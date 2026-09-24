import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

// The TDM 155AI week 3 site lives one level down, at /tdm155ai; its Markdown is under _context/tdm155ai/.
export const base = "/tdm155ai";

// `dir` is the folder relative to the repo root.
export const collections = {
  docs: { title: "Docs", description: "Today's four stations and their cards, this week's practice, tools, dates, and the reference pages.", number: "01", dir: "_context/tdm155ai/docs" },
  glossary: { title: "Glossary", description: "One short entry per term: the words for lenses, light, sound, and recording formats.", number: "02", dir: "_context/tdm155ai/glossary" },
};

export function label(slug) {
  return slug.replace(/[-_]/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function pageHref(collection, segments = []) {
  return base + "/" + [collection, ...segments].map(encodeURIComponent).join("/");
}

// Only the collections above are exposed, at most one folder deep. Symlinks are skipped.
export async function readCollection(collection) {
  if (!Object.hasOwn(collections, collection)) return [];
  const root = path.join(process.cwd(), "..", collections[collection].dir);
  const documents = [];

  async function visit(directory, segments = []) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory() && segments.length === 0) {
        await visit(filename, [entry.name]);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const { data, content } = matter(await readFile(filename, "utf8"));
        const slug = [...segments, entry.name.slice(0, -3)];
        const heading = content.match(/^#\s+(.+)$/m)?.[1];
        documents.push({
          slug,
          group: segments[0] || "",
          title: typeof data.title === "string" ? data.title : heading || label(slug.at(-1)),
          description: typeof data.description === "string" ? data.description : "",
          content,
          data,
          href: pageHref(collection, slug),
        });
      }
    }
  }

  await visit(root);
  // Sort by folder, then by filename, so zero-padded names (01-, 02-, …) read in order.
  return documents.sort((a, b) => a.group.localeCompare(b.group) || a.slug.at(-1).localeCompare(b.slug.at(-1)));
}

// Keep sibling and ../ Markdown links useful in the rendered site, including anchors.
export function markdownHref(href, documentHref) {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return href;
  const url = new URL(href, `https://content.local${documentHref}`);
  url.pathname = url.pathname.replace(/\.md$/i, "");
  // On disk the collections live under _context/tdm155ai/; on the site they are routes under /tdm155ai. Root-absolute
  // links in the Markdown (/capture, /live) were written for the class site, so they get the same prefix.
  if (url.pathname.startsWith("/_context/")) url.pathname = url.pathname.slice("/_context".length);
  else if (href.startsWith("/") && url.pathname !== base && !url.pathname.startsWith(base + "/")) url.pathname = base + url.pathname;
  return url.pathname + url.search + url.hash;
}

// slug → { term, short } for every glossary entry, used to print one-line definitions on the station cards.
export async function glossaryIndex() {
  const docs = await readCollection("glossary");
  const index = {};
  for (const doc of docs) {
    if (doc.slug.length !== 1 || doc.slug[0] === "README") continue;
    const { term, short } = doc.data;
    if (typeof term === "string" && typeof short === "string") index[doc.slug[0]] = { term, short, href: doc.href };
  }
  return index;
}

// The four station cards, in order, with their terms resolved against the glossary.
export async function stationCards() {
  const [docs, glossary] = await Promise.all([readCollection("docs"), glossaryIndex()]);
  return docs
    .filter((doc) => doc.group === "stations")
    .map((doc) => ({ ...doc, terms: (Array.isArray(doc.data.terms) ? doc.data.terms : []).map((slug) => glossary[slug] ? { slug, ...glossary[slug] } : { slug, term: slug, short: "", href: pageHref("glossary", [slug]) }) }));
}
