import { useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Deck as SpectacleDeck, DeckContext } from "spectacle";
import type { DeckProps } from "spectacle";
import type { PrezzoDeckRuntimeProps } from "../deck-types";
import {
  REMOTE_AUDIO_COMMAND_EVENT,
  REMOTE_AUDIO_STATE_EVENT,
  REMOTE_CONTROLLER_CONNECTED_EVENT,
  remoteWebSocketUrl,
} from "./remote-control";
import type { RemoteAudioState, RemoteServerMessage } from "./remote-control";

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
  const controllerCountRef = useRef<number | null>(null);
  const lastAudioStateRef = useRef<string | null>(null);

  deckRef.current = deck;

  useEffect(() => {
    if (!remote?.enabled || !deck?.initialized) return undefined;

    const ws = new WebSocket(remoteWebSocketUrl(remote.slug, "presenter"));
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      if (lastAudioStateRef.current) ws.send(lastAudioStateRef.current);

      if (!pendingStateRef.current) return;

      ws.send(pendingStateRef.current);
      pendingStateRef.current = null;
    });

    ws.addEventListener("error", () => {
      console.warn("Remote presenter WebSocket connection failed.");
    });

    // The active slide's AudioPlayer publishes its playback over a window event
    // (separate component tree); forward it to controllers via the socket.
    const onAudioState = (event: Event) => {
      const detail = (event as CustomEvent<RemoteAudioState>).detail;
      // Stamp the slide the audio is on so the controller can scope the panel
      // to the current slide regardless of message ordering or dropped clears.
      const audio: RemoteAudioState = { ...detail, slideIndex: deckRef.current?.activeView.slideIndex ?? 0 };
      const serialized = JSON.stringify({ audio, type: "audio-state" });
      lastAudioStateRef.current = serialized;
      if (ws.readyState === WebSocket.OPEN) ws.send(serialized);
    };

    window.addEventListener(REMOTE_AUDIO_STATE_EVENT, onAudioState);

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

        if (previous !== null && message.controllers > previous) {
          window.dispatchEvent(new Event(REMOTE_CONTROLLER_CONNECTED_EVENT));
        }

        return;
      }

      if (message.type === "audio-control") {
        window.dispatchEvent(
          new CustomEvent(REMOTE_AUDIO_COMMAND_EVENT, {
            detail: { command: message.command, value: message.value },
          }),
        );
        return;
      }

      const currentDeck = deckRef.current;

      if (!currentDeck?.initialized) return;

      // The deck is the source of truth for its starting position: Spectacle
      // honors ?slideIndex= in the URL (else slide 1). We intentionally do NOT
      // reposition to the server's remembered state on `hello`, so opening the
      // deck URL no longer jumps to wherever it was last left. Live phone
      // control still drives navigation via `control` messages below, and the
      // presenter pushes its real position up so controllers stay in sync.
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
      window.removeEventListener(REMOTE_AUDIO_STATE_EVENT, onAudioState);
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
