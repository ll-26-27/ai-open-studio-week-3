import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

// The live gallery reads from `_media/` at the repo root (gitignored). Anyone can run the app with an
// empty or different folder; the page just shows whatever is there right now.
export const mediaRoot = path.resolve(process.cwd(), "..", "_media");

export const imageTypes = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".svg": "image/svg+xml" };
export const videoTypes = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".m4v": "video/x-m4v" };
// Shot on an iPhone by default; browsers cannot show these, so the gallery counts them and asks for a conversion.
export const unsupportedTypes = new Set([".heic", ".heif", ".hevc", ".dng", ".raw", ".cr2", ".arw"]);

export function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return imageTypes[ext] || videoTypes[ext] || null;
}

// Resolve a URL path inside a media folder (_media/ unless told otherwise), refusing anything that escapes it.
export function resolveMedia(segments, root = mediaRoot) {
  const target = path.resolve(root, ...segments.map(decodeURIComponent));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

// Serves one file from a media folder, with Range support so video scrubs and plays in Safari.
export async function mediaResponse(request, segments, root = mediaRoot) {
  const file = resolveMedia(segments, root);
  const type = file && contentType(file);
  if (!file || !type) return new Response("Not found", { status: 404 });

  let info;
  try { info = await stat(file); } catch { return new Response("Not found", { status: 404 }); }
  if (!info.isFile()) return new Response("Not found", { status: 404 });

  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
  const range = request.headers.get("range");
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (match) {
    const start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
    if (start >= info.size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
    headers["Content-Length"] = String(end - start + 1);
    return new Response(Readable.toWeb(createReadStream(file, { start, end })), { status: 206, headers });
  }
  headers["Content-Length"] = String(info.size);
  return new Response(Readable.toWeb(createReadStream(file)), { status: 200, headers });
}

// Every image and video under a media folder (_media/ by default), any depth, newest first. `prefix` is the route
// that serves that folder.
export async function listMedia(root = mediaRoot, prefix = "/media/") {
  const items = [];
  let skipped = 0;
  async function visit(directory, segments) {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === "ENOENT") return; throw error; }
    const names = new Set(entries.map((entry) => entry.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) { await visit(full, [...segments, entry.name]); continue; }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (unsupportedTypes.has(ext)) { skipped += 1; continue; }
      const type = imageTypes[ext] ? "image" : videoTypes[ext] ? "video" : null;
      if (!type) continue;
      const info = await stat(full);
      // A capture's description sits beside it as <image>.json (see lib/capture.mjs).
      let description = "";
      if (type === "image" && names.has(`${entry.name}.json`)) {
        try { description = JSON.parse(await readFile(`${full}.json`, "utf8")).description || ""; } catch {}
      }
      items.push({
        description,
        name: entry.name,
        folder: segments.join("/"),
        type,
        src: prefix + [...segments, entry.name].map(encodeURIComponent).join("/"),
        bytes: info.size,
        modified: info.mtimeMs,
      });
    }
  }
  await visit(root, []);
  items.sort((a, b) => b.modified - a.modified);
  return { items, skipped };
}
