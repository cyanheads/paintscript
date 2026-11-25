/**
 * @fileoverview The engine version, read from the package's own package.json so it
 * has one source; journals record it.
 * @module version
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';

/** The engine's package version. */
export const VERSION: string = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))).version;
