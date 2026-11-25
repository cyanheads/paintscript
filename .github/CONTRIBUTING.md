# Contributing

Hi, and thanks for using `paintscript`! If a stroke lands wrong, paint mixes or dries in a way real paint wouldn't, or the script vocabulary is missing something you need, an issue is the most useful thing you can send. Let me know about any rough edge or new ideas.

Issues are the contribution path here: bugs, feature requests, and documentation gaps all land there, and code changes go through my workflows, so a precise issue with a reproduction is the fastest route to a fix.

- [Report a bug](https://github.com/cyanheads/paintscript/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/cyanheads/paintscript/issues/new?template=feature_request.yml)
- [Float an idea or ask a question](https://github.com/cyanheads/paintscript/issues/new) — free-form, no template, no need to be sure it's a bug first

The bug and feature forms are structured, and filling in the fields is what makes those actionable. Anything that fits neither can just be a plain issue — a half-formed idea in your own words is fine.

## Before filing

A few things that save a round-trip:

1. **Confirm it's the engine, not the script.** A script that throws comes back as a `script_error` status with its line and column, and the run review flags strokes that laid no paint or took most of their color from the wet paint underneath. If the run already says what went wrong, the engine is behaving.
2. **Check you're on the latest release.** `npm view paintscript version` — fixes land on the current version, older ones aren't patched.
3. **Search existing issues.** `gh issue list -R cyanheads/paintscript --search "<keyword>" --state all`. Add to the matching thread instead of opening a duplicate.
4. **Redact anything sensitive.** Issues are public and permanent — no keys, tokens, internal URLs, or PII in code, logs, or stack traces.

## What makes an issue actionable

- **The script and its settings.** The smallest passage that shows the problem, with the canvas size, ground, texture, surface, and seed, or the whole `paintscript run` command. With the same seed a run repeats exactly, so that is the complete reproduction. A journal file does the same job.
- **What came out, and what should have.** A crop of the painting or a `show()` view, and a sentence on what real paint would do.
- The package version and the runtime (Bun or Node.js, with its version).
- For features: the painting you were trying to make first, then what the vocabulary or engine should let you do.

## For agents

Use one of the two forms and do the triage above first. The free-form path is for humans thinking out loud, not for skipping the checklist — an unverified report costs more to read than it saves to file.

## Security

Don't open a public issue for a vulnerability. See [SECURITY.md](./SECURITY.md) for private disclosure.
