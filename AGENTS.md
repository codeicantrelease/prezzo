# Prezzo

Prezzo is a private React presentation project for building decks that feel as familiar as PowerPoint to present, but as unconstrained as a modern React app to create.

The goal is to make high-impact technical and product storytelling easier for agents and humans together: live slides in the browser, reusable visual components, presenter notes, data-driven charts, embedded media, and Remotion sequences when the idea needs a rendered video moment. When Prezzo is working, a rough spoken brief can become a coherent run of show, then a polished deck, then selected exported motion graphics without rebuilding the story in another tool.

## Current Status

This is a greenfield starter repo under `/Users/duane/Documents/code/duaneedwards/prezzo`, intended for a future private GitHub repo under `duaneedwards/prezzo`.

The current version is a runnable multi-deck Vite React app with:

- Spectacle for the live browser deck.
- Motion for in-deck animation.
- Recharts for graph examples.
- Remotion for rendered video compositions.
- First-class deck directories under `decks/`.
- A deck registry in `src/deck-registry.ts`.
- A small CLI in `scripts/prezzo.mjs`.
- A project-level skill at `skills/prezzo-deck/SKILL.md`.

Read [docs/deck-contract.md](docs/deck-contract.md) before creating or moving decks. Read [docs/technical-direction.md](docs/technical-direction.md) before changing architecture. Read [docs/presentation-flow.md](docs/presentation-flow.md) before designing deck workflow or agent automation.

## Some Thoughts From The Author

The point is not to make every slide a circus. The point is to stop accepting the ceiling of static slides when the explanation would be clearer as an animation, a live component, a clip, a tiny app, a chart, or a rendered sequence.

Treat "wow factor" as clarity with timing. A talk should still have rhythm, restraint, hierarchy, and a strong spine. Use React because it lets us compose real things. Use video because some moments deserve frame-perfect timing. Use agents because a good agent can help storyboard, build, inspect, and tighten faster than a blank slide canvas.

## Product Principles

1. Make the first screen the deck, not a landing page.
   The repo exists to create presentations, so `npm run dev -- <slug>` should put a usable deck in front of the author immediately.

2. Keep live and rendered modes distinct.
   Spectacle is for presenting and navigating. Remotion is for deterministic video output. Share visual primitives where sensible, but do not force one runtime to pretend to be the other.

3. Prefer components over pasted pixels.
   Charts, demos, media frames, timelines, and title treatments should become reusable React pieces before they become one-off slide hacks.

4. Make agent work inspectable.
   Agents should leave outlines, assumptions, source links, and verification notes where future agents can read them. Do not hide key creative decisions inside generated code.

5. Design for performance under presentation pressure.
   Slides should load locally, survive offline where possible, and avoid heavyweight remote assets unless the author explicitly accepts that dependency.

6. Let media carry evidence.
   Product clips, GIFs, screenshots, generated images, and rendered motion should show the thing being explained. Avoid vague atmospheric visuals.

7. Build toward a private toolbox.
   This can become a personal presentation system: themes, reusable slide kits, render helpers, and agent skills should accumulate carefully.

## Product Shape

v0 should prove:

- A live Spectacle deck can be authored as normal React.
- A Remotion composition can render a polished video opener or hero insert.
- Future agents have enough guidance to create a new deck without asking basic stack questions.
- Multiple decks can live in the same repo and be selected from the CLI or URL.
- The workflow supports charts, animation, presenter notes, and local media.

v0 should not become:

- A SaaS presentation editor.
- A PowerPoint clone with drag handles.
- A generic website or marketing page.
- A pile of disconnected animation experiments.
- A dependency-heavy media suite before the core authoring loop is pleasant.

## Competitive Baseline

PowerPoint and Keynote set the baseline for presenter confidence, slide navigation, speaker notes, and quick iteration. Prezzo should not regress on those basics.

Pitch, Canva, and Figma Slides set a baseline for collaborative visual polish. Prezzo differentiates by making the deck executable: React components, real data, local demos, generated assets, and video export in the same repository.

Remotion sets the baseline for programmatic video creation. Prezzo should use it where deterministic video helps the deck, not as a replacement for every slide.

## General Rules

- Use `npm` unless the repo deliberately changes package manager; `pnpm` is not assumed to be installed on this machine.
- Keep `.npmrc` with `legacy-peer-deps=true`; Spectacle pulls older React presentation dependencies whose optional peer trees are noisy and unnecessary for this app.
- Keep deck code under `decks/<slug>/`.
- Keep reusable pieces under `src/components/` and shared runtime files under `src/`.
- Register every deck in `src/deck-registry.ts`.
- Treat runtime chrome as deck opt-in. Timers and the Quake terminal live under `src/runtime/` and should be enabled from `deck.config.ts` only when useful.
- Put deck-specific Remotion scenes under `decks/<slug>/remotion/`; keep the Remotion root under `src/remotion/`.
- Keep generated or heavyweight media out of git unless it is small, source-controlled, and clearly needed.
- Put deck-local media in `decks/<slug>/assets/` and document its origin or license.
- Do not commit private client data, unreleased product screenshots, credentials, or paid stock assets without explicit permission.
- If you add an external service, model, asset provider, or paid dependency, document the date checked and the URL in `docs/technical-direction.md`.
- If a deck relies on remote media, provide a local fallback or call out the risk in the deck notes.

## Task Completion Requirements

For code changes, run:

```bash
npm run check
```

For deck creation and selection:

```bash
npm run deck:list
npm run deck:new -- <slug> --style-guide /path/to/style-guide
npm run dev -- <slug>
```

For deck or visual changes, also run the dev server and inspect the deck in a browser. Check at least:

- First slide loads without console errors.
- Every slide is reviewed from an actual screenshot after animations settle.
- Text fits at desktop presentation size.
- Text and controls have readable contrast on their actual backgrounds, including footers, progress indicators, chart labels, media captions, and text inside cards.
- Navigation works with keyboard controls.
- Motion does not obscure important content.
- Any media assets load from local paths or documented URLs.

If a visual review surfaces a clear defect such as white-on-white text, clipped content, overlapping controls, unreadable chart labels, or invisible navigation chrome, fix it immediately and re-check the affected slide. Do not merely report that the issue exists unless the fix requires a product/design decision.

For Remotion changes, run:

```bash
npm run studio -- <slug>
```

Use `npm run render -- <slug>` when the change affects exported video timing, dimensions, or composition structure.

## References

- Technical direction: [docs/technical-direction.md](docs/technical-direction.md)
- Deck contract: [docs/deck-contract.md](docs/deck-contract.md)
- Presentation flow research: [docs/presentation-flow.md](docs/presentation-flow.md)
- Project skill: [skills/prezzo-deck/SKILL.md](skills/prezzo-deck/SKILL.md)
- Agent manifest: [prezzo.json](prezzo.json)
- Spectacle: https://github.com/FormidableLabs/spectacle
- Spectacle docs: https://www.formidable.com/open-source/spectacle
- Remotion docs: https://www.remotiondocs.com/docs
- Remotion AI docs: https://www.remotiondocs.com/docs/ai/
- Motion for React: https://motion.dev/docs/react
