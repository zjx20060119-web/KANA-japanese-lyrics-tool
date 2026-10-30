import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const dictionarySource = join(
  frontendRoot,
  "node_modules",
  "kuromoji",
  "dict",
);
const dictionaryTarget = join(
  frontendRoot,
  "public",
  "kuromoji-dict",
);

if (!existsSync(dictionarySource)) {
  throw new Error(`Kuromoji dictionary not found: ${dictionarySource}`);
}

mkdirSync(dictionaryTarget, { recursive: true });

for (const fileName of readdirSync(dictionarySource)) {
  if (fileName.endsWith(".dat.gz")) {
    copyFileSync(
      join(dictionarySource, fileName),
      join(dictionaryTarget, fileName),
    );
  }
}

for (const fileName of readdirSync(dictionaryTarget)) {
  if (fileName.endsWith(".dat")) {
    unlinkSync(join(dictionaryTarget, fileName));
  }
}

for (const licenseFile of ["LICENSE-2.0.txt", "NOTICE.md"]) {
  const licenseSource = join(
    frontendRoot,
    "node_modules",
    "kuromoji",
    licenseFile,
  );
  if (existsSync(licenseSource)) {
    copyFileSync(
      licenseSource,
      join(dictionaryTarget, licenseFile),
    );
  }
}

console.log("Kuromoji dictionary vendored.");
