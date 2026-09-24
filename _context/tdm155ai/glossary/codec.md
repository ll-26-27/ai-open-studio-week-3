---
term: "Codec"
slug: codec
short: "The method used to compress video into a file: H.264 for compatibility, HEVC (H.265) for half the size, ProRes for editing quality at huge sizes."
aliases: ["H.264", "HEVC", "H.265", "ProRes"]
category: formats
see_also: [bitrate, bit-depth, resolution, log-profile]
updated: 2026-09-23
---

# Codec

**The method used to compress video into a file: H.264 for compatibility, HEVC (H.265) for half the size, ProRes for editing quality at huge sizes.**

## In plain terms

Raw video is enormous, so every camera compresses it. A codec is the scheme: **H.264** (also called AVC) plays everywhere and is the safe choice. **HEVC** (H.265, "High Efficiency" on iPhone) gets the same quality at about half the size but some older software chokes on it. **ProRes** barely compresses at all; files are ten times bigger, but they grade cleanly and edit without the computer straining. **AV1** is the newer, smaller web codec.

The codec is separate from the container: `.mp4` and `.mov` are boxes that can hold any of these. A file that "won't open" is usually a codec problem, not a container problem.

## Why it matters this term

It is the setting that decides whether a file opens on someone else's machine and how much of your phone it eats.

## See also

[Bitrate](bitrate.md) · [Bit depth](bit-depth.md) · [Resolution](resolution.md) · [Log profile](log-profile.md)
