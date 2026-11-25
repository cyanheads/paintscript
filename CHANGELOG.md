# Changelog

All notable changes to this project. Each entry links to its full per-version file in [changelog/](changelog/).

## [0.2.0](changelog/0.2.x/0.2.0.md) — 2026-11-25 · ⚠️ Breaking · 🛡️ Security

The time limit and cancellation now hold between vocabulary calls and inside a stroke, journal replay is held to the time and stroke limits, and PNG decoding is size-capped. Painting methods reject arguments they cannot use.

## [0.1.0](changelog/0.1.x/0.1.0.md) — 2026-11-25

First release: paint by code. JavaScript lays simulated brush strokes, from thick oil paint to ink and watercolor-like washes, with exact replay to a PNG and a timelapse GIF.
