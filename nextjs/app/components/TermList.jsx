import Link from "next/link";

// "Terms to master" block: each station card's terms with the glossary's one-line definition.
export default function TermList({ terms, heading = "Terms to master" }) {
  if (!terms?.length) return null;
  return (
    <section className="term-list" aria-label={heading}>
      <p className="eyebrow">{heading}</p>
      <dl>
        {terms.map((term) => (
          <div className="term" key={term.slug}>
            <dt><Link href={term.href}>{term.term}</Link></dt>
            <dd>{term.short}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
