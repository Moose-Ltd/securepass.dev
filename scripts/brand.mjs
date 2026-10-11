#!/usr/bin/env node
// Renders the brand assets from the 512px Vectors Tank "Security" icon (KTD13): the favicon set,
// app icons, the header logo and one 1200x630 social preview per tool page. Uses Playwright, which
// the browser tests already need. Outputs are committed under public/; re-run only when the brand
// changes.
//
//   npm run brand

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const pub = `${root}public`;
const icon = readFileSync(`${root}src/assets/brand/vault-512.png`).toString("base64");
const guilloche = readFileSync(`${root}src/assets/guilloche.svg`).toString("base64");
const sans = readFileSync(`${root}src/assets/fonts/instrument-sans-latin-wght.woff2`).toString("base64");
const mono = readFileSync(`${root}src/assets/fonts/jetbrains-mono-latin-wght.woff2`).toString("base64");

const PAPER = "#f4f6fb";

const fonts = `
@font-face { font-family: "Instrument Sans"; font-weight: 400 700; src: url(data:font/woff2;base64,${sans}) format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 100 800; src: url(data:font/woff2;base64,${mono}) format("woff2"); }
`;

/** A square icon: the padlock at `scale` of the canvas on an optional background. */
const iconHtml = (size, scale, background) => `<!doctype html><html><head><style>
html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${background ?? "transparent"}; }
body { display: grid; place-items: center; }
img { width: ${Math.round(size * scale)}px; height: ${Math.round(size * scale)}px; image-rendering: auto; }
</style></head><body><img src="data:image/png;base64,${icon}"></body></html>`;

const OG = {
  password: { title: "Password generator", sample: [["k7", ""], ["#", "s"], ["Qm", ""], ["2", "d"], ["!", "s"], ["vXp", ""], ["9", "d"], ["@", "s"], ["Lw", ""], ["4", "d"], ["$", "s"], ["Rn", ""], ["8", "d"], ["&", "s"]], rating: "Excellent", bits: "131 bits", time: "billions of times the age of the universe" },
  passphrase: { title: "Passphrase generator", sample: [["walrus-gravity-lantern-", ""], ["​", ""], ["unpaved-cobalt-sprinkler", ""]], rating: "Strong", bits: "77.5 bits", time: "about 1,100 years" },
  pin: { title: "PIN generator", sample: [["804 731", "d"]], rating: "For limited tries", bits: "19.9 bits", time: "about 7 months at 100 tries an hour" },
  check: { title: "Password strength checker", sample: [["••••••••••••", ""]], rating: "Breach check", bits: "k-anonymity", time: "your password never leaves your device" },
};

const ogHtml = (mode) => {
  const o = OG[mode];
  const sample = o.sample.map(([text, cls]) => `<span class="${cls}">${text}</span>`).join("");
  const level = { Excellent: 5, Strong: 4 }[o.rating] ?? 0;
  const bars = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= level ? "on" : ""}"></i>`).join("");
  return `<!doctype html><html><head><style>${fonts}
* { box-sizing: border-box; }
html, body { margin: 0; width: 1200px; height: 630px; }
body { position: relative; overflow: hidden; background: #0b1130; color: #e9edfa; font-family: "Instrument Sans", sans-serif; padding: 64px 72px; }
.band { position: absolute; left: 0; right: 0; bottom: 0; height: 150px; background: #9fb2e6; opacity: .22; -webkit-mask: url(data:image/svg+xml;base64,${guilloche}) center / 360px 100% repeat-x; }
.glow { position: absolute; width: 760px; height: 760px; right: -220px; top: -260px; border-radius: 50%; background: radial-gradient(closest-side, rgba(92,200,242,.16), transparent); }
.brand { display: flex; align-items: center; gap: 16px; font-size: 34px; font-weight: 650; letter-spacing: -.02em; }
.brand img { width: 60px; height: 60px; }
.domain { margin-left: auto; color: #8f9bc3; font-size: 26px; font-weight: 500; }
.top { display: flex; align-items: center; }
h1 { margin: 54px 0 0; max-width: 800px; font-size: ${o.title.length > 20 ? 62 : 76}px; font-weight: 600; letter-spacing: -.035em; line-height: 1; }
.sub { margin-top: 18px; color: #b1bbdc; font-size: 30px; }
.card { position: relative; margin-top: 44px; width: 820px; padding: 28px 32px; border: 1px solid #2c3a75; border-radius: 22px; background: #111a40; box-shadow: 0 30px 60px -30px rgba(0,0,0,.7); }
.secret { font-family: "JetBrains Mono", monospace; font-size: 40px; letter-spacing: .02em; color: #e9edfa; }
.secret .d { color: #7dd3f5; font-weight: 650; }
.secret .s { color: #f9c860; font-weight: 550; }
.meter { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 22px; }
.meter i { height: 8px; border-radius: 4px; background: #23305f; }
.meter i.on { background: ${level === 5 ? "#6dcff5" : "#4fd69e"}; }
.row { display: flex; gap: 18px; align-items: baseline; white-space: nowrap; margin-top: 14px; font-size: 24px; color: #b1bbdc; }
.row b { color: ${level === 5 ? "#6dcff5" : level === 4 ? "#4fd69e" : "#f9c860"}; font-weight: 650; }
.lock { position: absolute; right: 72px; top: 220px; width: 230px; height: 230px; opacity: .95; filter: drop-shadow(0 30px 40px rgba(0,0,0,.45)); }
</style></head><body>
<div class="glow"></div><div class="band"></div>
<div class="top"><div class="brand"><img src="data:image/png;base64,${icon}">SecurePass</div><div class="domain">securepass.dev</div></div>
<h1>${o.title}</h1>
<p class="sub">Made on your device. Never sent anywhere.</p>
<div class="card"><div class="secret">${sample}</div><div class="meter">${bars}</div><div class="row"><b>${o.rating}</b><span>${o.bits}</span><span>${o.time}</span></div></div>
<img class="lock" src="data:image/png;base64,${icon}">
</body></html>`;
};

/** An ICO container holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function shot(html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width, height } });
}

mkdirSync(`${pub}/og`, { recursive: true });
const write = (name, data) => {
  writeFileSync(`${pub}/${name}`, data);
  process.stdout.write(`brand: ${name} (${data.length} bytes)\n`);
};

const fav = [];
for (const size of [16, 32, 48]) fav.push({ size, data: await shot(iconHtml(size, 1), size, size) });
write("favicon.ico", ico(fav));
write("favicon-32.png", fav[1].data);
write("logo-64.png", await shot(iconHtml(64, 1), 64, 64));
write("icon-192.png", await shot(iconHtml(192, 0.92), 192, 192));
write("icon-512.png", await shot(iconHtml(512, 0.92), 512, 512));
// Maskable icons are cropped to a circle as small as 80% of the canvas; keep the lock well inside.
write("maskable-512.png", await shot(iconHtml(512, 0.62, PAPER), 512, 512));
// iOS fills transparency with black, so the touch icon gets the paper background.
write("apple-touch-icon.png", await shot(iconHtml(180, 0.78, PAPER), 180, 180));

for (const mode of Object.keys(OG)) {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml(mode), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  write(`og/${mode}.png`, await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } }));
}

await browser.close();
