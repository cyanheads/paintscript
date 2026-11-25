/**
 * @fileoverview The one error type the engine throws for caller mistakes and bad input,
 * keyed by a stable `code` callers branch on.
 * @module errors
 */

/** Stable reasons a `PaintscriptError` carries. */
export type PaintscriptErrorCode =
  | 'invalid_color'
  | 'invalid_brush'
  | 'unknown_brush'
  | 'invalid_stroke'
  | 'invalid_region'
  | 'invalid_options'
  | 'invalid_image'
  | 'invalid_journal'
  | 'no_reference'
  | 'reference_mismatch'
  | 'checkpoint_not_found'
  | 'canvas_changed';

/** An operation rejected its input. `code` is stable; `message` says what to change. */
export class PaintscriptError extends Error {
  override readonly name = 'PaintscriptError';
  readonly code: PaintscriptErrorCode;

  constructor(code: PaintscriptErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}
