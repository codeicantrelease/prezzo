#!/usr/bin/env node
// Asset provenance guard.
//
// Prevents copyrighted media from landing in the repo: every committed raster
// image / audio / video file must be declared in `assets-allowlist.json` with a
// source and license. A human has to assert provenance for each one — which is
// the real control, since copyright can't be detected automatically.
//
// Text assets (SVG, etc.) are exempt: they are diffable and authored in-repo.
// Large or third-party licensed media should be referenced at runtime instead
// of committed (see .gitignore for *.mp3, *.mp4, ...). The danger-zone audio
// and the original dubdubtok SVG are the working examples of both patterns.
//
// Runs in CI (.github/workflows/asset-provenance.yml) and via `npm run check`.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const MEDIA = /\.(png|jpe?g|gif|webp|bmp|tiff?|ico|mp3|wav|ogg|m4a|aac|flac|mp4|mov|webm|avi|mkv)$/i;
const ALLOWLIST = "assets-allowlist.json";

const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const media = tracked.filter((file) => MEDIA.test(file));

const declared = new Set();
const malformed = [];

if (existsSync(ALLOWLIST)) {
  const data = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
  for (const entry of data.assets ?? []) {
    if (entry?.path && entry?.source && entry?.license) declared.add(entry.path);
    else malformed.push(entry);
  }
}

const undeclared = media.filter((file) => !declared.has(file));
const stale = [...declared].filter((path) => !tracked.includes(path));

if (malformed.length > 0) {
  console.error(`\n✗ ${ALLOWLIST} has entries missing path/source/license:`);
  for (const entry of malformed) console.error(`  - ${JSON.stringify(entry)}`);
}

if (undeclared.length > 0) {
  console.error("\n✗ Undeclared binary media asset(s) committed:\n");
  for (const file of undeclared) console.error(`  - ${file}`);
  console.error(`\nEvery committed image/audio/video must be declared in ${ALLOWLIST} as`);
  console.error('  { "path": "...", "source": "...", "license": "..." }');
  console.error("\nThis guards against copyrighted media being published. Either:");
  console.error("  • use an original or appropriately-licensed asset and declare it, or");
  console.error("  • reference large/third-party media at runtime instead of committing it");
  console.error("    (add the extension to .gitignore, like *.mp3).");
}

if (malformed.length > 0 || undeclared.length > 0) {
  process.exit(1);
}

if (stale.length > 0) {
  console.warn(`⚠ ${ALLOWLIST} lists asset(s) no longer in the repo (safe to remove):`);
  for (const path of stale) console.warn(`  - ${path}`);
}

console.log(`✓ Asset provenance OK — ${media.length} declared media file(s), ${tracked.length} tracked files.`);
