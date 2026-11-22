#!/usr/bin/env node
// Turn one downloaded image into web-ready WebP files within the design-taste-frontend perf budget.
//
//   node optimise.mjs <input> <out-dir> <name> [--role hero|image] [--widths 2880,1440,780]
//
// Writes <out-dir>/<name>-<w>.webp for every width not larger than the source, lowering quality until
// each file fits its budget (hero 400 KiB, other images 250 KiB), and prints one JSON line:
// {"name","files":[{"file","width","height","kib","quality"}],"aspect"}
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [input, outDir, name] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!input || !outDir || !name) {
  console.error('usage: node optimise.mjs <input> <out-dir> <name> [--role hero|image] [--widths 2880,1440,780]');
  process.exit(2);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) { console.error('name: lowercase letters, digits and hyphens only'); process.exit(2); }

const role = flag('role', 'image');
const budget = (role === 'hero' ? 400 : 250) * 1024;
const meta = await sharp(input).metadata();
const defaults = role === 'hero' ? [2880, 1440, 780] : [1600, 1200, 780];
let widths = (flag('widths') ? flag('widths').split(',').map(Number) : defaults).filter(w => w > 0);
const fit = widths.filter(w => w <= meta.width);
widths = fit.length ? fit : [meta.width]; // never upscale: the largest width is the source's own

fs.mkdirSync(outDir, { recursive: true });
const files = [];
for (const w of widths) {
  const file = path.join(outDir, `${name}-${w}.webp`);
  let q = 82, buf;
  for (;;) {
    buf = await sharp(input).resize({ width: w, withoutEnlargement: true }).webp({ quality: q, effort: 6 }).toBuffer();
    if (buf.length <= budget || q <= 40) break;
    q -= 6;
  }
  fs.writeFileSync(file, buf);
  const m = await sharp(buf).metadata();
  files.push({ file: file.replace(/\\/g, '/'), width: m.width, height: m.height, kib: Math.round(buf.length / 1024), quality: q, overBudget: buf.length > budget });
}
console.log(JSON.stringify({ name, role, aspect: +(meta.width / meta.height).toFixed(3), source: { width: meta.width, height: meta.height }, files }));
