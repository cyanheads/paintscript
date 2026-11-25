/**
 * @fileoverview What a run's strokes add up to: percentiles of their measurements,
 * repetition statistics that show a mechanical fill, and at most three observations
 * stated as facts with numbers, never as advice.
 * @module painting/run-review
 */

/**
 * A stroke's share of the work of making the painting, √(length × width) with a dab
 * counted as a short stroke: a timelapse spaces its frames by this, so a passage of
 * small dabs gets frames in proportion and a few broad sweeps don't take over.
 */
export function brushwork(length: number, width: number): number {
  return Math.sqrt(Math.max(2, length || width * 0.45) * width);
}

/** One laid stroke as the review sees it. */
export interface StrokeRecord {
  /** Direction from the first path point to the last, radians; null for a dab without one or a closed path. */
  angle: number | null;
  covered: number;
  dab: boolean;
  gaps: number;
  length: number;
  mixed: number;
  /** Brush width in px. */
  width: number;
}

/** 10th, 50th, and 90th percentiles. */
export interface Spread {
  p10: number;
  p50: number;
  p90: number;
}

/** Percentiles of the per-stroke measurements; null with no strokes. */
export interface StrokeSpreads {
  covered: Spread | null;
  gaps: Spread | null;
  mixed: Spread | null;
}

/** Repetition statistics over a run's strokes. */
export interface RunReview {
  /** Circular standard deviation of stroke direction (mod 180°) in degrees; null with fewer than 2 directed strokes. */
  angleSpread: number | null;
  /** Path length of the strokes that are not dabs. */
  length: Spread | null;
  /**
   * Share of strokes in the single most common (length, angle, width) bin: lengths and
   * widths in steps of 20%, angles in steps of 10°, dabs as their own length.
   */
  repeatShare: number | null;
  /** Share of non-dab strokes shorter than 1.5× their brush width. */
  shortShare: number | null;
  width: Spread | null;
}

/** Nearest-rank percentiles of `values`; null when empty. */
export function spread(values: readonly number[]): Spread | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]!;
  return { p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}

/** Percentiles of covered, gaps, and mixed. */
export function strokeSpreads(strokes: readonly StrokeRecord[]): StrokeSpreads {
  return {
    covered: spread(strokes.map((s) => s.covered)),
    gaps: spread(strokes.map((s) => s.gaps)),
    mixed: spread(strokes.map((s) => s.mixed)),
  };
}

/** Repetition statistics. */
export function reviewStrokes(strokes: readonly StrokeRecord[]): RunReview {
  const lines = strokes.filter((s) => !s.dab);
  const directed = strokes.filter((s) => s.angle !== null);
  let angleSpread: number | null = null;
  if (directed.length >= 2) {
    // axial directions: double the angle so 0° and 180° coincide, then halve the spread
    let c = 0;
    let si = 0;
    for (const s of directed) {
      c += Math.cos(2 * s.angle!);
      si += Math.sin(2 * s.angle!);
    }
    const R = Math.min(1, Math.hypot(c, si) / directed.length);
    angleSpread = R < 1e-9 ? 90 : ((Math.sqrt(-2 * Math.log(R)) / 2) * 180) / Math.PI;
  }
  let repeatShare: number | null = null;
  if (strokes.length >= 2) {
    const bins = new Map<string, number>();
    const log12 = (v: number) => Math.round(Math.log(Math.max(0.5, v)) / Math.log(1.2));
    for (const s of strokes) {
      const len = s.dab ? 'dab' : log12(s.length);
      const ang = s.angle === null ? '-' : Math.round(((s.angle * 180) / Math.PI + 180) / 10) % 18;
      const key = `${len}|${ang}|${log12(s.width)}`;
      bins.set(key, (bins.get(key) ?? 0) + 1);
    }
    repeatShare = Math.max(...bins.values()) / strokes.length;
  }
  return {
    length: spread(lines.map((s) => s.length)),
    width: spread(strokes.map((s) => s.width)),
    angleSpread,
    repeatShare,
    shortShare: lines.length
      ? lines.filter((s) => s.length < 1.5 * s.width).length / lines.length
      : null,
  };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Facts worth a second look, in a fixed order, at most three: one-bin repetition,
 * strokes mostly made of wet paint underneath, strokes that laid nothing, one
 * direction, short strokes, bare footprints. Each needs enough strokes to mean something.
 */
export function observe(strokes: readonly StrokeRecord[], review: RunReview): string[] {
  const n = strokes.length;
  const out: string[] = [];
  if (review.repeatShare !== null && n >= 20 && review.repeatShare >= 0.5)
    out.push(`${pct(review.repeatShare)} of ${n} strokes repeat one length, angle, and width`);
  const mixedMost = strokes.filter((s) => s.mixed > 0.5).length;
  if (n >= 10 && mixedMost >= 0.25 * n)
    out.push(`${mixedMost} of ${n} strokes took over half their color from wet paint underneath`);
  const empty = strokes.filter((s) => s.covered === 0).length;
  if (empty > 0) out.push(`${empty} of ${n} strokes laid no paint on the canvas`);
  if (review.angleSpread !== null && n >= 20 && review.angleSpread < 10)
    out.push(`stroke directions across ${n} strokes spread ${review.angleSpread.toFixed(1)}°`);
  const lines = strokes.filter((s) => !s.dab).length;
  if (review.shortShare !== null && lines >= 20 && review.shortShare >= 0.6)
    out.push(
      `${pct(review.shortShare)} of ${lines} strokes are shorter than 1.5× their brush width`,
    );
  const gaps = spread(strokes.map((s) => s.gaps));
  if (gaps && n >= 10 && gaps.p50 > 0.4)
    out.push(`the median stroke left ${pct(gaps.p50)} of its footprint bare`);
  return out.slice(0, 3);
}
