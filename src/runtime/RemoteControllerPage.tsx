import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Home,
  Lock,
  MonitorDot,
  Pause,
  Play,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { DeckConfig } from "../deck-types";
import { remoteWebSocketUrl } from "./remote-control";
import type {
  RemoteAudioCommand,
  RemoteAudioState,
  RemoteControlCommand,
  RemoteDeckState,
  RemotePresenterSurface,
  RemoteServerMessage,
  RemoteSlideControlMessage,
} from "./remote-control";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, "0")}`;
}

type RemoteControllerPageProps = {
  deck: DeckConfig;
  decks?: DeckConfig[];
  session?: boolean;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

function clampSlideIndex(value: number, deck: DeckConfig) {
  const maxIndex = Math.max(0, (deck.slideCount ?? 1) - 1);

  return Math.max(0, Math.min(value, maxIndex));
}

export function RemoteControllerPage({ deck: initialDeck, decks = [initialDeck], session = false }: RemoteControllerPageProps) {
  const [deck, setDeck] = useState(initialDeck);
  const [pin, setPin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [wsReady, setWsReady] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<RemoteDeckState | null>(null);
  const [audio, setAudio] = useState<RemoteAudioState | null>(null);
  const [presenterSurface, setPresenterSurface] = useState<RemotePresenterSurface>("home");
  const [presenterCount, setPresenterCount] = useState(0);
  const [gotoValue, setGotoValue] = useState("1");
  const [isHomeArmed, setIsHomeArmed] = useState(false);
  // Live slide-mirror preview, off by default (opt-in: it loads the full deck in
  // an iframe and reloads on each navigation, which costs bandwidth/battery).
  const [showPreview, setShowPreview] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const autoConnectPinRef = useRef<string | null>(null);
  const deckRef = useRef(deck);
  const isHomeSurface = presenterSurface === "home";
  const hasLiveDeck = presenterSurface === "deck" && presenterCount > 0;
  const isDeckPending = presenterSurface === "deck" && presenterCount === 0;
  const slideCount = state?.slideCount ?? deck.slideCount ?? 1;
  const currentSlideIndex = clampSlideIndex(state?.slideIndex ?? 0, deck);
  const currentSlideNumber = currentSlideIndex + 1;
  // Only surface audio controls for the slide we are actually on. The bridge
  // stamps each audio-state with its slide; if it does not match the current
  // slide (e.g. a "cleared" update was missed), keep the panel hidden.
  const showAudio = Boolean(audio?.hasAudio && audio.slideIndex === currentSlideIndex);
  // Prefer the live note the presenter reads off the on-screen slide (always
  // correct, even as slides move); fall back to the static array only when no
  // presenter has pushed state yet.
  const liveNotes = state?.notes?.trim();
  const notes = liveNotes || deck.presenterNotes?.[currentSlideIndex] || "No presenter notes for this slide.";
  const currentStepIndex = Math.max(0, state?.stepIndex ?? 0);
  // Mirror the deck at the live slide/step in a read-only preview. Keyed on
  // slide+step so the iframe remounts (and re-seeks) as the presenter advances.
  const previewKey = `${currentSlideIndex}-${currentStepIndex}`;
  const previewSrc = `/${deck.slug}/?slideIndex=${currentSlideIndex}&stepIndex=${currentStepIndex}&preview=1`;

  deckRef.current = deck;

  const progress = useMemo(() => {
    if (slideCount <= 1) return 100;

    return Math.round((currentSlideIndex / (slideCount - 1)) * 100);
  }, [currentSlideIndex, slideCount]);

  useEffect(() => {
    if (!isHomeArmed) return undefined;

    const timeout = window.setTimeout(() => setIsHomeArmed(false), 2400);
    return () => window.clearTimeout(timeout);
  }, [isHomeArmed]);

  useEffect(() => {
    if (hasLiveDeck) return;

    setShowPreview(false);
  }, [hasLiveDeck]);

  const connectWithPin = async (nextPin: string) => {
    setStatus("connecting");
    setError("");

    try {
      const response = await fetch("/__prezzo_remote/connect", {
        body: JSON.stringify({ deckSlug: session ? undefined : deck.slug, pin: nextPin }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as {
        activeDeckSlug?: string;
        error?: string;
        presenterSurface?: RemotePresenterSurface;
        state?: RemoteDeckState | null;
        token?: string;
      };

      if (!response.ok || !payload.token) {
        throw new Error(payload.error ?? "Invalid PIN.");
      }

      const activeDeck = payload.activeDeckSlug ? decks.find((candidate) => candidate.slug === payload.activeDeckSlug) : null;

      if (activeDeck) setDeck(activeDeck);
      if (payload.presenterSurface) setPresenterSurface(payload.presenterSurface);
      setToken(payload.token);
      setState(payload.state ?? null);
      setStatus("connected");
    } catch (connectError) {
      setStatus("error");
      setError(connectError instanceof Error ? connectError.message : "Could not connect.");
    }
  };

  useEffect(() => {
    const queryPin = new URLSearchParams(window.location.search).get("pin")?.replace(/\D/g, "").slice(0, 6);

    if (!queryPin || queryPin.length !== 6 || autoConnectPinRef.current === queryPin) return;

    autoConnectPinRef.current = queryPin;
    setPin(queryPin);
    void connectWithPin(queryPin);
  }, [deck.slug]);

  useEffect(() => {
    if (!token) return undefined;

    const ws = new WebSocket(remoteWebSocketUrl(deckRef.current.slug, "controller", token));
    wsRef.current = ws;
    setStatus("connecting");
    setWsReady(false);

    ws.addEventListener("open", () => {
      setStatus("connected");
      setWsReady(true);
      setError("");
    });

    ws.addEventListener("message", (event) => {
      let message: RemoteServerMessage;

      try {
        message = JSON.parse(String(event.data)) as RemoteServerMessage;
      } catch {
        console.warn("Received malformed remote controller message.");
        return;
      }

      if ((message.type === "hello" || message.type === "state") && message.state) {
        setState(message.state);
        setGotoValue(String(message.state.slideIndex + 1));
      }

      if ((message.type === "hello" || message.type === "state") && !message.state) {
        setState(null);
        setGotoValue("1");
      }

      if (message.type === "active-deck") {
        const activeDeck = decks.find((candidate) => candidate.slug === message.deckSlug);

        if (activeDeck) {
          setDeck(activeDeck);
          setState(null);
          setAudio(null);
          setGotoValue("1");
        }
      }

      if (message.type === "presenter-surface") {
        setPresenterSurface(message.surface);

        if (message.surface === "home") {
          setPresenterCount(0);
          setState(null);
          setAudio(null);
          setGotoValue("1");
        }
      }

      if (message.type === "connections") {
        setPresenterCount(message.presenters);
      }

      if (message.type === "audio-state") {
        setAudio(message.audio);
      }
    });

    ws.addEventListener("close", () => {
      if (wsRef.current === ws) wsRef.current = null;
      setWsReady(false);
      setStatus((current) => (current === "connected" ? "idle" : current));
    });

    ws.addEventListener("error", () => {
      setWsReady(false);
      setStatus("error");
      setError("Connection lost. Re-enter the PIN to reconnect.");
    });

    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
      setWsReady(false);
    };
  }, [decks, token]);

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void connectWithPin(pin);
  };

  const sendControl = (command: RemoteSlideControlMessage["command"], slideIndex?: number) => {
    const ws = wsRef.current;
    if (!wsReady || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        command,
        slideIndex,
        stepIndex: 0,
        type: "control",
      } satisfies RemoteControlCommand),
    );
  };

  const openDeck = (deckSlug: string) => {
    const nextDeck = decks.find((candidate) => candidate.slug === deckSlug);
    const ws = wsRef.current;

    if (!nextDeck) return;

    setDeck(nextDeck);
    setPresenterSurface("deck");
    setState(null);
    setAudio(null);
    setGotoValue("1");

    if (!wsReady || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        deckSlug,
        type: "open-deck",
      } satisfies RemoteControlCommand),
    );
  };

  const openHome = () => {
    const ws = wsRef.current;

    setIsHomeArmed(false);
    setPresenterSurface("home");
    setPresenterCount(0);
    setState(null);
    setAudio(null);
    setShowPreview(false);
    setGotoValue("1");

    if (!wsReady || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: "open-home",
      } satisfies RemoteControlCommand),
    );
  };

  const gotoSlide = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slideNumber = Number(gotoValue);

    if (!Number.isFinite(slideNumber)) return;

    sendControl("goto", clampSlideIndex(slideNumber - 1, deck));
  };

  const sendAudioControl = (command: RemoteAudioCommand, value?: number) => {
    const ws = wsRef.current;
    if (!wsReady || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ command, type: "audio-control", value }));
  };

  if (!token) {
    return (
      <main className="remote-control remote-control--login">
        <form className="remote-login" onSubmit={connect}>
          <div className="remote-login__brand">
            <Lock size={28} />
            <span>{deck.label}</span>
          </div>
          <label htmlFor="remote-pin">Presenter PIN</label>
          <input
            autoComplete="one-time-code"
            id="remote-pin"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            pattern="[0-9]*"
            placeholder="000000"
            value={pin}
          />
          <button disabled={status === "connecting" || pin.length < 6} type="submit">
            <Send size={18} />
            <span>{status === "connecting" ? "Connecting" : "Connect"}</span>
          </button>
          {error ? <p className="remote-control__error">{error}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className={`remote-control remote-control--active ${hasLiveDeck ? "" : "remote-control--waiting"}`}>
      <section className="remote-control__status">
        <button
          aria-label={isHomeArmed ? "Confirm return presenter to deck selector" : "Return presenter to deck selector"}
          className={`remote-control__home ${isHomeArmed ? "remote-control__home--armed" : ""}`}
          disabled={!wsReady}
          onClick={() => {
            if (!isHomeArmed) {
              setIsHomeArmed(true);
              return;
            }

            openHome();
          }}
          type="button"
        >
          <Home size={18} />
          <span>{isHomeArmed ? "Confirm" : "Home"}</span>
        </button>
        <div>
          <span>{deck.label}</span>
          <strong>{hasLiveDeck ? `${currentSlideNumber} / ${slideCount}` : isHomeSurface ? "Pick deck" : "Opening"}</strong>
        </div>
        <div className="remote-control__presenter">
          <MonitorDot size={18} />
          <span>{hasLiveDeck ? "Live" : isDeckPending ? "Opening" : "Waiting"}</span>
        </div>
        {hasLiveDeck ? (
          <button
            className="remote-control__preview-toggle"
            type="button"
            aria-pressed={showPreview}
            onClick={() => setShowPreview((value) => !value)}
          >
            {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>{showPreview ? "Hide slide" : "Show slide"}</span>
          </button>
        ) : null}
      </section>

      {isHomeSurface ? (
        <section className="remote-control__deck-switch" aria-label="Deck selector">
          <label htmlFor="remote-deck">Deck</label>
          <select
            id="remote-deck"
            onChange={(event) => {
              const nextDeck = decks.find((candidate) => candidate.slug === event.target.value);

              if (!nextDeck) return;

              setDeck(nextDeck);
              setState(null);
              setAudio(null);
              setGotoValue("1");
            }}
            value={deck.slug}
          >
            {decks.map((candidate) => (
              <option key={candidate.slug} value={candidate.slug}>
                {candidate.label}
              </option>
            ))}
          </select>
          <button disabled={!wsReady} onClick={() => openDeck(deck.slug)} type="button">
            Open deck
          </button>
        </section>
      ) : null}

      {hasLiveDeck ? (
        <div className="remote-control__progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {hasLiveDeck && showPreview ? (
        <section className="remote-control__preview" aria-label="Current slide preview">
          <iframe
            key={previewKey}
            className="remote-control__preview-frame"
            src={previewSrc}
            title={`Slide ${currentSlideNumber} preview`}
            loading="lazy"
            tabIndex={-1}
            scrolling="no"
            // The preview embeds our OWN deck (first-party, same-origin). It needs
            // both allow-scripts (it's a React app) AND allow-same-origin — without
            // the latter the frame gets a null origin and the deck's ES-module
            // imports become cross-origin fetches the dev server doesn't CORS-allow,
            // so it renders blank. This pair is escapable in principle, but the
            // content is trusted; real isolation here is preview=1 (no remote
            // bridge) + pointer-events:none (no input), not the sandbox. We still
            // set it to withhold top-navigation/popups as defense-in-depth.
            sandbox="allow-scripts allow-same-origin"
          />
        </section>
      ) : null}

      {hasLiveDeck ? (
        <>
          <section className="remote-control__notes" aria-live="polite">
            <span>Notes</span>
            <p>{notes}</p>
          </section>

          <section className="remote-control__actions" aria-label="Slide controls">
            <button disabled={!wsReady} onClick={() => sendControl("previous")} type="button">
              <ChevronLeft size={30} />
              <span>Previous</span>
            </button>
            <button disabled={!wsReady} onClick={() => sendControl("next")} type="button">
              <span>Next</span>
              <ChevronRight size={30} />
            </button>
          </section>
        </>
      ) : null}

      {hasLiveDeck && showAudio && audio ? (
        <section className="remote-audio" aria-label="Audio controls">
          <div className="remote-audio__meta">
            <span>Audio</span>
            <strong>{audio.title ?? "Now playing"}</strong>
            {audio.subtitle ? <small>{audio.subtitle}</small> : null}
          </div>

          <div className="remote-audio__transport">
            <button
              aria-label={audio.playing ? "Pause" : "Play"}
              className="remote-audio__play"
              onClick={() => sendAudioControl("toggle-play")}
              type="button"
            >
              {audio.playing ? <Pause size={26} /> : <Play size={26} />}
            </button>
            <button
              aria-label={audio.muted ? "Unmute" : "Mute"}
              className="remote-audio__icon"
              onClick={() => sendAudioControl("toggle-mute")}
              type="button"
            >
              {audio.muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
            <div className="remote-audio__volume">
              <button
                aria-label="Volume down"
                onClick={() => sendAudioControl("volume", Math.max(0, audio.volume - 0.1))}
                type="button"
              >
                −
              </button>
              <span>{Math.round(audio.volume * 100)}%</span>
              <button
                aria-label="Volume up"
                onClick={() => sendAudioControl("volume", Math.min(1, audio.volume + 0.1))}
                type="button"
              >
                +
              </button>
            </div>
          </div>

          <div className="remote-audio__scrubber">
            <span>{formatTime(audio.currentTime)}</span>
            <input
              aria-label="Seek audio"
              max={Math.max(1, audio.duration)}
              min={0}
              onChange={(event) => sendAudioControl("seek", Number(event.target.value))}
              step={1}
              type="range"
              value={Math.min(audio.currentTime, audio.duration || 0)}
            />
            <span>{formatTime(audio.duration)}</span>
          </div>
        </section>
      ) : null}

      {hasLiveDeck ? (
        <form className="remote-control__goto" onSubmit={gotoSlide}>
          <label htmlFor="remote-goto">Slide</label>
          <input
            id="remote-goto"
            inputMode="numeric"
            max={slideCount}
            min={1}
            onChange={(event) => setGotoValue(event.target.value.replace(/\D/g, ""))}
            type="number"
            value={gotoValue}
          />
        <button disabled={!wsReady} type="submit">Go</button>
        </form>
      ) : null}

      {error ? <p className="remote-control__error">{error}</p> : null}
    </main>
  );
}
