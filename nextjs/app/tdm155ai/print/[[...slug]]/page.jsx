import { notFound } from "next/navigation";
import { collections, readCollection, stationCards } from "../../../../lib/content.mjs";
import Markdown from "../../../components/Markdown.jsx";
import TermList from "../../../components/TermList.jsx";

export const dynamic = "force-dynamic";

const categories = [["sound", "Sound"], ["support", "Support and movement"], ["light", "Light"], ["lens", "Lenses and cameras"], ["exposure", "Exposure and control"], ["formats", "Recording formats"], ["experiments", "Experiments and ideas"]];

function PrintBar({ hint }) {
  return (
    <header className="print-bar">
      <span>TDM 155AI · Week 3 · Tools of the AV trade</span>
      <span>{hint || "⌘P to print"}</span>
    </header>
  );
}

function Card({ doc, pageBreak }) {
  return (
    <article className={pageBreak ? "print-card page-break" : "print-card"}>
      <p className="eyebrow">Station {doc.data.station ?? ""}</p>
      <h1>{doc.title.replace(/^Station \d+:\s*/, "")}</h1>
      {doc.description && <p className="lede">{doc.description}</p>}
      <TermList terms={doc.terms} />
      <div className="prose"><Markdown doc={doc} copyButtons={false} /></div>
      {doc.data.share && <p className="print-share"><strong>Share:</strong> {doc.data.share}</p>}
    </article>
  );
}

export async function generateMetadata({ params }) {
  const { slug = [] } = await params;
  return { title: slug[0] === "cards" ? "Station cards" : slug[0] === "glossary" && slug.length === 1 ? "Glossary" : slug.at(-1) || "Printables" };
}

export default async function PrintPage({ params }) {
  const { slug = [] } = await params;

  if (slug.length === 0) {
    return (
      <main className="print-main">
        <PrintBar hint="index" />
        <h1>Printables</h1>
        <ul className="print-index">
          <li><a href="/tdm155ai/print/cards">The four station cards</a>, one page each</li>
          <li><a href="/tdm155ai/print/glossary">The glossary</a>, one line per term</li>
          <li><a href="/tdm155ai/print/docs/02-tools">Tools</a></li>
          <li><a href="/tdm155ai/print/docs/03-dates">Dates</a></li>
          <li><a href="/tdm155ai/print/docs/01-practice">This week's practice</a></li>
          <li>Any page: put <code>/print</code> in front of its address.</li>
        </ul>
      </main>
    );
  }

  if (slug[0] === "cards") {
    const cards = await stationCards();
    return <main className="print-main">{cards.map((doc, index) => <Card doc={doc} key={doc.href} pageBreak={index > 0} />)}</main>;
  }

  if (slug[0] === "glossary" && slug.length === 1) {
    const docs = await readCollection("glossary");
    const entries = docs.filter((doc) => doc.slug.length === 1 && doc.slug[0] !== "README" && doc.data.term).map((doc) => doc.data);
    return (
      <main className="print-main print-glossary">
        <PrintBar />
        <h1>Glossary</h1>
        {categories.map(([key, name]) => {
          const rows = entries.filter((entry) => entry.category === key).sort((a, b) => a.term.localeCompare(b.term));
          return rows.length ? (
            <section key={key}>
              <h2>{name}</h2>
              <dl>{rows.map((entry) => <div className="term" key={entry.slug}><dt>{entry.term}</dt><dd>{entry.short}</dd></div>)}</dl>
            </section>
          ) : null;
        })}
      </main>
    );
  }

  const [collection, ...rest] = slug;
  if (!Object.hasOwn(collections, collection)) notFound();
  const docs = await readCollection(collection);
  const doc = docs.find((entry) => entry.slug.join("/") === rest.join("/"));
  if (!doc) notFound();
  if (doc.group === "stations") {
    const cards = await stationCards();
    const card = cards.find((entry) => entry.href === doc.href);
    return <main className="print-main"><Card doc={card} /></main>;
  }
  return (
    <main className="print-main">
      <PrintBar />
      <article className="print-card">
        <h1>{doc.title}</h1>
        {doc.description && <p className="lede">{doc.description}</p>}
        <div className="prose"><Markdown doc={doc} copyButtons={false} /></div>
      </article>
    </main>
  );
}
