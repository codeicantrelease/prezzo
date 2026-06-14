import { PrezzoDeck } from "./Deck";
import { DeckVideo } from "./remotion/DeckVideo";
import type { DeckConfig } from "../../src/deck-types";

export const deckConfig = {
  slug: "prezzo-demo",
  label: "Prezzo Demo",
  description: "Starter deck showing the live Spectacle and rendered Remotion paths.",
  slideCount: 6,
  presenterNotes: [
    "Open with the simple promise: keep the deck workflow familiar, but remove the ceiling on what a slide can be.",
    "Anchor the audience in the known workflow first. The difference is not novelty; it is React surface area inside familiar deck navigation.",
    "Describe the agent loop as a repeatable production workflow: brief, storyboard, build, inspect, tighten.",
    "Keep this slide restrained. The point is that media earns its place when it clarifies something static slides cannot.",
    "Close on the product framing: the deck is an executable surface that can also produce rendered motion when needed.",
    "Audio runtime test: the track autostarts on slide activation and falls back to a play button if the browser blocks unmuted autoplay.",
  ],
  component: PrezzoDeck,
  runtime: {
    hiddenPages: {
      dubdubtok: {
        enabled: true,
        imageUrl: "/assets/dubdubtok-one-piece-source.webp",
        sourceAspectRatio: 500 / 282,
        targetRotationDegrees: 267,
        targetPercent: 50,
        targetYPercent: 50,
        toleranceDegrees: 24,
      },
    },
    timer: {
      enabled: true,
      mode: "elapsed",
    },
    terminal: {
      enabled: true,
    },
  },
  remotion: {
    id: "prezzo-demo",
    component: DeckVideo,
    durationInFrames: 210,
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: {
      title: "Prezzo",
      subtitle: "React decks with a render button",
    },
  },
} satisfies DeckConfig;
