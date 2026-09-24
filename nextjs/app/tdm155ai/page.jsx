import Link from "next/link";
import { collections } from "../../lib/content.mjs";

const links = [
  ...Object.entries(collections).map(([slug, collection]) => ({ href: `/tdm155ai/${slug}`, number: collection.number, title: collection.title, description: collection.description })),
  { href: "/tdm155ai/live", number: "03", title: "Live", description: "The gallery of what the room is making today, refreshed as files land." },
];

export default function Home() {
  return (
    <main id="main">
      <section className="hero" aria-labelledby="course-title">
        <div className="hero-meta"><span>Harvard · Fall 2026</span><span>Tools of the AV trade</span></div>
        <h1 id="course-title"><span>tdm155ai</span><span>week <span className="accent">3</span></span></h1>
        <div className="hero-foot"><span>Cameras · lenses · light · sound</span><span aria-hidden="true">↓</span><span>September 23, 2026</span></div>
      </section>
      <nav className="home-links home-links-3" aria-label="Explore">
        {links.map((link) => (
          <Link className="home-link" href={link.href} key={link.href}>
            <span className="eyebrow">{link.number} / Explore</span>
            <div className="home-link-title"><h2>{link.title}</h2><span aria-hidden="true">↗</span></div>
            <p>{link.description}</p>
          </Link>
        ))}
      </nav>
      <footer className="site-footer"><span>TDM155AI</span><span>Shoot something. Look at it. Shoot it again.</span></footer>
    </main>
  );
}
