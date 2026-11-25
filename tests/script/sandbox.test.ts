import type { QuickJSWASMModule } from 'quickjs-emscripten-core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type HostFunction,
  loadQuickJS,
  runScript,
  type ScriptRun,
} from '../../src/script/sandbox.js';

let qjs: QuickJSWASMModule;
beforeAll(async () => {
  qjs = await loadQuickJS();
});

const PRELUDE = `(() => {
  const H = globalThis.__host;
  const C = JSON.parse(globalThis.__config);
  delete globalThis.__host;
  delete globalThis.__config;
  globalThis.echo = (v) => JSON.parse(H.echo(JSON.stringify([v])));
  globalThis.fail = () => H.fail('[]');
  globalThis.config = C;
})();`;

function run(
  code: string,
  extra: Partial<ScriptRun> = {},
  host: Record<string, HostFunction> = {},
) {
  const calls: unknown[] = [];
  const outcome = runScript(qjs, {
    code,
    prelude: PRELUDE,
    config: JSON.stringify({ answer: 42 }),
    memoryBytes: 32 * 1024 * 1024,
    shouldInterrupt: () => false,
    host: {
      echo: (json) => {
        calls.push(JSON.parse(json));
        return JSON.stringify((JSON.parse(json) as unknown[])[0]);
      },
      fail: () => {
        throw new Error('host says no');
      },
      ...host,
    },
    ...extra,
  });
  return { outcome, calls };
}

describe('runScript', () => {
  it('completes a script and passes JSON both ways', () => {
    const { outcome, calls } = run(
      'if (echo({ a: [1, 2] }).a[1] !== 2 || config.answer !== 42) throw new Error("bad")',
    );
    expect(outcome).toEqual({ kind: 'completed' });
    expect(calls).toEqual([[{ a: [1, 2] }]]);
  });

  it('hides the host handles from the script', () => {
    expect(
      run('if (typeof __host !== "undefined" || typeof __config !== "undefined") throw 1').outcome,
    ).toEqual({
      kind: 'completed',
    });
  });

  it('reports an uncaught error at its line and column in the script', () => {
    expect(run('const a = 1;\n\n  null.x;').outcome).toEqual({
      kind: 'error',
      message: expect.stringMatching(/^TypeError: /),
      line: 3,
      column: 3,
    });
  });

  it('locates a host error at the script line that called it', () => {
    expect(run('\n\nfail();').outcome).toEqual({
      kind: 'error',
      message: 'host says no',
      line: 3,
      column: 1,
    });
  });

  it('locates a syntax error', () => {
    const { outcome } = run('const a = 1;\nconst b = ;');
    expect(outcome).toMatchObject({ kind: 'error', line: 2 });
    expect(outcome.kind === 'error' && outcome.message).toMatch(/^SyntaxError: /);
  });

  it('reports a thrown non-error as its value', () => {
    expect(run('throw "plain"').outcome).toEqual({ kind: 'error', message: 'plain' });
  });

  it('stops a runaway loop with an interrupt the script cannot catch', () => {
    let polls = 0;
    const { outcome } = run('try { while (true) {} } catch (e) {}', {
      shouldInterrupt: () => ++polls > 3,
    });
    expect(outcome).toEqual({ kind: 'interrupted' });
  });

  it('stops at the memory cap', () => {
    const { outcome } = run('const a = []; while (true) a.push(new Array(1e5).fill(1));', {
      memoryBytes: 16 * 1024 * 1024,
    });
    expect(outcome).toEqual({ kind: 'out_of_memory' });
  });

  it('reports deep recursion as a script error, not a host crash', () => {
    const { outcome } = run('function f(n) { return f(n + 1); }\nf(0);');
    expect(outcome).toMatchObject({ kind: 'error', message: expect.stringMatching(/^RangeError/) });
  });

  it('finishes async work and reports its rejection', () => {
    expect(run('(async () => { await 1; echo(1); })()').calls).toEqual([[1]]);
    expect(run('(async () => { await 1;\n throw new Error("late"); })()').outcome).toMatchObject({
      kind: 'error',
      message: 'late',
      line: 2,
    });
  });

  it('starts every run from a fresh global scope', () => {
    expect(run('globalThis.leak = 1').outcome.kind).toBe('completed');
    expect(run('if (typeof leak !== "undefined") throw new Error("leaked")').outcome).toEqual({
      kind: 'completed',
    });
  });
});
