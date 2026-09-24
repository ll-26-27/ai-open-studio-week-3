import Link from "next/link";
import { notFound } from "next/navigation";
import { listGalleries, readGallery } from "../../../../lib/galleries.mjs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug = [] } = await params;
  const gallery = slug.length === 1 ? await readGallery(slug[0]) : null;
  return { title: gallery?.title || "Galleries" };
}

function Header() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/tdm155ai">tdm155ai <span>week 3</span></Link>
      <nav aria-label="Main navigation">
        <Link href="/tdm155ai/docs">Docs</Link>
        <Link href="/tdm155ai/glossary">Glossary</Link>
        <Link href="/tdm155ai/galleries" aria-current="true">Galleries</Link>
        <Link href="/tdm155ai/live">Live</Link>
      </nav>
    </header>
  );
}

export default async function GalleriesPage({ params }) {
  const { slug = [] } = await params;
  if (slug.length > 1) notFound();

  if (slug.length === 0) {
    const galleries = await listGalleries();
    return (
      <>
        <Header />
        <main id="main" className="live-main">
          <header className="page-heading">
            <p className="eyebrow">Week 03 / Galleries</p>
            <h1>Galleries</h1>
            <p className="lede">Generated images to compare with what the stations make: one prompt, many models.</p>
          </header>
          <ul className="gallery-index">
            {galleries.map((gallery) => (
              <li key={gallery.slug}>
                <Link href={`/tdm155ai/galleries/${gallery.slug}`}>
                  <span className="gallery-strip">{gallery.items.slice(0, 5).map((item) => <img key={item.file} src={item.src} alt="" loading="lazy" />)}</span>
                  <h2>{gallery.title}</h2>
                  <p>“{gallery.prompt}” · {gallery.items.length} images · {gallery.made}</p>
                </Link>
              </li>
            ))}
          </ul>
        </main>
      </>
    );
  }

  const gallery = await readGallery(slug[0]);
  if (!gallery) notFound();
  return (
    <>
      <Header />
      <main id="main" className="live-main">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/tdm155ai">Home</Link><span>/</span><Link href="/tdm155ai/galleries">Galleries</Link><span>/</span><Link href="/tdm155ai/docs/stations/01-studio-lights">Station 1: Studio lights</Link>
        </nav>
        <header className="page-heading">
          <p className="eyebrow">Week 03 / Gallery · {gallery.made}</p>
          <h1>{gallery.title}</h1>
          <p className="lede">Prompt: <strong>“{gallery.prompt}”</strong></p>
          {gallery.note && <p className="gallery-note">{gallery.note}</p>}
        </header>
        <ul className="gallery-grid">
          {gallery.items.map((item) => (
            <li key={item.file}>
              <a href={item.src} target="_blank" rel="noreferrer"><img src={item.src} alt={`${item.model} portrait for “${gallery.prompt}”`} width={item.width} height={item.height} loading="lazy" /></a>
              <div className="gallery-caption">
                <h2>{item.model}</h2>
                <p className="gallery-meta">{item.company} · {item.width}×{item.height} · {item.endpoint}</p>
                {item.lighting && <p className="gallery-lighting">{item.lighting}</p>}
              </div>
            </li>
          ))}
        </ul>
      </main>
      <footer className="site-footer"><Link href="/tdm155ai">TDM155AI · Week 3</Link><Link href="/tdm155ai/docs/stations/01-studio-lights">Back to the lights station</Link></footer>
    </>
  );
}
