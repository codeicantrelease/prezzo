#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const decksDir = path.join(root, "decks");
const registryPath = path.join(root, "src", "deck-registry.ts");

const [, , command = "help", ...args] = process.argv;

function option(name) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));

  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function positional(index = 0) {
  return args.filter((arg) => !arg.startsWith("--"))[index];
}

function toSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitle(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toBinding(slug) {
  const parts = slug.split("-").filter(Boolean);
  const name = parts
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");

  return `${name || "deck"}Config`;
}

function toComponentName(slug) {
  const raw = toTitle(slug).replace(/[^A-Za-z0-9]/g, "") || "Generated";
  return /^[A-Za-z]/.test(raw) ? `${raw}Deck` : `Deck${raw}Deck`;
}

async function readDeckConfigs() {
  const entries = await fs.readdir(decksDir, { withFileTypes: true }).catch(() => []);
  const decks = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const configPath = path.join(decksDir, entry.name, "deck.config.ts");
    const source = await fs.readFile(configPath, "utf8").catch(() => "");
    if (!source) continue;

    const slug = source.match(/slug:\s*"([^"]+)"/)?.[1] ?? entry.name;
    const label = source.match(/label:\s*"([^"]+)"/)?.[1] ?? toTitle(slug);
    const description = source.match(/description:\s*"([^"]+)"/)?.[1] ?? "";
    const hasRemotion = source.includes("remotion:");

    decks.push({ slug, label, description, hasRemotion });
  }

  return decks.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function assertDeck(slug) {
  const decks = await readDeckConfigs();
  const deck = decks.find((item) => item.slug === slug);

  if (!deck) {
    throw new Error(`Unknown deck "${slug}". Run "npm run deck:list" to see available decks.`);
  }

  return deck;
}

function run(cmd, cmdArgs, env = {}) {
  const child = spawn(cmd, cmdArgs, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

async function updateRegistry(slug) {
  const binding = toBinding(slug);
  const relativeImport = `../decks/${slug}/deck.config`;
  let registry = await fs.readFile(registryPath, "utf8");

  if (!registry.includes(relativeImport)) {
    registry = registry.replace(
      /import type \{ DeckConfig \} from "\.\/deck-types";/,
      `import { deckConfig as ${binding} } from "${relativeImport}";\nimport type { DeckConfig } from "./deck-types";`,
    );
  }

  if (!registry.includes(`${binding},`)) {
    registry = registry.replace(
      /export const deckConfigs = \[([\s\S]*?)\] satisfies DeckConfig\[];/,
      (match, body) => `export const deckConfigs = [${body.trimEnd()}\n  ${binding},\n] satisfies DeckConfig[];`,
    );
  }

  await fs.writeFile(registryPath, registry);
}

async function createDeck() {
  const rawSlug = positional();
  if (!rawSlug) throw new Error("Usage: npm run deck:new -- <slug> [--style-guide /path/to/style-guide]");

  const slug = toSlug(rawSlug);
  const label = option("label") ?? toTitle(slug);
  const styleGuide = option("style-guide") ?? option("styleGuide") ?? "";
  const deckPath = path.join(decksDir, slug);

  await fs.mkdir(path.join(deckPath, "assets"), { recursive: true });
  await fs.mkdir(path.join(deckPath, "qa"), { recursive: true });
  await fs.mkdir(path.join(deckPath, "remotion"), { recursive: true });

  const existing = await fs.stat(path.join(deckPath, "deck.config.ts")).then(() => true, () => false);
  if (existing) throw new Error(`Deck "${slug}" already exists at ${path.relative(root, deckPath)}.`);

  const componentName = toComponentName(slug);

  await fs.writeFile(
    path.join(deckPath, "Deck.tsx"),
    `import { Deck, FlexBox, Heading, Slide, Text } from "spectacle";
import { Template } from "../../src/components/Template";
import { prezzoTheme } from "../../src/theme";

export function ${componentName}() {
  return (
    <Deck theme={prezzoTheme} template={Template}>
      <Slide backgroundColor="#101418">
        <FlexBox className="slide-shell" flexDirection="column" justifyContent="center">
          <Text className="kicker" color="#f3b23a">
            Draft deck
          </Text>
          <Heading fontSize="88px" color="#f8f3e7" margin="8px 0 24px">
            ${label}
          </Heading>
          <Text color="rgba(248,243,231,0.78)" fontSize="34px" maxWidth="1060px">
            Replace this starter slide after writing the brief and run of show.
          </Text>
        </FlexBox>
      </Slide>
    </Deck>
  );
}
`,
  );

  await fs.writeFile(
    path.join(deckPath, "remotion", "DeckVideo.tsx"),
    `import { AbsoluteFill } from "remotion";

type DeckVideoProps = {
  title: string;
  subtitle: string;
};

export function DeckVideo({ title, subtitle }: DeckVideoProps) {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        background: "#101418",
        color: "#f8f3e7",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, Avenir Next, system-ui, sans-serif",
        justifyContent: "center",
        padding: 120,
      }}
    >
      <div style={{ color: "#f3b23a", fontSize: 34, fontWeight: 900 }}>Prezzo render</div>
      <h1 style={{ fontSize: 128, lineHeight: 1, margin: "24px 0" }}>{title}</h1>
      <p style={{ color: "rgba(248,243,231,0.78)", fontSize: 48, margin: 0 }}>{subtitle}</p>
    </AbsoluteFill>
  );
}
`,
  );

  await fs.writeFile(
    path.join(deckPath, "deck.config.ts"),
    `import { ${componentName} } from "./Deck";
import { DeckVideo } from "./remotion/DeckVideo";
import type { DeckConfig } from "../../src/deck-types";

export const deckConfig = {
  slug: "${slug}",
  label: "${label.replaceAll('"', '\\"')}",
  description: "Generated Prezzo deck.",
  slideCount: 1,
  component: ${componentName},
  remotion: {
    id: "${slug}",
    component: DeckVideo,
    durationInFrames: 150,
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: {
      title: "${label.replaceAll('"', '\\"')}",
      subtitle: "Draft render scene",
    },
  },
} satisfies DeckConfig;
`,
  );

  await fs.writeFile(
    path.join(deckPath, "notes.md"),
    `# ${label}

## Brief

- Audience:
- Duration:
- Objective:
- Desired feeling:
- Must-say points:
- Forbidden claims:

## Style Guide

${styleGuide ? `Use: \`${styleGuide}\`` : "No external style guide provided yet."}

## Run Of Show

1. Opening promise.

## Visual QA

Capture settled screenshots into \`qa/\` and fix contrast, clipping, overlap, hidden controls, and unreadable media captions before handoff.
`,
  );

  await fs.writeFile(
    path.join(deckPath, "assets", "README.md"),
    `# ${label} Assets

Record source, license, creation date, and commit suitability for each non-trivial asset.
`,
  );

  await fs.writeFile(path.join(deckPath, "qa", ".gitkeep"), "");
  await updateRegistry(slug);
  console.log(`Created deck ${slug} at ${path.relative(root, deckPath)}`);
}

async function main() {
  if (command === "list") {
    const decks = await readDeckConfigs();
    for (const deck of decks) {
      const suffix = deck.hasRemotion ? " + remotion" : "";
      console.log(`${deck.slug} - ${deck.label}${suffix}`);
      if (deck.description) console.log(`  ${deck.description}`);
    }
    return;
  }

  if (command === "new") {
    await createDeck();
    return;
  }

  if (command === "dev") {
    const slug = toSlug(positional() || "prezzo-demo");
    await assertDeck(slug);
    run("vite", ["--host", "127.0.0.1"], { VITE_PREZZO_DECK: slug });
    return;
  }

  if (command === "studio") {
    const slug = toSlug(positional() || "prezzo-demo");
    await assertDeck(slug);
    run("remotion", ["studio", "src/remotion/index.ts"], { VITE_PREZZO_DECK: slug });
    return;
  }

  if (command === "render") {
    const slug = toSlug(positional() || "prezzo-demo");
    const deck = await assertDeck(slug);
    if (!deck.hasRemotion) throw new Error(`Deck "${slug}" does not define a Remotion composition.`);
    run("remotion", ["render", "src/remotion/index.ts", slug, `out/${slug}.mp4`], {
      VITE_PREZZO_DECK: slug,
    });
    return;
  }

  if (command === "qa") {
    const slug = toSlug(positional() || "prezzo-demo");
    await assertDeck(slug);
    console.log(`Visual QA checklist for ${slug}:`);
    console.log(`1. Run: npm run dev -- ${slug}`);
    console.log(`2. Open: http://127.0.0.1:5173/${slug}`);
    console.log("3. Capture settled screenshots for every changed slide.");
    console.log("4. Fix contrast, clipping, overlap, hidden controls, unreadable chart labels, and media captions.");
    console.log("5. Re-run npm run check and re-capture affected slides.");
    return;
  }

  console.log(`Prezzo commands:
  npm run deck:list
  npm run deck:new -- <slug> [--style-guide /path/to/style-guide]
  npm run dev -- <slug>
  npm run studio -- <slug>
  npm run render -- <slug>
  npm run deck:qa -- <slug>`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
