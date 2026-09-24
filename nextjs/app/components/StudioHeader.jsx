import Link from "next/link";

// The header for the studio's own pages (everything outside /tdm155ai).
const links = [
  { href: "/writing", label: "Writing" },
  { href: "/present", label: "Present" },
  { href: "/tdm155ai", label: "TDM 155AI" },
];

export default function StudioHeader({ current }) {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/">ai open studio <span>week 3</span></Link>
      <nav aria-label="Main navigation">
        {links.map((link) => <Link key={link.href} href={link.href} aria-current={current === link.href ? "true" : undefined}>{link.label}</Link>)}
      </nav>
    </header>
  );
}
