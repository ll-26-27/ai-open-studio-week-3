import Link from "next/link";
import { examples } from "../lib/examples.mjs";

export default function Home() {
  return (
    <main id="main">
      <section className="hero" aria-labelledby="studio-title">
        <div className="hero-meta"><span>Learning Lab · Bok Center</span><span>Supporting in-person assignments and activities</span></div>
        <h1 id="studio-title"><span>ai open</span><span>studio</span><span>week <span className="accent">3</span></span></h1>
        <div className="hero-foot"><span>Media projects · orals · notes from photos</span><span aria-hidden="true">↓</span><span>September 24, 2026</span></div>
      </section>
      <nav className="home-links" aria-label="Examples">
        {examples.map((example) => (
          <Link className="home-link" href={example.href} key={example.href}>
            <span className="eyebrow">{example.number} / {example.eyebrow}</span>
            <div className="home-link-title"><h2>{example.title}</h2><span aria-hidden="true">↗</span></div>
            <p>{example.description}</p>
          </Link>
        ))}
      </nav>
      <footer className="site-footer"><span>AI Open Studio</span><span>Thursdays 1:30, the Learning Lab</span></footer>
    </main>
  );
}
