# Prezzo

Prezzo is a private React presentation lab for decks that can be shown live in the browser and rendered into video when the moment deserves proper spectacle.

## Quick Start

```bash
npm install
npm run dev
```

Open the Vite URL to present the Spectacle deck.

For rendered motion graphics:

```bash
npm run studio
npm run render
```

## Shape

- `src/Deck.tsx` is the live Spectacle deck.
- `src/remotion/` is the rendered video path.
- `src/components/` contains reusable visual primitives that future decks can share.
- `skills/prezzo-deck/` is the project-level agent skill for creating decks in this repo.
- `docs/technical-direction.md` records the stack decisions and constraints.
- `docs/presentation-flow.md` captures the researched agent workflow and wow-factor roadmap.
