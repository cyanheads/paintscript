/**
 * @fileoverview The stroke kernel: a footprint of bristle strands swept along the
 * resampled path. Each strand carries its own reservoir and tint, picks up wet paint
 * it passes over, and deposits by pressure, load, and contact with the weave, so
 * streaks, dry-brush breaks, ridges, and carried color emerge from the sweep.
 * @module brush/lay-stroke
 */

import type { Canvas } from '../canvas/canvas.js';
import { NB } from '../color/spectrum.js';
import { paintOf } from '../paint/kubelka-munk.js';
import { rng } from '../random/rng.js';
import type { StrokeSpec } from './brush.js';
import { resamplePath } from './path.js';

/** Lay one stroke on the canvas. */
export function layStroke(canvas: Canvas, st: StrokeSpec): void {
  const { width: W, height: H, K, S, V, weave } = canvas;
  const br = st.brush;
  const w = br.width;
  const r = rng(canvas.nextStrokeSeed());
  const load = st.load ?? 0.7;
  const basePress = st.pressure ?? 0.7;
  const kind = st.paint ?? 'opaque';
  const stiff = br.stiffness ?? 0.6;
  const soft = br.type === 'soft';
  const streak = br.streak ?? (soft ? 0 : 1);
  const toneVar = br.toneVar ?? (soft ? 0 : 0.5 * streak);
  const splay = br.splay ?? (soft ? 0 : 0.2);
  const thinner = st.thinner ?? 0;
  let path = st.path;
  if (path.length === 1) {
    const a = st.angle ?? -0.6 + (r() - 0.5) * 0.6;
    const L = Math.max(2, w * 0.45);
    const [x, y, p] = path[0]!;
    path = [
      [x! - Math.cos(a) * L * 0.5, y! - Math.sin(a) * L * 0.5, p ?? basePress],
      [x! + Math.cos(a) * L * 0.5, y! + Math.sin(a) * L * 0.5, p ?? basePress],
    ];
  }
  const pts = resamplePath(path, basePress, st.corners ?? false);
  if (pts.length < 2) return;
  const Ltot = pts[pts.length - 1]!.s;

  // strands
  const type = br.type;
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
  const base = st.color ?? null;
  const tint = new Float32Array(NB);
  const T0 = 1.1;
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
          : 1 - 0.35 * au ** 6;
    act[s] = r() < 1 - 0.035 * streak ? 1 : 0;
    const clump = Math.min(nClumps - 1, Math.floor((u + 0.5) * nClumps));
    if (type === 'splayed') act[s] = clumpOn[clump]! ? act[s]! : 0;
    wob[s] = (type === 'splayed' ? clumpOff[clump]! : 0) + (r() - 0.5) * splay * (w / N) * 1.5;
    ph[s] = r() * 6.28;
    const amt = load * resLen * (w / N) * T0 * (0.55 + 0.9 * r());
    sA[s] = base ? amt : 0;
    sA0[s] = base ? amt : 0;
    if (base) {
      const v1 = (r() - 0.5) * 2;
      const v2 = (r() - 0.5) * 2;
      for (let b = 0; b < NB; b++)
        tint[b] =
          base[b]! * (1 + toneVar * 0.2 * v1) * (1 + (toneVar * 0.12 * v2 * (b - 3.5)) / 3.5);
      paintOf(tint, kind, sK, sS, s * NB);
    }
  }
  const pick = 0.5 * (1 - 0.5 * stiff) * (1 + thinner);
  const thick = T0 * (0.35 + 0.65 * load) * (1 - 0.5 * thinner);
  const f = 0.3;
  const tremor = r() * 6.28;
  const easeLen = Math.max(2, (type === 'round' ? 0.35 : 0.2) * w);
  const taperLen = st.end === 'flick' ? 1.4 * w : st.end === 'stop' ? 0 : 0.45 * w;

  for (let k = 0; k < pts.length; k++) {
    const q = pts[k]!;
    const rem = Ltot - q.s;
    let pr = q.p * Math.min(1, 0.55 + (0.45 * q.s) / easeLen);
    if (taperLen > 0 && rem < taperLen)
      pr *=
        (st.end === 'flick' ? 0.05 : 0.3) + (st.end === 'flick' ? 0.95 : 0.7) * (rem / taperLen);
    if (st.end === 'stop' && rem < 3) pr *= 1.7;
    const wEff =
      type === 'round' || soft
        ? w * (0.45 + 0.55 * Math.min(1, pr))
        : type === 'filbert'
          ? w * (0.7 + 0.3 * Math.min(1, pr))
          : w * (0.92 + 0.08 * Math.min(1, pr));
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
    for (let ao = lo; ao <= hi; ao += 0.6) {
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
      const sp = pr * prof[s]! * mod;
      for (let along = 0; along < 1; along += 0.5) {
        const px = Math.round(q.x + nx * off + q.tx * along);
        const py = Math.round(q.y + ny * off + q.ty * along);
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const i = py * W + px;
        const io = i * NB;
        const so = s * NB;
        // pickup of wet paint onto the strand
        const v = V[i]!;
        if (v > 1e-4) {
          const pk = Math.min(v * 0.5, pick * v * Math.min(1, sp) * f * 2);
          const A = sA[s]!;
          const tot = A + pk;
          for (let b = 0; b < NB; b++) {
            sK[so + b] = (sK[so + b]! * A + K[io + b]! * pk) / tot;
            sS[so + b] = (sS[so + b]! * A + S[io + b]! * pk) / tot;
          }
          sA[s] = tot;
          V[i] = v - pk;
        }
        // deposit
        const A = sA[s]!;
        if (A <= 1e-5) continue;
        const fill =
          sA0[s]! > 0 ? Math.min(1, (A / sA0[s]!) * 2.5) : Math.min(1, A / (thick * f * 2));
        // a lightly loaded brush catches only the tops of the weave; an empty blender never runs dry
        const dryness = base
          ? Math.max(0, 1 - fill * 1.6, (0.3 - sp) / 0.3, ((0.4 - load) / 0.4) * 0.95)
          : Math.max(0, (0.3 - sp) / 0.3);
        let contact = 1;
        if (dryness > 0) {
          const hl = weave[i]! / 0.1 + (r() - 0.5) * 0.35;
          contact = Math.min(1, Math.max(0, (hl - dryness * 0.95 + 0.25) * 3));
        }
        const dd = Math.min(A, thick * Math.min(1.6, sp) * f * contact * fill);
        if (dd <= 0) continue;
        const vv = V[i]!;
        const nv = vv + dd;
        for (let b = 0; b < NB; b++) {
          K[io + b] = (K[io + b]! * vv + sK[so + b]! * dd) / nv;
          S[io + b] = (S[io + b]! * vv + sS[so + b]! * dd) / nv;
        }
        V[i] = nv;
        sA[s] = A - dd;
      }
    }
  }
}
