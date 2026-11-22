#!/usr/bin/env node
// Generate images with Google Gemini (Nano Banana) through the official @google/genai SDK (Interactions API).
//
//   node gemini.mjs <jobs.json> <out-dir> [--model gemini-nano-banana-2.1] [--size 2K] [--concurrency 3]
//   node gemini.mjs --check            confirms a key is available (never prints it)
//
// jobs.json: [{ "id": "hero", "prompt": "...", "aspect": "16:9" }, ...]
// Writes <out-dir>/<id>.<ext> for each job and prints one JSON line per job:
// {"id","ok":true,"file","mime","model"} or {"id","ok":false,"error"}.
//
// The API key comes from GEMINI_API_KEY when set, else from the DPAPI-encrypted file written by
// store-gemini-key.ps1 (%LOCALAPPDATA%\website-generator\gemini.key). The key is never printed or written.
import { GoogleGenAI } from '@google/genai';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--check'));

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const file = path.join(process.env.LOCALAPPDATA || '', 'website-generator', 'gemini.key');
  if (!fs.existsSync(file)) return null;
  // DPAPI decrypt as the current user; the plaintext only travels over this process's pipe.
  const ps = `$s = Get-Content -LiteralPath '${file.replace(/'/g, "''")}' | ConvertTo-SecureString; ` +
    `$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); ` +
    `try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }`;
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch { return null; }
}

const key = loadKey();
if (!key) {
  console.error('gemini: no API key. Run: powershell -ExecutionPolicy Bypass -File .claude/skills/generate-images/scripts/store-gemini-key.ps1');
  process.exit(3);
}
const scrub = s => String(s).split(key).join('[key]');
if (args.includes('--check')) { console.log(JSON.stringify({ ok: true, source: process.env.GEMINI_API_KEY ? 'env' : 'dpapi-file', length: key.length })); process.exit(0); }

const [jobsFile, outDir] = pos;
if (!jobsFile || !outDir) { console.error('usage: node gemini.mjs <jobs.json> <out-dir> [--model ..] [--size 2K] [--concurrency 3]'); process.exit(2); }
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const model = flag('model', 'gemini-nano-banana-2.1');
const size = flag('size', '2K');
const concurrency = Math.max(1, Number(flag('concurrency', 3)));
fs.mkdirSync(outDir, { recursive: true });

const ai = new GoogleGenAI({ apiKey: key });
const extOf = m => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[m] || 'img');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(job) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(job.id || '')) return { id: job.id, ok: false, error: 'bad id' };
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const it = await ai.interactions.create({
        model,
        input: job.prompt,
        response_format: { type: 'image', aspect_ratio: job.aspect || '1:1', image_size: size, mime_type: 'image/jpeg' },
      });
      const img = it.output_image;
      if (!img) return { id: job.id, ok: false, error: 'no image returned' + (it.output_text ? ': ' + it.output_text.slice(0, 200) : '') };
      let buf, mime = img.mime_type || 'image/jpeg';
      if (img.data) buf = Buffer.from(img.data, 'base64');
      else if (img.uri) {
        const r = await fetch(img.uri, { headers: { 'x-goog-api-key': key } });
        if (!r.ok) throw Object.assign(new Error('download ' + r.status), { status: r.status });
        buf = Buffer.from(await r.arrayBuffer()); mime = r.headers.get('content-type') || mime;
      } else return { id: job.id, ok: false, error: 'image block has no data or uri' };
      const file = path.join(outDir, `${job.id}.${extOf(mime)}`);
      fs.writeFileSync(file, buf);
      return { id: job.id, ok: true, file: file.replace(/\\/g, '/'), mime, model, kib: Math.round(buf.length / 1024) };
    } catch (e) {
      const status = e.status || e.code;
      const retry = [429, 500, 502, 503, 504].includes(Number(status));
      if (!retry || attempt === 4) return { id: job.id, ok: false, error: scrub(`${status || ''} ${e.message || e}`.trim()).slice(0, 400) };
      await sleep(2000 * 2 ** attempt);
    }
  }
}

const queue = [...jobs];
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
  for (let job; (job = queue.shift());) console.log(JSON.stringify(await run(job)));
}));
