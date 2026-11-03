#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
emoji_dir=${1:-"$script_dir/emojis"}

if [[ ! -d "$emoji_dir" ]]; then
  printf 'Error: directory not found: %s\n' "$emoji_dir" >&2
  exit 1
fi
emoji_dir=$(cd -- "$emoji_dir" && pwd)

if command -v magick >/dev/null 2>&1; then
  image_tool=(magick)
elif command -v convert >/dev/null 2>&1; then
  image_tool=(convert)
else
  printf 'Error: ImageMagick (magick or convert) is required to trim PNG edges.\n' >&2
  exit 1
fi

files=()
while IFS= read -r -d '' file; do
  files+=("$file")
done < <(find "$emoji_dir" -type f -iname '*.png' -print0)

for file in "${files[@]}"; do
  directory=${file%/*}
  filename=${file##*/}
  stem=${filename%.*}
  trimmed_stem=$(printf '%s' "$stem" | LC_ALL=C sed -E 's/[[:space:]]+$//')
  trailing_number=
  if [[ "$trimmed_stem" =~ ([0-9]+)$ ]]; then
    trailing_number=${BASH_REMATCH[1]}
  fi
  normalized=$(
    printf '%s' "$stem" |
      LC_ALL=C tr '[:upper:]' '[:lower:]' |
      LC_ALL=C sed -E \
        -e 's/[[:space:]]+/_/g' \
        -e 's/-//g' \
        -e 's/[^a-z_]+//g' \
        -e 's/_+/_/g' \
        -e 's/^_+|_+$//g'
  )
  if [[ -z "$normalized" ]]; then
    normalized=emoji
  fi
  if [[ -n "$trailing_number" ]]; then
    normalized="${normalized}_${trailing_number}"
  fi

  target="$directory/$normalized.png"
  if [[ "$target" != "$file" ]]; then
    suffix=2
    while [[ -e "$target" || -L "$target" ]]; do
      target="$directory/${normalized}_$suffix.png"
      ((suffix += 1))
    done
  fi

  trimmed=$(mktemp "$directory/.normalize-emojis.XXXXXXXX.png")
  if ! "${image_tool[@]}" "$file" -trim +repage "$trimmed"; then
    rm -f -- "$trimmed"
    printf 'Error: could not trim PNG: %s\n' "$file" >&2
    exit 1
  fi
  if ! mv -- "$trimmed" "$file"; then
    rm -f -- "$trimmed"
    printf 'Error: could not replace PNG: %s\n' "$file" >&2
    exit 1
  fi

  if [[ "$target" != "$file" ]]; then
    if ! mv -- "$file" "$target"; then
      printf 'Error: could not rename %s to %s\n' "$file" "$target" >&2
      exit 1
    fi
    printf 'Renamed: %q -> %q\n' "$file" "$target"
  else
    printf 'Trimmed: %q\n' "$file"
  fi
done