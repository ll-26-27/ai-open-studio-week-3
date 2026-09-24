---
title: "Sharing to /live"
description: "How the live wall works today: two ways in, both by hand."
updated: 2026-09-23
---

# Sharing to /live

The [live page](/live) is a gallery of whatever is in the `_media/` folder at the root of this repo, newest first. It re-checks the folder every ten seconds, so a file that lands shows up on the wall without anyone reloading.

## Today: two ways in

- **Studio lights** and the **camera obscura's projector and camera** run through the station computer's capture page (`/capture`): the camera's feed is on screen, and **Capture** (or the space bar) saves the still into the folder.
- **Studio cameras** feed OBS on the connected computer. Press the capture button and the still lands in the folder. (OBS is software we'll come back to later in the term.)
- **Camera obscura and phone** shots go to the **class image channel on Slack**. Someone pulls them into the folder by hand.

Formats that display: JPEG, PNG, WebP, GIF, MP4, MOV, WebM. HEIC does not, but sharing from an iPhone usually converts on the way out, so don't worry about it today.

## Running it yourself

Clone the repo, then:

```sh
cd nextjs
pnpm install
pnpm dev
```

Open the localhost address it prints. `_media/` is gitignored, so your wall shows your files and nobody else's; the app works with the folder empty.

## Later

Filling `_media/` from a drop folder (Blue's OBS stills or Final Cut markers) and a caption pass that looks at each image and says what it sees are the next steps, not built yet. The gallery reads the folder; whatever fills it can change without touching the page.
