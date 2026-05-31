import { Composition } from "remotion";
import { DeckVideo } from "./DeckVideo";

export function RemotionRoot() {
  return (
    <Composition
      id="PrezzoDemo"
      component={DeckVideo}
      durationInFrames={210}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: "Prezzo",
        subtitle: "React decks with a render button",
      }}
    />
  );
}
