import { mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mediaRoot } from "./media.mjs";

// Captures land in _media/<station>/ (so /live shows them at once), then optionally go to a NAS folder and a Slack
// channel. All settings come from nextjs/.env.local; see .env.example. Local save always happens first; a NAS or
// Slack failure is reported back to the page but never loses the still.

export const stations = {
  lights: "Studio lights",
  cameras: "Studio cameras",
  obscura: "Camera obscura",
  phone: "Phone",
  other: "Other",
  // The studio's /writing page: paper, cards, sticky notes, whiteboards.
  writing: "Writing",
};

const env = (name) => (process.env[name] || "").trim();

export function captureConfig() {
  return {
    machine: env("CAPTURE_MACHINE") || os.hostname().replace(/\.local$/, ""),
    nasDir: env("CAPTURE_NAS_DIR"),
    slackBotToken: env("SLACK_BOT_TOKEN"),
    // A user token (xoxp-) uploads as that person and can make public links; Slack only lets the uploader do that.
    slackUserToken: env("SLACK_USER_TOKEN"),
    slackChannel: env("SLACK_CHANNEL_ID"),
    openrouterKey: env("OPENROUTER_API_KEY"),
    openrouterModel: env("OPENROUTER_MODEL"),
  };
}

export function slackToken(config) {
  return config.slackUserToken || config.slackBotToken;
}

// A NAS share that dropped can leave file calls hanging; never let one hold up a capture.
export function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// What the capture page is allowed to know: which targets exist, not the secrets behind them.
export function publicConfig() {
  const config = captureConfig();
  return { machine: config.machine, nas: Boolean(config.nasDir), slack: Boolean(slackToken(config) && config.slackChannel), publicLinks: Boolean(config.slackUserToken && config.slackChannel), describe: Boolean(config.openrouterKey) };
}

function stamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function safe(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "machine";
}

export function captureFilename(station, machine) {
  // Milliseconds keep two presses in the same second from colliding.
  return `${station}-${stamp()}-${String(Date.now() % 1000).padStart(3, "0")}-${safe(machine)}.jpg`;
}

export async function saveLocal(bytes, station, filename) {
  const directory = path.join(mediaRoot, station);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
  return "/media/" + [station, filename].map(encodeURIComponent).join("/");
}

// A capture's description lives beside it as <image>.json, which /live reads; the media route never serves it.
export async function saveSidecar(directory, station, filename, data) {
  await writeFile(path.join(directory, station, `${filename}.json`), JSON.stringify(data, null, 2) + "\n");
}

// The NAS is a mounted share (Finder → Go → Connect to Server → smb://<NAS IP>/<share>), so this is a plain copy.
// The base folder has to exist already: if the share is not mounted, creating /Volumes/<share>/… would quietly
// write to the local disk instead.
export async function saveNas(bytes, station, filename, nasDir) {
  if (!(await stat(nasDir)).isDirectory()) throw Object.assign(new Error("not a folder"), { code: "ENOENT" });
  const directory = path.join(nasDir, station);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
  return path.join(directory, filename);
}

async function slackCall(method, token, init) {
  const response = await fetch(`https://slack.com/api/${method}`, { method: "POST", ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
  if (!data.ok) throw Object.assign(new Error(`${method}: ${data.error || "failed"}`), { slackError: data.error });
  return data;
}

const slackForm = (method, token, params) => slackCall(method, token, { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
const slackJson = (method, token, body) => slackCall(method, token, { headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// files.sharedPublicURL needs a user token and the workspace setting "Allow file sharing via public links". Right
// after an upload the file can still be processing, so retry briefly; an already-public file comes back via files.info.
async function sharePublicly(token, fileId) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return (await slackForm("files.sharedPublicURL", token, { file: fileId })).file;
    } catch (error) {
      if (error.slackError === "already_public") return (await slackForm("files.info", token, { file: fileId })).file;
      if (error.slackError !== "file_not_found" || attempt >= 5) throw error;
      await pause(700);
    }
  }
}

// permalink_public is a slack-files.com page (https://slack-files.com/T-F-SECRET); the embeddable form is
// files-pri/T-F/<filename>?pub_secret=SECRET. Same conversion as the hypomnesis ensemble's img2md bot.
export function publicImageUrl(permalink, permalinkPublic) {
  const [team, fileId, ...secretParts] = (permalinkPublic || "").split("slack-files.com/")[1]?.split("-") || [];
  const secret = secretParts.join("-");
  const filename = (permalink || "").split("/").pop();
  if (!team || !fileId || !secret || !filename) throw new Error(`could not make a public image URL from ${permalinkPublic}`);
  return `https://files.slack.com/files-pri/${team}-${fileId}/${filename}?pub_secret=${secret}`;
}

// The timestamp of the message that carries the file in this channel, so the embed line can go in its thread.
function shareTs(file, channel) {
  const shares = file?.shares || {};
  return shares.public?.[channel]?.[0]?.ts || shares.private?.[channel]?.[0]?.ts || null;
}

// Slack's current upload flow: ask for an upload URL, send the bytes there, then share the file into the channel.
// Either token needs files:write and has to be in the channel. With a user token (`publicLink`), the file is then
// made public and a thread reply carries a Markdown embed line (chat:write; files:read to find the thread).
export async function postSlack(bytes, filename, { token, channel, comment, publicLink }) {
  const { upload_url: uploadUrl, file_id: fileId } = await slackForm("files.getUploadURLExternal", token, { filename, length: String(bytes.length) });
  const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: bytes });
  if (!upload.ok) throw new Error(`upload: HTTP ${upload.status}`);
  await slackJson("files.completeUploadExternal", token, { files: [{ id: fileId, title: filename }], channel_id: channel, initial_comment: comment });
  if (!publicLink) return { fileId };

  const file = await sharePublicly(token, fileId);
  const url = publicImageUrl(file.permalink, file.permalink_public);
  const markdown = `![${filename.replace(/\.jpg$/, "")}](${url})`;

  let ts = shareTs(file, channel);
  for (let attempt = 0; !ts && attempt < 4; attempt += 1) {
    await pause(700);
    ts = shareTs((await slackForm("files.info", token, { file: fileId }).catch(() => ({}))).file, channel);
  }
  await slackJson("chat.postMessage", token, { channel, ...(ts ? { thread_ts: ts } : {}), text: "```\n" + markdown + "\n```", unfurl_links: false, unfurl_media: false }).catch(() => {});
  return { fileId, url, markdown };
}
