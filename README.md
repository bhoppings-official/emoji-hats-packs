# emoji-hats-packs
emoji hat hats

## Building emoji atlases

Run `npm install` once, then `npm run build` to generate or update each pack's
`atlas.webp` and `atlas.json`. Use `npm run build:force` to rebuild every atlas.

## Updating the pack list

Run `node generate-pack-list.js` to regenerate `pack_list.json` from the pack
directories under `packs/`. A directory is included when it contains a
`pack.json` file.

## Regenerating pack icons

Run `node generate-pack-icons.js` to regenerate the square, transparent pack
icons. This requires ImageMagick and the Noto Color Emoji font.
