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
4. Decide slide-by-slide whether each moment is:
   - static Spectacle slide
   - Spectacle slide with Motion reveal
   - live React component or chart
   - embedded media
   - Remotion-rendered sequence
5. Implement the deck in `src/Deck.tsx` and reusable pieces in `src/components/`.
6. Put rendered compositions in `src/remotion/`.
7. Keep local media in `public/assets/` and document source or generation details.
8. Run `npm run check`.
9. Inspect the live deck in a browser by capturing settled screenshots for every changed slide.
10. Fix layout, overlap, contrast, clipping, invisible controls, and console errors.
11. Run `npm run render` when Remotion timing or composition output changed.

## Deck Rules

- Start with the deck itself; do not build a marketing landing page.
- Make every slide answer "what should the audience understand now?"
- Use presenter notes for intent, timing, and spoken transitions.
- Use Motion for live browser energy, not for deterministic video timing.
- Use Remotion frame APIs for rendered output.
- Prefer real screenshots, real clips, real charts, and generated visual assets over vague decoration.
- Keep text within stable containers at 16:9 presentation dimensions.
- Avoid adding a dependency unless it clearly improves the presentation surface.

## Done Means

- `npm run check` passes.
- The deck loads locally.
- Keyboard navigation works.
- Text is readable and not overlapping.
- Screenshots have been reviewed after animations settle.
- Obvious visual defects have been auto-corrected, including white-on-white text or controls.
- Media assets resolve.
- Remotion compositions still open in Studio when relevant.
