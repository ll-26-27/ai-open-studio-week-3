import Link from "next/link";
import { notFound } from "next/navigation";
import { collections, glossaryIndex, label, pageHref, readCollection } from "../../../../lib/content.mjs";
import Markdown from "../../../components/Markdown.jsx";
import TermList from "../../../components/TermList.jsx";

// Read the Markdown on each request so edits and new files appear on refresh.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { collection, slug = [] } = await params;
  if (!Object.hasOwn(collections, collection)) return {};
  const docs = await readCollection(collection);
  const doc = docs.find((entry) => entry.slug.join("/") === slug.join("/"));
  return { title: doc?.title || (slug[0] ? label(slug[0]) : collections[collection].title) };
}

export default async function ContentPage({ params }) {
  const { collection, slug = [] } = await params;
  if (!Object.hasOwn(collections, collection) || slug.length > 2) notFound();
  const info = collections[collection];
  const docs = await readCollection(collection);
  const doc = docs.find((entry) => entry.slug.join("/") === slug.join("/"));
  const groups = [...new Set(docs.map((entry) => entry.group))];
  const isGroup = slug.length === 1 && groups.includes(slug[0]);
  if (slug.length && !doc && !isGroup) notFound();
  const visibleGroups = isGroup ? [slug[0]] : groups;
  const title = doc?.title || (isGroup ? label(slug[0]) : info.title);
  const termSlugs = Array.isArray(doc?.data?.terms) ? doc.data.terms : [];
  const glossary = termSlugs.length ? await glossaryIndex() : {};
  const terms = termSlugs.map((key) => ({ slug: key, term: glossary[key]?.term || key, short: glossary[key]?.short || "", href: pageHref("glossary", [key]) }));
  const printHref = doc ? doc.href.replace(/^\/tdm155ai/, "/tdm155ai/print") : null;

  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/tdm155ai">tdm155ai <span>week 3</span></Link>
        <nav aria-label="Main navigation">
          {Object.entries(collections).map(([key, value]) => <Link key={key} href={`/tdm155ai/${key}`} aria-current={key === collection ? "true" : undefined}>{value.title}</Link>)}
          <Link href="/tdm155ai/live">Live</Link>
        </nav>
      </header>
      <div className="content-shell">
        <aside className="sidebar">
          <Link className="eyebrow sidebar-title" href={`/tdm155ai/${collection}`}>{info.number} / {info.title}</Link>
          <nav aria-label={`${info.title} contents`}>
            {groups.map((group) => (
              <div className="sidebar-group" key={group}>
                <Link className="group-label" href={pageHref(collection, group ? [group] : [])}>{group ? label(group) : "Overview"}</Link>
                {docs.filter((entry) => entry.group === group).map((entry) => <Link className="sidebar-link" key={entry.href} href={entry.href} aria-current={doc?.href === entry.href ? "page" : undefined}>{entry.title}</Link>)}
              </div>
            ))}
          </nav>
        </aside>
        <main id="main" className="content-main">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/tdm155ai">Home</Link><span>/</span><Link href={`/tdm155ai/${collection}`}>{info.title}</Link>
            {slug.length > 0 && <><span>/</span>{doc && doc.group ? <Link href={pageHref(collection, [doc.group])}>{label(doc.group)}</Link> : <span>{title}</span>}</>}
          </nav>
          <header className="page-heading">
            <p className="eyebrow">Week 03 / {doc ? "Reading" : "Collection"}</p>
            <h1>{title}</h1>
            {(doc?.description || !doc) && <p className="lede">{doc ? doc.description : isGroup ? `${docs.filter((entry) => entry.group === slug[0]).length} notes to explore.` : info.description}</p>}
          </header>
          {doc ? (
            <>
              <TermList terms={terms} />
              <article className="prose">
                <Markdown doc={doc} />
              </article>
              <div className="article-end"><Link href={pageHref(collection, doc.group ? [doc.group] : [])}>← Back to {doc.group ? label(doc.group) : info.title}</Link>{printHref && <a href={printHref}>Print version ↗</a>}</div>
            </>
          ) : (
            <div className="document-groups">
              {visibleGroups.map((group) => (
                <section className="document-group" key={group}>
                  <h2>{group ? label(group) : "Overview"}</h2>
                  {docs.filter((entry) => entry.group === group).map((entry, index) => (
                    <Link className="document-link" key={entry.href} href={entry.href}>
                      <span className="document-number">{String(index + 1).padStart(2, "0")}</span>
                      <div><h3>{entry.title}</h3>{entry.description && <p>{entry.description}</p>}</div>
                      <span className="document-arrow" aria-hidden="true">↗</span>
                    </Link>
                  ))}
                </section>
              ))}
              {docs.length === 0 && <p className="lede">The first notes are on their way.</p>}
            </div>
          )}
        </main>
      </div>
      <footer className="site-footer"><Link href="/tdm155ai">TDM155AI · Week 3</Link><span>Tools of the AV trade</span></footer>
    </>
  );
}
