import { PrezzoDeck } from "./Deck";
import { DeckVideo } from "./remotion/DeckVideo";
import type { DeckConfig } from "../../src/deck-types";

export const deckConfig = {
  slug: "prezzo-demo",
  label: "Prezzo Demo",
  description: "Starter deck showing the live Spectacle and rendered Remotion paths.",
  slideCount: 5,
  component: PrezzoDeck,
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
