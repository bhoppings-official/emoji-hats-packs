#!/usr/bin/env node
/**
 * build-atlas.cjs
 *
 * For every pack in ./packs/<name>/emojis/*.png this builds
 *
 *   ./packs/<name>/atlas.webp   one sprite sheet with every emoji of the pack
 *   ./packs/<name>/atlas.json   where each emoji sits in that sheet + sheet metadata
 *
 * Before packing, each pack's PNGs are normalized in place (trimmed and renamed).
 * Each one is then shrunk to fit inside a SIZE x SIZE cell (aspect ratio kept, centred,
 * transparent padding), converted to 8-bit and placed on a grid. Packs whose PNGs didn't
 * change since the last build are skipped.
 *
 * Usage (from the repo root)
 *   npm run build                     build every pack that changed
 *   npm run build -- food egypt       build only these packs
 *   npm run build:force               rebuild everything
 *   npm run build -- --size=128 --quality=85 --padding=2 --maxCols=12
 *
 * atlas.json
 *   {
 *     "meta":   { size, padding, stride, columns, rows, width, height, count, hash, ... },
 *     "emojis": { "<name>": { "x": <px>, "y": <px> }, ... }
 *   }
 *   x / y = top-left corner of that emoji's size x size cell inside atlas.webp.
 *   Cells are `stride` (= size + 2 * padding) apart; the padding is transparent so that
 *   scaling the sheet in CSS never bleeds one emoji into its neighbour.
 */
'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = __dirname;
const PACKS_DIR = path.join(ROOT, 'packs');
const FORMAT_VERSION = 1; // bump if the layout of atlas.json / the sheet changes (forces a rebuild)

const opts = {
  size: 192,    // each emoji is fitted inside a size x size cell
  padding: 2,   // transparent gutter around every cell (px)
  quality: 90,  // lossy WebP quality (alpha is always lossless)
  maxCols: 10,  // widest the sheet may get, in cells (10 x 196 = 1960 px at the defaults)
};

/* ------------------------------------------------------------------ args */
const only = [];
let force = false;
for (const a of process.argv.slice(2)) {
  if (a === '--force') force = true;
  else if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    if (!(k in opts) || v === undefined || !Number.isFinite(Number(v)) || Number(v) < 0) {
      die(`Unknown or invalid option "${a}". Options: --force, ${Object.keys(opts).map(k => `--${k}=<number>`).join(', ')}`);
    }
    opts[k] = Number(v);
  } else only.push(a);
}
if (opts.size < 1 || opts.maxCols < 1 || opts.quality > 100) die('size and maxCols must be >= 1 and quality must be 0-100.');

function die(msg) { console.error(msg); process.exit(1); }
const kb = n => (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
const mb = n => (n / 1048576).toFixed(n < 10485760 ? 2 : 1) + ' MB';

/* ------------------------------------------------------------------ helpers */
// run fn over items with at most `limit` in flight, keep the order of the results
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function listPngs(pack) {
  let files;
  try { files = await fs.readdir(path.join(PACKS_DIR, pack, 'emojis')); } catch { return []; }
  files = files.filter(f => /\.png$/i.test(f)).sort();            // plain sort = same order on every machine
  const seen = new Map();
  for (const f of files) {
    const name = f.replace(/\.png$/i, '');
    if (seen.has(name)) throw new Error(`"${seen.get(name)}" and "${f}" would have the same name`);
    seen.set(name, f);
  }
  return files;
}

async function normalizeEmojis(pack) {
  const emojiDir = path.join(PACKS_DIR, pack, 'emojis');
  let files;
  try {
    files = await fs.readdir(emojiDir);
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  if (!files.some(f => /\.png$/i.test(f))) return;

  execFileSync('bash', [path.join(ROOT, 'normalize-emojis.sh'), emojiDir], { stdio: 'inherit' });
}

// hash of every input byte + every setting that changes the output: unchanged = skip the pack
async function hashSource(pack, files) {
  const h = crypto.createHash('sha1');
  h.update(JSON.stringify([FORMAT_VERSION, opts.size, opts.padding, opts.quality, opts.maxCols]));
  for (const f of files) {
    h.update('\0' + f + '\0');
    h.update(await fs.readFile(path.join(PACKS_DIR, pack, 'emojis', f)));
  }
  return h.digest('hex');
}

async function writeAtomic(file, data) {
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

/* ------------------------------------------------------------------ one pack */
async function buildPack(pack, files) {
  const { size, padding, quality, maxCols } = opts;
  const dir = path.join(PACKS_DIR, pack);
  const n = files.length;
  const cols = Math.min(maxCols, Math.ceil(Math.sqrt(n)));        // roughly square sheet
  const rows = Math.ceil(n / cols);
  const stride = size + 2 * padding;
  const width = cols * stride, height = rows * stride;
  if (width > 16383 || height > 16383) throw new Error(`sheet would be ${width}x${height}px, WebP's limit is 16383`);

  // 1. shrink every emoji (8-bit sRGB, aspect kept)
  const cells = await mapLimit(files, Math.max(2, Math.min(os.cpus().length, 8)), f =>
    sharp(path.join(dir, 'emojis', f))
      .resize(size, size, { fit: 'inside', kernel: 'lanczos3' })
      .toColourspace('srgb')                                      // 16-bit -> 8-bit
      .ensureAlpha()
      .png({ compressionLevel: 1 })                               // throw-away intermediate: fast, not small
      .toBuffer({ resolveWithObject: true }));

  // 2. place them on the grid, centred inside their cell
  const emojis = Object.create(null);
  const composites = cells.map(({ data, info }, i) => {
    const x = (i % cols) * stride + padding;
    const y = Math.floor(i / cols) * stride + padding;
    emojis[files[i].replace(/\.png$/i, '')] = { x, y };
    return { input: data, left: x + Math.floor((size - info.width) / 2), top: y + Math.floor((size - info.height) / 2) };
  });

  const webp = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .webp({ quality, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toBuffer();

  return { webp, width, height, cols, rows, stride, emojis };
}

/* ------------------------------------------------------------------ main */
async function main() {
  sharp.cache(false);                                             // every input is read exactly once

  let packs = (await fs.readdir(PACKS_DIR, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name).sort();
  if (only.length) {
    const missing = only.filter(p => !packs.includes(p));
    if (missing.length) die(`No such pack in ./packs: ${missing.join(', ')}`);
    packs = only;
  }

  console.log(`Atlas build: ${opts.size}px cells, ${opts.padding}px padding, WebP q${opts.quality}${force ? ' (forced)' : ''}\n`);
  let built = 0, skipped = 0, failed = 0, totalIn = 0, totalOut = 0, totalEmojis = 0;
  const t0 = Date.now();

  for (const pack of packs) {
    try {
      await normalizeEmojis(pack);
      const files = await listPngs(pack);
      if (!files.length) continue;                                // not a pack (no emojis/ folder or no PNGs)
      const sourceHash = await hashSource(pack, files);
      const webpPath = path.join(PACKS_DIR, pack, 'atlas.webp');
      const jsonPath = path.join(PACKS_DIR, pack, 'atlas.json');

      if (!force) {
        try {
          const old = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
          await fs.access(webpPath);
          if (old.meta && old.meta.sourceHash === sourceHash) {
            skipped++; totalEmojis += files.length;
            console.log(`  =  ${pack.padEnd(22)} up to date (${files.length} emojis)`);
            continue;
          }
        } catch { /* missing or unreadable -> build */ }
      }

      const t = Date.now();
      const r = await buildPack(pack, files);
      const hash = crypto.createHash('sha1').update(r.webp).digest('hex').slice(0, 10);
      const manifest = {
        meta: {
          version: FORMAT_VERSION,
          pack,
          image: 'atlas.webp',
          format: 'webp',
          hash,                                                   // of atlas.webp: handy as a cache-buster (atlas.webp?v=<hash>)
          sourceHash,                                             // of the PNGs + settings: used to skip unchanged packs
          width: r.width,
          height: r.height,
          size: opts.size,                                        // each emoji's cell is size x size
          padding: opts.padding,
          stride: r.stride,                                       // distance between two cells = size + 2 * padding
          columns: r.cols,
          rows: r.rows,
          count: files.length,
        },
        emojis: r.emojis,
      };
      await writeAtomic(webpPath, r.webp);
      await writeAtomic(jsonPath, JSON.stringify(manifest, null, 1) + '\n');

      let inBytes = 0;
      for (const f of files) inBytes += (await fs.stat(path.join(PACKS_DIR, pack, 'emojis', f))).size;
      built++; totalIn += inBytes; totalOut += r.webp.length; totalEmojis += files.length;
      const decoded = r.width * r.height * 4;
      console.log(`  +  ${pack.padEnd(22)} ${String(files.length).padStart(3)} emojis  ${r.width}x${r.height}  ${mb(inBytes)} -> ${kb(r.webp.length)}  (${((Date.now() - t) / 1000).toFixed(1)}s)`
        + (decoded > 32 * 1048576 ? `  WARNING: decodes to ${mb(decoded)} of RAM, consider fewer emojis per sheet` : ''));
    } catch (err) {
      failed++;
      console.error(`  !  ${pack.padEnd(22)} FAILED: ${err.message}`);
    }
  }

  console.log(`\n${built} built, ${skipped} unchanged, ${failed} failed · ${totalEmojis} emojis · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (built) console.log(`Built packs: ${mb(totalIn)} of PNG -> ${mb(totalOut)} of WebP`);
  if (failed) process.exit(1);
}

main().catch(err => die(err.stack || String(err)));
