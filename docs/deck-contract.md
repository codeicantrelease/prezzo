# Deck Contract

Prezzo treats each presentation as a first-class deck directory. This is the repo-level contract agents should follow when creating or revising decks.

## Directory Shape

```text
decks/<deck-slug>/
  deck.config.ts
  Deck.tsx
  notes.md
  assets/
  qa/
  remotion/
    DeckVideo.tsx
```

- `deck.config.ts` registers the deck slug, label, browser component, slide count, and optional Remotion composition.
- `runtime` in `deck.config.ts` opts the deck into persistent presentation UI such as timers and the Quake terminal.
- `Deck.tsx` is the live Spectacle deck.
- `notes.md` holds the brief, run of show, style-guide reference, assumptions, and QA notes.
- `assets/` holds deck-local screenshots, clips, GIFs, audio, and generated images.
- `qa/` holds screenshots or notes from visual review.
- `remotion/` holds deck-local rendered video scenes.

Shared primitives belong under `src/components/`, `src/theme.ts`, and future shared runtime folders. Deck-specific one-offs stay inside the deck directory.

## Registry

Every deck must be imported and listed in [../src/deck-registry.ts](../src/deck-registry.ts). The registry powers:

- the in-browser deck index
- URL path selection
- CLI deck validation
- Remotion composition registration

Decks can be opened by path:

```text
http://127.0.0.1:5173/prezzo-demo
```

The CLI also sets `VITE_PREZZO_DECK`, so `/` opens the selected deck when started with:

```bash
npm run dev -- prezzo-demo
```

## Commands

```bash
npm run deck:list
npm run deck:new -- customer-roadshow --style-guide /path/to/style-guide.md
npm run dev -- customer-roadshow
npm run studio -- customer-roadshow
npm run render -- customer-roadshow
npm run deck:qa -- customer-roadshow
npm run check
```

`deck:new` creates the folder, starter deck, starter Remotion scene, notes, assets folder, QA folder, and registry entry.

## Style Guides

A style guide can be a local markdown file, design export, screenshot folder, brand deck, or reference repo. Agents should record the path in `notes.md`, read it before styling, and cite specific constraints they applied.

If the style guide conflicts with presentation readability, readability wins. Explain the deviation in `notes.md`.

## Runtime Chrome

Runtime chrome is opt-in per deck. Enable it in `deck.config.ts`:

```ts
runtime: {
  timer: {
    enabled: true,
    mode: "elapsed",
  },
  terminal: {
    enabled: true,
  },
}
```

The timer persists across Spectacle slide navigation because it lives in the app shell, not inside a slide. It is intentionally hidden during normal presenting and appears inside the terminal chrome when the terminal is open. A deck can also start a visible clock-style focus countdown from the terminal with `timer start`; it is hidden until that command runs and anchors to the active presentation frame.

The Quake terminal has no visible handle by default. It is bound to the backquote/tilde key. Press:

- `` ` `` to open or close the terminal
- `Esc` to close it

Starter commands:

```text
help
deck
vim
vim on
vim off
timer
timer 2m
timer start
timer start 90s
timer stop
timer pause
timer resume
timer reset
timer elapsed
timer countdown 20m
goto 3
clear
close
```

Keep runtime chrome presenter-focused. Do not enable it for a deck unless the deck actually benefits from live controls, timing, debug/status overlays, or command interaction.

`timer start` launches a visible 120-second clock countdown overlay by default. Pass a duration such as `timer start 45s` or `timer start 2m` when a slide moment needs a different countdown. The shorter `timer 2m` form does the same thing. Use `timer stop` to hide the overlay.

The terminal defaults to vim input mode and shows a right-aligned input-line status with a Vim mark plus `NORMAL`, `INSERT`, or `OFF`. `Esc` enters normal mode when the terminal input is focused. In normal mode, `i`, `a`, `I`, and `A` return to insert mode; `h`, `l`, `w`, `b`, `e`, `0`, `$`, and `x` edit the command line; `dw`, `db`, `de`, `d$`, `d0`, and `dd` delete by motion; and `j`/`k` cycle command history. Use `vim off` for presenters who prefer standard input behavior and `vim on` to re-enable it.

## Visual QA

Agents must inspect settled screenshots for every changed slide. Treat these as fixable test failures:

- white-on-white or dark-on-dark text
- hidden footer/progress controls
- clipped titles or captions
- unreadable chart labels
- overlapping media and copy
- animation end states that cover the main message
- runtime chrome that obscures the slide content

Do not hand off a deck after merely noticing these issues. Fix obvious defects, re-run `npm run check`, and re-capture affected slides.

## Machine-Readable Entrypoints

Use [../prezzo.json](../prezzo.json) for a compact command and layout manifest. Use this document for the human-readable deck contract.
