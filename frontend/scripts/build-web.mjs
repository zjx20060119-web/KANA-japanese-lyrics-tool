import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const frontendRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const nextBin = require.resolve("next/dist/bin/next");

const vendorResult = spawnSync(
  process.execPath,
  [resolve(frontendRoot, "scripts", "vendor-kuromoji.mjs")],
  { cwd: frontendRoot, stdio: "inherit", env: process.env },
);
if (vendorResult.status !== 0) {
  process.exit(vendorResult.status ?? 1);
}

const buildResult = spawnSync(
  process.execPath,
  [nextBin, "build"],
  {
    cwd: frontendRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      OFFLINE_EXPORT: "true",
    },
  },
);
process.exit(buildResult.status ?? 1);
