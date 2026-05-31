# Presentation Flow Research

This is the working model for how Prezzo can turn an idea into a live deck with optional rendered motion. It links back to [../AGENTS.md](../AGENTS.md) and [technical-direction.md](technical-direction.md).

## What Is Possible

React decks can do more than static slides:

- Live JSX slides with navigation, notes, templates, and progressive reveals through Spectacle.
- Smooth browser animation and gestures through Motion.
- Data-driven charts through Recharts or future D3 components.
- Embedded local video, GIFs, audio, screenshots, generated images, and product demos.
- Interactive mini-apps, calculators, simulations, and live components.
- Frame-perfect title sequences, explainers, captions, and social clips through Remotion.
- Exportable MP4 assets that can be reused in talks, docs, product pages, or social posts.

The useful split is:

- Use Spectacle when the presenter controls pacing.
- Use Motion when the browser deck should feel alive.
- Use Remotion when the sequence needs exact timing, audio sync, captions, or a rendered file.

## Agent-Driven Deck Creation

Agents should not begin by spraying JSX. Use this sequence:

1. Brief: audience, setting, duration, goal, emotional tone, must-say points, forbidden claims, and source material.
2. Spine: one-sentence thesis and 3-5 section beats.
3. Run of show: slide-by-slide outline with purpose, visual approach, and presenter note.
4. Asset plan: screenshots, clips, generated images, charts, data, icons, and videos.
5. Create: use `npm run deck:new -- <slug> --style-guide /path/to/style-guide` when starting a new presentation.
6. Build: implement the deck in React, adding reusable components when patterns repeat.
7. Inspect: run locally, capture screenshots, check text fit, console errors, and navigation.
8. Render: create Remotion compositions for hero sequences or export inserts.
9. Tighten: remove cleverness that does not advance the story.

The inspect step is mandatory. Agents should capture actual slide screenshots after animations settle, review them for contrast, clipping, overlap, hidden navigation chrome, illegible chart labels, and media/caption readability, then auto-correct obvious defects before handing the deck back.

## Deck Anatomy

A strong Prezzo deck should usually contain:

- Opening promise: what changes if the audience believes the talk.
- Context: why this matters now.
- Evidence: demos, charts, clips, examples, or concrete screenshots.
- Mechanism: how the thing works.
- Contrast: why this is better than the default path.
- Decision: what the audience should do next.

Each slide should have a job. If a slide is only decorative, cut it or turn it into a transition moment.

## Multi-Deck Workflow

Prezzo is a deck workspace, not a single deck. Agents should create a new folder under `decks/` for each presentation and keep the brief, assets, QA notes, and Remotion scenes with that deck.

Selection paths:

- CLI: `npm run dev -- <slug>`
- Browser: `http://127.0.0.1:5173/<slug>`
- Render: `npm run render -- <slug>`

Use [deck-contract.md](deck-contract.md) as the source of truth for the deck directory shape.

## Wow Factor Menu

Use these deliberately:

- Cinematic opener: 5-10 second Remotion title sequence.
- Data moment: animated chart that lands on one number.
- Product proof: short local clip or GIF embedded in the live deck.
- Interactive model: small React component that responds to presenter input.
- Exploded diagram: Motion-powered build-up across reveal steps.
- Voiceover/social cut: Remotion composition using the same visual system as the talk.
- Captions: Remotion-rendered captions when audio or video is part of the output.

## Quality Bar

The deck should pass these checks before being called done:

- The first 30 seconds are immediately understandable.
- Every slide has a single dominant idea.
- Text remains readable from the back of a room.
- Animations support pacing instead of showing off.
- Screenshots have been reviewed after animations settle, not just immediately after page load.
- No white-on-white, dark-on-dark, clipped, or overlapped text remains.
- Media assets are local or intentionally remote.
- Presenter notes explain why a slide exists.
- Exported video has deterministic timing and no browser-only animation artifacts.

## Current Research Notes

- Spectacle is actively maintained and describes itself as a React presentation library with JSX syntax and live code demo support.
- Remotion docs now explicitly address coding agents, AI-ready documentation, skills, prompt-to-video, and programmatic rendering.
- Remotion project creation can install agent skills, and the docs mention `npx skills add remotion-dev/skills`.
- Motion for React exposes declarative animation through `motion` components imported from `motion/react`.
- Remotion has licensing constraints that future commercial usage must check.

References:

- https://github.com/FormidableLabs/spectacle
- https://www.formidable.com/open-source/spectacle
- https://www.remotiondocs.com/docs
- https://www.remotiondocs.com/docs/ai/
- https://www.remotiondocs.com/docs/ai/skills
- https://www.remotiondocs.com/docs/license
- https://motion.dev/docs/react
