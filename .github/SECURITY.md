# Security Policy

## Supported Versions

Security fixes land on the latest release of `paintscript`. Older versions are not
patched — upgrade to the current release.

## Reporting a Vulnerability

Please do not open a public issue for security reports. Instead:

- Report privately via GitHub: **Security** tab → **Report a vulnerability**, or
- Email **security@caseyjhand.com**

Include a minimal reproduction where possible — the smallest script or journal that
triggers it. You'll receive an acknowledgment within a few days, and credit in the
release notes if the report leads to a fix (unless you prefer otherwise).

## Scope

`paintscript` runs scripts it did not write, often written by an AI model, inside a
QuickJS WebAssembly sandbox with time, stroke, memory, and stack limits. In scope: a
script that reaches anything outside the sandbox (the file system, the network, the
host process, or another run's state); a script, journal, or PNG that gets past those
limits to hang the host or exhaust its memory; and input that crashes the engine
instead of coming back as a run status or a typed `PaintscriptError`.
