import { describe, expect, it } from 'vitest';
import { journalOf } from '../../src/journal/journal.js';
import { Painting } from '../../src/painting/painting.js';
import { renderTimelapse } from '../../src/timelapse/timelapse.js';

async function journal() {
  const p = await Painting.create({ width: 200, height: 120, seed: 4 });
  p.run(
    "for (let i = 0; i < 12; i++) stroke({ path: [[10, 10 + i * 9], [190, 14 + i * 9]], brush: { type: 'flat', width: 10 }, color: mix(['#2b4f8c', 12 - i], ['#e9dfc8', i + 1]) });",
  );
  p.run(
    "for (let i = 0; i < 40; i++) stroke({ path: [[rand(10, 190), rand(10, 110)]], brush: { type: 'round', width: 6 }, color: '#c94f2a' });",
  );
  return journalOf(p);
}

describe('renderTimelapse', () => {
  it('films a journal as a looping GIF sized to the canvas aspect', async () => {
    const film = await renderTimelapse(await journal(), {
      width: 100,
      frames: 20,
      fps: 10,
      hold: 2,
    });
    expect(new TextDecoder().decode(film.bytes.subarray(0, 6))).toBe('GIF89a');
    expect([film.width, film.height]).toEqual([100, 60]);
    expect(film.frames).toBeGreaterThan(10);
    expect(film.frames).toBeLessThanOrEqual(21);
    // first frame 0.4 s, painting frames 0.1 s each, the finished painting held 2 s
    expect(film.durationMs).toBe(400 + (21 - 2) * 100 + 2000);
  });

  it('films the painting under its own surface', async () => {
    const j = await journal();
    const varnished = { ...j, header: { ...j.header, surface: 'varnish' as const } };
    const options = { width: 100, frames: 4 };
    expect((await renderTimelapse(varnished, options)).bytes).not.toEqual(
      (await renderTimelapse(j, options)).bytes,
    );
  });

  it('rejects options out of range', async () => {
    const j = await journal();
    for (const o of [{ width: 8 }, { frames: 1 }, { frames: 2.5 }, { fps: 0 }, { hold: 61 }])
      await expect(renderTimelapse(j, o)).rejects.toMatchObject({ code: 'invalid_options' });
  });
});
