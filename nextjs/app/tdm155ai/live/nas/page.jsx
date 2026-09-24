import { stat } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { captureConfig, withTimeout } from "../../../../lib/capture.mjs";
import { listMedia } from "../../../../lib/media.mjs";
import AutoRefresh from "../AutoRefresh.jsx";
import Gallery from "../Gallery.jsx";

export const dynamic = "force-dynamic";

export const metadata = { title: "Live (NAS)" };

// Experimental: the same wall as /live, but read from the NAS folder every studio machine copies its captures to.
// Reading a network share on every refresh may be slow or flaky; /live (this machine only) stays the reliable one.
async function readNas() {
  const { nasDir } = captureConfig();
  if (!nasDir) return { problem: "CAPTURE_NAS_DIR isn't set in nextjs/.env.local on this machine." };
  const root = path.resolve(nasDir);
  try {
    if (!(await withTimeout(stat(root), 5000, "The NAS")).isDirectory()) return { problem: `${root} isn't a folder.` };
  } catch {
    return { problem: `Can't reach ${root}. Is the NAS share mounted? (Finder → Go → Connect to Server → smb://<NAS IP>/<share>)` };
  }
  try {
    const started = Date.now();
    const { items, skipped } = await withTimeout(listMedia(root, "/nas-media/"), 10000, "Reading the NAS");
    return { items, skipped, root, ms: Date.now() - started };
  } catch (error) {
    return { problem: `Reading the NAS failed: ${error.message}` };
  }
}

export default async function NasLivePage() {
  const nas = await readNas();
  const items = nas.items || [];

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
          <p className="eyebrow">Week 03 / Live / NAS · experimental</p>
          <h1>Every machine, via the NAS</h1>
          <p className="lede">Captures from all the studio machines, read from the shared NAS folder, newest first. {nas.problem ? "" : items.length ? `${items.length} file${items.length === 1 ? "" : "s"}, read in ${nas.ms} ms.` : "Nothing there yet."} <Link href="/tdm155ai/live">This machine only →</Link></p>
          <AutoRefresh seconds={15} />
        </header>
        {nas.problem
          ? <section className="live-empty"><p className="eyebrow">Not connected</p><p>{nas.problem}</p></section>
          : items.length > 0 && <Gallery items={items} />}
      </main>
      <footer className="site-footer"><Link href="/tdm155ai">TDM155AI · Week 3</Link><span>{nas.root || "NAS not connected"}</span></footer>
    </>
  );
}
