import "@fontsource-variable/inter";
import "./globals.css";

export const metadata = {
  title: { default: "AI Open Studio · Week 3", template: "%s · AI Open Studio" },
  description: "AI Open Studio, week 3: supporting in-person assignments and activities, with examples from the Learning Lab's courses.",
};

// The site is dark only; there is no light theme to switch to.
export const viewport = { colorScheme: "dark", themeColor: "#0e0f0e" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
