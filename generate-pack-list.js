const fs = require("node:fs");
const path = require("node:path");

const packsDirectory = path.join(__dirname, "packs");
const outputPath = path.join(__dirname, "pack_list.json");

const packNames = fs
  .readdirSync(packsDirectory, { withFileTypes: true })
  .filter((entry) => {
    if (!entry.isDirectory()) {
      return false;
    }

    return fs.existsSync(path.join(packsDirectory, entry.name, "pack.json"));
  })
  .map((entry) => entry.name)
  .sort();

fs.writeFileSync(outputPath, `${JSON.stringify(packNames, null, 2)}\n`);
console.log(`Generated ${path.relative(__dirname, outputPath)} with ${packNames.length} packs.`);
