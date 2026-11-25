/**
 * @fileoverview Brush and stroke descriptions: the types a caller fills in, and what the
 * kernel measures about a stroke it laid.
 * @module brush/brush
 */

import type { PixelRect } from '../canvas/canvas.js';
import type { PaintKind } from '../paint/kubelka-munk.js';
import type { PathPoint } from './path.js';

/**
 * Brush shapes. `soft` is a smooth sable: Gaussian profile, no bristle streaks, no tint
 * variation. `knife` is a palette knife: a rigid blade that lays flat, thick paint with
 * crisp edges, scrapes up wet paint, and skips across the weave when lightly loaded.
 */
export type BrushType = 'flat' | 'round' | 'filbert' | 'fan' | 'splayed' | 'soft' | 'knife';

/** Every brush type, for validation. */
export const BRUSH_TYPES: readonly BrushType[] = [
  'flat',
  'round',
  'filbert',
  'fan',
  'splayed',
  'soft',
  'knife',
];

/** A brush. Width in canvas px; the other properties are 0–1 unless noted. */
export interface BrushSpec {
  /** Paint each strand holds, as a multiple of the default load length (about 420 px at load 1). */
  reservoir?: number;
  /** Bristle spread: strand wobble and clumping. Default 0.2 (0 for `soft` and `knife`). */
  splay?: number;
  /** Bristle stiffness: stiffer bristles pick up less wet paint. Default 0.6 (1 for `knife`). */
  stiffness?: number;
  /**
   * How much the bristles streak, rag the edges, and drop out. Default 1 (0 for `soft`
   * and `knife`). Brushes under about 10 px streak proportionally less, so fine lines
   * hold together.
   */
  streak?: number;
  /** Per-strand tint variation. Default 0.5 × streak. */
  toneVar?: number;
  type: BrushType;
  width: number;
}

/**
 * How a stroke ends: `lift` tapers out, `taper` thins to a point, `stop` ends square and
 * presses in, `flick` tapers long and thin.
 */
export type StrokeEnd = 'lift' | 'taper' | 'stop' | 'flick';

/** Every stroke end, for validation. */
export const STROKE_ENDS: readonly StrokeEnd[] = ['lift', 'taper', 'stop', 'flick'];

/** One stroke as the kernel lays it. */
export interface StrokeSpec {
  /** Direction of a one-point dab, radians. Default about -0.6 with a little variation. */
  angle?: number;
  brush: BrushSpec;
  /** Reflectance spectrum of the paint loaded; absent is a clean brush that only blends. */
  color?: Float32Array;
  /**
   * How fully the brush meets the surface, 0–1. Lower values touch only the tops of the
   * weave and ridges, for scumbling and dry brush. Default 1.
   */
  contact?: number;
  /** Straight segments between points instead of a smooth curve. */
  corners?: boolean;
  end?: StrokeEnd;
  /** Paint on the brush, 0–1. Default 0.7. */
  load?: number;
  paint?: PaintKind;
  /** Control points. One point is a dab. */
  path: readonly PathPoint[];
  /** Pressure where a path point gives none, 0–1. Pressure near 0 thins round, soft, and filbert brushes to a point. Default 0.7. */
  pressure?: number;
  /** Solvent in the paint, 0–1: a leaner, more transparent film that picks up more. Default 0. */
  thinner?: number;
}

/** What the kernel measured about one stroke. */
export interface StrokeResult {
  /** Pixels the stroke changed (x1, y1 exclusive), or null if it changed none. */
  bbox: PixelRect | null;
  /** Pixels that took paint. */
  covered: number;
  /** Share of the footprint the bristles passed over that took no paint (0–1). */
  gaps: number;
  /** Path length in px (0 for a dab). */
  length: number;
  /**
   * Share of the wet paint in the pixels the stroke painted that is not this stroke's
   * own color: wet paint it landed in plus paint it picked up and carried (0–1).
   */
  mixed: number;
  /** Wet paint volume the bristles lifted from the canvas. */
  pickedUp: number;
}
