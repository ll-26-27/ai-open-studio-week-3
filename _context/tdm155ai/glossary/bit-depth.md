---
term: "Bit depth"
slug: bit-depth
short: "How many shades each color channel can store: 8-bit gives 256, 10-bit gives 1024, which matters for skies, gradients, and grading."
aliases: []
category: formats
see_also: [codec, log-profile, bitrate]
updated: 2026-09-23
---

# Bit depth

**How many shades each color channel can store: 8-bit gives 256, 10-bit gives 1024, which matters for skies, gradients, and grading.**

## In plain terms

With 8 bits per channel there are 256 steps from black to white in each of red, green, and blue, about 16 million colors. That is enough for a finished image, but push it in a color correction and smooth gradients break into visible bands. 10-bit has four times as many steps per channel and survives grading. iPhones record 10-bit when HDR is on; most cameras' "10-bit 4:2:2" modes are the same idea.

Bit depth is not [bitrate](bitrate.md), though they are often confused: one is how fine the color steps are, the other is how much data per second the file gets.

## Why it matters this term

If you plan to grade or shoot [log](log-profile.md), 10-bit is the difference between a look and a mess.

## See also

[Codec](codec.md) · [Log profile](log-profile.md) · [Bitrate](bitrate.md)
