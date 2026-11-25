import { describe, expect, it } from 'vitest';
import { PRELUDE } from '../../src/script/prelude.js';
import { VOCABULARY_DTS } from '../../src/script/vocabulary-dts.js';

describe('VOCABULARY_DTS', () => {
  it('declares every global the prelude defines, and nothing it does not', () => {
    // stubs and aliases the declarations mention in prose rather than declare
    const undeclared = new Set(['console', 'Date']);
    const defined = [...PRELUDE.matchAll(/define\('(\w+)'/g)]
      .map((m) => m[1]!)
      .filter((n) => !undeclared.has(n));
    const declared = [...VOCABULARY_DTS.matchAll(/^declare (?:function|const) (\w+)/gm)].map(
      (m) => m[1]!,
    );
    expect(new Set(declared)).toEqual(new Set(defined));
  });
});
