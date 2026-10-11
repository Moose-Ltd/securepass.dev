// Prerenders every page at build time (KTD12). The output is plain HTML: the tool works only once
// its script loads, but everything a visitor or crawler needs to read is already in the document.
// Build-time only.

import { CSP_DIRECTIVES, SECURITY_HEADERS, THEME_BOOTSTRAP } from "../security/headers.ts";
import { SCENARIOS } from "../core/scenarios.ts";
import { CREDITS, FAQ, GUIDES } from "./content.ts";
import { ICONS } from "./icons.ts";
import { ROUTES, SITE_ORIGIN, canonicalUrl, routeForMode, type Mode, type Route } from "./routes.ts";

export type PageId = Mode | "not-found";

const REPO_URL = "https://github.com/Moose-Ltd/securepass.dev";
const AUTHOR = { name: "Matt Berry", url: "https://matt-berry.com" };
const YEAR = 2026;

/** The rating bands KTD7 defines, shown on the page. A unit test ties them to ratingFromBits. */
export const RATING_BANDS = [
  { rating: "very-weak", label: "Very weak", range: "under 45 bits" },
  { rating: "weak", label: "Weak", range: "45 to 59 bits" },
  { rating: "fair", label: "Fair", range: "60 to 74 bits" },
  { rating: "strong", label: "Strong", range: "75 to 99 bits" },
  { rating: "excellent", label: "Excellent", range: "100 bits or more" },
] as const;

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** JSON for a script data block: `<` is escaped so the content can never close the element. */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function stripTags(htmlFragment: string): string {
  return htmlFragment.replace(/<[^>]+>/g, "");
}

export function renderPage(id: PageId): string {
  const route = id === "not-found" ? undefined : routeForMode(id);
  const mode: Mode = route?.mode ?? "password";
  const body =
    id === "not-found"
      ? renderNotFound()
      : [renderTool(route!), renderGuide(route!), renderHow(), renderBreach(), renderCrackTime(), renderBestPractice(), renderFaq()].join("\n");

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
${renderHead(route)}
</head>
<body data-mode="${mode}">
<a class="skip-link" href="#${id === "not-found" ? "main" : "tool"}">Skip to ${id === "not-found" ? "content" : "the tool"}</a>
${renderHeader(id)}
<main id="main">
${body}
</main>
${renderFooter()}
<div class="sr-only" aria-live="polite" aria-atomic="true" data-announcer></div>
<div class="toast" role="status" data-update-toast hidden>
  <p class="toast__text">A new version of SecurePass is ready.</p>
  <button type="button" class="btn btn--small btn--ghost" data-action="dismiss-update">Not now</button>
  <button type="button" class="btn btn--small btn--primary" data-action="reload">Reload</button>
</div>
</body>
</html>
`;
}

function renderHead(route: Route | undefined): string {
  const title = route?.title ?? "Page not found | SecurePass";
  const description = route?.description ?? "This page doesn't exist. SecurePass generates strong passwords on your device.";
  const canonical = route ? canonicalUrl(route) : undefined;
  const ogImage = `${SITE_ORIGIN}/og/${route?.mode ?? "password"}.png`;
  const ogAlt = `SecurePass ${route?.h1.toLowerCase() ?? "password generator"}: made on your device, never sent anywhere.`;
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta name="robots" content="${route ? "index, follow, max-image-preview:large" : "noindex, follow"}">`,
    canonical ? `<link rel="canonical" href="${canonical}">` : "",
    '<meta name="color-scheme" content="light dark">',
    '<meta name="theme-color" content="#f4f6fb" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#0b1130" media="(prefers-color-scheme: dark)">',
    '<meta name="application-name" content="SecurePass">',
    '<meta name="apple-mobile-web-app-title" content="SecurePass">',
    `<meta name="author" content="${AUTHOR.name}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="SecurePass">',
    '<meta property="og:locale" content="en_US">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    canonical ? `<meta property="og:url" content="${canonical}">` : "",
    `<meta property="og:image" content="${ogImage}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(ogAlt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${ogImage}">`,
    `<meta name="twitter:image:alt" content="${esc(ogAlt)}">`,
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    `<script>${THEME_BOOTSTRAP}</script>`,
    '<link rel="stylesheet" href="/styles/main.css">',
    '<script type="module" src="/app/main.ts"></script>',
    route ? `<script type="application/ld+json">${jsonLd(structuredData(route))}</script>` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function structuredData(route: Route): unknown {
  const canonical = canonicalUrl(route);
  const graph: unknown[] = [
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: `${SITE_ORIGIN}/`,
      name: "SecurePass",
      description: "A free, open-source password generator that never sends your passwords anywhere.",
      inLanguage: "en",
      publisher: { "@id": `${SITE_ORIGIN}/#author` },
    },
    { "@type": "Person", "@id": `${SITE_ORIGIN}/#author`, name: AUTHOR.name, url: AUTHOR.url },
    {
      "@type": "WebApplication",
      "@id": `${SITE_ORIGIN}/#app`,
      name: "SecurePass",
      url: `${SITE_ORIGIN}/`,
      applicationCategory: "SecurityApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript and a modern browser",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Random password generator, 8 to 128 characters",
        "Passphrase generator using the EFF long wordlist",
        "Random PIN generator",
        "Password strength checker with crack-time estimates",
        "Private breach check using k-anonymity",
        "Works offline, no tracking, no cookies",
      ],
      image: `${SITE_ORIGIN}/icon-512.png`,
      author: { "@id": `${SITE_ORIGIN}/#author` },
      license: "https://opensource.org/licenses/MIT",
      codeRepository: REPO_URL,
    },
    {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: route.title,
      description: route.description,
      isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
      about: { "@id": `${SITE_ORIGIN}/#app` },
      primaryImageOfPage: `${SITE_ORIGIN}/og/${route.mode}.png`,
      inLanguage: "en",
    },
  ];
  if (route.path === "/") {
    graph.push({
      "@type": "FAQPage",
      "@id": `${SITE_ORIGIN}/#faq`,
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: stripTags(item.answer) },
      })),
    });
  } else {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "SecurePass", item: `${SITE_ORIGIN}/` },
        { "@type": "ListItem", position: 2, name: route.h1, item: canonical },
      ],
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function renderHeader(id: PageId): string {
  const anchor = (hash: string) => (id === "not-found" ? `/${hash}` : hash);
  return `<header class="site-header">
  <div class="site-header__inner">
    <a class="brand" href="/" aria-label="SecurePass home">
      <img class="brand__mark" src="/logo-64.png" width="32" height="32" alt="">
      <span class="brand__name">SecurePass</span>
    </a>
    <nav class="site-nav" aria-label="Sections">
      <a href="${anchor("#how")}">How it works</a>
      <a href="${anchor("#breach")}">Breach check</a>
      <a href="${anchor("#faq")}">FAQ</a>
    </nav>
    <div class="site-header__tools">
      <a class="netpill" href="${anchor("#network")}" data-netpill>
        ${ICONS.shield}
        <span class="netpill__text" data-net-summary>Nothing sent</span>
      </a>
      <button type="button" class="iconbtn" data-action="theme" aria-label="Theme: match system. Switch to light">
        ${ICONS.system}${ICONS.sun}${ICONS.moon}
      </button>
      <a class="iconbtn" href="${REPO_URL}" aria-label="Source code on GitHub">${ICONS.github}</a>
    </div>
  </div>
</header>`;
}

function modeLink(route: Route, active: Mode): string {
  const current = route.mode === active ? ' aria-current="page"' : "";
  return `<a class="modes__link" href="${route.path}" data-mode-link="${route.mode}"${current}>${esc(route.tab)}</a>`;
}

function rangeField(opts: { id: string; label: string; min: number; max: number; value: number; unit: string; opt: string }): string {
  return `<div class="range" data-range="${opts.opt}">
        <div class="range__head">
          <label class="range__label" for="${opts.id}">${esc(opts.label)}</label>
          <div class="stepper">
            <button type="button" class="stepper__btn" data-step="-1" aria-label="Fewer ${esc(opts.unit)}">${ICONS.minus}</button>
            <input class="stepper__num" type="number" inputmode="numeric" id="${opts.id}-num" min="${opts.min}" max="${opts.max}" value="${opts.value}" aria-label="${esc(opts.label)}, number of ${esc(opts.unit)}" data-opt-num="${opts.opt}">
            <button type="button" class="stepper__btn" data-step="1" aria-label="More ${esc(opts.unit)}">${ICONS.plus}</button>
          </div>
        </div>
        <input class="range__input" type="range" id="${opts.id}" min="${opts.min}" max="${opts.max}" value="${opts.value}" data-opt="${opts.opt}">
      </div>`;
}

function strengthBlock(scope: "gen" | "check"): string {
  const empty = scope === "check" ? ' data-empty="true"' : "";
  return `<div class="strength" data-strength="${scope}"${empty}>
        <div class="meter" data-meter aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
        <div class="strength__row">
          <p class="strength__rating"><span class="strength__label" data-rating-label>${scope === "check" ? "Waiting for a password" : "Calculating"}</span><span class="strength__bits" data-bits></span></p>
          <p class="strength__time" data-time-line>${scope === "check" ? "Type or paste a password to see how long it would last." : "&nbsp;"}</p>
        </div>
        <button type="button" class="linkbtn strength__toggle" data-action="details" aria-expanded="false" aria-controls="crack-${scope}">How long under other attacks?</button>
        <div class="crack" id="crack-${scope}" hidden>
          <dl class="crack__list" data-crack-list>
${SCENARIOS.map(
  (s) => `            <div class="crack__row" data-scenario="${s.id}"><dt>${esc(s.label)} <span class="crack__rate">${esc(s.rateLabel)}</span></dt><dd data-scenario-time>&nbsp;</dd></div>`,
).join("\n")}
          </dl>
          <p class="crack__note">Average time to find it, assuming the attacker knows exactly how it was made. <a href="#crack-time">How these are estimated</a>.</p>
        </div>
      </div>`;
}

function renderTool(route: Route): string {
  const isCheck = route.mode === "check";
  const show = (cond: boolean) => (cond ? "" : " hidden");
  return `<section class="tool" id="tool" aria-labelledby="page-title">
  <div class="tool__head">
    <h1 class="tool__title" id="page-title" tabindex="-1" data-page-title>${esc(route.h1)}</h1>
    <p class="tool__lede" data-page-lede>${esc(route.lede)}</p>
  </div>
  <div class="vault" data-vault>
    <nav class="modes" aria-label="Tools">
      ${ROUTES.map((r) => modeLink(r, route.mode)).join("\n      ")}
    </nav>

    <div class="panel panel--generate" data-panel="generate"${show(!isCheck)}>
      <div class="secret" data-secret>
        <div class="secret__frame">
          <output class="secret__value" id="secret" translate="no" data-secret-value aria-label="Generated ${route.mode === "pin" ? "PIN" : route.mode}">
            <span class="secret__placeholder" data-secret-placeholder>Generating on your device&hellip;</span>
          </output>
          <noscript><p class="secret__notice">SecurePass makes passwords with JavaScript running on your device, so nothing is ever sent to a server. Turn JavaScript on to use the generator.</p></noscript>
        </div>
        <div class="secret__actions">
          <button type="button" class="iconbtn iconbtn--quiet" data-action="hide" aria-pressed="false" aria-label="Hide" disabled>${ICONS.eye}${ICONS.eyeOff}</button>
          <button type="button" class="iconbtn iconbtn--quiet" data-action="spell" aria-expanded="false" aria-controls="spell" aria-label="Spell it out" disabled>${ICONS.spell}</button>
          <button type="button" class="btn btn--ghost" data-action="regenerate" disabled>${ICONS.refresh}<span>New</span></button>
          <button type="button" class="btn btn--primary" data-action="copy" disabled>${ICONS.copy}${ICONS.check}<span data-copy-label>Copy</span></button>
        </div>
        <p class="secret__hint" data-copy-hint hidden></p>
      </div>
      <ol class="spell" id="spell" translate="no" data-spell hidden></ol>
      ${strengthBlock("gen")}
      <p class="pin-badge" data-pin-badge${show(route.mode === "pin")}>${ICONS.info}<span>Only use a PIN where wrong guesses are limited, like a phone or bank card. It can't hold out against an offline attack.</span></p>

      <fieldset class="opts" data-options="password"${show(route.mode === "password")}>
        <legend class="sr-only">Password options</legend>
        ${rangeField({ id: "pw-length", label: "Length", min: 8, max: 128, value: 20, unit: "characters", opt: "length" })}
        <div class="sets" role="group" aria-labelledby="sets-label">
          <p class="opts__label" id="sets-label">Include</p>
          <div class="sets__chips">
            <label class="chip"><input type="checkbox" data-set="upper" checked><span>A&ndash;Z</span></label>
            <label class="chip"><input type="checkbox" data-set="lower" checked><span>a&ndash;z</span></label>
            <label class="chip"><input type="checkbox" data-set="digits" checked><span>0&ndash;9</span></label>
            <label class="chip"><input type="checkbox" data-set="symbols" checked><span>!@#$</span></label>
          </div>
          <p class="opts__note" data-sets-note role="status"></p>
        </div>
        <details class="more">
          <summary>More options</summary>
          <div class="more__body">
            <label class="switch"><input type="checkbox" role="switch" data-opt="avoidAmbiguous"><span class="switch__track" aria-hidden="true"></span><span>Avoid look-alike characters <span class="switch__eg" translate="no">l 1 I O 0 o</span></span></label>
            <div class="field">
              <label class="field__label" for="pw-exclude">Leave out these characters</label>
              <input class="field__input" id="pw-exclude" type="text" maxlength="64" autocomplete="off" autocapitalize="off" spellcheck="false" translate="no" placeholder="For example &lt;&gt;&quot;'" data-opt="exclude">
              <p class="field__hint">Useful when a site rejects certain symbols.</p>
            </div>
          </div>
        </details>
      </fieldset>

      <fieldset class="opts" data-options="passphrase"${show(route.mode === "passphrase")}>
        <legend class="sr-only">Passphrase options</legend>
        ${rangeField({ id: "pp-words", label: "Words", min: 3, max: 12, value: 6, unit: "words", opt: "words" })}
        <div class="seps" role="radiogroup" aria-labelledby="sep-label">
          <p class="opts__label" id="sep-label">Between words</p>
          <div class="seps__options">
            <label class="chip chip--radio"><input type="radio" name="separator" value="-" checked><span translate="no">-</span><span class="sr-only">Hyphen</span></label>
            <label class="chip chip--radio"><input type="radio" name="separator" value=" "><span>Space</span></label>
            <label class="chip chip--radio"><input type="radio" name="separator" value="."><span translate="no">.</span><span class="sr-only">Full stop</span></label>
            <label class="chip chip--radio"><input type="radio" name="separator" value="_"><span translate="no">_</span><span class="sr-only">Underscore</span></label>
            <label class="chip chip--radio"><input type="radio" name="separator" value=","><span translate="no">,</span><span class="sr-only">Comma</span></label>
            <label class="chip chip--radio"><input type="radio" name="separator" value=""><span>None</span></label>
          </div>
        </div>
        <div class="toggles">
          <label class="switch"><input type="checkbox" role="switch" data-opt="capitalize"><span class="switch__track" aria-hidden="true"></span><span>Capitalise words</span></label>
          <label class="switch"><input type="checkbox" role="switch" data-opt="includeDigit"><span class="switch__track" aria-hidden="true"></span><span>Add a number</span></label>
        </div>
      </fieldset>

      <fieldset class="opts" data-options="pin"${show(route.mode === "pin")}>
        <legend class="sr-only">PIN options</legend>
        ${rangeField({ id: "pin-digits", label: "Digits", min: 4, max: 12, value: 6, unit: "digits", opt: "digits" })}
      </fieldset>
    </div>

    <div class="panel panel--check" data-panel="check"${show(isCheck)}>
      <div class="field field--check">
        <label class="field__label" for="check-input">Password to check</label>
        <div class="pwfield">
          <input class="field__input field__input--secret" id="check-input" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" translate="no" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" data-check-input>
          <button type="button" class="iconbtn iconbtn--quiet" data-action="reveal" aria-pressed="false" aria-label="Show password" aria-controls="check-input">${ICONS.eye}${ICONS.eyeOff}</button>
        </div>
        <p class="field__hint" data-check-hint>Analysed on your device as you type. It is never sent or saved.</p>
      </div>
      ${strengthBlock("check")}
      <ul class="feedback" data-check-feedback></ul>
      <div class="breach-box" data-breach>
        <div class="breach-box__text">
          <p class="breach-box__title">Has it been in a data breach?</p>
          <p class="breach-box__note">Sends only the first 5 characters of the password's SHA-1 hash to Have I Been Pwned. <a href="#breach">How this stays private</a></p>
        </div>
        <button type="button" class="btn btn--secondary" data-action="breach" disabled>Check breaches</button>
        <p class="breach-box__result" data-breach-result role="status" hidden></p>
      </div>
    </div>
  </div>
</section>`;
}

function renderGuide(route: Route): string {
  const guide = GUIDES[route.mode];
  return `<section class="guide" aria-labelledby="guide-title">
  <div class="container guide__inner">
    <h2 class="guide__title" id="guide-title">${esc(guide.heading)}</h2>
    <div class="guide__body prose">${guide.body.map((p) => `<p>${p}</p>`).join("")}</div>
  </div>
</section>`;
}

function renderHow(): string {
  const directives = CSP_DIRECTIVES.map(
    (d) => `<div class="policy__row"><dt><code>${esc(d.value ? `${d.name} ${d.value}` : d.name)}</code></dt><dd>${esc(d.note)}</dd></div>`,
  ).join("\n          ");
  const otherHeaders = SECURITY_HEADERS.filter((h) => h.name !== "Content-Security-Policy")
    .map((h) => `<div class="policy__row"><dt><code>${esc(h.name)}</code></dt><dd>${esc(h.note)}</dd></div>`)
    .join("\n          ");

  return `<section class="how" id="how" aria-labelledby="how-title">
  <div class="container">
    <header class="section-head">
      <h2 class="section-head__title" id="how-title">How SecurePass keeps your passwords to yourself</h2>
      <p class="section-head__lede">There is no server that sees your passwords, because there is no server involved at all. Here is what that means in practice, and how you can check each part yourself.</p>
    </header>

    <article class="feature" id="randomness" aria-labelledby="randomness-title">
      <div class="feature__text prose">
        <h3 id="randomness-title">Made by your device, not a server</h3>
        <p>Every character comes from <code>crypto.getRandomValues</code>, your browser's cryptographically secure random number generator. It is the same source browsers use to create encryption keys.</p>
        <p>Turning random numbers into characters is where many generators go wrong. Taking a remainder makes some characters slightly more likely than others. SecurePass throws away any number that would cause that bias, so every possible password is exactly as likely as every other.</p>
        <p>If your browser can't provide secure randomness, SecurePass refuses to generate anything rather than fall back to something weaker.</p>
      </div>
      <figure class="feature__proof codecard">
        <figcaption class="codecard__caption">The function every character passes through</figcaption>
        <pre class="codecard__code" translate="no"><code>{{RANDOM_INT_SOURCE}}</code></pre>
      </figure>
    </article>

    <article class="feature" id="network" aria-labelledby="network-title">
      <div class="feature__text prose">
        <h3 id="network-title">Nothing is sent, and you can check</h3>
        <p>SecurePass is a set of static files. Once the page has loaded, generating and checking passwords makes no network requests at all, and the page's security policy would block one if it tried.</p>
        <p>The counter beside this text watches every request this page makes to another site. It stays at zero unless you run a breach check.</p>
        <h4>Verify it yourself</h4>
        <ol class="steps">
          <li>Open your browser's developer tools with <kbd>F12</kbd>, or <kbd>Cmd</kbd>&nbsp;<kbd>Option</kbd>&nbsp;<kbd>I</kbd> on a Mac.</li>
          <li>Choose the <strong>Network</strong> tab.</li>
          <li>Generate a few passwords and type in the strength checker.</li>
          <li>Watch the list stay empty.</li>
        </ol>
        <p>To go further, turn on airplane mode. After your first visit SecurePass keeps working, because it runs entirely from your device.</p>
      </div>
      <div class="feature__proof netcard" data-netcard>
        <p class="netcard__count"><output data-net-count>0</output></p>
        <p class="netcard__label" data-net-label>requests to other sites since you opened this page</p>
        <ol class="netcard__log" data-net-log hidden></ol>
        <p class="netcard__offline" data-offline-status>Saves itself for offline use after your first visit.</p>
      </div>
    </article>

    <article class="feature" id="headers" aria-labelledby="headers-title">
      <div class="feature__text prose">
        <h3 id="headers-title">Locked down by your browser</h3>
        <p>Every page arrives with a strict Content Security Policy, which your browser enforces. Even if SecurePass's own code had a bug, the browser would refuse to load scripts from anywhere else, send data to an unknown server, or let another site wrap the page in a frame.</p>
        <p>This is the exact policy your browser received with this page, and what each rule does.</p>
      </div>
      <div class="feature__proof policy">
        <dl class="policy__list" aria-label="Content Security Policy directives">
          ${directives}
        </dl>
        <details class="policy__more">
          <summary>The other security headers</summary>
          <dl class="policy__list">
          ${otherHeaders}
          </dl>
        </details>
      </div>
    </article>

    <article class="feature" id="storage" aria-labelledby="storage-title">
      <div class="feature__text prose">
        <h3 id="storage-title">Nothing stored, nothing tracked</h3>
        <p>No accounts, no cookies, no analytics, no ads and no third-party scripts. SecurePass doesn't know who you are or how you use it, and it has no way to find out.</p>
        <p>The only thing it remembers is your settings, kept in your browser's local storage so they are there next time. Clearing this site's data removes them.</p>
      </div>
      <div class="feature__proof ledger">
        <div class="ledger__col">
          <h4 class="ledger__title">Remembered on this device</h4>
          <ul class="ledger__list ledger__list--kept">
            <li>Length and character choices</li>
            <li>Passphrase and PIN settings</li>
            <li>Light or dark theme</li>
          </ul>
        </div>
        <div class="ledger__col">
          <h4 class="ledger__title">Never kept anywhere</h4>
          <ul class="ledger__list ledger__list--never">
            <li>Generated passwords</li>
            <li>Passwords you check</li>
            <li>Breach check results</li>
            <li>Your IP address, device or visits</li>
          </ul>
        </div>
      </div>
    </article>
  </div>
</section>`;
}

function renderBreach(): string {
  return `<section class="breach" id="breach" aria-labelledby="breach-title">
  <div class="container">
    <header class="section-head">
      <h2 class="section-head__title" id="breach-title">A breach check that never reveals your password</h2>
      <p class="section-head__lede">Have I Been Pwned keeps hundreds of millions of real passwords exposed in data breaches. SecurePass can look yours up without sending it, or even its full fingerprint, using a technique called k-anonymity. It only happens when you press the button.</p>
    </header>
    <ol class="kanon" translate="no">
      <li class="kanon__step">
        <p class="kanon__what">Your device hashes the password with SHA-1.</p>
        <p class="kanon__demo"><span class="kanon__plain">password</span> <span class="kanon__arrow" aria-hidden="true">&rarr;</span> <span class="hash"><span class="hash__sent">5BAA6</span><span class="hash__kept">1E4C9B93F3F0682250B6CF8331B7EE68FD8</span></span></p>
      </li>
      <li class="kanon__step">
        <p class="kanon__what">Only the first 5 of its 40 characters are sent.</p>
        <p class="kanon__demo"><span class="kanon__url">api.pwnedpasswords.com/range/<span class="hash__sent">5BAA6</span></span></p>
      </li>
      <li class="kanon__step">
        <p class="kanon__what">The service returns every breached hash starting with those 5, around 800 to 1,000 of them, padded with decoys so even the reply's size gives nothing away.</p>
        <p class="kanon__demo kanon__demo--list"><span>0018A45C4D1DEF81644B54AB7F969B88D65:<em>count</em></span><span>00D4F6E8FA6EECAD2A3AA415EEC418D38EC:<em>count</em></span><span>&hellip;</span><span>1E4C9B93F3F0682250B6CF8331B7EE68FD8:<em>count</em></span><span>&hellip;</span></p>
      </li>
      <li class="kanon__step">
        <p class="kanon__what">Your device looks for the other 35 characters in that list. The service never learns which one, if any, was yours.</p>
        <p class="kanon__demo"><span class="hash__kept">1E4C9B93F3F0682250B6CF8331B7EE68FD8</span> <span class="kanon__match">found</span></p>
      </li>
    </ol>
    <p class="breach__foot">Breach data: <a href="https://haveibeenpwned.com/Passwords">Have I Been Pwned</a>. The request carries no cookies and no referrer, and it is the only request SecurePass's security policy allows to another site.</p>
  </div>
</section>`;
}

function renderCrackTime(): string {
  const scenarioRows = SCENARIOS.map(
    (s) => `<tr${s.id === "offline-fast" ? ' class="is-headline"' : ""}><th scope="row">${esc(s.label)}</th><td>${esc(s.rateLabel)}</td><td>${esc(s.description)} <a href="${esc(s.source)}">Source</a></td></tr>`,
  ).join("\n          ");
  const bands = RATING_BANDS.map(
    (b) => `<li class="bands__item" data-rating="${b.rating}"><span class="bands__swatch" aria-hidden="true"></span><span class="bands__label">${b.label}</span><span class="bands__range">${b.range}</span></li>`,
  ).join("\n          ");
  return `<section class="crack-time" id="crack-time" aria-labelledby="crack-time-title">
  <div class="container">
    <header class="section-head">
      <h2 class="section-head__title" id="crack-time-title">How crack time is estimated</h2>
      <p class="section-head__lede">The headline number assumes a well-equipped attacker, so it never flatters a password.</p>
    </header>
    <div class="split">
      <div class="prose">
        <h3>Generated passwords: exact maths</h3>
        <p>A generated password's strength is exactly the number of passwords your settings could have produced. SecurePass counts them, leaving out any that would be missing a character type you asked for, and reports the result as bits of entropy. Twenty characters from all four sets give about 131 bits; six passphrase words give about 77.5.</p>
        <p>An attacker who knows exactly how the password was made still has to try, on average, half of the possibilities. The time is that number of guesses divided by the attacker's speed.</p>
        <h3>Passwords you type: pattern analysis</h3>
        <p>People don't choose characters at random, so length alone says little. The checker uses zxcvbn to find the dictionary words, names, dates, keyboard runs and substitutions that cracking tools try first, and estimates how many guesses those patterns take. Long, patternless runs are priced as random.</p>
      </div>
      <div>
        <table class="scenarios">
          <caption>Attack speeds used for the estimates</caption>
          <thead><tr><th scope="col">Attack</th><th scope="col">Guesses per second</th><th scope="col">Assumption</th></tr></thead>
          <tbody>
          ${scenarioRows}
          </tbody>
        </table>
        <h3 class="bands__title">Ratings</h3>
        <ul class="bands">
          ${bands}
        </ul>
      </div>
    </div>
  </div>
</section>`;
}

function renderBestPractice(): string {
  return `<section class="practice" id="best-practice" aria-labelledby="practice-title">
  <div class="container">
    <header class="section-head">
      <h2 class="section-head__title" id="practice-title">What good password hygiene looks like in 2026</h2>
      <p class="section-head__lede">Based on <a href="https://pages.nist.gov/800-63-4/sp800-63b.html">NIST SP 800-63B-4</a>, the US government's digital identity guidelines, finalised in 2025.</p>
    </header>
    <ul class="practice__list">
      <li><h3>Length beats complexity</h3><p>Use at least 15 characters for any password that is the only thing protecting an account. Mandatory symbol-and-number rules are out; length and randomness are what count.</p></li>
      <li><h3>One password per account</h3><p>Reused passwords turn one breach into many. A password manager makes unique passwords effortless.</p></li>
      <li><h3>Check against breaches</h3><p>Services should reject passwords already exposed in breaches, and so should you. A breached password is the first thing attackers try.</p></li>
      <li><h3>Change it when there's a reason</h3><p>Forced changes every few months are no longer recommended. Change a password when there is any sign it has been exposed.</p></li>
      <li><h3>Add a second factor</h3><p>Turn on passkeys or two-factor authentication wherever they are offered. They stop a stolen password from being enough on its own.</p></li>
    </ul>
  </div>
</section>`;
}

function renderFaq(): string {
  const items = FAQ.map(
    (item, i) => `<div class="faq__item"><dt id="faq-${i + 1}">${esc(item.question)}</dt><dd>${item.answer}</dd></div>`,
  ).join("\n      ");
  return `<section class="faq" id="faq" aria-labelledby="faq-title">
  <div class="container">
    <header class="section-head">
      <h2 class="section-head__title" id="faq-title">Questions, answered plainly</h2>
    </header>
    <dl class="faq__list">
      ${items}
    </dl>
  </div>
</section>`;
}

function renderNotFound(): string {
  return `<section class="lost" aria-labelledby="lost-title">
  <div class="container lost__inner">
    <h1 class="lost__title" id="lost-title" tabindex="-1">This page doesn't exist</h1>
    <p class="lost__text">The address may be mistyped, or the page may have moved. Everything SecurePass does is on these four pages:</p>
    <ul class="lost__links">
      ${ROUTES.map((r) => `<li><a href="${r.path}">${esc(r.h1)}</a></li>`).join("\n      ")}
    </ul>
  </div>
</section>`;
}

function renderFooter(): string {
  const tools = ROUTES.map((r) => `<li><a href="${r.path}">${esc(r.h1)}</a></li>`).join("");
  const credits = CREDITS.map((c) => `<li><span class="footer__credit-label">${esc(c.label)}</span> ${c.html}</li>`).join("");
  return `<footer class="site-footer">
  <div class="guilloche-band" aria-hidden="true"></div>
  <div class="container site-footer__inner">
    <div class="footer__brand">
      <a class="brand brand--footer" href="/">
        <img class="brand__mark" src="/logo-64.png" width="32" height="32" alt="" loading="lazy">
        <span class="brand__name">SecurePass</span>
      </a>
      <p class="footer__tagline">Passwords made on your device and never sent anywhere. Free, open source, and private by design.</p>
      <p class="footer__status"><span class="status-dot" aria-hidden="true"></span><span data-offline-status-short>No cookies, no tracking</span></p>
    </div>
    <nav class="footer__nav" aria-label="Footer">
      <div class="footer__col">
        <h2 class="footer__heading">Tools</h2>
        <ul>${tools}</ul>
      </div>
      <div class="footer__col">
        <h2 class="footer__heading">Learn</h2>
        <ul>
          <li><a href="/#how">How it works</a></li>
          <li><a href="/#headers">Security headers</a></li>
          <li><a href="/#breach">Private breach check</a></li>
          <li><a href="/#crack-time">Crack-time maths</a></li>
          <li><a href="/#faq">FAQ</a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h2 class="footer__heading">Project</h2>
        <ul>
          <li><a href="${REPO_URL}">Source code</a></li>
          <li><a href="${REPO_URL}/security/advisories/new">Report a vulnerability</a></li>
          <li><a href="/.well-known/security.txt">security.txt</a></li>
          <li><a href="${REPO_URL}/blob/main/LICENSE">MIT license</a></li>
        </ul>
      </div>
    </nav>
    <div class="footer__credits">
      <h2 class="footer__heading">Credits</h2>
      <ul>${credits}</ul>
    </div>
  </div>
  <div class="container footer__base">
    <p>&copy; ${YEAR} <a href="${AUTHOR.url}">${AUTHOR.name}</a>. Built in the open.</p>
    <p><a href="${REPO_URL}/blob/main/THIRD_PARTY_NOTICES.md">Third-party notices</a></p>
  </div>
</footer>`;
}
