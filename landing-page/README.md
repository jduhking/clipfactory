# Growth Factory website

The public website: product pages, pricing, the user guide, architecture, legal pages and the Checkout return pages. Plain HTML, CSS and JavaScript with no runtime dependencies. The generated pages are committed, so hosting serves the files as they are, with no build step.

## Pages

| Page | Source |
|---|---|
| `/` home: the loop, agents, platforms, privacy, pricing, FAQ | `site/pages/index.html` (generated homepage) |
| `/product.html`, `/learning.html` | hand-written |
| `/pricing.html` plans, monthly and yearly, comparison table | `site/pages/pricing.html` + `plans.json` |
| `/download.html` setup on Mac, Windows and Linux | `site/pages/download.html` |
| `/architecture.html` five system diagrams | `site/pages/architecture.html` + `site/diagrams.mjs` |
| `/guide/…` the user guide | `../docs/guide/*.md` |
| `/privacy.html`, `/terms.html` | `site/pages/` |
| `/billing/success.html`, `/billing/cancel.html`, `/billing/return.html` Stripe returns (noindex) | `site/pages/billing/` |
| `/404.html`, `/sitemap.xml` | generated |

`build.mjs` (no dependencies) does the generating:

- stamps the shared header and footer (`site/layout.mjs`) into every page, between `<!-- site:header -->` and `<!-- site:footer -->` markers;
- fills `<!-- build:pricing-cards -->` and `<!-- build:pricing-table -->` from `plans.json`, the mirror of `supabase/functions/_shared/plans.ts`;
- draws `<!-- build:diagram NAME -->` as inline SVG;
- renders the user guide from `docs/guide/` with a small Markdown renderer (`site/markdown.mjs`), with the sidebar order in `DOCS_NAV`.

Edit the sources, then run `npm run generate` and commit the output. `npm run check` fails when the committed pages are stale. Keep `docs/architecture.md` (Mermaid) in step with `site/diagrams.mjs`.

No page links an installer until a signed release exists. Illustrative photos and sample metrics are labeled; no animation is presented as a live agent run or measured growth.

## Preview and checks

```sh
npm run dev        # http://127.0.0.1:4174/
npm run generate   # after editing site/, plans.json or docs/guide/
npm run check
npm test
```

The tests check that the output is current, that every page has the shared chrome, a unique title and one H1, that links, assets and anchors resolve, that pricing matches `plans.json`, that the sitemap and noindex pages agree, that the billing pages exist where the billing function sends people, that diagram boxes and labels do not overlap, and that no installer link appears.

## Publication

Vercel project with root directory `landing-page`, no framework and no build command. `vercel.json` turns on clean URLs, so `/pricing` serves `pricing.html`; explicit `.html` links also work on the local server. `.vercelignore` keeps the build sources and tests out of the upload. Vercel serves `404.html` for unknown paths.

Set the billing function's `BILLING_RETURN_URL` to the site origin (for example `https://growth-factory-landing.vercel.app`) so Checkout returns to `/billing/success.html` and `/billing/cancel.html`. See [self-hosting](../docs/guide/self-hosting.md).

The privacy and terms pages are drafts for the owner to review before launch.

Asset provenance and font licenses: [ASSETS.md](ASSETS.md).

## Mac-first streamer landing page

The homepage source is `site/pages/index.html`; `build.mjs` generates `index.html`.
It uses the Pearl Studio graphite/violet material from `frontend/src/growth/tokens.css`,
self-hosted Instrument Sans, and an unchanged, labelled app screenshot. Shared styles
in `styles.css`, `pages.css` and `site.css` keep the guide, pricing and setup pages dark too.

Initial audience: small streamers on Apple Silicon Macs. The primary CTA opens an email
to request beta access; it is not a signup service, guaranteed invitation, or installer.
The initial workflow is saved recording → clips → you keep or skip → export. Live capture,
chat-highlight detection, verified audience growth and launched billing are not claimed.
No streamer affiliation or endorsement is implied.

Public site: https://clipfactory-landing.vercel.app, Vercel team `jduhkings-projects`,
project `clipfactory-landing`. Canonical URLs and source links target this site and
`jduhking/clipfactory`. CSS/JS and brand-image links carry `?v=pearl-streamer-7`; bump that version after
future visual changes to avoid stale browser asset caches. Generated HTML is committed.
Vercel currently receives reviewed static file deployments, not automatic Git deployments.

### One stream, told in photos

The home page explains the app with one streamer's night rather than a diagram, in five plain
steps anyone can follow: **Find, Cut, Pick, Post, Learn**. The words come from the code, not from
marketing: `clip_factory/scouts.py` (hook, one complete idea, payoff; skip intros, sponsor reads
and dead air), `faces.py` and `craft.py` (face-following vertical crop, hook card and captions off
the face), `growth_loop.py` and `learning.py` (results per platform, one change at a time: the
opening or the length). The agent names (Scout, Critic, Strategist) stay inside the app.

- **Hero (`story`).** Last night's stream plays through, the intro and dead air are struck out,
  two moments are found, a dashed 9:16 crop locks on to the face and lifts into a phone, then a
  hook and word-by-word captions appear. You keep it (and keep or skip two more), it flies to
  text-labelled TikTok, Reels and Shorts rows, sample bars fill, Shorts stays "No report yet",
  and one suggestion waits for Approve before joining the "What it has learned" shelf. Each
  24 second pass is the next stream; after three the shelf clears. The rail under it shows
  Stream N, the caption, and the five steps.
- **Steps (`find`, `cut`, `pick`, `post`, `learn`).** The same painter, windowed to one step, on
  the sticky figure beside the scrolling steps. Each step has a "Why it matters" line.
- **Photos.** `assets/streamers/*.webp` are Pexels stock photos of models (see `ASSETS.md`),
  loaded once and shared by every scene; until they arrive the scenes draw plain surfaces. The
  page labels them as stock photos, not customers or endorsements.
- **Honesty, enforced by `tests/scenes.test.mjs`.** No digits are ever drawn, colours come only
  from the app palette, an unreported platform is an empty outline (never zero), nothing posts
  before Keep, a suggestion changes nothing before Approve, and the result shapes never grow
  between streams, so the page does not imply a lift.
- **Restraint.** 30 fps cap, device pixel ratio capped at 1.5, asleep offscreen and in hidden
  tabs, one chosen still frame per scene under reduced motion, no canvas in forced colors, and a
  Pause control for each animation.

The problem section cites the Nysos 2026 study of 53,511 Twitch channels
(https://nysos.io/en/etude-clipping-twitch).

### Keeping the design out of generated-default territory

The home page is checked against the tells that make a page read as machine-made, and
`tests/site.test.mjs` keeps them out: no tracked capitals or eyebrow labels, no accent word inside
a heading, no arrows padding a control label, no middle-dot meta strings, no em dashes in copy, no
re-drawn browser chrome, no decorative status dots, straight quotes replaced with typographic
ones, every colour declared in the `:root` token block, and one elevation token on one element
(the screenshot). Hierarchy comes from size, weight and measure instead.

Hallmark's `sloplint.mjs` (from the design skills in the workspace) was used as an outside check.
Two warnings are accepted deliberately: the page carries more words than its 450-word target
because the beta disclosures in AGENTS.md are mandatory, and the plan button label comes from
`plans.json`, which mirrors the app's plan catalogue.

### Animated topography

The hero reuses the app's contour shader (`frontend/src/growth/contours.ts`) in
`contours.js`, with a manual pause adapter in `topography.js`. It is decorative,
non-interactive, behind the content, capped at 30fps and DPR 1.5, and sleeps while
offscreen or the tab is hidden. Reduced motion draws one still frame. Unsupported
WebGL retains `assets/topography.svg`, a static contour field derived from the same
terrain equation at t=41. Forced colors hides the decoration. Shader parity and
lifecycle behavior are covered by the site tests. No runtime dependencies added.
