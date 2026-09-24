import Link from "next/link";
import { listMedia } from "../../../lib/media.mjs";
import AutoRefresh from "./AutoRefresh.jsx";
import Gallery from "./Gallery.jsx";

// Read _media/ on every request; the client component above refreshes it on a timer.
export const dynamic = "force-dynamic";

export const metadata = { title: "Live" };

export default async function LivePage() {
  const { items, skipped } = await listMedia();
  const images = items.filter((item) => item.type === "image").length;
  const videos = items.length - images;

  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/tdm155ai">tdm155ai <span>week 3</span></Link>
        <nav aria-label="Main navigation">
          <Link href="/tdm155ai/docs">Docs</Link>
          <Link href="/tdm155ai/glossary">Glossary</Link>
          <Link href="/tdm155ai/capture">Capture</Link>
          <Link href="/tdm155ai/live" aria-current="true">Live</Link>
        </nav>
      </header>
      <main id="main" className="live-main">
        <header className="page-heading live-heading">
          <p className="eyebrow">Week 03 / Live</p>
          <h1>What the room is making</h1>
          <p className="lede">Stills and clips from today's stations, newest first. {items.length ? `${images} image${images === 1 ? "" : "s"}${videos ? ` and ${videos} clip${videos === 1 ? "" : "s"}` : ""}.` : "Nothing yet."} <Link href="/tdm155ai/live/nas">All machines, via the NAS (experimental) →</Link></p>
          <AutoRefresh seconds={10} />
        </header>
        {skipped > 0 && <p className="live-note">{skipped} file{skipped === 1 ? "" : "s"} skipped: HEIC and RAW can't be shown in a browser. Export as JPEG or PNG (on iPhone: Settings → Camera → Formats → Most Compatible, or share via Files, which converts).</p>}
        {items.length === 0 ? (
          <section className="live-empty">
            <p className="eyebrow">Empty</p>
            <p>Drop images or clips into <code>_media/</code> at the root of this repo. They appear here within a few seconds; subfolders are fine.</p>
          </section>
        ) : (
          <Gallery items={items} />
        )}
      </main>
      <footer className="site-footer"><Link href="/tdm155ai">TDM155AI · Week 3</Link><span>Tools of the AV trade</span></footer>
    </>
  );
}
