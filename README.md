# Prezzo

Prezzo is an open-source (MIT) React presentation lab for decks that can be shown live in the browser and rendered into video when the moment deserves proper spectacle.

## Quick Start

```bash
npm install
npm run deck:list
npm run dev -- prezzo-demo
```

Open the Vite URL to present the Spectacle deck.

For rendered motion graphics:

```bash
npm run studio -- prezzo-demo
npm run render -- prezzo-demo
```

Create a new deck:

```bash
npm run deck:new -- customer-roadshow --style-guide /path/to/style-guide.md
npm run dev -- customer-roadshow
```

## Shape

- `decks/` contains first-class presentation directories.
- `decks/prezzo-demo/` is the built-in example deck.
- `src/deck-registry.ts` registers available decks.
- `src/components/` contains reusable visual primitives that future decks can share.
- `skills/prezzo-deck/` is the project-level agent skill for creating decks in this repo.
- `docs/deck-contract.md` defines the deck directory contract.
- `docs/technical-direction.md` records the stack decisions and constraints.
- `docs/presentation-flow.md` captures the researched agent workflow and wow-factor roadmap.
- `prezzo.json` is a compact machine-readable entrypoint for agents.

## License

MIT — see [LICENSE](LICENSE). Committed media assets must be declared in `assets-allowlist.json` with a source and license; the `check-assets` CI guards against undeclared (potentially copyrighted) media landing in the repo.
