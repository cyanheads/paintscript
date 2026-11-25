/**
 * @fileoverview Runs one script in a fresh QuickJS-ng (WebAssembly) runtime: no I/O,
 * no timers, a memory cap, a stack cap, and an interrupt the caller polls while the
 * script runs. Host functions cross the boundary as JSON strings, and an uncaught
 * error comes back with its line and column in the script's own source.
 * @module script/sandbox
 */

import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSWASMModule,
} from 'quickjs-emscripten-core';

/** File name the script is evaluated under; error locations are read from its stack frames. */
const SCRIPT_FILE = 'passage.js';
const PRELUDE_FILE = 'prelude.js';
const STACK_BYTES = 512 * 1024;

let quickjs: Promise<QuickJSWASMModule> | undefined;

/** The WebAssembly interpreter, compiled once per process. */
export function loadQuickJS(): Promise<QuickJSWASMModule> {
  // a dynamic import: the variant's types describe its CommonJS build, and the loader
  // unwraps whichever module shape the runtime resolves
  quickjs ??= newQuickJSWASMModuleFromVariant(import('@jitl/quickjs-ng-wasmfile-release-sync'));
  return quickjs;
}

/** A host function: one JSON array of arguments in, a JSON value (or nothing) out. May throw. */
export type HostFunction = (argsJson: string) => string | undefined;

/** One script run. */
export interface ScriptRun {
  /** The script. */
  code: string;
  /** Exposed to the prelude as `globalThis.__config`, a JSON string. */
  config: string;
  /** Exposed to the prelude as the functions of `globalThis.__host`. */
  host: Readonly<Record<string, HostFunction>>;
  /** Guest heap cap in bytes. */
  memoryBytes: number;
  /** Source evaluated before the script, in the same global scope. */
  prelude: string;
  /** Polled while the script runs; returning true stops it with an error it cannot catch. */
  shouldInterrupt: () => boolean;
}

/** How a script run ended. */
export type ScriptOutcome =
  | { kind: 'completed' }
  | { column?: number; kind: 'error'; line?: number; message: string }
  | { kind: 'interrupted' }
  | { kind: 'out_of_memory' };

/** Run a script to completion, an uncaught error, an interrupt, or the memory cap. */
export function runScript(qjs: QuickJSWASMModule, run: ScriptRun): ScriptOutcome {
  const rt = qjs.newRuntime();
  rt.setMemoryLimit(run.memoryBytes);
  rt.setMaxStackSize(STACK_BYTES);
  const vm = rt.newContext();
  try {
    installHost(vm, run);
    const prelude = vm.evalCode(run.prelude, PRELUDE_FILE);
    if (prelude.error) {
      const dumped: unknown = vm.dump(prelude.error);
      prelude.error.dispose();
      throw new Error(`prelude failed: ${JSON.stringify(dumped)}`);
    }
    prelude.value.dispose();

    // armed only for the script, so the prelude always finishes
    let interrupted = false;
    rt.setInterruptHandler(() => {
      if (run.shouldInterrupt()) interrupted = true;
      return interrupted;
    });
    const result = vm.evalCode(run.code, SCRIPT_FILE);
    if (result.error) return failure(vm, result.error, interrupted);
    const rejection = settle(vm, result.value);
    if (rejection) return failure(vm, rejection, interrupted);
    return interrupted ? { kind: 'interrupted' } : { kind: 'completed' };
  } finally {
    vm.dispose();
    rt.dispose();
  }
}

function installHost(vm: QuickJSContext, run: ScriptRun) {
  const host = vm.newObject();
  for (const [name, fn] of Object.entries(run.host)) {
    const f = vm.newFunction(name, (args) => {
      const out = fn(vm.getString(args));
      return out === undefined ? vm.undefined : vm.newString(out);
    });
    vm.setProp(host, name, f);
    f.dispose();
  }
  vm.setProp(vm.global, '__host', host);
  host.dispose();
  const config = vm.newString(run.config);
  vm.setProp(vm.global, '__config', config);
  config.dispose();
}

/**
 * Run pending jobs so an async script finishes, and return the rejection if the
 * script's completion value is a promise that rejected. Disposes `value`.
 */
function settle(vm: QuickJSContext, value: QuickJSHandle): QuickJSHandle | undefined {
  try {
    const jobs = vm.runtime.executePendingJobs();
    if (jobs.error) return jobs.error;
    if (vm.typeof(value) !== 'object') return undefined;
    const state = vm.getPromiseState(value);
    if (state.type === 'rejected') return state.error;
    if (state.type === 'fulfilled' && !state.notAPromise) state.value.dispose();
    return undefined;
  } finally {
    value.dispose();
  }
}

/** Classify an uncaught error and dispose it. */
function failure(vm: QuickJSContext, error: QuickJSHandle, interrupted: boolean): ScriptOutcome {
  const dumped: unknown = vm.dump(error);
  error.dispose();
  if (interrupted) return { kind: 'interrupted' };
  if (typeof dumped !== 'object' || dumped === null)
    return { kind: 'error', message: typeof dumped === 'string' ? dumped : JSON.stringify(dumped) };
  const { name, message, stack } = dumped as { message?: unknown; name?: unknown; stack?: unknown };
  // QuickJS reports its heap cap only as this InternalError; nothing else carries the reason
  if (name === 'InternalError' && message === 'out of memory') return { kind: 'out_of_memory' };
  const text = typeof message === 'string' ? message : JSON.stringify(dumped);
  const at = typeof stack === 'string' ? /passage\.js:(\d+):(\d+)/.exec(stack) : null;
  return {
    kind: 'error',
    // a typed error keeps its name (TypeError, RangeError); a plain or vocabulary error is just its message
    message:
      typeof name === 'string' && name !== 'Error' && name !== 'PaintscriptError'
        ? `${name}: ${text}`
        : text,
    ...(at ? { line: Number(at[1]), column: Number(at[2]) } : {}),
  };
}
