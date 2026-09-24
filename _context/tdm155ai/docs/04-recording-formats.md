---
title: "Recording formats: the five numbers"
description: "Resolution, frame rate, codec, bit depth, and bitrate, and what each one does to your file."
updated: 2026-09-23
---

# Recording formats: the five numbers

Every video file is described by five numbers, and your phone's settings menu shows you three of them at most. Here is what each one is, what changing it does, and what to pick today.

| Number | What it is | Phone default | Change it when |
| --- | --- | --- | --- |
| [Resolution](../glossary/resolution.md) | Pixels per frame: 1920×1080 (1080p), 3840×2160 (4K) | 1080p or 4K | 4K if you'll crop or reframe in the edit; 1080p is enough for every social platform |
| [Frame rate](../glossary/frame-rate.md) | Frames per second: 24, 30, 60, 120 | 30 | 24 for a film look; 60 or 120 if you want slow motion later |
| [Codec](../glossary/codec.md) | How the frames are compressed: H.264, HEVC (H.265), ProRes | HEVC ("High Efficiency") on iPhone | H.264 ("Most Compatible") if a file won't open somewhere; ProRes for grading, if you have the storage |
| [Bit depth](../glossary/bit-depth.md) | Shades per color channel: 8-bit (256) or 10-bit (1024) | 10-bit when HDR is on, 8-bit otherwise | 10-bit for skies, gradients, and anything you will color-correct |
| [Bitrate](../glossary/bitrate.md) | Megabits per second the codec is allowed to spend | Chosen for you | You can't set it on a phone; higher resolution, frame rate, and ProRes all push it up |

## What the sizes look like

Ten seconds of video, roughly, on a current iPhone:

| Setting | Bitrate (approx.) | 10 s |
| --- | --- | --- |
| 1080p30 HEVC | 8–12 Mb/s | 10–15 MB |
| 4K30 HEVC | 40–60 Mb/s | 50–75 MB |
| 4K60 HEVC | 80–110 Mb/s | 100–140 MB |
| 4K30 ProRes HQ | 600–700 Mb/s | 750–900 MB |
| 4K30 ProRes Log | 600–700 Mb/s | 750–900 MB, and flat until graded |

A minute of ProRes 4K is about 5 GB. That is why it fills a phone in minutes, and why H.264 and HEVC exist.

## Two more that matter

- **HDR vs. SDR.** iPhones record HDR (Dolby Vision) by default. It looks brilliant on the phone and washed out or over-bright on most other screens and in most editors. Turn HDR off for anything you will edit with other people's footage.
- **[Log](../glossary/log-profile.md).** A flat, grey recording that keeps more highlight and shadow detail for grading later. Only useful if you will grade; it looks wrong straight out of the camera.

## Stills

- **HEIC** is the iPhone's default photo format: half the size of a JPEG, but browsers, the live wall, and many apps can't open it. Settings → Camera → Formats → **Most Compatible** switches to JPEG and H.264 for today.
- **ProRAW / DNG** keeps the sensor data for editing; 25 MB per photo, and also not browser-viewable.

## Where to set these

- **iPhone built-in camera:** Settings → Camera → Formats (codec, HDR, ProRes, Log), and Record Video (resolution, frame rate).
- **Blackmagic Camera:** the format bar at the top of the screen; tap resolution, frame rate, and codec directly. It shows the projected file size per minute as you change them.
- **Android:** varies; look under the camera app's settings gear for Video resolution, Frame rate, and "Advanced" or "Efficient video" (HEVC).
