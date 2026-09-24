import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Generated-image galleries: one folder per gallery in nextjs/public/galleries/<slug>/, holding the images and a
// gallery.json ({ title, prompt, made, note, items: [{ file, model, company, endpoint, width, height, lighting }] }).
// The images are served by Next as static files at /galleries/<slug>/<file>.
const root = path.join(process.cwd(), "public", "galleries");

export async function readGallery(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const gallery = JSON.parse(await readFile(path.join(root, slug, "gallery.json"), "utf8"));
    return { ...gallery, slug, items: (gallery.items || []).map((item) => ({ ...item, src: `/galleries/${slug}/${encodeURIComponent(item.file)}` })) };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function listGalleries() {
  let entries = [];
  try { entries = await readdir(root, { withFileTypes: true }); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const galleries = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => readGallery(entry.name)));
  return galleries.filter(Boolean).sort((a, b) => String(b.made).localeCompare(String(a.made)));
}
