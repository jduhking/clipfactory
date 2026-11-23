#!/usr/bin/env node
// Builds the generated parts of the static site. Zero dependencies; the output is committed, so Vercel serves the
// folder as is. `node build.mjs` writes the files; `node build.mjs --check` fails if any committed file is stale.
//
// - guide/*.html from ../docs/guide/*.md (the user guide the app's Help opens);
// - pages from site/pages/**/*.html fragments (pricing, architecture, legal, billing return pages, 404);
// - the shared header and footer, and the pricing cards, stamped into the hand-written pages;
// - sitemap.xml.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdown, escapeHtml } from "./site/markdown.mjs";
import { page, header, footer, stamp, canonical, SITE, REPO } from "./site/layout.mjs";
import { pricingCards, pricingTable } from "./site/plans.mjs";
import { renderDiagram } from "./site/diagrams.mjs";
import { swarmMarkup, loopMarkup } from "./motion.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const GUIDE_SRC = join(ROOT, "..", "docs", "guide");
const HAND_PAGES = ["product.html", "learning.html"];

/** Docs sidebar. Every guide page must appear exactly once; build fails otherwise. */
export const DOCS_NAV = [
  ["Start here", ["", "getting-started", "faq"]],
  ["Using the app", ["factory", "factory-map", "library", "studio", "results", "references", "brand-profile", "posting"]],
  ["Setup and account", ["models", "settings-privacy", "plans"]],
  ["Under the hood", ["@architecture", "self-hosting"]],
];
const NAV_LABELS = { "": "Overview", "@architecture": "Architecture" };

const guideHref = (name) => (name === "" ? "/guide/" : name === "@architecture" ? "/architecture.html" : `/guide/${name}.html`);
const guidePath = (name) => (name === "" ? "/guide/index.html" : `/guide/${name}.html`);

function rewriteGuideLink(href) {
  if (href.startsWith(SITE)) {
    const path = href.slice(SITE.length) || "/";
    return path === "/" || path.endsWith("/") || path.includes(".") ? path : path.replace(/^([^#]*)/, "$1.html");
  }
  const local = href.match(/^([\w-]+)\.md(#.*)?$/);
  if (!local) return href;
  const [, name, hash = ""] = local;
  return (name === "README" ? "/guide/" : `/guide/${name}.html`) + hash;
}

function description(html) {
  const text = (html.match(/<p>([\s\S]*?)<\/p>/)?.[1] || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  return text.length > 158 ? `${text.slice(0, 155).replace(/\s+\S*$/, "")}…` : text;
}

async function guidePages() {
  const files = (await readdir(GUIDE_SRC)).filter((f) => f.endsWith(".md")).sort();
  const names = files.map((f) => (f === "README.md" ? "" : f.slice(0, -3)));
  const listed = DOCS_NAV.flatMap(([, items]) => items).filter((n) => !n.startsWith("@"));
  const missing = names.filter((n) => !listed.includes(n));
  const extra = listed.filter((n) => !names.includes(n));
  if (missing.length || extra.length || new Set(listed).size !== listed.length) {
    throw new Error(`DOCS_NAV and docs/guide disagree. Missing: ${missing.join(", ") || "-"}; unknown: ${extra.join(", ") || "-"}`);
  }
  const rendered = new Map();
  for (const name of names) {
    const source = await readFile(join(GUIDE_SRC, name === "" ? "README.md" : `${name}.md`), "utf8");
    rendered.set(name, renderMarkdown(source, { rewriteLink: rewriteGuideLink }));
  }
  const order = DOCS_NAV.flatMap(([, items]) => items);
  const label = (name) => NAV_LABELS[name] || rendered.get(name).title;
  const out = new Map();
  for (const name of names) {
    const { html, title, headings } = rendered.get(name);
    const path = guidePath(name);
    const sidebar = DOCS_NAV.map(([group, items]) => `<div><h2>${group}</h2><ul>${items.map((item) =>
      `<li><a href="${guideHref(item)}"${item === name ? ' aria-current="page"' : ""}>${escapeHtml(label(item))}</a></li>`).join("")}</ul></div>`).join("");
    const at = order.indexOf(name);
    const prev = order[at - 1];
    const next = order[at + 1];
    const pager = [
      prev !== undefined ? `<a class="docs-prev" href="${guideHref(prev)}"><span>Previous</span>${escapeHtml(label(prev))}</a>` : "<span></span>",
      next !== undefined ? `<a class="docs-next" href="${guideHref(next)}"><span>Next</span>${escapeHtml(label(next))}</a>` : "<span></span>",
    ].join("");
    const toc = headings.length
      ? `<aside class="docs-toc" aria-labelledby="toc-title"><h2 id="toc-title">On this page</h2><ul>${headings.map((h) => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join("")}</ul></aside>`
      : "";
    const file = name === "" ? "README.md" : `${name}.md`;
    const main = `<div class="wrap docs-layout">
<nav class="docs-nav" aria-label="Documentation">${sidebar}</nav>
<article class="docs-article"><p class="page-kicker">User guide</p><h1>${escapeHtml(title)}</h1>
<div class="prose">
${html}
</div>
<nav class="docs-pager" aria-label="Previous and next page">${pager}</nav>
<p class="docs-edit"><a href="${REPO}/blob/master/docs/guide/${file}" target="_blank" rel="noopener noreferrer">Edit this page on GitHub ↗</a></p></article>
${toc}
</div>`;
    const pageTitle = name === "" ? "User guide — Growth Factory" : `${title} — Growth Factory guide`;
    out.set(path.slice(1), page({ title: pageTitle, description: description(html), path, bodyClass: "docs-page", main }));
  }
  return out;
}

/** Replace <!-- build:name arg --> placeholders (and any previous output between paired markers). */
function fill(html, catalog) {
  return html.replace(/<!-- build:([\w-]+)(?: ([\w-]+))? -->(?:[\s\S]*?<!-- \/build:\1 -->)?/g, (_, name, arg) => {
    const content =
      name === "pricing-cards" ? pricingCards(catalog)
      : name === "pricing-table" ? pricingTable(catalog)
      : name === "diagram" ? renderDiagram(arg)
      : name === "scene" && arg === "swarm" ? swarmMarkup()
      : name === "scene" && arg === "loop" ? loopMarkup()
      : (() => { throw new Error(`Unknown build placeholder: ${name}`); })();
    return `<!-- build:${name}${arg ? ` ${arg}` : ""} -->${content}<!-- /build:${name} -->`;
  });
}

function stampChrome(html, path, file) {
  let count = 0;
  const out = html.replace(/<!-- site:(header|footer) -->[\s\S]*?<!-- \/site:\1 -->/g, (_, tag) => {
    count++;
    return stamp(tag, tag === "header" ? header(path) : footer(path));
  });
  if (count !== 2) throw new Error(`${file}: expected one site:header and one site:footer marker pair, found ${count}`);
  return out;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])));
  return files.flat();
}

async function fragmentPages(catalog) {
  const out = new Map();
  const base = join(ROOT, "site", "pages");
  for (const file of (await walk(base)).filter((f) => f.endsWith(".html")).sort()) {
    const rel = relative(base, file).split("\\").join("/");
    const source = await readFile(file, "utf8");
    const meta = source.match(/^<!--meta\s+(\{[\s\S]*?\})\s*-->\n?/);
    if (!meta) throw new Error(`site/pages/${rel}: missing <!--meta {...} --> header`);
    const { title, description: desc, noindex = false, bodyClass = "" } = JSON.parse(meta[1]);
    const main = fill(source.slice(meta[0].length).trim(), catalog);
    out.set(rel, page({ title, description: desc, path: `/${rel}`, noindex, bodyClass, main }));
  }
  return out;
}

async function handPages(catalog) {
  const out = new Map();
  for (const file of HAND_PAGES) {
    const source = await readFile(join(ROOT, file), "utf8");
    out.set(file, fill(stampChrome(source, file === "index.html" ? "/" : `/${file}`, file), catalog));
  }
  return out;
}

function sitemap(files) {
  const urls = [...files.entries()]
    .filter(([file, html]) => file.endsWith(".html") && !/name="robots" content="noindex"/.test(html))
    .map(([file]) => canonical(`/${file === "index.html" ? "" : file}`))
    .sort((a, b) => (a === `${SITE}/` ? -1 : b === `${SITE}/` ? 1 : a.localeCompare(b)));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
}

export async function build() {
  const catalog = JSON.parse(await readFile(join(ROOT, "plans.json"), "utf8"));
  const files = new Map([...(await handPages(catalog)), ...(await fragmentPages(catalog)), ...(await guidePages())]);
  files.set("sitemap.xml", sitemap(files));
  return files;
}

async function main() {
  const check = process.argv.includes("--check");
  const files = await build();
  const stale = [];
  for (const [file, content] of files) {
    const target = join(ROOT, file);
    const current = await readFile(target, "utf8").catch(() => null);
    if (current === content) continue;
    if (check) { stale.push(file); continue; }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    console.log(`wrote ${file}`);
  }
  const generated = (await walk(join(ROOT, "guide")).catch(() => [])).map((f) => relative(ROOT, f).split("\\").join("/"));
  const orphans = generated.filter((f) => !files.has(f));
  if (check && (stale.length || orphans.length)) {
    console.error(`The site is out of date. Run \`npm run build\` in landing-page/.\n${[...stale.map((f) => `  stale: ${f}`), ...orphans.map((f) => `  orphan: ${f}`)].join("\n")}`);
    process.exit(1);
  }
  if (!check && orphans.length) console.warn(`Remove pages no longer generated: ${orphans.join(", ")}`);
  if (check) console.log(`Site is up to date (${files.size} generated files).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
