// Shared page chrome: <head>, header and footer. build.mjs stamps the header and footer into every page between
// <!-- site:header --> / <!-- site:footer --> markers, so navigation is identical across the site.
import { escapeHtml } from "./markdown.mjs";

export const SITE = "https://clipfactory-landing.vercel.app";
export const CONTACT = "jamesbodebiyi@gmail.com";
export const REPO = "https://github.com/jduhking/clipfactory";

const NAV = [
  { href: "/product.html", label: "Product", current: (p) => p === "/product.html" },
  { href: "/learning.html", label: "Learning", current: (p) => p === "/learning.html" },
  { href: "/pricing.html", label: "Pricing", current: (p) => p === "/pricing.html" },
  { href: "/guide/", label: "Docs", current: (p) => p.startsWith("/guide/") || p === "/architecture.html" },
];

const FOOTER = [
  ["Product", [["/", "Overview"], ["/product.html", "Product"], ["/learning.html", "Learning loop"], ["/pricing.html", "Pricing"], ["/download.html", "Download"]]],
  ["Docs", [["/guide/", "User guide"], ["/guide/getting-started.html", "Your first clip"], ["/guide/faq.html", "Questions and answers"], ["/architecture.html", "Architecture"], ["/guide/self-hosting.html", "Self-hosting"]]],
  ["Company", [[`mailto:${CONTACT}`, "Contact"], ["/privacy.html", "Privacy"], ["/terms.html", "Terms"], [REPO, "Source code"]]],
];

const current = (on) => (on ? ' aria-current="page"' : "");

export function header(path) {
  const links = NAV.map((item) => `<a href="${item.href}"${current(item.current(path))}>${item.label}</a>`).join("");
  return `<header class="site-header"><div class="wrap header-row">
  <a class="brand header-logo" href="/" aria-label="Growth Factory home"><img src="/assets/icon.svg?v=pearl-streamer-9" alt="" width="36" height="36" /><span class="header-title">Growth Factory</span></a>
  <nav class="nav-desktop" aria-label="Main navigation">${links}</nav>
  <a class="btn btn-dark btn-sm header-download" href="mailto:${CONTACT}?subject=Growth%20Factory%20Mac%20streamer%20beta">Join the waitlist</a>
  <button class="menu-btn" type="button" aria-label="Open menu" aria-controls="mobile-nav" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
</div><nav id="mobile-nav" class="nav-mobile" aria-label="Mobile navigation" hidden>${links}<a class="btn btn-dark" href="mailto:${CONTACT}?subject=Growth%20Factory%20Mac%20streamer%20beta">Join the waitlist</a></nav></header>`;
}

export function footer(path) {
  const columns = FOOTER.map(([title, links]) => {
    const items = links.map(([href, label]) => {
      const external = href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<li><a href="${href}"${current(href === path)}${external}>${label}</a></li>`;
    }).join("");
    return `<div><h2>${title}</h2><ul>${items}</ul></div>`;
  }).join("");
  return `<footer class="site-foot"><div class="wrap site-foot-grid">
  <div class="site-foot-brand"><a class="brand sm" href="/" aria-label="Growth Factory home"><img src="/assets/icon.svg?v=pearl-streamer-9" alt="" width="28" height="28" /><span>Growth Factory</span></a><p>Your stream has good moments. Turn them into short clips on your Mac, with the final edit always in your hands.</p><p><a href="mailto:${CONTACT}">${CONTACT}</a></p></div>
  <nav aria-label="Footer">${columns}</nav>
</div><div class="wrap site-foot-base"><span>© 2026 Growth Factory</span><span>A private Mac beta, with every clip reviewed by the person who made it</span></div></footer>`;
}

export function canonical(path) {
  const clean = path.replace(/index\.html$/, "").replace(/\.html$/, "");
  return SITE + clean;
}

export function head({ title, description, path, noindex = false }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const url = canonical(path);
  const robots = noindex ? '\n  <meta name="robots" content="noindex" />' : "";
  return `<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="theme-color" content="#121212" />
  <title>${t}</title><meta name="description" content="${d}" />${robots}
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" /><meta property="og:site_name" content="Growth Factory" /><meta property="og:title" content="${t}" /><meta property="og:description" content="${d}" /><meta property="og:url" content="${url}" /><meta property="og:image" content="${SITE}/assets/social-card.jpg?v=pearl-streamer-9" /><meta property="og:image:width" content="1280" /><meta property="og:image:height" content="720" /><meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg?v=pearl-streamer-9" />
  <link rel="stylesheet" href="/styles.css?v=pearl-streamer-9" /><link rel="stylesheet" href="/pages.css?v=pearl-streamer-9" /><link rel="stylesheet" href="/site.css?v=pearl-streamer-9" /><script src="/app.js?v=pearl-streamer-9" defer></script>
</head>`;
}

export const stamp = (tag, html) => `<!-- site:${tag} -->${html}<!-- /site:${tag} -->`;

/** A complete page for generated content. */
export function page({ title, description, path, noindex, bodyClass = "", main }) {
  return `<!doctype html>
<html lang="en">${head({ title, description, path, noindex })}
<body class="product-pages${bodyClass ? ` ${bodyClass}` : ""}"><a class="skip-link" href="#main">Skip to content</a>
${stamp("header", header(path))}
<main id="main">
${main}
</main>
${stamp("footer", footer(path))}
</body></html>
`;
}
