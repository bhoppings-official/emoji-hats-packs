A guy pack is a folder in `guys/` (the emoji packs live in `packs/`). Its internal name is the folder name in snake_case (`My Cats` → `my_cats`).

## Required
- At least one picture (png, jpg, jpeg, webp, gif, svg, avif) directly inside the folder. Each picture is one guy.
  The guy's display name is the file name without extension, with `_` and `-` turned into spaces and capitalised (max 28 characters).
  Order in the picker: sorted by file name (natural order, so `guy2` comes before `guy10`).

## Generated (don't write these by hand; the GitHub Action does)
- `guys/<pack>/guys.json` — `{"icon":"icon.png","guys":["a.png","b.png"]}`. The game cannot list a folder from GitHub, so this is its file list.
- `guys/pack_list.json` — `["cats","example"]`, every pack that has at least one picture. Packs are added to the picker in this order, after the built-in guys.

## Optional (in the pack folder)
- `icon.png` — icon shown on the pack's card. Default: the first guy. Not counted as a guy.
- `pack.json` — object:
  - `title` — display name (default: the folder name)
  - `description` — text on the card
  - `llm_description` — about the whole pack, given to the AI judge
  - `icon` — a different icon file name
  - `tags` — array of short tags shown on the card
- `descriptions.json` — `{"<file name without extension>": "what this guy looks like"}`, given to the AI judge (default: "an emoji character").

## Picture guidelines
- Transparent background, roughly square, 256–512 px. Guys are drawn in a square box, `object-fit: contain`, aligned to the bottom; hats sit on top of the picture's top edge, so the head should touch the top edge and be centred.
- Under ~300 KB per file. Max 200 guys per pack.
