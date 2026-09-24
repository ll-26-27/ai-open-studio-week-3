import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

export default {
  // Next blocks dev resources (HMR, lazy client chunks) for hostnames other than localhost, which leaves pages
  // un-hydrated when opened via 127.0.0.1 or a LAN address. Add any host you open the dev server from.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.local"],
  turbopack: { root: path.resolve(appRoot, "..") },
  outputFileTracingRoot: path.resolve(appRoot, ".."),
  outputFileTracingIncludes: {
    "/*": ["../_context/tdm155ai/docs/**/*.md", "../_context/tdm155ai/glossary/**/*.md"],
  },
};
