// Print pages are the one light surface: black ink on white, no chrome. Everything else on the site is dark.
export const metadata = { title: { default: "Print · TDM155AI", template: "%s · Print · TDM155AI" } };

export default function PrintLayout({ children }) {
  return <div className="print-root">{children}</div>;
}
