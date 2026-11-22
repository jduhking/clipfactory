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
The initial workflow is saved recording → draft → human review → export. Live capture,
chat-highlight detection, verified audience growth and launched billing are not claimed.
No streamer affiliation or endorsement is implied.

Public site: https://clipfactory-landing.vercel.app, Vercel team `jduhkings-projects`,
project `clipfactory-landing`. Canonical URLs and source links target this site and
`jduhking/clipfactory`. CSS/JS and brand-image links carry `?v=pearl-streamer-6`; bump that version after
future visual changes to avoid stale browser asset caches. Generated HTML is committed.
Vercel currently receives reviewed static file deployments, not automatic Git deployments.

### The growth loop, animated

The home page is built around the app's own loop. Its five stage families (Understand, Create,
Judge, Ship, Learn) and the order of the hero's beats come from `frontend/src/growth`: the Factory
map's stage families, `flowEvents`, and the learning-loop demo. The motion thesis is that one clip
is followed all the way round, and every pass leaves the channel a little more grown.

- **Hero (`loop`).** The real app screenshot sits in the middle of an orbit drawn on two canvases,
  one behind it and one in front. The agent pulls a moment out of your recording and the Editor
  cuts a vertical clip with word-by-word captions. The critic scores it, then the loop stops at
  your approval before the clip flies to text-labelled TikTok, Reels and Shorts portals. Results
  come back as sample shapes, and the Strategist re-cuts the next clip hook-first. Each loop adds
  a growth ring. After four loops the rings settle and a new stream starts. A chapter rail under
  the stage (`railReporter`) shows the same state the painter returns, so words and picture never
  disagree.
- **Stations (`understand`, `cut`, `judge`, `post`, `learn`).** One sticky diagram crossfades
  between stations as each step reaches the middle of the screen (`followSteps`).
- **Growth.** The real Factory map, captured from the app running on labelled preview data.

The motion uses real easing: `easeInOutCubic` to travel, `easeOutBack` to settle, a comet trail
scaled by speed, and a tilt-and-squash on landing cards. Rules the tests enforce:
- Nothing reaches a channel before the approval beat, and the reduced-motion still of the hero is
  that approval gate.
- Every animation has a written description, and the station diagram is captioned
  `Animated illustration`.
- No scene draws a number. A platform with no report is an empty dashed outline marked
  `No report yet`: unavailable, never zero. The results bars are labelled as sample shapes.
- Every colour is from the palette. Each scene honours 30 fps, a 1.5 device-pixel-ratio cap,
  sleep while offscreen or in a hidden tab, a chosen still under reduced motion, no canvas in
  forced colours, and a pause control.

The page asks for growth without promising it: the hero note, the growth section and the FAQ all
say that nothing here guarantees more views.

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
