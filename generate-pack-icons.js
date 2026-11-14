const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const packsDirectory = path.join(__dirname, "packs");
const icons = {
  art: ["🎨", "🖌️", "🖼️"],
  birthday: ["🎂", "🎈", "🎉"],
  buildings: ["🏙️", "🏠", "🏗️"],
  china: ["🐉", "🏮", "🥟"],
  christmas: ["🎄", "🎁", "🛷"],
  clothing: ["👗", "🧵", "👒"],
  containers: ["🫙", "🧺", "🧳"],
  drinks: ["🍹", "☕", "🥤"],
  egypt: ["🏺", "🪲", "🏜️"],
  emotions: ["❤️‍🩹", "💔", "🧊"],
  energy: ["⚡", "🔋", "🔮"],
  environmental: ["🌱", "♻️", "🌧️"],
  example: ["🎩", "🧢", "👒"],
  fathers_day: ["🧰", "🔨", "🎁"],
  finance: ["💰", "🪙", "📈"],
  food: ["🥧", "🥯", "🍯"],
  france: ["🥖", "🗼", "🎨"],
  furniture: ["🛋️", "🛏️", "🪑"],
  gaming: ["🎮", "🕹️", "🎧"],
  halloween: ["🎃", "🦇", "🕸️"],
  hobbies: ["🧶", "🛶", "🎣"],
  japan: ["⛩️", "🌸", "🍵"],
  lunar_new_year: ["🏮", "🐉", "🧧"],
  mexico: ["🌮", "🪇", "🌵"],
  mothers_day: ["💐", "💌", "🕯️"],
  nature: ["🌿", "🍄", "💧"],
  new_years: ["🎆", "🥂", "🕛"],
  objects: ["✂️", "🧳", "🪞"],
  poop: ["💩", "😎", "🪰"],
  seasonal: ["🍂", "❄️", "🌷"],
  south_korea: ["🥬", "🥢", "🍶"],
  stinky: ["🧦", "🪰", "🧀"],
  st_patricks_day: ["☘️", "🌈", "🪙"],
  structures: ["🌉", "🗼", "🚇"],
  technology: ["🤖", "🧠", "💾"],
  thanksgiving: ["🦃", "🥧", "🌽"],
  tools: ["🔧", "🪚", "🔨"],
  toys: ["🧸", "🦆", "🧱"],
  valentines_day: ["💌", "🌹", "💘"],
  war: ["⚔️", "🏰", "🔥"],
};

const positions = [
  { size: 148, x: 54, y: 52 },
  { size: 80, x: 8, y: 10 },
  { size: 80, x: 168, y: 166 },
];

const packNames = fs
  .readdirSync(packsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(packsDirectory, entry.name, "pack.json")))
  .map((entry) => entry.name);
const missingIcons = packNames.filter((packName) => !icons[packName]);
const unknownIcons = Object.keys(icons).filter((packName) => !packNames.includes(packName));
if (missingIcons.length || unknownIcons.length) {
  throw new Error(
    `Pack icon list mismatch. Missing: ${missingIcons.join(", ") || "none"}; unknown: ${unknownIcons.join(", ") || "none"}.`,
  );
}

for (const [packName, emojiSet] of Object.entries(icons)) {
  const packDirectory = path.join(packsDirectory, packName);
  if (!fs.existsSync(path.join(packDirectory, "pack.json"))) {
    throw new Error(`Pack metadata not found for "${packName}".`);
  }

  const outputPath = path.join(packDirectory, "icon.png");
  const args = ["-size", "256x256", "xc:none"];

  emojiSet.forEach((emoji, index) => {
    const { size, x, y } = positions[index];
    args.push(
      "(",
      "-background",
      "none",
      "-font",
      "Noto Color Emoji",
      "-pointsize",
      String(size),
      `pango:${emoji}`,
      "-resize",
      `${size}x${size}`,
      ")",
      "-geometry",
      `+${x}+${y}`,
      "-composite",
    );
  });

  args.push("-strip", outputPath);
  const result = spawnSync("convert", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Could not create ${outputPath}: ${result.stderr}`);
  }
}

console.log(`Generated ${Object.keys(icons).length} transparent pack icons.`);
