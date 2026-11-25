#!/usr/bin/env node
/**
 * @fileoverview The `paintscript` executable: runs the command with the process's
 * arguments and exits with its code.
 * @module cli/bin
 */

import { main } from './main.js';

process.exitCode = await main(process.argv.slice(2));
