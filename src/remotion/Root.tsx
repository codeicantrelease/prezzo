import { Composition } from "remotion";
import { deckConfigs } from "../deck-registry";

export function RemotionRoot() {
  return (
    <>
      {deckConfigs
        .filter((deck) => deck.remotion)
        .map((deck) => {
          const remotion = deck.remotion!;

          return (
            <Composition
              component={remotion.component}
              defaultProps={remotion.defaultProps}
              durationInFrames={remotion.durationInFrames}
              fps={remotion.fps}
              height={remotion.height}
              id={remotion.id}
              key={remotion.id}
              width={remotion.width}
            />
          );
        })}
    </>
  );
}
