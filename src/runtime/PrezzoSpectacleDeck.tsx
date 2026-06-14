import { useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Deck as SpectacleDeck, DeckContext } from "spectacle";
import type { DeckProps } from "spectacle";
import type { PrezzoDeckRuntimeProps } from "../deck-types";
import { REMOTE_CONTROLLER_CONNECTED_EVENT, remoteWebSocketUrl } from "./remote-control";
import type { RemoteServerMessage } from "./remote-control";

type PrezzoSpectacleDeckProps = DeckProps & {
  children: ReactNode;
  remote?: PrezzoDeckRuntimeProps["remote"];
};

function RemoteDeckBridge({ remote }: { remote?: PrezzoDeckRuntimeProps["remote"] }) {
  const deck = useContext(DeckContext);
  const deckRef = useRef(deck);
  const pendingStateRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSentStateRef = useRef("");
  const controllerCountRef = useRef(0);

  deckRef.current = deck;

  useEffect(() => {
    if (!remote?.enabled || !deck?.initialized) return undefined;

    const ws = new WebSocket(remoteWebSocketUrl(remote.slug, "presenter"));
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      if (!pendingStateRef.current) return;

      ws.send(pendingStateRef.current);
      pendingStateRef.current = null;
    });

    ws.addEventListener("error", () => {
      console.warn("Remote presenter WebSocket connection failed.");
    });

    ws.addEventListener("message", (event) => {
      let message: RemoteServerMessage;

      try {
        message = JSON.parse(String(event.data)) as RemoteServerMessage;
      } catch {
        console.warn("Failed to parse remote control message.");
        return;
      }

      if (message.type === "connections") {
        const previous = controllerCountRef.current;
        controllerCountRef.current = message.controllers;

        if (message.controllers > previous) {
          window.dispatchEvent(new Event(REMOTE_CONTROLLER_CONNECTED_EVENT));
        }

        return;
      }

      const currentDeck = deckRef.current;

      if (!currentDeck?.initialized) return;

      if (message.type === "hello" && message.state) {
        currentDeck.skipTo({
          slideIndex: Math.max(0, Math.min(message.state.slideIndex, currentDeck.slideCount - 1)),
          stepIndex: Math.max(0, message.state.stepIndex),
        });
        return;
      }

      if (message.type !== "control") return;

      if (message.command === "next") {
        currentDeck.stepForward();
        return;
      }

      if (message.command === "previous") {
        currentDeck.stepBackward();
        return;
      }

      if (message.command === "goto" && typeof message.slideIndex === "number") {
        currentDeck.skipTo({
          slideIndex: Math.max(0, Math.min(message.slideIndex, currentDeck.slideCount - 1)),
          stepIndex: Math.max(0, message.stepIndex ?? 0),
        });
      }
    });

    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [deck?.initialized, remote?.enabled, remote?.slug]);

  useEffect(() => {
    if (!remote?.enabled || !deck?.initialized) return;

    const state = {
      slideCount: deck.slideCount || remote.slideCount,
      slideIndex: deck.activeView.slideIndex,
      stepIndex: deck.activeView.stepIndex,
      type: "presenter-state",
    };
    const serialized = JSON.stringify(state);

    if (lastSentStateRef.current === serialized) return;

    lastSentStateRef.current = serialized;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(serialized);
      pendingStateRef.current = null;
      return;
    }

    pendingStateRef.current = serialized;
  }, [
    deck?.activeView.slideIndex,
    deck?.activeView.stepIndex,
    deck?.initialized,
    deck?.slideCount,
    remote?.enabled,
    remote?.slideCount,
  ]);

  return null;
}

export function PrezzoSpectacleDeck({ children, remote, ...deckProps }: PrezzoSpectacleDeckProps) {
  return (
    <SpectacleDeck {...deckProps}>
      {children}
      <RemoteDeckBridge remote={remote} />
    </SpectacleDeck>
  );
}
