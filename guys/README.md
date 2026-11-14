# Guys packs

`packs/` holds the emoji packs, `guys/` (this folder) holds the guys packs for **Emoji Hats**. The game reads this repo straight from GitHub, so a new pack shows up in the game's
Mods page (under **GUYS PACKS**) a few minutes after you add it (GitHub caches files for up to 5 minutes). No server, no code changes.

## Add a guy pack (the 60-second way)

1. Open this repo on github.com → open the `guys` folder.
2. **Add file → Upload files**, and drag in a **folder of pictures**. The folder name is the pack name
   (e.g. `cats`, `my_friends`, `halloween`). GitHub keeps the folder when you drop a whole folder in.
3. Press **Commit changes**.
4. Wait ~20 seconds for the bot, then up to a few minutes for GitHub's cache. A bot (the *Update guy pack lists* Action) writes `guys/pack_list.json` and `guys/<pack>/guys.json` for you.
   Reload the game → **Mods → GUYS PACKS** → switch your pack on.

That's all. One picture = one guy. The guy's name is the file name (`big_steve.png` → "Big Steve").

### Optional extras (only if you want them)

Put these next to the pictures in `guys/<pack>/`:

| File | What it does |
|---|---|
| `icon.png` | the pack's icon on its card (default: its first guy) |
| `pack.json` | `{"title":"Cats","description":"shown on the card","llm_description":"told to the AI judge about the whole pack","tags":["animals"]}` |
| `descriptions.json` | `{"big_steve":"a huge guy with a tiny moustache"}` — what the AI judge is told about each guy (key = file name without `.png`) |

## Adding a pack from your computer (git)

```
git clone https://github.com/bhoppings-official/emoji-hats-packs
cd emoji-hats-packs
mkdir guys/cats        # then copy your pictures in
git add -A && git commit -m "Add cats" && git push
```
(Want the lists updated before you push? `node scripts/build-guys-manifests.mjs`.)

## Picture rules (full spec in `guys/GUY_PACK_SPECIFICATION.MD`)

* Transparent **PNG**, roughly **square**, **256–512 px** (webp, jpg, gif, svg and avif also work).
  The game shows every guy in a square box, bottom-aligned, with the hat on top, so the head should fill the picture and reach its top edge.
* Keep each file small (under ~300 KB); everybody downloads them when the pack is on.
* Max 200 guys per pack. Pack folder names: letters, numbers, `_`, `-`, spaces.

## Nothing shows up?

* Check the **Actions** tab: *Update guy pack lists* should have a green tick. (First time: **Settings → Actions → General →
  Workflow permissions → Read and write permissions**.)
* The repo must be **public** (the game reads it through raw.githubusercontent.com).
* The Action not available? Run `node scripts/build-guys-manifests.mjs` and commit what it changes.
