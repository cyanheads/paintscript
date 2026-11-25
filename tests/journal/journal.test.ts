import { describe, expect, it } from 'vitest';
import {
  formatJournal,
  journalOf,
  parseJournal,
  replayJournal,
} from '../../src/journal/journal.js';
import { Painting } from '../../src/painting/painting.js';
import type { RgbImage } from '../../src/render/render.js';
import { VERSION } from '../../src/version.js';

const PASSES = [
  "brush('b', { type: 'filbert', width: 14 }); palette('ochre', mix(['#c8902e', 3], '#3a2a1a')); for (let i = 0; i < 5; i++) stroke({ path: [[10, 15 + i * 16], [150, 20 + i * 15 + rand(-4, 4)]], brush: 'b', color: 'ochre' });",
  "dry(); stroke({ path: [[20, 80], [80, 20], [140, 80]], brush: { type: 'soft', width: 10 }, color: '#f1ece0', paint: 'semi_opaque' });",
];

const look = (p: Painting) => Buffer.from(p.image().rgb);

async function painted(reference?: RgbImage) {
  const p = await Painting.create({
    width: 160,
    height: 100,
    seed: 21,
    texture: 'coarse_weave',
    ground: { r: 0.42, g: 0.4, b: 0.37 },
    ...(reference && { reference: { image: reference } }),
  });
  for (const [i, code] of PASSES.entries()) p.run(code, { label: `pass ${i + 1}` });
  return p;
}

const grey = (w: number, h: number, v: number): RgbImage => ({
  width: w,
  height: h,
  rgb: new Uint8Array(w * h * 3).fill(v),
});

describe('journal', () => {
  it('writes a painting as JSON Lines and reads it back', async () => {
    const journal = journalOf(await painted());
    expect(journal.header).toMatchObject({
      type: 'paintscript',
      version: 1,
      engine: VERSION,
      width: 160,
      height: 100,
      seed: 21,
      texture: 'coarse_weave',
      pxPerMm: 4,
    });
    expect(journal.runs.map((r) => [r.run, r.label, r.strokes])).toEqual([
      [1, 'pass 1', 5],
      [2, 'pass 2', 1],
    ]);
    const text = formatJournal(journal);
    expect(text.split('\n')).toHaveLength(4);
    expect(parseJournal(text)).toEqual(journal);
  });

  it('replays to the same painting, and leaves out reverted runs', async () => {
    const p = await painted();
    const replayed = await replayJournal(parseJournal(formatJournal(journalOf(p))));
    expect(look(replayed)).toEqual(look(p));
    expect(replayed.palette).toEqual(p.palette);
    p.run("stroke({ path: [[0, 0], [160, 100]], brush: 'b', color: '#101010' })");
    p.revert(2);
    expect(journalOf(p).runs).toHaveLength(2);
  });

  it('names the line and the field of a journal it cannot read', () => {
    const good =
      '{"type":"paintscript","version":1,"engine":"0.1.0","width":10,"height":10,"ground":{"hex":"#000000","bands":[0,0,0,0,0,0,0,0]},"texture":"smooth","seed":1,"pxPerMm":4}';
    const run = (n: number) => `{"run":${n},"code":"","strokes":0,"brushwork":0}`;
    const cases: [string, RegExp][] = [
      ['', /line 1: the journal is empty/],
      ['not json', /line 1: not valid JSON/],
      [good.replace('"seed":1', '"seed":-1'), /line 1: seed: /],
      [`${good}\n${run(2)}`, /line 2: run must be 1 \(got 2\)/],
      [`${good}\n${run(1)}\n{"run":2}`, /line 3: code: /],
    ];
    for (const [text, message] of cases)
      expect(() => parseJournal(text)).toThrow(
        expect.objectContaining({
          code: 'invalid_journal',
          message: expect.stringMatching(message),
        }),
      );
  });

  it('replays against the reference it names, and no other', async () => {
    const ref = grey(80, 50, 140);
    const journal = journalOf(await painted(ref));
    expect(journal.header.reference).toMatchObject({ width: 80, height: 50, fit: 'cover' });
    await expect(replayJournal(journal)).rejects.toMatchObject({ code: 'no_reference' });
    await expect(replayJournal(journal, { reference: grey(80, 50, 141) })).rejects.toMatchObject({
      code: 'reference_mismatch',
    });
    await expect(replayJournal(journal, { reference: ref })).resolves.toBeInstanceOf(Painting);
    await expect(
      replayJournal(journalOf(await painted()), { reference: ref }),
    ).rejects.toMatchObject({ code: 'reference_mismatch' });
  });
});
