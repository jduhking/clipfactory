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

No page links an installer until a signed release exists. The homepage animations use sample content; none is presented as a live agent run or measured growth.

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
self-hosted Instrument Sans, screenshots of the real app and two short animations of it. Shared styles
in `styles.css`, `pages.css` and `site.css` keep the guide, pricing and setup pages dark too.

Initial audience: small streamers on Apple Silicon Macs. The primary CTA opens an email
to request beta access; it is not a signup service, guaranteed invitation, or installer.
The initial workflow is saved recording → clips → you keep or skip → export. Live capture,
chat-highlight detection, verified audience growth and launched billing are not claimed.
No streamer affiliation or endorsement is implied.

Public site: https://clipfactory-landing.vercel.app, Vercel team `jduhkings-projects`,
project `clipfactory-landing`. Canonical URLs and source links target this site and
`jduhking/clipfactory`. CSS/JS and brand-image links carry `?v=pearl-streamer-10`; bump that version after
future visual changes to avoid stale browser asset caches. Generated HTML is committed.
Vercel currently receives reviewed static file deployments, not automatic Git deployments.

### One line, one button, a stream turning into clips

The home page follows the shape of simple product sites like Streamable: a centred headline,
one sentence, one button, then the product itself. It has no video and no disclaimer lines.

- **Hero.** "Clips that grow your channel." with one lead sentence, "Join the Mac beta", and
  one picture over the animated topography: a two-hour stream with its three best moments marked,
  and the three vertical clips cut from them, with hooks, captions and the platform each is for.
  It is HTML and CSS from `motion.js` (`<!-- build:scene hero -->`), not a screenshot.
- **Proof.** One sourced line from the Nysos 2026 study of 53,511 Twitch channels
  (https://nysos.io/en/etude-clipping-twitch).
- **Three rows**, each a sentence or two beside an animation: the scouts (finding and cutting
  clips), the A/B loop (two versions on Instagram, the one with more views wins), and the playbook
  (approved rules stacking up week by week as the channel grows).
- **Waitlist, FAQ, then pricing** at the bottom.

The copy comes from the code: `clip_factory/growth_loop.py` (one variable per experiment from
`SUPPORTED_RULES`: hook, length, framing, captions; equal measurement windows and a minimum view
sample before a call), `learning.py` (nothing becomes a Style rule before you approve it), and
`scouts.py`, `faces.py` and `craft.py` for finding and cutting. Only the scouts are named on the
page; the other agent names (Critic, Strategist) stay inside the app. `tests/site.test.mjs`
checks each image's markup size against its WebP header.

### The animations

`motion.js` holds the hero picture and the three scenes: their data, the finished-state HTML that
`build.mjs` writes into `<!-- build:scene hero|swarm|loop|learn -->`, and a small player. They are HTML
and CSS in the app's own surfaces, not recordings, so they read the same with JavaScript off.

- **Swarm** follows `scouts.py`: a two-hour sample stream is split into twelve ten-minute
  stretches, one scout per stretch proposes up to two moments scored 1 to 10, then the selector
  keeps the best per stretch and the top three become vertical clips. Scouts share one model and
  run one after another, so they light in turn, and the status line uses the app's own progress
  messages ("Scout 4/12 reviewing minutes 30-40", "Selecting the best 3 of 14 scout candidates").
- **Loop** follows `growth_loop.py`: three rounds, each changing one supported rule (hook,
  length, captions). Both versions go up on Instagram, the platform whose insights include reach
  (`REPORTED_METRICS` in `posting_server.py`). Views, reach, likes and shares count up over the
  same seven days; only then, with at least 100 views on both, does the version with more views
  win (`compare_observations` defaults to views), and it is not always the new one. The lesson
  waits for your OK before it becomes a rule for your next clips.
- **Playbook** ("It learns what works for your channel.") shows eight weeks of a sample channel:
  average views per new clip and how many suggested clips you keep both climb as approved rules
  stack up, Style v2 to v5. The first three rules are the loop's lessons.

The player runs only while a scene is on screen and the tab is visible, has a Pause button, and
shows the finished frame with reduced motion. `tests/motion.test.mjs` checks the scenes against
the constants and messages in `scouts.py`, `growth_loop.py` and `posting_server.py`, and the
player against fakes.

### Animated topography

The hero background is the app's contour field: `topography.js` mounts `contours.js`, the
website adapter of the WebGL shader in `frontend/src/growth/contours.ts`, behind the hero. It
pauses offscreen and in hidden tabs, has a "Pause background" button, draws one still frame with
reduced motion, hides with forced colours, and leaves the static `assets/topography.svg` in place
without WebGL or JavaScript.

### Keeping the design out of generated-default territory

The home page is checked against the tells that make a page read as machine-made, and
`tests/site.test.mjs` keeps them out: no tracked capitals or eyebrow labels, no accent word inside
a heading, no arrows padding a control label, no middle-dot meta strings, no em dashes in copy, no
re-drawn browser chrome, no decorative status dots, straight quotes replaced with typographic
ones, every colour declared in the `:root` token block, and one elevation token on one surface
(the app frames). Hierarchy comes from size, weight and measure instead.

Hallmark's `sloplint.mjs` (from the design skills in the workspace) was used as an outside check.
One warning is accepted deliberately: the plan button label comes from `plans.json`, which
mirrors the app's plan catalogue.
