# emoji-hats-packs
emoji hat hats

## Building emoji atlases

Run `npm install` once and install ImageMagick (`magick` or `convert`), then
`npm run build` to normalize each pack's emoji PNGs and generate or update its
`atlas.webp` and `atlas.json`. Normalization trims image edges and renames
files in place. Use `npm run build:force` to rebuild every atlas.

## Updating the pack list

Run `node generate-pack-list.js` to regenerate `pack_list.json` from the pack
directories under `packs/`. A directory is included when it contains a
`pack.json` file.

## Regenerating pack icons

Run `node generate-pack-icons.js` to regenerate the square, transparent pack
icons. This requires ImageMagick and the Noto Color Emoji font.
