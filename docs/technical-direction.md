# Technical Direction

This document records the project-level technical decisions for Prezzo. It complements [../AGENTS.md](../AGENTS.md), which explains the product intent and agent posture.

## Architecture

Prezzo has two runtime paths:

1. Live deck path: Vite + React + Spectacle in `decks/<slug>/Deck.tsx`.
2. Rendered video path: Remotion entry point in `src/remotion/index.ts`.

The live deck optimizes for presenter navigation, progressive reveals, notes, embedded media, and fast local iteration. The Remotion path optimizes for deterministic frame timing and video export.

Shared visual primitives belong in `src/components/` only when they work in both contexts or can degrade cleanly. If a component depends on browser interaction, navigation state, or non-deterministic animation timing, keep it in the live deck path.

Deck metadata lives in `decks/<slug>/deck.config.ts` and is registered in `src/deck-registry.ts`. Read [deck-contract.md](deck-contract.md) before changing this shape.

## Tooling Defaults

Current package versions were checked on 2026-05-31 with `npm view`:

- `spectacle@10.2.3`
- `remotion@4.0.469`
- `@remotion/cli@4.0.469`
- `@remotion/player@4.0.469`
- `motion@12.40.0`
- `react@19.2.6` is current, but this starter pins `react@18.3.1` because Spectacle's transitive presentation dependencies still declare React 16-18 peer ranges.
- `vite@8.0.14` is current, but this starter pins `vite@6.4.2` because the local npm runtime is Node `20.11.0` and Vite 8 requires Node `20.19+` or `22.12+`.
- `typescript@6.0.3`
- `recharts@3.8.1`

Use `npm install` and `npm run check` as the default setup and verification path.

Deck commands:

```bash
npm run deck:list
npm run deck:new -- <slug> [--style-guide /path/to/style-guide]
npm run dev -- <slug>
npm run studio -- <slug>
npm run render -- <slug>
npm run deck:qa -- <slug>
```

The repo includes `.npmrc` with `legacy-peer-deps=true` because Spectacle depends on the older `react-spring` meta package. Without that setting, npm auto-installs unnecessary optional peer trees such as React Native and Three packages and emits misleading engine warnings.

The `overrides` block patches Spectacle transitive audit findings for `@babel/runtime`, `prismjs`, and `trim` without forcing a breaking downgrade of Spectacle.

## Package Roles

- `spectacle`: Live slide deck, navigation, presenter notes, progressive reveals, and slide templates.
- `motion`: Browser animation for live slides. Prefer restrained transitions, gesture affordances, and rich reveal moments.
- `remotion`: Deterministic frame-based video rendering for openers, explainers, title sequences, exportable GIF/video inserts, and social clips.
- `@remotion/cli`: Local commands for Remotion Studio and rendering. Invoked through `scripts/prezzo.mjs` so deck slugs map to composition ids.
- `@remotion/player`: Future option for embedding Remotion previews inside the live React app.
- `recharts`: Starter charting library for data-driven presentation examples.
- `lucide-react`: Icon set for presentation UI and diagram primitives.

## Remotion Boundary

Remotion animation should be driven by frame state: `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`, `spring()`, `Sequence`, and media primitives from Remotion.

Do not use browser-time animation libraries as the source of truth inside rendered compositions unless you have verified deterministic output. Motion is excellent for live browser animation; Remotion is the right tool for exact video timing.

Remotion licensing is not plain MIT. The official docs state that Remotion is free for individuals, small for-profit organizations up to three employees, non-profits, and non-commercial evaluation; larger commercial use requires a company license. Check https://www.remotiondocs.com/docs/license before using this in a commercial setting.

## Presentation Assets

Use `decks/<slug>/assets/` for deck-local videos, GIFs, images, audio, and generated media. Add a short note beside any non-trivial asset naming:

- source or generation prompt
- license/usage rights
- date created or downloaded
- whether it can be committed

Large exports belong in `out/`, which is ignored by git.

## Agent Workflow

Agents creating a new deck should:

1. Capture the audience, objective, duration, and desired feeling.
2. Create the deck with `npm run deck:new -- <slug> --style-guide /path/to/style-guide` when a style guide exists.
3. Draft a run of show in `decks/<slug>/notes.md` before coding slides.
4. Identify which moments need static slides, live React components, embedded media, or Remotion render.
5. Implement slide components with stable dimensions and readable hierarchy.
6. Run `npm run check`.
7. Inspect the deck visually in a browser.
8. Render Remotion only when timing or export output changed.

The local project skill at [../skills/prezzo-deck/SKILL.md](../skills/prezzo-deck/SKILL.md) encodes this workflow for future agents.

## UI Direction

Prezzo decks should feel crisp, confident, and a little cinematic, but never illegible. Use strong contrast, generous spacing, and a small number of deliberate accents. Avoid turning every slide into a panel grid. The best slides should feel like an explanation arriving on time.

Hero slides can be immersive. Dense slides should be calm and scannable. Charts should make one point quickly. Media should reveal the actual product, action, or state being discussed.

## Testing Priorities

The minimum code check is:

```bash
npm run check
```

Visual work also needs manual or automated browser inspection. Future test helpers should prioritize:

- screenshot checks for desktop presentation size
- settled-state screenshot capture after animations complete
- contrast checks for text and controls against their rendered backgrounds
- first-slide smoke checks
- console error detection
- Remotion render smoke tests for composition metadata
- asset existence checks for local media referenced by decks

Agents should treat obvious visual defects as fixable test failures. Examples: white-on-white footer controls, low-contrast text inside cards, clipped titles, chart labels that disappear against a panel, and animation end states that cover the main message.

## Dependency Policy

Add dependencies only when they unlock a real presentation capability. Prefer React-native libraries with strong TypeScript support, active maintenance, and local/offline behavior.

Good candidates to evaluate later:

- `three` / `@react-three/fiber` for immersive 3D presentation moments.
- `d3` when chart grammar exceeds Recharts.
- `playwright` for automated visual verification.
- Remotion official skills from `remotion-dev/skills` if this repo becomes heavily video-focused.

## External References

- Spectacle repository and release status: https://github.com/FormidableLabs/spectacle
- Spectacle docs: https://www.formidable.com/open-source/spectacle
- Remotion project creation and system requirements: https://www.remotiondocs.com/docs
- Remotion AI and agent workflow docs: https://www.remotiondocs.com/docs/ai/
- Remotion Agent Skills docs: https://www.remotiondocs.com/docs/ai/skills
- Remotion license: https://www.remotiondocs.com/docs/license
- Motion for React docs: https://motion.dev/docs/react
