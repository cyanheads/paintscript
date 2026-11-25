import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { main } from '../../src/cli/main.js';
import { decodePng } from '../../src/image/png.js';
import { parseJournal } from '../../src/journal/journal.js';
import { VOCABULARY_DTS } from '../../src/script/vocabulary-dts.js';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'paintscript-cli-'));
  await writeFile(
    join(dir, 'a.js'),
    "brush('b', { type: 'flat', width: 12 });\nstroke({ path: [[10, 20], [110, 30]], brush: 'b', color: '#2f5fa8' });\nlog('first');",
  );
  await writeFile(
    join(dir, 'b.js'),
    "stroke({ path: [[20, 60], [100, 70]], brush: 'b', color: '#c0392b' });",
  );
  await writeFile(
    join(dir, 'bad.js'),
    "stroke({ path: [[1, 1]], brush: 'b', color: '#fff' });\nstroke({ path: [[1, 1]], brush: 'nope' });",
  );
});
afterAll(async () => {
  await rm(dir, { recursive: true });
});

async function cli(...argv: string[]) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => (out += t), err: (t) => (err += t) });
  return { code, out, err };
}

describe('paintscript', () => {
  it('prints the vocabulary', async () => {
    expect(await cli('vocabulary')).toEqual({ code: 0, out: VOCABULARY_DTS, err: '' });
  });

  it('runs scripts to a painting, a journal, and a timelapse, and replays the journal exactly', async () => {
    const f = (n: string) => join(dir, n);
    const run = await cli(
      'run',
      f('a.js'),
      f('b.js'),
      '--out',
      f('p.png'),
      '--journal',
      f('j.jsonl'),
      '--timelapse',
      f('t.gif'),
      '--width',
      '120',
      '--height',
      '80',
      '--seed',
      '9',
      '--texture',
      'smooth',
      '--surface',
      'matte',
    );
    expect(run.err).toBe('');
    expect(run.code).toBe(0);
    expect(run.out).toContain('canvas 120×80, seed 9');
    expect(run.out).toContain('  first');
    const png = decodePng(await readFile(f('p.png')));
    expect([png.width, png.height]).toEqual([120, 80]);
    expect(parseJournal(await readFile(f('j.jsonl'), 'utf8')).runs.map((r) => r.label)).toEqual([
      'a.js',
      'b.js',
    ]);
    expect((await readFile(f('t.gif'))).subarray(0, 6).toString()).toBe('GIF89a');
    const replay = await cli('replay', f('j.jsonl'), '--out', f('q.png'));
    expect(replay.code).toBe(0);
    expect(await readFile(f('q.png'))).toEqual(await readFile(f('p.png')));
  });

  it('saves show() views with --views, and says so when they are not saved', async () => {
    await writeFile(
      join(dir, 'look.js'),
      "show(undefined, { mode: 'value', maxSide: 40 }); show({ x: 0, y: 0, w: 60, h: 40 }, { mode: 'squint', maxSide: 30 });",
    );
    const size = ['--width', '120', '--height', '80'];
    const saved = await cli(
      'run',
      join(dir, 'look.js'),
      '--out',
      join(dir, 'look.png'),
      '--views',
      join(dir, 'views'),
      ...size,
    );
    expect(saved.code).toBe(0);
    expect(saved.out).toContain(`view ${join(dir, 'views', 'look-1-value.png')}`);
    const squint = decodePng(await readFile(join(dir, 'views', 'look-2-squint.png')));
    expect(Math.max(squint.width, squint.height)).toBe(30);
    const unsaved = await cli('run', join(dir, 'look.js'), '--out', join(dir, 'look.png'), ...size);
    expect(unsaved.out).toContain('2 show() views not saved; pass --views <dir>');
  });

  it('stops at a script error with the file, line, and column', async () => {
    const r = await cli(
      'run',
      join(dir, 'a.js'),
      join(dir, 'bad.js'),
      '--out',
      join(dir, 'x.png'),
      '--width',
      '120',
      '--height',
      '80',
    );
    expect(r.code).toBe(1);
    expect(r.err).toContain(
      `${join(dir, 'bad.js')}:2:1: stroke(): no brush named "nope"; defined: b`,
    );
  });

  it('explains what is missing or wrong', async () => {
    expect(await cli()).toMatchObject({ code: 2 });
    expect((await cli('run', join(dir, 'a.js'))).err).toContain('run needs --out');
    expect((await cli('run', join(dir, 'a.js'), '--out', 'x.png', '--colour', 'red')).code).toBe(2);
    expect(
      (await cli('run', join(dir, 'a.js'), '--out', 'x.png', '--width', 'wide')).err,
    ).toContain('--width must be a whole number');
    expect((await cli('run', join(dir, 'missing.js'), '--out', 'x.png')).err).toContain(
      'no such file',
    );
    expect((await cli('paint')).err).toContain('unknown command "paint"');
  });
});
