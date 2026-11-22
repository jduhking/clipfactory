// Every page of the site: generated output is current, links and anchors resolve, pricing matches plans.json,
// and no unreleased installer is linked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { join, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { build, DOCS_NAV } from "../build.mjs";
import { DIAGRAMS, renderDiagram } from "../site/diagrams.mjs";
import { SITE } from "../site/layout.mjs";
import { limitText } from "../site/plans.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO = join(ROOT, "..");
const SKIP = new Set(["node_modules", "site", "tests", "screenshots", ".vercel"]);

async function walk(dir, prefix = "") {
  const out = [];
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { if (!SKIP.has(entry.name)) out.push(...(await walk(dir, rel))); }
    else if (entry.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

const files = (await walk(ROOT)).sort();
const pages = new Map(await Promise.all(files.map(async (f) => [f, await readFile(join(ROOT, f), "utf8")])));
const catalog = JSON.parse(await readFile(join(ROOT, "plans.json"), "utf8"));
const noindex = (src) => /<meta name="robots" content="noindex/.test(src);

/** Site path ("/", "/guide/", "/pricing.html", relative) -> file under landing-page/. */
function fileFor(from, path) {
  let p = path.startsWith("/") ? path.slice(1) : posix.join(posix.dirname(from), path);
  if (p === "" || p.endsWith("/")) p += "index.html";
  return posix.normalize(p);
}
const idsIn = (src) => [...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

test("the committed site is what build.mjs generates", async () => {
  const built = await build();
  for (const [file, content] of built) {
    const current = await readFile(join(ROOT, file), "utf8").catch(() => null);
    assert.ok(current === content, `${file} is out of date: run npm run build in landing-page/`);
  }
  const generatedHtml = [...built.keys()].filter((f) => f.endsWith(".html")).sort();
  assert.deepEqual(files, generatedHtml, "every page is generated, and nothing stale is left behind");
});

test("every page has a unique title, one H1, a description, a canonical URL and the shared header and footer", () => {
  const titles = new Map();
  for (const [name, src] of pages) {
    const title = src.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title, `${name}: missing title`);
    assert.ok(!titles.has(title), `${name}: same title as ${titles.get(title)}`);
    titles.set(title, name);
    assert.match(src, /<html lang="en">/, `${name}: lang`);
    assert.equal((src.match(/<h1\b/g) || []).length, 1, `${name}: one H1`);
    assert.match(src, /<meta\s+name="description"\s+content="[^"]{40,}"/, `${name}: description`);
    assert.match(src, new RegExp(`<link rel="canonical" href="${SITE.replace(/[.]/g, "\\.")}/[^"]*"`), `${name}: canonical`);
    assert.match(src, /<meta property="og:title"/, `${name}: Open Graph`);
    assert.match(src, /<!-- site:header --><header class="site-header">/, `${name}: header`);
    assert.match(src, /<!-- site:footer --><footer class="site-foot">/, `${name}: footer`);
    for (const href of ["/product.html", "/learning.html", "/pricing.html", "/guide/", "/download.html"]) {
      assert.ok(src.includes(`href="${href}"`), `${name}: nav link ${href}`);
    }
    assert.match(src, /aria-controls="mobile-nav" aria-expanded="false"/, `${name}: menu button`);
    assert.match(src, /id="mobile-nav"[^>]*hidden/, `${name}: mobile nav starts hidden`);
  }
});

test("IDs are unique and every link, asset and anchor resolves", async () => {
  for (const [name, src] of pages) {
    const ids = idsIn(src);
    assert.equal(ids.length, new Set(ids).size, `${name}: duplicate ID`);
    for (const [, href] of src.matchAll(/(?:src|href)="([^"\s]+)"/g)) {
      if (/^(?:https?:|data:|mailto:|tel:)/.test(href)) continue;
      const [urlPath, hash] = href.split("#");
      const path = urlPath.split("?")[0];
      const target = path ? fileFor(name, path) : name;
      await access(join(ROOT, target)).catch(() => assert.fail(`${name}: ${href} points to a missing file`));
      if (hash) {
        const targetSrc = pages.get(target) ?? "";
        assert.ok(idsIn(targetSrc).includes(hash), `${name}: ${href} has no matching id in ${target}`);
      }
    }
  }
  for (const sheet of ["styles.css", "pages.css", "site.css"]) {
    const css = await readFile(join(ROOT, sheet), "utf8");
    for (const [, url] of css.matchAll(/url\("(\/[^"#]+)"\)/g)) await access(join(ROOT, url.slice(1)));
  }
});

test("no page links to an installer or release download before a signed release exists", () => {
  for (const [name, src] of pages) {
    assert.doesNotMatch(src, /href="[^"]*(?:releases\/download|releases\/latest|\.dmg|\.zip|\.exe|\.msi|\.AppImage|demo-loop|rehearsal)[^"]*"/i, `${name}: installer or demo link`);
    assert.doesNotMatch(src, /theclipfactory-frontend-two\.vercel\.app/, `${name}: web rehearsal link`);
  }
  const download = pages.get("download.html");
  for (const os of ["Mac", "Windows", "Linux"]) assert.match(download, new RegExp(`<h3 id="os-${os.toLowerCase()}">${os}</h3>`));
  for (const script of ["scripts/setup-mac.sh", "scripts\\setup-windows.ps1", "scripts/setup-linux.sh"]) assert.ok(download.includes(script), script);
});

function cardsIn(src) {
  return [...src.matchAll(/<article class="plan-card[^"]*" data-plan="(\w+)" data-price-month="(\d+)" data-price-year="(\d+)"[^>]*>([\s\S]*?)<\/article>/g)]
    .map(([, id, month, year, body]) => ({ id, month: Number(month), year: Number(year), body }));
}

for (const name of ["index.html", "pricing.html"]) {
  test(`${name} shows the plans, prices and limits from plans.json`, () => {
    const cards = cardsIn(pages.get(name));
    assert.deepEqual(cards.map((c) => c.id), catalog.plans.map((p) => p.id), "one card per plan, in order");
    for (const [i, plan] of catalog.plans.entries()) {
      const card = cards[i];
      assert.equal(card.month, plan.price.month);
      assert.equal(card.year, plan.price.year);
      assert.ok(card.body.includes(`>${plan.name}</h3>`), `${plan.id}: name`);
      assert.ok(card.body.includes(`<span data-show="month">$${plan.price.month.toLocaleString("en-US")}</span>`), `${plan.id}: monthly price`);
      assert.ok(card.body.includes(`<span data-show="year">$${plan.price.year.toLocaleString("en-US")}</span>`), `${plan.id}: yearly price`);
      for (const [key, value] of Object.entries(plan.limits)) {
        const text = limitText(key, value);
        if (text) assert.ok(card.body.includes(`<li data-limit="${key}" data-value="${value}">${text}</li>`), `${plan.id}: ${key}`);
      }
    }
    // No stray prices: every dollar amount on the page belongs to the catalog.
    const amounts = new Set(catalog.plans.flatMap((p) => [p.price.month, p.price.year, p.price.year * 12, p.price.month * 12 - p.price.year * 12]));
    for (const [, n] of pages.get(name).matchAll(/\$([\d,]+)/g)) assert.ok(amounts.has(Number(n.replace(/,/g, ""))), `${name}: unexpected price $${n}`);
  });
}

test("the pricing comparison table matches plans.json", () => {
  const src = pages.get("pricing.html");
  const cell = (plan, attr) => src.match(new RegExp(`<td data-plan="${plan}" ${attr}>([^<]*)</td>`))?.[1];
  for (const plan of catalog.plans) {
    for (const interval of ["month", "year"]) {
      const price = plan.price[interval];
      assert.equal(cell(plan.id, `data-price="${interval}"`), price ? `$${price.toLocaleString("en-US")} a month` : "$0", `${plan.id} ${interval}`);
    }
    for (const [key, value] of Object.entries(plan.limits)) {
      const expected = key === "clips_per_month" && value === null ? "Unlimited" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
      assert.equal(cell(plan.id, `data-limit="${key}"`), expected, `${plan.id} ${key}`);
    }
  }
});

test("the docs navigation lists every guide page once, and each has a page", async () => {
  const guide = (await readdir(join(REPO, "docs", "guide"))).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
  const listed = DOCS_NAV.flatMap(([, names]) => names).filter((n) => !n.startsWith("@")).map((n) => n || "README");
  assert.deepEqual([...listed].sort(), guide);
  for (const name of guide) assert.ok(pages.has(name === "README" ? "guide/index.html" : `guide/${name}.html`), name);
  for (const [file, src] of pages) if (file.startsWith("guide/")) assert.match(src, /class="docs-nav"[\s\S]*aria-current="page"/, `${file}: current page marked`);
});

test("the sitemap lists every indexable page and no noindex page", async () => {
  const sitemap = await readFile(join(ROOT, "sitemap.xml"), "utf8");
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  const expected = [...pages.values()].filter((src) => !noindex(src)).map((src) => src.match(/<link rel="canonical" href="([^"]+)"/)[1]).sort();
  assert.deepEqual(listed, expected);
  for (const file of ["404.html", "billing/success.html", "billing/cancel.html", "billing/return.html"]) assert.ok(noindex(pages.get(file)), `${file} is noindex`);
  const robots = await readFile(join(ROOT, "robots.txt"), "utf8").catch(() => "");
  if (robots) assert.match(robots, /sitemap\.xml/i);
});

test("Checkout and billing portal return pages exist where the billing function sends people", async () => {
  const handler = await readFile(join(REPO, "supabase", "functions", "billing", "handler.ts"), "utf8");
  for (const path of ["/billing/success.html", "/billing/cancel.html", "/billing/return.html"]) {
    assert.ok(handler.includes(`\${returnBase}${path}`), `handler sends people to ${path}`);
    assert.ok(pages.has(path.slice(1)), `${path} exists`);
  }
  assert.match(pages.get("billing/success.html"), /Back in the app|back to the app|Return to/i);
});

test("architecture diagrams are readable: boxes do not overlap, labels sit between boxes, all inside the canvas", () => {
  const page = pages.get("architecture.html");
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const [id, spec] of Object.entries(DIAGRAMS)) {
    assert.ok(page.includes(`aria-labelledby="${id}-title ${id}-desc"`), `${id} is on the architecture page`);
    const [width, height] = spec.size;
    const boxes = spec.nodes;
    for (const [i, a] of boxes.entries()) {
      assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= width && a.y + a.h <= height, `${id}: ${a.id} outside the canvas`);
      for (const b of boxes.slice(i + 1)) assert.ok(!overlap(a, b), `${id}: ${a.id} overlaps ${b.id}`);
    }
    const labels = [...renderDiagram(id).matchAll(/<rect class="d-label-bg" x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)]
      .map(([, x, y, w, h]) => ({ x: +x, y: +y, w: +w, h: +h }));
    assert.equal(labels.length, spec.edges.filter((e) => e.label).length);
    for (const [i, l] of labels.entries()) {
      for (const b of boxes) assert.ok(!overlap(l, b), `${id}: an edge label covers ${b.id}`);
      for (const m of labels.slice(i + 1)) assert.ok(!overlap(l, m), `${id}: two edge labels overlap`);
    }
  }
});

test("docs/architecture.md has a Mermaid version of every website diagram", async () => {
  const doc = await readFile(join(REPO, "docs", "architecture.md"), "utf8");
  for (const spec of Object.values(DIAGRAMS)) assert.match(doc, new RegExp(`^## ${spec.title}$`, "m"), spec.title);
  assert.equal((doc.match(/^```mermaid$/gm) || []).length, Object.keys(DIAGRAMS).length);
});
