/**
 * @fileoverview A stroke's path: a Catmull-Rom spline (or a polyline with `corners`)
 * through the control points, resampled at 1 px arc-length steps with the pressure
 * and unit tangent at each sample.
 * @module brush/path
 */

/** One resampled point: position, pressure, unit tangent, arc length from the start. */
export interface PathSample {
  p: number;
  s: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
}

/** A control point: `[x, y]` or `[x, y, pressure]`. */
export type PathPoint = readonly number[];

/** Resample a path at 1 px steps. Fewer than 2 samples come back for a path with no length. */
export function resamplePath(
  path: readonly PathPoint[],
  basePressure: number,
  corners: boolean,
): PathSample[] {
  const P = path.map((q) => ({ x: q[0]!, y: q[1]!, p: q[2] ?? basePressure }));
  const dense: { p: number; x: number; y: number }[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]!;
    const p1 = P[i]!;
    const p2 = P[i + 1]!;
    const p3 = P[Math.min(P.length - 1, i + 2)]!;
    const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 2));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) =>
        corners
          ? b + (c - b) * t
          : 0.5 *
            (2 * b +
              (-a + c) * t +
              (2 * a - 5 * b + 4 * c - d) * t2 +
              (-a + 3 * b - 3 * c + d) * t3);
      dense.push({
        x: cr(p0.x, p1.x, p2.x, p3.x),
        y: cr(p0.y, p1.y, p2.y, p3.y),
        p: p1.p + (p2.p - p1.p) * t,
      });
    }
  }
  dense.push(P[P.length - 1]!);
  const out: PathSample[] = [];
  let acc = 0;
  let next = 0;
  for (let i = 0; i < dense.length - 1; i++) {
    const a = dense[i]!;
    const b = dense[i + 1]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d === 0) continue;
    const tx = (b.x - a.x) / d;
    const ty = (b.y - a.y) / d;
    while (next <= acc + d) {
      const t = (next - acc) / d;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        p: a.p + (b.p - a.p) * t,
        tx,
        ty,
        s: next,
      });
      next += 1;
    }
    acc += d;
  }
  return out;
}
