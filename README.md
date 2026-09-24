# ai-open-studio-week-3

AI Open Studio, week 3 (Thursday 2026-09-24, 1:30–2:45 at the Learning Lab): **supporting in-person assignments and activities.** What the Lab did to support real media projects, oral assignments, and capturing notes and documentation from photos.

The site is a home page of examples, each a self-contained site one level down. It started on 2026-09-24 as a copy of [tdm155ai-week-3](https://github.com/tdm155ai/tdm155ai-week-3) (the class of 2026-09-23), with that whole site moved to `/tdm155ai`. More examples get added beside it.

| URL | What |
| --- | --- |
| `/` | The studio home: one card per example (listed in `nextjs/lib/examples.mjs`) |
| `/tdm155ai` | TDM 155AI week 3, tools of the AV trade: the class site's old home page |
| `/tdm155ai/docs` | The checklist, the four station cards, practice, tools, dates, recording formats, the desk video kit handout, how to share to the wall |
| `/tdm155ai/glossary` | The glossary, one page per term |
| `/tdm155ai/capture` | A camera feed (the Web Presenter's USB-C webcam output, or any camera the browser sees) and a Capture button. Saves stills to `_media/<station>/`, and to a NAS folder and a Slack channel when `nextjs/.env.local` sets them up (see `nextjs/.env.example`). Open it as `/tdm155ai/capture?station=lights` or `?station=obscura`. |
| `/tdm155ai/live` | Stills and clips from `_media/`, newest first, re-checked every ten seconds |
| `/tdm155ai/live/nas` | **Experimental.** The same wall read from the NAS folder, so it shows every studio machine's captures |
| `/tdm155ai/print` | Light print versions: the station cards, the glossary, any page |

`/api/capture`, `/media/…`, and `/nas-media/…` stay at the root: they're shared plumbing, not part of one example.

## Adding an example

1. Its pages go in `nextjs/app/<slug>/`, its Markdown in `_context/<slug>/`.
2. Add a card to `nextjs/lib/examples.mjs`.

The `/tdm155ai` pages are the pattern: `lib/content.mjs` sets `base = "/tdm155ai"` and prefixes every page link with it, including root-absolute links in the Markdown (`/capture` becomes `/tdm155ai/capture`).

## Run it

```sh
cd nextjs
pnpm install
pnpm dev
```

Open the localhost address it prints. Markdown under `_context/` is read on each request, so edits show on refresh; nothing needs registering.

## Studio capture setup

Each studio machine runs its own copy of the app, with a Blackmagic Web Presenter plugged in by USB-C. The Web Presenter's USB output is a standard webcam, so Chrome sees it with no driver, and `/capture` picks it automatically (it names itself "Blackmagic Design").

1. In `nextjs/`: `pnpm install`, then `cp .env.example .env.local` and fill in what this machine uses (below). Everything in it is optional.
2. `pnpm dev`, then open `http://localhost:<port>/tdm155ai/capture?station=lights` (or `?station=obscura`) in Chrome and allow the camera. It has to be `localhost` on the machine with the Web Presenter: browsers only open cameras on a secure origin, and another machine's IP over plain http isn't one.
3. Press **Capture** or the space bar. Each still is saved to `_media/<station>/` on this machine first, then copied to the NAS and posted to Slack if those are set up. Uploads run in the background, so presses never wait on the network.

**Nothing here depends on the NAS or Slack.** The local save always happens first. If the share isn't mounted, or Slack is slow or refuses, that capture's status says so (NAS calls give up after 8 seconds, Slack after 30) and the still is still on this machine's `/tdm155ai/live`. Restart `pnpm dev` after editing `.env.local`; it is read at startup.

### Connecting the NAS

The app writes to the NAS as a mounted folder, not over the network itself.

1. In Finder, press ⌘K (Go → Connect to Server) and enter `smb://<NAS IP>`. Choose **Registered User**, enter a NAS account, tick **Remember this password in my keychain**, and pick the share. It mounts at `/Volumes/<share name>`; `ls /Volumes` to check.
2. Once, from any machine, make the folder: `mkdir "/Volumes/<share name>/ai-open-studio-week-3"`.
3. In `nextjs/.env.local`: `CAPTURE_NAS_DIR="/Volumes/<share name>/ai-open-studio-week-3"` (keep the quotes if the name has spaces). `NAS_IP` is only a note for whoever sets up the machine.
4. Restart `pnpm dev`. The capture status should read **NAS ✓**, a `lights/` or `obscura/` folder appears on the share, and `/tdm155ai/live/nas` shows every machine's captures.

If Connect to Server fails, the Mac is probably on a different network from the NAS. If captures say "NAS folder not found (is the share mounted?)", the share dropped (sleep and restarts do that): reconnect with ⌘K, or drag the mounted share into System Settings → General → Login Items so it remounts at login. If the share shows up as `/Volumes/<share>-1`, it was mounted twice: eject both, reconnect, and check the path.

### Image descriptions

With `OPENROUTER_API_KEY` set, each capture also gets two or three sentences from a vision model (`OPENROUTER_MODEL`, default `anthropic/claude-sonnet-5`), written for the station: key-light position and hard or soft light at the lights station, what the lens, glass, or projector added at the camera obscura. The description shows under the thumbnail on `/capture`, under the still on `/tdm155ai/live` (it is saved beside the image as `<image>.json`, and copied to the NAS), and as a quote in the Slack post. It takes a few seconds; the Slack post waits for it, the local save doesn't. Untick **Describe** on the capture page to skip it.

### Connecting Slack

Captures go to one channel, with the station and machine name as the message. Two ways to set it up in `nextjs/.env.local`:

- **Upload as you, with public links (what we use):** `SLACK_USER_TOKEN` (an `xoxp-` token; user token scopes `files:write`, `files:read`, `chat:write`) and `SLACK_CHANNEL_ID` (the `C…` ID; in Slack, channel name → About → the ID at the bottom). Each capture is posted as that user, made public, and a thread reply carries a Markdown embed line (`![name](https://files.slack.com/files-pri/…?pub_secret=…)`); the capture page shows a **Copy MD** button for it too. Slack only lets the person who uploaded a file make its public link, which is why this needs a user token. The workspace setting "Allow file sharing via public links" has to be on.
- **Upload as a bot, no public links:** `SLACK_BOT_TOKEN` (an `xoxb-` token with `files:write`) and `SLACK_CHANNEL_ID`, and invite the bot to the channel (`/invite @<bot name>`).

If both tokens are set, the user token is used. The capture page's Slack checkbox turns posting off for that machine without touching the file.

## Folders

- `_context/tdm155ai/docs/`, `_context/tdm155ai/glossary/`, and `_context/tdm155ai/print/` (the Letter PDFs): the class site's Markdown and printables.
- `_media/`: **gitignored, local only.** Drop images (JPEG, PNG, WebP, GIF) and clips (MP4, MOV, WebM) here and they appear on `/tdm155ai/live`. Subfolders are fine. HEIC and RAW are counted but not shown; export as JPEG. The app works with the folder empty, so your copy shows your files and nobody else's.
- `nextjs/`: the app. Dark only. Files are served from `_media/` by a route handler, not from `public/`, so the folder can live outside the app and be swapped for another source later.

## Later

`/tdm155ai/live/nas` is the first try at one wall for every machine. Pulling phone shots in from the Slack channel is not built yet.
