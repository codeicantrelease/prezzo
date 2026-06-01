---
name: prezzo-deck
description: Build or revise Prezzo React presentation decks using Spectacle for live slides, Motion for browser animation, and Remotion for rendered video moments.
---

# Prezzo Deck

Use this skill when creating or revising a deck in the Prezzo repo.

## Workflow

1. Read `AGENTS.md`, `docs/technical-direction.md`, and `docs/presentation-flow.md`.
2. Collect the audience, duration, objective, source material, and desired tone.
3. Draft the run of show before editing code.
4. If creating a new deck, run `npm run deck:new -- <slug> --style-guide /path/to/style-guide` when a style guide exists.
5. Decide slide-by-slide whether each moment is:
   - static Spectacle slide
   - Spectacle slide with Motion reveal
   - live React component or chart
   - embedded media
   - Remotion-rendered sequence
6. Implement the deck in `decks/<slug>/Deck.tsx` and reusable pieces in `src/components/`.
7. Put rendered compositions in `decks/<slug>/remotion/`.
8. Keep local media in `decks/<slug>/assets/` and document source or generation details.
9. Run `npm run check`.
10. Inspect the live deck in a browser by capturing settled screenshots for every changed slide.
11. Fix layout, overlap, contrast, clipping, invisible controls, and console errors.
12. Run `npm run render -- <slug>` when Remotion timing or composition output changed.

## Deck Rules

- Start with the deck itself; do not build a marketing landing page.
- Keep every presentation as a first-class directory under `decks/<slug>/`.
- Register every new deck in `src/deck-registry.ts`.
- Enable runtime chrome only when useful for that deck. Runtime timer and Quake terminal are opt-in through `deck.config.ts`.
- When terminal is enabled, verify the backquote/tilde shortcut opens it and `Esc` closes it.
- Runtime chrome should not be visible by default during normal presentation; timer/status UI belongs inside the opened terminal unless the presenter starts visible chrome with a command such as `timer start`.
- If a deck uses the visible focus countdown, verify `timer start` shows the top-right overlay, `timer stop` hides it, and the overlay does not cover important slide content.
- Hidden pages are app-shell routes, not Spectacle slides. If a deck config enables `runtime.hiddenPages`, verify the terminal command opens the route and the page does not change the deck slide count.
- The Quake terminal defaults to vim input mode. Verify the input-line vim status is visible, `vim off` restores standard typing, and focused terminal input captures vim keys instead of triggering slide shortcuts.
- Make every slide answer "what should the audience understand now?"
- Use presenter notes for intent, timing, and spoken transitions.
- Use Motion for live browser energy, not for deterministic video timing.
- Use Remotion frame APIs for rendered output.
- Prefer real screenshots, real clips, real charts, and generated visual assets over vague decoration.
- Keep text within stable containers at 16:9 presentation dimensions.
- Avoid adding a dependency unless it clearly improves the presentation surface.

## Done Means

- `npm run check` passes.
- The deck loads locally with `npm run dev -- <slug>`.
- Keyboard navigation works.
- Text is readable and not overlapping.
- Screenshots have been reviewed after animations settle.
- Obvious visual defects have been auto-corrected, including white-on-white text or controls.
- Media assets resolve.
- Remotion compositions still open in Studio when relevant.
