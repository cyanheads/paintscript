/**
 * @fileoverview Brush and stroke descriptions: the types a caller fills in and the
 * defaults the kernel resolves them to.
 * @module brush/brush
 */

import type { PaintKind } from '../paint/kubelka-munk.js';
import type { PathPoint } from './path.js';

/**
 * Brush shapes. `soft` is a smooth sable: Gaussian profile, no bristle streaks, no tint
 * variation.
 */
export type BrushType = 'flat' | 'round' | 'filbert' | 'fan' | 'splayed' | 'soft';

/** Every brush type, for validation. */
export const BRUSH_TYPES: readonly BrushType[] = [
  'flat',
  'round',
  'filbert',
  'fan',
  'splayed',
  'soft',
];

/** A brush. Width in canvas px; the other properties are 0–1 unless noted. */
export interface BrushSpec {
  /** Paint each strand holds, as a multiple of the default load length (about 420 px at load 1). */
  reservoir?: number;
  /** Bristle spread: strand wobble and clumping. Default 0.2 (0 for `soft`). */
  splay?: number;
  /** Bristle stiffness: stiffer bristles pick up less wet paint. Default 0.6. */
  stiffness?: number;
  /** How much the bristles streak, rag the edges, and drop out. Default 1 (0 for `soft`). */
  streak?: number;
  /** Per-strand tint variation. Default 0.5 × streak. */
  toneVar?: number;
  type: BrushType;
  width: number;
}

/** How a stroke ends: `lift` tapers out, `stop` ends square and presses in, `flick` tapers long and thin. */
export type StrokeEnd = 'lift' | 'stop' | 'flick';

/** One stroke as the kernel lays it. */
export interface StrokeSpec {
  /** Direction of a one-point dab, radians. */
  angle?: number;
  brush: BrushSpec;
  /** Reflectance spectrum of the paint loaded; absent is a clean brush that only blends. */
  color?: Float32Array;
  /** Straight segments between points instead of a smooth curve. */
  corners?: boolean;
  end?: StrokeEnd;
  /** Paint on the brush, 0–1. Default 0.7. */
  load?: number;
  paint?: PaintKind;
  path: readonly PathPoint[];
  /** Pressure where a path point gives none, 0–1. Default 0.7. */
  pressure?: number;
  /** Solvent in the paint, 0–1: thinner films, more pickup. Default 0. */
  thinner?: number;
}
