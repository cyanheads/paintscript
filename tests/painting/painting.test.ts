import { describe, expect, it } from 'vitest';
import { PaintscriptError } from '../../src/errors.js';
import { Painting, type PaintingOptions, type RunResult } from '../../src/painting/painting.js';

const make = (o: PaintingOptions = {}) =>
  Painting.create({ width: 160, height: 100, seed: 11, ...o });

/** What the painting looks like, exactly: its full-resolution render. */
const look = (p: Painting) => Buffer.from(p.image().rgb);

const SCENE = `
brush('wide', { type: 'flat', width: 18 });
palette('sky', mix(['#2f5fa8', 2], '#f2efe6'));
stroke({ path: [[10, 30], [80, 24], [150, 34]], brush: 'wide', color: 'sky' });
for (let i = 0; i < 6; i++)
  stroke({ path: [[20 + i * 22 + rand(-3, 3), 60], [30 + i * 22, 92]], brush: { type: 'round', width: 7 }, color: '#b8452b' });
`;

function scriptError(r: RunResult) {
  expect(r.status).toBe('script_error');
  return r.status === 'script_error' ? r.error : undefined;
}

describe('Painting.run', () => {
  it('commits a completed run and reports what it did', async () => {
    const p = await make();
    const r = p.run(SCENE, { label: 'block-in' });
    expect(r.status).toBe('completed');
    expect(r).toMatchObject({ checkpoint: 1, previousCheckpoint: 0, dryRun: false });
    expect(r.stats).toMatchObject({ strokes: 7, emptyStrokes: 0, dries: 0 });
    expect(r.stats.wetShare).toBeGreaterThan(0.1);
    expect(r.stats.covered!.p50).toBeGreaterThan(100);
    expect(r.views).toHaveLength(1);
    expect(p.history).toEqual([
      { code: SCENE, label: 'block-in', strokes: 7, coverage: expect.any(Number) },
    ]);
    expect(Object.keys(p.brushes)).toEqual(['wide']);
    expect(p.palette.sky!.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('leaves no trace of a run that fails, and names the line', async () => {
    const p = await make();
    p.run(SCENE);
    const before = look(p);
    const err = scriptError(
      p.run(
        "brush('other', { type: 'soft', width: 9 });\nstroke({ path: [[5, 5], [150, 90]], brush: 'other', color: '#ffffff' });\nstroke({ path: [[1, 1]], brush: 'missing' });",
      ),
    );
    expect(err).toEqual({
      message: 'stroke(): no brush named "missing"; defined: wide, other',
      line: 3,
      column: 1,
    });
    expect(p.checkpoint).toBe(1);
    expect(look(p)).toEqual(before);
    expect(Object.keys(p.brushes)).toEqual(['wide']);
  });

  it('reports a dry run exactly as the real run lands, then rolls it back', async () => {
    const p = await make();
    const blank = look(p);
    const dry = p.run(SCENE, { dryRun: true });
    expect(dry).toMatchObject({ status: 'completed', dryRun: true, checkpoint: 0 });
    expect(look(p)).toEqual(blank);
    expect(p.brushes).toEqual({});
    const real = p.run(SCENE);
    expect(real.stats.covered).toEqual(dry.stats.covered);
    expect(real.views[0]!.image.rgb).toEqual(dry.views[0]!.image.rgb);
  });

  it('refuses to run when the painting is not at the expected checkpoint', async () => {
    const p = await make();
    p.run(SCENE);
    expect(() => p.run(SCENE, { expectCheckpoint: 0 })).toThrow(
      expect.objectContaining({ code: 'canvas_changed' }),
    );
    expect(p.run(SCENE, { expectCheckpoint: 1 }).checkpoint).toBe(2);
  });

  it('replays exactly: same seed, same scripts, same painting', async () => {
    const a = await make();
    const b = await make();
    for (const p of [a, b]) {
      p.run(SCENE);
      p.run("stroke({ path: [[rand(0, 160), rand(0, 100)]], brush: 'wide', color: '#e8c547' });");
    }
    expect(look(a)).toEqual(look(b));
    const c = await make({ seed: 12 });
    c.run(SCENE);
    expect(look(c)).not.toEqual(look(a));
  });

  it('gives each run its own rand() stream and every run the same noise() field', async () => {
    const p = await make();
    const a = p.run('log(rand(), noise(3.3, 4.4))');
    const b = p.run('log(rand(), noise(3.3, 4.4))');
    const [ra, na] = a.log.trim().split(' ');
    const [rb, nb] = b.log.trim().split(' ');
    expect(ra).not.toBe(rb);
    expect(na).toBe(nb);
  });

  it('keeps brushes and palette colors for later runs', async () => {
    const p = await make();
    p.run(SCENE);
    const r = p.run(
      "stroke({ path: [[10, 50], [150, 50]], brush: 'wide', color: 'sky' }); log(palette('sky').hex)",
    );
    expect(r.status).toBe('completed');
    expect(r.log).toBe(`${p.palette.sky!.hex}\n`);
  });

  it('replaces the clock and Math.random with errors that point to rand()', async () => {
    const p = await make();
    for (const code of ['Math.random()', 'Date.now()', 'new Date()'])
      expect(scriptError(p.run(code))!.message).toMatch(/use rand\(\)/);
    expect(p.run('if (typeof performance !== "undefined") throw new Error("clock")').status).toBe(
      'completed',
    );
  });

  it('rejects bad arguments with messages that name the field', async () => {
    const p = await make();
    const cases: [string, RegExp][] = [
      ["stroke({ path: [[1, 2]], brush: 'nope' })", /no brush named "nope"; none are defined yet/],
      [
        "stroke({ path: [[1, 2]], brush: { type: 'flat', width: 4 }, colour: '#fff' })",
        /unknown option "colour"/,
      ],
      [
        "stroke({ path: [[1, 2]], brush: { type: 'flat', width: 4 }, load: 2 })",
        /load must be a number from 0 to 1 \(got 2\)/,
      ],
      [
        "stroke({ path: [[1, NaN]], brush: { type: 'flat', width: 4 } })",
        /path\[0\] must be \[x, y\]/,
      ],
      ["stroke({ path: [], brush: { type: 'flat', width: 4 } })", /path must be an array/],
      [
        "stroke({ path: [[1, 2]], brush: { type: 'mop', width: 4 } })",
        /type must be one of flat, round/,
      ],
      [
        "stroke({ path: [[1, 2]], brush: { type: 'flat', width: 4 }, color: 'teal' })",
        /no palette color named "teal"/,
      ],
      [
        "stroke({ path: [[1, 2]], brush: { type: 'flat', width: 4 }, color: '#12' })",
        /color: "#12" is not a hex color/,
      ],
      [
        "stroke({ path: [[0, 0], [5000, 0]], brush: { type: 'flat', width: 4 } })",
        /more than a canvas width/,
      ],
      ["mix(['#fff', 0])", /\[color, parts > 0\]/],
      ['dry({ x: 500, y: 500, w: 10, h: 10 })', /has no pixels on the 160×100 canvas/],
      ["show(undefined, { mode: 'xray' })", /mode must be one of color, squint/],
      ['diff()', /needs a reference image/],
      ["palette('#abc', '#fff')", /cannot start with "#"/],
      ["JSON.stringify = () => 'nope'; at(1, 2)", /did not arrive as a JSON array/],
    ];
    for (const [code, message] of cases) expect(scriptError(p.run(code))!.message).toMatch(message);
  });

  it('caps views per run and renders each as the canvas looked at that point', async () => {
    const p = await make({ limits: { views: 2 } });
    const r = p.run(
      "show(); stroke({ path: [[10, 50], [150, 50]], brush: { type: 'flat', width: 30 }, color: '#202020' }); show({ x: 0, y: 0, w: 80, h: 100 }, { mode: 'value', maxSide: 40 }); show(); show();",
    );
    expect(r.views).toHaveLength(2);
    expect(r.viewsDropped).toBe(2);
    expect(r.views[1]).toMatchObject({ mode: 'value', region: { x: 0, y: 0, w: 80, h: 100 } });
    expect(Math.max(r.views[1]!.image.width, r.views[1]!.image.height)).toBe(40);
    expect(r.views[0]!.image.rgb).not.toEqual(p.view().image.rgb);
  });

  it('keeps log lines up to the byte cap and says when it dropped more', async () => {
    const p = await make({ limits: { logBytes: 20 } });
    const r = p.run("log('one', { a: 1 }); console.log('two'); log('x'.repeat(30));");
    expect(r.log).toBe('one {"a":1}\ntwo\n');
    expect(r.logTruncated).toBe(true);
  });

  describe('budgets', () => {
    it('stops at the stroke cap and rolls back', async () => {
      const p = await make({ limits: { strokes: 3 } });
      const blank = look(p);
      const r = p.run(
        "for (let i = 0; i < 10; i++) stroke({ path: [[10 + i * 10, 10], [10 + i * 10, 90]], brush: { type: 'round', width: 4 }, color: '#000000' });",
      );
      expect(r).toMatchObject({ status: 'budget_exceeded', limit: 'strokes', checkpoint: 0 });
      expect(look(p)).toEqual(blank);
    });

    it('stops a script that runs past its time', async () => {
      const p = await make({ limits: { timeMs: 30 } });
      expect(p.run('while (true) {}')).toMatchObject({ status: 'budget_exceeded', limit: 'time' });
    });

    it('stops a script past its memory', async () => {
      const p = await make({ limits: { memoryBytes: 8 * 1024 * 1024 } });
      expect(p.run('const a = []; while (true) a.push(new Array(1e5).fill(1));')).toMatchObject({
        status: 'budget_exceeded',
        limit: 'memory',
      });
    });

    it('stops when the caller cancels', async () => {
      const p = await make();
      expect(p.run('while (true) {}', { cancelled: () => true }).status).toBe('cancelled');
    });
  });
});

describe('Painting.revert', () => {
  const PASSES = [
    SCENE,
    "dry(); stroke({ path: [[10, 70], [150, 20]], brush: { type: 'knife', width: 16 }, color: '#f2efe6', load: 1 });",
    "brush('fine', { type: 'round', width: 3 }); stroke({ path: [[20, 15], [140, 85]], brush: 'fine', color: 'sky' });",
  ];

  it('walks back through saved tiles, restoring names with the pixels', async () => {
    const p = await make();
    const looks: Buffer[] = [look(p)];
    for (const code of PASSES) {
      p.run(code);
      looks.push(look(p));
    }
    expect(p.revert(1)).toMatchObject({ checkpoint: 1, runsRemoved: 2, replayed: false });
    expect(look(p)).toEqual(looks[1]);
    expect(Object.keys(p.brushes)).toEqual(['wide']);
    expect(p.checkpoint).toBe(1);
    expect(p.revert(0).region).not.toBeNull();
    expect(look(p)).toEqual(looks[0]);
  });

  it('replays the kept scripts when their tiles were dropped, to the same painting', async () => {
    const tight = await make({ limits: { undoBytes: 1 } });
    const reference = await make();
    for (const code of PASSES) tight.run(code);
    reference.run(PASSES[0]!);
    expect(tight.revert(1)).toMatchObject({ checkpoint: 1, runsRemoved: 2, replayed: true });
    expect(look(tight)).toEqual(look(reference));
    // the next run continues the same streams as if the reverted runs never happened
    tight.run(PASSES[2]!);
    reference.run(PASSES[2]!);
    expect(look(tight)).toEqual(look(reference));
  });

  it('rejects a checkpoint that does not exist', async () => {
    const p = await make();
    p.run(SCENE);
    for (const bad of [-1, 2, 0.5])
      expect(() => p.revert(bad)).toThrow(
        expect.objectContaining({ code: 'checkpoint_not_found' }),
      );
    expect(p.revert(1)).toMatchObject({ runsRemoved: 0, region: null });
  });
});

describe('Painting with a reference', () => {
  const ref = (() => {
    const width = 80;
    const height = 50;
    const rgb = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 3;
        rgb[o] = x < 40 ? 200 : 30;
        rgb[o + 1] = 60;
        rgb[o + 2] = x < 40 ? 40 : 160;
      }
    return { width, height, rgb };
  })();

  it('fits the canvas to the reference aspect and exposes it to scripts', async () => {
    const p = await Painting.create({ width: 160, reference: { image: ref }, seed: 3 });
    expect(p.height).toBe(100);
    expect(p.reference).toMatchObject({ width: 80, height: 50, fit: 'cover' });
    expect(p.reference!.sha256).toMatch(/^[0-9a-f]{64}$/);
    const r = p.run(
      "const c = ref.at(20, 50); const e = ref.edge(80, 50); const before = diff().mean; stroke({ path: [[5, 50], [75, 50]], brush: { type: 'flat', width: 40 }, color: c, load: 1 }); log(c.hex, Math.abs(e.angle).toFixed(2), before > diff().mean);",
    );
    expect(r.status).toBe('completed');
    const [hex, angle, closer] = r.log.trim().split(' ');
    expect(hex).toMatch(/^#c/);
    expect(angle).toBe((Math.PI / 2).toFixed(2));
    expect(closer).toBe('true');
    expect(p.diff().worst.length).toBeGreaterThan(0);
  });

  it('runs a script without a reference with ref null and diff refused', async () => {
    const p = await make();
    expect(p.run('if (ref !== null) throw new Error("ref")').status).toBe('completed');
    expect(() => p.diff()).toThrow(PaintscriptError);
  });
});

describe('Painting.create', () => {
  it('rejects options it cannot use', async () => {
    const bad: [PaintingOptions, string][] = [
      [{ width: 10 }, 'invalid_options'],
      [{ width: 5000, height: 5000 }, 'invalid_options'],
      [{ seed: -1 }, 'invalid_options'],
      [{ texture: 'burlap' as never }, 'invalid_options'],
      [{ ground: 'beige' }, 'invalid_color'],
      [{ limits: { timeMs: 0 } }, 'invalid_options'],
      [{ reference: { image: { width: 2, height: 2, rgb: new Uint8Array(3) } } }, 'invalid_image'],
    ];
    for (const [o, code] of bad) await expect(Painting.create(o)).rejects.toMatchObject({ code });
  });
});
