import Link from "next/link";
import { stations } from "../../../lib/capture.mjs";
import CaptureClient from "./CaptureClient.jsx";

export const dynamic = "force-dynamic";

export const metadata = { title: "Capture" };

// /capture?station=lights (or obscura, cameras, phone). The feed comes from whatever camera the browser can see:
// the Web Presenter's USB-C webcam output shows up as a camera with no driver.
export default async function CapturePage({ searchParams }) {
  const { station } = await searchParams;
  const initial = Object.hasOwn(stations, station || "") ? station : "other";

  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/tdm155ai">tdm155ai <span>week 3</span></Link>
        <nav aria-label="Main navigation">
          <Link href="/tdm155ai/docs">Docs</Link>
          <Link href="/tdm155ai/glossary">Glossary</Link>
          <Link href="/tdm155ai/capture" aria-current="true">Capture</Link>
          <Link href="/tdm155ai/live">Live</Link>
        </nav>
      </header>
      <main id="main" className="capture-main">
        <CaptureClient stations={stations} initialStation={initial} />
      </main>
    </>
  );
}
