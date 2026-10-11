#!/usr/bin/env node
// Generates the guilloché band used behind the secret and in the footer: interlaced, phase-shifted
// waves of the kind printed on banknotes and certificates to make them hard to forge. The tile is
// 360 units wide and repeats seamlessly. Output: src/assets/guilloche.svg (a mask; colour comes from CSS).
//
//   node scripts/guilloche.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const W = 360; // tile width: one envelope period
const H = 96;
const WAVE = 60; // carrier wavelength; W must be a whole number of waves
const STEP = 7.5; // sample spacing, converted to smooth cubic Béziers below
const LINES = 9; // per family; two mirrored families interlace

const cy = H / 2;
const envelope = (x) => 0.42 + 0.58 * Math.sin((Math.PI * x) / W) ** 2;

function curve(phase, sign) {
  const pts = [];
  for (let x = -STEP; x <= W + STEP + 0.001; x += STEP) {
    const y = cy + sign * (H * 0.44) * envelope(x) * Math.sin((2 * Math.PI * x) / WAVE + phase);
    pts.push([x, y]);
  }
  // Catmull-Rom through the samples, as cubic Béziers.
  const f = (n) => Number(n.toFixed(1));
  let d = `M${f(pts[1][0])} ${f(pts[1][1])}`;
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

const paths = [];
for (let k = 0; k < LINES; k++) {
  const phase = (k / LINES) * Math.PI;
  paths.push(curve(phase, 1), curve(phase, -1));
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none"><g fill="none" stroke="#000" stroke-width=".6" stroke-linecap="round">${paths
  .map((d) => `<path d="${d}"/>`)
  .join("")}</g></svg>\n`;

const out = fileURLToPath(new URL("../src/assets/guilloche.svg", import.meta.url));
writeFileSync(out, svg);
process.stdout.write(`guilloche: wrote ${out} (${svg.length} bytes)\n`);
