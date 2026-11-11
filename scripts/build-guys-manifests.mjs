// Guys packs only (the emoji packs in packs/ are untouched). Rebuilds the generated files the game reads:
//   guys/pack_list.json      -> ["example","cats",...]       (every folder in guys/ that has at least one picture)
//   guys/<pack>/guys.json    -> {"icon":"icon.png","guys":["bob.png","sue.png"]}   (the pictures in that folder)
// Run by the GitHub Action on every push. You can also run it yourself:  node scripts/build-guys-manifests.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IMG = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const ICON = /^icon\.(png|jpe?g|webp|gif|svg|avif)$/i;
const PACK_FOLDER = /^[A-Za-z0-9_][\w -]{0,59}$/;
const FILE_OK = /^[^\/\\\u0000-\u001f]{1,100}$/;
const sort = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

function writeIfChanged(path, data) {
  const text = JSON.stringify(data, null, 2) + '\n';
  if (existsSync(path) && readFileSync(path, 'utf8') === text) return false;
  writeFileSync(path, text);
  console.log('updated', path);
  return true;
}

const packs = [];
for (const dir of readdirSync('guys').sort(sort)) {
  const full = join('guys', dir);
  if (!statSync(full).isDirectory()) continue;
  if (!PACK_FOLDER.test(dir)) { console.warn(`skipped "${dir}": folder names may only use letters, numbers, _ - and spaces (max 60)`); continue; }
  const files = readdirSync(full).filter(f => IMG.test(f) && FILE_OK.test(f) && statSync(join(full, f)).isFile());
  const guys = files.filter(f => !ICON.test(f)).sort(sort).slice(0, 200);
  if (!guys.length) { console.warn(`skipped "${dir}": no pictures in it yet`); continue; }
  const icon = files.find(f => ICON.test(f)) || guys[0];
  writeIfChanged(join(full, 'guys.json'), { icon, guys });
  packs.push(dir);
}
writeIfChanged('guys/pack_list.json', packs);
console.log(`${packs.length} guy pack(s):`, packs.join(', ') || '(none)');
