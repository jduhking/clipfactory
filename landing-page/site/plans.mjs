// Pricing from plans.json (the mirror of supabase/functions/_shared/plans.ts). Names, prices and limits come only
// from the catalog; this file adds the words around them. tests/pages.test.mjs checks the rendered pages against it.

const COPY = {
  free: { tagline: "The whole factory on one brand, to try it on your own footage.", cta: "Get started free", note: "No account or card needed." },
  pro: { tagline: "For a creator posting every week across their own channels.", cta: "Start free, upgrade in the app", badge: "For most creators" },
  business: { tagline: "For a single operator managing many brands and accounts. No shared team workspace.", cta: "Start free, upgrade in the app" },
};
const PLATFORMS = "TikTok, Instagram, YouTube, Facebook, LinkedIn, X and Threads";

const usd = (n) => `$${n.toLocaleString("en-US")}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Visible wording for one limit; tests use the same function to check parity. */
export function limitText(key, value) {
  switch (key) {
    case "brands": return plural(value, "brand", "brands");
    case "clips_per_month": return value === null ? "Unlimited clips" : `${value} clips a month`;
    case "posting": return value ? "Post and schedule from the app" : "Export clips and post them yourself";
    case "connected_accounts": return value ? plural(value, "connected account", "connected accounts") : "No connected accounts";
    case "factory_builder": return value ? "Factory upgrades: new editing skills, built and tested for your review" : "";
    default: throw new Error(`Unknown plan limit: ${key}`);
  }
}
const cellText = (key, value) =>
  key === "clips_per_month" ? (value === null ? "Unlimited" : String(value))
  : typeof value === "boolean" ? (value ? "Yes" : "No")
  : String(value);

const LIMIT_ROWS = [
  ["brands", "Brands"],
  ["clips_per_month", "Clips a month"],
  ["posting", "Posting and scheduling from the app"],
  ["connected_accounts", "Connected accounts"],
  ["factory_builder", "Factory upgrades (builder)"],
];

function perMonth(plan, interval) {
  return `<span data-show="${interval}">${usd(plan.price[interval])}</span>`;
}

function billed(plan) {
  if (!plan.price.month) return `<span>${COPY[plan.id].note}</span>`;
  const year = plan.price.year * 12;
  const saving = plan.price.month * 12 - year;
  return `<span data-show="month">Billed monthly. Or ${usd(plan.price.year)} a month billed yearly.</span><span data-show="year">${usd(year)} billed once a year, saving ${usd(saving)}.</span>`;
}

function card(plan) {
  const copy = COPY[plan.id];
  if (!copy) throw new Error(`No website copy for plan ${plan.id}`);
  const limits = Object.entries(plan.limits)
    .map(([key, value]) => [key, value, limitText(key, value)])
    .filter(([, , text]) => text)
    .map(([key, value, text]) => `<li data-limit="${key}" data-value="${value}">${text}</li>`)
    .join("");
  const posting = plan.limits.posting ? `<p class="plan-platforms">${PLATFORMS}</p>` : "";
  const featured = copy.badge ? " plan-featured" : "";
  const badge = copy.badge ? `<span class="plan-badge">${copy.badge}</span>` : "";
  const button = copy.badge ? "btn-primary" : "btn-dark";
  return `<article class="plan-card${featured}" data-plan="${plan.id}" data-price-month="${plan.price.month}" data-price-year="${plan.price.year}" aria-labelledby="plan-${plan.id}">
  <div class="plan-head"><h3 id="plan-${plan.id}">${plan.name}</h3>${badge}</div>
  <p class="plan-tagline">${copy.tagline}</p>
  <p class="plan-price"><span class="plan-amount">${perMonth(plan, "month")}${perMonth(plan, "year")}</span><span class="plan-per">a month</span></p>
  <p class="plan-billed">${billed(plan)}</p>
  <a class="btn ${button} plan-cta" href="/download.html">${copy.cta}</a>
  <ul class="plan-limits">${limits}</ul>${posting}
</article>`;
}

export function pricingCards(catalog) {
  return `<div class="pricing" data-pricing data-interval="month">
<div class="pricing-toggle" role="group" aria-label="Billing period"><button type="button" data-interval="month" aria-pressed="true">Monthly</button><button type="button" data-interval="year" aria-pressed="false">Yearly <span>save about 20%</span></button></div>
<div class="plan-cards">
${catalog.plans.map(card).join("\n")}
</div>
<p class="pricing-note">Prices in US dollars, before any sales tax. Every plan runs the full factory on your computer. You upgrade inside the app (<strong>Settings → Plan and billing</strong>), which opens Stripe Checkout; cancel any time from <strong>Manage billing</strong>. Cloud model costs, if you add your own key, are paid to the provider and are separate.</p>
</div>`;
}

export function pricingTable(catalog) {
  const head = catalog.plans.map((plan) => `<th scope="col">${plan.name}</th>`).join("");
  const price = (interval, label) =>
    `<tr><th scope="row">${label}</th>${catalog.plans.map((plan) => `<td data-plan="${plan.id}" data-price="${interval}">${plan.price[interval] ? `${usd(plan.price[interval])} a month` : "$0"}</td>`).join("")}</tr>`;
  const rows = LIMIT_ROWS.map(([key, label]) =>
    `<tr><th scope="row">${label}</th>${catalog.plans.map((plan) => `<td data-plan="${plan.id}" data-limit="${key}">${cellText(key, plan.limits[key])}</td>`).join("")}</tr>`).join("");
  return `<div class="table-scroll"><table class="compare-table"><caption class="visually-hidden">Plan comparison</caption><thead><tr><th scope="col"><span class="visually-hidden">Feature</span></th>${head}</tr></thead><tbody>${price("month", "Billed monthly")}${price("year", "Billed yearly")}${rows}</tbody></table></div>`;
}
