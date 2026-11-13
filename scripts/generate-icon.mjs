// Package the supplied artwork using Tauri's icon generator. No artwork is redrawn.
import { copyFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@tauri-apps/cli/tauri.js",
    "icon",
    "src/assets/quiet-time.png",
    "--output",
    ".tools/icon-build",
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
mkdirSync(new URL("../src-tauri/icons/", import.meta.url), { recursive: true });
for (const file of ["icon.ico", "32x32.png", "128x128.png", "128x128@2x.png"]) {
  copyFileSync(
    new URL(`../.tools/icon-build/${file}`, import.meta.url),
    new URL(`../src-tauri/icons/${file}`, import.meta.url),
  );
}
