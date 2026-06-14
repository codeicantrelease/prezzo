#!/usr/bin/env node
// Open the running dev deck in Google Chrome with the autoplay policy disabled,
// so audio slides autostart with sound even on a cold load (no prior gesture).
//
// Usage:
//   npm run present              # opens the default deck
//   npm run present my-deck      # opens /my-deck
//   npm run present my-deck 6    # cold-loads /my-deck on slide 6
//   PREZZO_PORT=5180 npm run present
//
// This only affects the Chrome instance it launches (a dedicated throwaway
// profile so the flag reliably applies). It is a local presenting/testing
// convenience — the deck itself degrades gracefully without it: audio slides
// autostart muted and unmute on the first interaction.

import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const slug = process.argv[2] || process.env.VITE_PREZZO_DECK || "prezzo-demo";
const slide = Number(process.argv[3]);
const port = process.env.PREZZO_PORT || "5173";
const query = Number.isFinite(slide) && slide > 0 ? `?slideIndex=${slide - 1}&stepIndex=0` : "";
const url = `http://localhost:${port}/${slug}${query}`;
const profileDir = path.join(os.tmpdir(), "prezzo-present-chrome");

const flags = [
  "--autoplay-policy=no-user-gesture-required",
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--no-default-browser-check",
];

let command;
let args;

if (process.platform === "darwin") {
  command = "open";
  args = ["-na", "Google Chrome", "--args", ...flags, url];
} else if (process.platform === "win32") {
  command = "cmd";
  args = ["/c", "start", "", "chrome", ...flags, url];
} else {
  command = "google-chrome";
  args = [...flags, url];
}

console.log(`Opening ${url}`);
console.log("Chrome flag: --autoplay-policy=no-user-gesture-required (audio autostarts with sound)");

const child = spawn(command, args, { detached: true, stdio: "inherit" });

child.on("error", (error) => {
  console.error(`\nFailed to launch Chrome: ${error.message}`);
  console.error("Make sure Google Chrome is installed, or open this URL manually:");
  console.error(`  ${url}`);
  process.exit(1);
});

child.unref();
