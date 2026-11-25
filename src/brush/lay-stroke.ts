/**
 * @fileoverview The stroke kernel: a footprint of bristle strands swept along the
 * resampled path, or pressed once for a dab. Each strand carries its own reservoir and
 * tint, picks up wet paint it passes over, and deposits by pressure, load, and contact
 * with the weave, so streaks, dry-brush breaks, ridges, and carried color emerge from
 * the sweep. Deposits land at sub-pixel positions, splatted bilinearly into the four
 * pixels around each sample, so thin and slanted strokes don't alias.
 * @module brush/lay-stroke
 */

import type { Canvas, PixelRect } from '../canvas/canvas.js';
import { WEAVE_HEIGHT } from '../canvas/canvas.js';
import { NB } from '../color/spectrum.js';
import { paintOf } from '../paint/kubelka-munk.js';
import { rng } from '../random/rng.js';
import type { BrushType, StrokeResult, StrokeSpec } from './brush.js';
import { type PathPoint, resamplePath } from './path.js';

/** Hooks around one stroke. */
export interface LayOptions {
  /** Called once before the kernel writes, with a rectangle bounding every pixel the stroke can change. */
  beforeWrite?: (rect: PixelRect) => void;
  /**
   * Asked every `POLL_PX` px the bristles sweep; returning true ends the stroke where it
   * is. The caller then discards the run, so a cut stroke never reaches a painting.
   */
  shouldStop?: () => boolean;
}

/**
 * Bristle travel between `shouldStop` polls, in px across the stroke summed over its
 * samples: about 10 ms of kernel time, whatever the brush width.
 */
const POLL_PX = 50_000;

/** Visits per px² of the original sampling grid (1/0.6 across × 2 along); deposit rates are per visit. */
const BASE_VISITS = 2 / 0.6;
/** Smallest per-pixel deposit that counts the pixel as painted. */
const PAINTED = 0.004;
/** Paint volume one strand applies per unit load before the reservoir term (`thick` factor). */
const T0 = 1.1;
/** Share of a sample's deposit rate that reaches the canvas per visit. */
const F = 0.3;

/** Stroke width as a share of the brush width at pressure p: round, soft, and filbert thin to a point. */
function widthFactor(type: BrushType, p: number): number {
  const q = Math.min(1, p);
  if (type === 'round' || type === 'soft') return q >= 0.4 ? 0.45 + 0.55 * q : (q / 0.4) * 0.67;
  if (type === 'filbert') return q >= 0.25 ? 0.7 + 0.3 * q : (q / 0.25) * 0.775;
  if (type === 'knife') return 1;
  return 0.92 + 0.08 * q;
}

/** Lay one stroke on the canvas and measure it. */
export function layStroke(canvas: Canvas, st: StrokeSpec, opts: LayOptions = {}): StrokeResult {
  const { width: W, height: H, K, S, V, weave, mark, weaveAmp } = canvas;
  const br = st.brush;
  const w = br.width;
  const type = br.type;
  const r = rng(canvas.nextStrokeSeed());
  const markBase = canvas.nextMarkBase();
  const soft = type === 'soft';
  const knife = type === 'knife';
  const load = st.load ?? 0.7;
  const basePress = st.pressure ?? 0.7;
  const kind = st.paint ?? 'opaque';
  const stiff = br.stiffness ?? (knife ? 1 : 0.6);
  const streakNominal = br.streak ?? (soft || knife ? 0 : 1);
  // fine brushes hold a line: streaking fades in from about 1 px to 10 px wide
  const streak = streakNominal * Math.min(1, Math.max(0, (w - 1) / 9)) ** 3;
  const toneVar = br.toneVar ?? (soft || knife ? 0 : 0.5 * streakNominal);
  const splay = br.splay ?? (soft || knife ? 0 : 0.2);
  const thinner = st.thinner ?? 0;
  const contactCap = st.contact ?? 1;
  const lean = 1 - 0.85 * thinner;

  // a one-point path, or one with no length, is a dab
  let path: readonly PathPoint[] = st.path;
  let pts = path.length > 1 ? resamplePath(path, basePress, st.corners ?? false) : [];
  const dab = pts.length < 2;
  const angle = dab ? (st.angle ?? -0.6 + (r() - 0.5) * 0.6) : 0;
  const stamp = dab && (type === 'round' || type === 'soft' || type === 'filbert');
  const [cx, cy, cp] = path[0]!;
  const dabPress = cp ?? basePress;
  if (dab && !stamp) {
    const L = Math.max(2, w * 0.3);
    const dx = Math.cos(angle) * L * 0.5;
    const dy = Math.sin(angle) * L * 0.5;
    path = [
      [cx! - dx, cy! - dy, dabPress],
      [cx! + dx, cy! + dy, dabPress],
    ];
    pts = resamplePath(path, basePress, true);
  }
  const Ltot = stamp ? 0 : pts[pts.length - 1]!.s;

  // strands
  const N =
    type === 'fan'
      ? Math.max(4, Math.min(28, Math.round(w * 0.28)))
      : Math.max(5, Math.min(90, Math.round(w * 0.95)));
  const prof = new Float32Array(N);
  const act = new Uint8Array(N);
  const wob = new Float32Array(N);
  const ph = new Float32Array(N);
  const f1 = new Float32Array(N);
  const f2 = new Float32Array(N);
  const ph2 = new Float32Array(N);
  for (let s = 0; s < N; s++) {
    f1[s] = 0.02 + r() * 0.05;
    f2[s] = 0.11 + r() * 0.2;
    ph2[s] = r() * 6.28;
  }
  const eL = r() * 6.28;
  const eR = r() * 6.28;
  const sK = new Float32Array(N * NB);
  const sS = new Float32Array(N * NB);
  const sA = new Float32Array(N);
  const sA0 = new Float32Array(N);
  /** Picked-up volume within each strand's reservoir. */
  const sP = new Float32Array(N);
  const base = st.color ?? null;
  const tint = new Float32Array(NB);
  const resLen = 420 * (br.reservoir ?? 1);
  const nClumps = 2 + Math.floor(w / 9);
  const clumpOn = Array.from({ length: nClumps }, () => r() < 0.72);
  const clumpOff = Array.from({ length: nClumps }, () => (r() - 0.5) * splay * 0.25 * w);
  for (let s = 0; s < N; s++) {
    const u = (s + 0.5) / N - 0.5;
    const au = Math.abs(2 * u);
    prof[s] = soft
      ? Math.exp(-au * au * 2.8)
      : type === 'round'
        ? Math.sqrt(Math.max(0.05, 1 - au * au))
        : type === 'filbert'
          ? Math.max(0.05, 1 - au ** 3) ** 0.6
          : knife
            ? au > 0.84
              ? 1.35
              : 1
            : 1 - 0.35 * au ** 6;
    act[s] = knife || r() < 1 - 0.035 * streak ? 1 : 0;
    const clump = Math.min(nClumps - 1, Math.floor((u + 0.5) * nClumps));
    if (type === 'splayed') act[s] = clumpOn[clump]! ? act[s]! : 0;
    wob[s] = (type === 'splayed' ? clumpOff[clump]! : 0) + (r() - 0.5) * splay * (w / N) * 1.5;
    ph[s] = r() * 6.28;
    const amt = load * resLen * (w / N) * T0 * (knife ? 0.9 + 0.2 * r() : 0.55 + 0.9 * r());
    sA[s] = base ? amt : 0;
    sA0[s] = base ? amt : 0;
    if (base) {
      const v1 = (r() - 0.5) * 2;
      const v2 = (r() - 0.5) * 2;
      for (let b = 0; b < NB; b++)
        tint[b] =
          base[b]! * (1 + toneVar * 0.2 * v1) * (1 + (toneVar * 0.12 * v2 * (b - 3.5)) / 3.5);
      const so = s * NB;
      paintOf(tint, kind, sK, sS, so);
      if (lean !== 1)
        for (let b = 0; b < NB; b++) {
          sK[so + b]! *= lean;
          sS[so + b]! *= lean;
        }
    }
  }
  const pickBase = (knife ? 0.8 : 0.5 * (1 - 0.5 * stiff)) * (1 + thinner) * F * 2;
  const thick = T0 * (0.35 + 0.65 * load) * (1 - 0.5 * thinner) * (knife ? 1.5 : 1);
  const tremor = r() * 6.28;
  // across-width sample spacing: fine brushes sample finer so their width resolves
  const aoStep = Math.min(0.9, Math.max(0.35, w / 8));

  // conservative bounds of every pixel the stroke can change, for the caller's undo
  const reach = w * (0.5 + 0.15 * splay) + 2 * splay + 3;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  if (stamp) {
    minX = maxX = cx!;
    minY = maxY = cy!;
  } else
    for (const q of pts) {
      if (q.x < minX) minX = q.x;
      if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y;
      if (q.y > maxY) maxY = q.y;
    }
  const rx0 = Math.max(0, Math.floor(minX - reach));
  const ry0 = Math.max(0, Math.floor(minY - reach));
  const rx1 = Math.min(W, Math.ceil(maxX + reach) + 1);
  const ry1 = Math.min(H, Math.ceil(maxY + reach) + 1);
  const length = dab ? 0 : Ltot;
  if (rx0 >= rx1 || ry0 >= ry1)
    return { bbox: null, covered: 0, gaps: 0, mixed: 0, pickedUp: 0, length };
  opts.beforeWrite?.({ x0: rx0, y0: ry0, x1: rx1, y1: ry1 });

  /** Px swept since the last `shouldStop` poll. */
  let swept = 0;

  // measurements
  let visited = 0;
  let visitedPainted = 0;
  let covered = 0;
  let priorWet = 0;
  let ownLaid = 0;
  let carriedLaid = 0;
  let pickedUp = 0;
  let bx0 = W;
  let by0 = H;
  let bx1 = -1;
  let by1 = -1;
  const VIS = markBase + 1;
  const DEP = markBase + 2;
  const BOTH = markBase + 3;

  const visit = (fx: number, fy: number) => {
    const x = Math.round(fx);
    const y = Math.round(fy);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const j = y * W + x;
    const m = mark[j]!;
    if (m < markBase) {
      mark[j] = VIS;
      visited++;
    } else if (m === DEP) {
      mark[j] = BOTH;
      visited++;
      visitedPainted++;
    }
  };

  const changed = (x: number, y: number) => {
    if (x < bx0) bx0 = x;
    if (x > bx1) bx1 = x;
    if (y < by0) by0 = y;
    if (y > by1) by1 = y;
  };

  /** Pick up and deposit for strand s with strength sp at sub-pixel (fx, fy); `rate` scales per-visit amounts. */
  const touch = (fx: number, fy: number, s: number, sp: number, rate: number) => {
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const ax = fx - ix;
    const ay = fy - iy;
    const so = s * NB;
    let A = sA[s]!;
    // pickup of wet paint onto the strand
    const pkFrac = Math.min(0.75, pickBase * Math.min(1, sp) * rate);
    for (let c = 0; c < 4; c++) {
      const x = ix + (c & 1);
      const y = iy + (c >> 1);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const wt = (c & 1 ? ax : 1 - ax) * (c >> 1 ? ay : 1 - ay);
      if (wt < 0.0005) continue;
      const j = y * W + x;
      const v = V[j]!;
      if (v <= 1e-4) continue;
      const pk = v * pkFrac * wt;
      const io = j * NB;
      const tot = A + pk;
      for (let b = 0; b < NB; b++) {
        sK[so + b] = (sK[so + b]! * A + K[io + b]! * pk) / tot;
        sS[so + b] = (sS[so + b]! * A + S[io + b]! * pk) / tot;
      }
      A = tot;
      sP[s]! += pk;
      pickedUp += pk;
      V[j] = v - pk;
      changed(x, y);
    }
    sA[s] = A;
    if (A <= 1e-5) return;
    const fill = sA0[s]! > 0 ? Math.min(1, (A / sA0[s]!) * 2.5) : Math.min(1, A / (thick * F * 2));
    // a lightly loaded brush catches only the tops of the weave; an empty blender never runs dry
    const dryness = Math.max(
      Math.min(1, 1.25 * (1 - contactCap)),
      base
        ? Math.max(0, 1 - fill * 1.6, (0.3 - sp) / 0.3, ((0.4 - load) / 0.4) * 0.95)
        : Math.max(0, (0.3 - sp) / 0.3),
    );
    const rateDd = thick * Math.min(1.6, sp) * F * fill * rate;
    if (rateDd <= 0) return;
    for (let c = 0; c < 4; c++) {
      const x = ix + (c & 1);
      const y = iy + (c >> 1);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const wt = (c & 1 ? ax : 1 - ax) * (c >> 1 ? ay : 1 - ay);
      if (wt < 0.0005) continue;
      const j = y * W + x;
      let contact = 1;
      if (dryness > 0) {
        if (weaveAmp > 0) {
          // a dry brush catches the tops of the weave and breaks over its hollows
          const hl = weave[j]! / (WEAVE_HEIGHT * weaveAmp) + (knife ? 0 : (r() - 0.5) * 0.35);
          contact = Math.min(1, Math.max(0, (hl - dryness * 0.95 + 0.25) * 3));
        } else {
          // a smooth panel has no tops to catch: the film thins evenly and never speckles
          contact = 1 - dryness;
        }
      }
      const dd = Math.min(A, rateDd * wt * contact);
      if (dd <= 0) continue;
      const carried = (dd * sP[s]!) / A;
      const io = j * NB;
      const vv = V[j]!;
      const nv = vv + dd;
      for (let b = 0; b < NB; b++) {
        K[io + b] = (K[io + b]! * vv + sK[so + b]! * dd) / nv;
        S[io + b] = (S[io + b]! * vv + sS[so + b]! * dd) / nv;
      }
      V[j] = nv;
      A -= dd;
      sP[s]! -= carried;
      carriedLaid += carried;
      ownLaid += dd - carried;
      changed(x, y);
      if (dd >= PAINTED) {
        const m = mark[j]!;
        if (m < markBase) {
          mark[j] = DEP;
          covered++;
          priorWet += vv;
        } else if (m === VIS) {
          mark[j] = BOTH;
          covered++;
          visitedPainted++;
          priorWet += vv;
        }
      }
      if (A <= 1e-5) break;
    }
    sA[s] = A;
  };

  if (stamp) {
    // a dab: the brush pressed once, its bristles fanned over a disc (an oval for a filbert)
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const Ru = Math.max(0.5, (w * widthFactor(type, dabPress)) / 2);
    const Rv = type === 'filbert' ? Ru * 0.8 : Ru;
    const step = Math.min(aoStep, Math.max(0.25, Ru / 4));
    const rate = BASE_VISITS * step * step;
    // the rim wanders like a real dab's, by as much as the brush streaks
    const rim1 = r() * 6.28;
    const rim2 = r() * 6.28;
    for (let v = -Rv; v <= Rv; v += step) {
      swept += 2 * Ru;
      if (swept > POLL_PX) {
        swept = 0;
        if (opts.shouldStop?.()) break;
      }
      const kv = Math.round((v + Rv) / step);
      for (let u = -Ru; u <= Ru; u += step) {
        const theta = Math.atan2(v / Rv, u / Ru);
        const rim =
          1 -
          streak *
            (0.14 * (0.5 + 0.5 * Math.sin(3 * theta + rim1)) +
              0.09 * (0.5 + 0.5 * Math.sin(7 * theta + rim2)));
        const rho2 = ((u / Ru) ** 2 + (v / Rv) ** 2) / (rim * rim);
        if (rho2 > 1) continue;
        const fx = cx! - sa * u + ca * v;
        const fy = cy! + ca * u + sa * v;
        visit(fx, fy);
        const s = Math.min(N - 1, Math.max(0, Math.floor((u / (2 * Ru) + 0.5) * N)));
        if (!act[s]) continue;
        const radial = soft ? Math.exp(-rho2 * 2.8) : Math.sqrt(Math.max(0.05, 1 - rho2));
        const mod = 1 - streak * 0.22 * (1 - Math.sin(kv * f2[s]! + ph2[s]!)) * 0.5;
        touch(fx, fy, s, Math.min(1.6, dabPress) * radial * mod, rate);
      }
    }
  } else {
    const rate = BASE_VISITS * aoStep;
    const easeLen = Math.max(2, (type === 'round' ? 0.35 : 0.2) * w);
    const end = st.end ?? 'lift';
    const taperLen = dab
      ? 0
      : end === 'flick'
        ? 1.4 * w
        : end === 'taper'
          ? Math.max(3, w)
          : end === 'stop'
            ? 0
            : 0.45 * w;
    for (let k = 0; k < pts.length; k++) {
      const q = pts[k]!;
      const rem = Ltot - q.s;
      // a flat dab presses in and lifts off; a stroke eases in from first contact
      let pr = dab
        ? q.p * (0.6 + 0.4 * Math.sin((Math.PI * q.s) / Math.max(1, Ltot)))
        : q.p * Math.min(1, 0.55 + (0.45 * q.s) / easeLen);
      if (taperLen > 0 && rem < taperLen) {
        const t = rem / taperLen;
        pr *= end === 'flick' ? 0.05 + 0.95 * t : end === 'taper' ? t : 0.3 + 0.7 * t;
      }
      if (end === 'stop' && !dab && rem < 3) pr *= 1.7;
      const wEff = w * widthFactor(type, pr);
      if (wEff < 0.05) continue;
      swept += wEff;
      if (swept > POLL_PX) {
        swept = 0;
        if (opts.shouldStop?.()) break;
      }
      const nx = -q.ty;
      const ny = q.tx;
      const trem = Math.sin(k * 0.045 + tremor) * 0.6 * streak;
      const half = wEff / 2;
      // ragged edges: each side wanders in and out along the stroke
      const lo =
        -half *
        (1 -
          streak *
            (0.05 * (0.5 + 0.5 * Math.sin(k * 0.043 + eL)) +
              0.035 * Math.sin(k * 0.23 + eR) * Math.sin(k * 0.071 + eL)));
      const hi =
        half *
        (1 -
          streak *
            (0.05 * (0.5 + 0.5 * Math.sin(k * 0.039 + eR)) +
              0.035 * Math.sin(k * 0.19 + eL) * Math.sin(k * 0.067 + eR)));
      for (let ao = lo; ao <= hi; ao += aoStep) {
        visit(q.x + nx * ao, q.y + ny * ao);
        const uu = ao / wEff + 0.5;
        const s = Math.min(N - 1, Math.max(0, Math.floor(uu * N)));
        if (!act[s]) continue;
        if (type === 'fan' && Math.abs(uu * N - s - 0.5) > 0.22) continue;
        // per-strand load modulation along the stroke; edge strands skip more
        const modRaw =
          0.78 + 0.15 * Math.sin(k * f1[s]! + ph[s]!) + 0.07 * Math.sin(k * f2[s]! + ph2[s]!);
        const mod = 1 - streak * (1 - modRaw);
        const edge = Math.abs(2 * uu - 1);
        if (modRaw < 0.6 + 0.35 * edge ** 8 - (1 - streak) * 0.4) continue;
        const off = ao + wob[s]! + Math.sin(k * 0.06 + ph[s]!) * splay * 0.8 + trem;
        touch(q.x + nx * off, q.y + ny * off, s, pr * prof[s]! * mod, rate);
      }
    }
  }

  const laid = ownLaid + carriedLaid;
  return {
    bbox: bx1 < 0 ? null : { x0: bx0, y0: by0, x1: bx1 + 1, y1: by1 + 1 },
    covered,
    gaps: visited > 0 ? 1 - visitedPainted / visited : 0,
    mixed: laid + priorWet > 0 ? (priorWet + carriedLaid) / (priorWet + laid) : 0,
    pickedUp,
    length,
  };
}
