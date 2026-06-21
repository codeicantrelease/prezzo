import { ChevronLeft, ChevronRight, Eye, EyeOff, Lock, MonitorDot, Pause, Play, Send, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { DeckConfig } from "../deck-types";
import { remoteWebSocketUrl } from "./remote-control";
import type {
  RemoteAudioCommand,
  RemoteAudioState,
  RemoteControlCommand,
  RemoteDeckState,
  RemoteServerMessage,
} from "./remote-control";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, "0")}`;
}

type RemoteControllerPageProps = {
  deck: DeckConfig;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

function clampSlideIndex(value: number, deck: DeckConfig) {
  const maxIndex = Math.max(0, (deck.slideCount ?? 1) - 1);

  return Math.max(0, Math.min(value, maxIndex));
}

export function RemoteControllerPage({ deck }: RemoteControllerPageProps) {
  const [pin, setPin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState("");
  const [state, setState] = useState<RemoteDeckState | null>(null);
  const [audio, setAudio] = useState<RemoteAudioState | null>(null);
  const [presenterCount, setPresenterCount] = useState(0);
  const [gotoValue, setGotoValue] = useState("1");
  // Live slide-mirror preview, off by default (opt-in: it loads the full deck in
  // an iframe and reloads on each navigation, which costs bandwidth/battery).
  const [showPreview, setShowPreview] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const autoConnectPinRef = useRef<string | null>(null);
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

  const progress = useMemo(() => {
    if (slideCount <= 1) return 100;

    return Math.round((currentSlideIndex / (slideCount - 1)) * 100);
  }, [currentSlideIndex, slideCount]);

  const connectWithPin = async (nextPin: string) => {
    setStatus("connecting");
    setError("");

    try {
      const response = await fetch("/__prezzo_remote/connect", {
        body: JSON.stringify({ deckSlug: deck.slug, pin: nextPin }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        state?: RemoteDeckState | null;
        token?: string;
      };

      if (!response.ok || !payload.token) {
        throw new Error(payload.error ?? "Invalid PIN.");
      }

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

    const ws = new WebSocket(remoteWebSocketUrl(deck.slug, "controller", token));
    wsRef.current = ws;
    setStatus("connecting");

    ws.addEventListener("open", () => {
      setStatus("connected");
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

      if (message.type === "connections") {
        setPresenterCount(message.presenters);
      }

      if (message.type === "audio-state") {
        setAudio(message.audio);
      }
    });

    ws.addEventListener("close", () => {
      if (wsRef.current === ws) wsRef.current = null;
      setStatus((current) => (current === "connected" ? "idle" : current));
    });

    ws.addEventListener("error", () => {
      setStatus("error");
      setError("Connection lost. Re-enter the PIN to reconnect.");
    });

    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [deck.slug, token]);

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void connectWithPin(pin);
  };

  const sendControl = (command: RemoteControlCommand["command"], slideIndex?: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        command,
        slideIndex,
        stepIndex: 0,
        type: "control",
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
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

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
    <main className="remote-control remote-control--active">
      <section className="remote-control__status">
        <div>
          <span>{deck.label}</span>
          <strong>
            {currentSlideNumber} / {slideCount}
          </strong>
        </div>
        <div className="remote-control__presenter">
          <MonitorDot size={18} />
          <span>{presenterCount > 0 ? "Live" : "Waiting"}</span>
        </div>
        <button
          className="remote-control__preview-toggle"
          type="button"
          aria-pressed={showPreview}
          onClick={() => setShowPreview((value) => !value)}
        >
          {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
          <span>{showPreview ? "Hide slide" : "Show slide"}</span>
        </button>
      </section>

      <div className="remote-control__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      {showPreview ? (
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

      <section className="remote-control__notes" aria-live="polite">
        <span>Notes</span>
        <p>{notes}</p>
      </section>

      <section className="remote-control__actions" aria-label="Slide controls">
        <button onClick={() => sendControl("previous")} type="button">
          <ChevronLeft size={30} />
          <span>Previous</span>
        </button>
        <button onClick={() => sendControl("next")} type="button">
          <span>Next</span>
          <ChevronRight size={30} />
        </button>
      </section>

      {showAudio && audio ? (
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
        <button type="submit">Go</button>
      </form>

      {error ? <p className="remote-control__error">{error}</p> : null}
    </main>
  );
}
