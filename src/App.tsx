import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deckConfigs, findDeck, getDeckOrDefault } from "./deck-registry";
import type { DeckConfig } from "./deck-types";
import { Blackjack } from "./runtime/Blackjack";
import { DubDubTokChallenge } from "./runtime/DubDubTokChallenge";
import { PresentationShell } from "./runtime/PresentationShell";
import type { FocusTimerControls, TimerControls, TimerState } from "./runtime/PresentationShell";
import { QuakeTerminal } from "./runtime/QuakeTerminal";
import { RemoteAccessCard, RemoteAccessOverlay } from "./runtime/RemoteAccessOverlay";
import { RemoteControllerPage } from "./runtime/RemoteControllerPage";
import { REMOTE_CONTROLLER_CONNECTED_EVENT } from "./runtime/remote-control";
import { fetchRemoteAccess, remoteWebSocketUrl } from "./runtime/remote-control";
import type { RemoteAccessDetails } from "./runtime/remote-control";

const noopTimer: TimerState = {
  elapsedSeconds: 0,
  isRunning: false,
  mode: "elapsed",
};

const noopTimerControls: TimerControls = {
  pause: () => undefined,
  reset: () => undefined,
  resume: () => undefined,
  setCountdown: () => undefined,
  setElapsed: () => undefined,
};

const noopFocusTimerControls: FocusTimerControls = {
  start: () => undefined,
  stop: () => undefined,
};

function pathSegmentsFromLocation() {
  return window.location.pathname.split("/").filter(Boolean);
}

function selectedDeckSlugFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const queryDeck = params.get("deck");
  const pathDeck = pathSegmentsFromLocation()[0];

  // No deck in the path/query => show the home index (list of talks). We do NOT
  // fall back to VITE_PREZZO_DECK here: the root route is the launcher, and decks
  // are opened by explicit /<slug>/ path. (VITE_PREZZO_DECK still drives the
  // server-side remotion/studio defaults.)
  return pathDeck || queryDeck;
}

function hiddenPageSlugFromLocation() {
  return pathSegmentsFromLocation()[1];
}

type DeckIndexProps = {
  controllersConnected: boolean;
  remoteAccess: RemoteAccessDetails | null;
  onShowRemoteAccess: () => void;
};

function DeckIndex({ controllersConnected, remoteAccess, onShowRemoteAccess }: DeckIndexProps) {
  return (
    <main className="deck-index">
      <section className="deck-index__main" aria-label="Presentation selector">
        <p className="deck-index__eyebrow">Prezzo decks</p>
        <h1>Choose a presentation</h1>
        <ul>
          {deckConfigs.map((deck) => (
            <li key={deck.slug}>
              <a className="deck-index__start" href={`/${deck.slug}`}>
                <strong>{deck.label}</strong>
                <span>{deck.description ?? deck.slug}</span>
                <small>
                  {deck.slideCount ?? 1} slide{(deck.slideCount ?? 1) === 1 ? "" : "s"}
                </small>
              </a>
              <a className="deck-index__control" href={`/${deck.slug}/control`}>
                Remote
              </a>
            </li>
          ))}
        </ul>
      </section>

      <aside className="deck-index__remote" aria-label="Remote connection">
        {remoteAccess && !controllersConnected ? (
          <RemoteAccessCard access={remoteAccess} className="deck-index__remote-card" />
        ) : (
          <button className="deck-index__remote-button" disabled={!remoteAccess} onClick={onShowRemoteAccess} type="button">
            QR code
          </button>
        )}
      </aside>
    </main>
  );
}

function NoDecksConfigured() {
  return (
    <main className="deck-index">
      <section className="deck-index__main" aria-label="Presentation selector">
        <p className="deck-index__eyebrow">Prezzo decks</p>
        <h1>No decks configured</h1>
      </section>
    </main>
  );
}

function DeckIndexShell() {
  const defaultDeck = deckConfigs[0];

  if (!defaultDeck) {
    return <NoDecksConfigured />;
  }

  const [selectedDeck, setSelectedDeck] = useState<DeckConfig>(defaultDeck);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [homeRemoteAccess, setHomeRemoteAccess] = useState<RemoteAccessDetails | null>(null);
  const [remoteAccess, setRemoteAccess] = useState<RemoteAccessDetails | null>(null);
  const [controllerCount, setControllerCount] = useState(0);
  const controllerCountRef = useRef<number | null>(null);
  const indexFocusRef = useRef<HTMLDivElement>(null);

  const restoreIndexFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;

      if (activeElement instanceof HTMLElement && activeElement.closest(".quake-terminal")) {
        activeElement.blur();
      }

      indexFocusRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const closeTerminal = useCallback(() => {
    setIsTerminalOpen(false);
    restoreIndexFocus();
  }, [restoreIndexFocus]);

  const closeRemoteAccess = useCallback(() => {
    setRemoteAccess(null);
    restoreIndexFocus();
  }, [restoreIndexFocus]);

  useEffect(() => {
    if (!remoteAccess) return undefined;

    const onControllerConnected = () => closeRemoteAccess();

    window.addEventListener(REMOTE_CONTROLLER_CONNECTED_EVENT, onControllerConnected);
    return () => window.removeEventListener(REMOTE_CONTROLLER_CONNECTED_EVENT, onControllerConnected);
  }, [remoteAccess, closeRemoteAccess]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (remoteAccess) return;
      if (event.code !== "Backquote") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      event.preventDefault();
      if (isTerminalOpen) closeTerminal();
      else setIsTerminalOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeTerminal, isTerminalOpen, remoteAccess]);

  useEffect(() => {
    let isMounted = true;

    void fetchRemoteAccess()
      .then((access) => {
        if (isMounted) setHomeRemoteAccess(access);
      })
      .catch(() => {
        if (isMounted) setHomeRemoteAccess(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const ws = new WebSocket(remoteWebSocketUrl("launcher", "launcher"));

    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { controllers?: number; deckSlug?: string; type?: string };

        if (message.type === "open-deck" && message.deckSlug && findDeck(message.deckSlug)) {
          window.location.assign(`/${message.deckSlug}`);
        }

        if (message.type === "open-home" && window.location.pathname !== "/") {
          window.location.assign("/");
        }

        if (message.type === "connections" && typeof message.controllers === "number") {
          const previous = controllerCountRef.current;
          controllerCountRef.current = message.controllers;
          setControllerCount(message.controllers);

          if (previous !== null && message.controllers > previous) {
            window.dispatchEvent(new Event(REMOTE_CONTROLLER_CONNECTED_EVENT));
          }
        }
      } catch {
        // Ignore malformed broker messages.
      }
    });

    return () => ws.close();
  }, []);

  const terminalTimer = useMemo(() => noopTimer, []);

  return (
    <>
      <div className="presentation-focus-sentinel" data-prezzo-presentation-focus tabIndex={-1} ref={indexFocusRef}>
        <DeckIndex
          controllersConnected={controllerCount > 0}
          remoteAccess={homeRemoteAccess}
          onShowRemoteAccess={() => {
            if (homeRemoteAccess) setRemoteAccess(homeRemoteAccess);
          }}
        />
      </div>
      {remoteAccess ? <RemoteAccessOverlay access={remoteAccess} onClose={closeRemoteAccess} /> : null}
      <QuakeTerminal
        availableDecks={deckConfigs}
        deck={selectedDeck}
        focusTimerControls={noopFocusTimerControls}
        hasTimer={false}
        isOpen={isTerminalOpen}
        onClose={closeTerminal}
        onOpen={() => setIsTerminalOpen(true)}
        onSelectDeck={setSelectedDeck}
        sessionRemote
        onShowRemoteAccess={(access) => {
          setRemoteAccess(access);
          closeTerminal();
        }}
        timer={terminalTimer}
        timerControls={noopTimerControls}
      />
    </>
  );
}

export function App() {
  if (deckConfigs.length === 0) {
    return <NoDecksConfigured />;
  }

  const selectedSlug = selectedDeckSlugFromLocation();

  if (selectedSlug === "control") {
    return <RemoteControllerPage deck={deckConfigs[0]} decks={deckConfigs} session />;
  }

  if (!selectedSlug || selectedSlug === "decks") {
    return <DeckIndexShell />;
  }

  const selectedDeck = findDeck(selectedSlug);

  if (!selectedDeck) {
    return <DeckIndexShell />;
  }

  const DeckComponent = getDeckOrDefault(selectedDeck.slug).component;
  const hiddenPageSlug = hiddenPageSlugFromLocation();
  const dubdubtokConfig = selectedDeck.runtime?.hiddenPages?.dubdubtok;
  const blackjackConfig = selectedDeck.runtime?.hiddenPages?.blackjack;

  if (hiddenPageSlug === "control") {
    return <RemoteControllerPage deck={selectedDeck} decks={deckConfigs} />;
  }

  if (hiddenPageSlug === "blackjack" && blackjackConfig?.enabled) {
    return (
      <PresentationShell deck={selectedDeck}>
        <Blackjack deck={selectedDeck} />
      </PresentationShell>
    );
  }

  if (hiddenPageSlug === "dubdubtok" && dubdubtokConfig?.enabled) {
    return (
      <PresentationShell deck={selectedDeck}>
        <DubDubTokChallenge config={dubdubtokConfig} deck={selectedDeck} />
      </PresentationShell>
    );
  }

  // Preview mode (used by the controller's slide-mirror iframe): render the deck
  // read-only at the requested slide/step and DON'T connect the remote bridge, so
  // the embedded copy never registers as a second presenter and fights the real one.
  const previewMode = new URLSearchParams(window.location.search).get("preview") === "1";

  return (
    <PresentationShell deck={selectedDeck}>
      <DeckComponent
        remote={{
          enabled: !previewMode,
          slideCount: selectedDeck.slideCount ?? 1,
          slug: selectedDeck.slug,
        }}
      />
    </PresentationShell>
  );
}
