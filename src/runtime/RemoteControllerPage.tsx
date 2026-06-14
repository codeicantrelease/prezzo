import { ChevronLeft, ChevronRight, Lock, MonitorDot, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { DeckConfig } from "../deck-types";
import { remoteWebSocketUrl } from "./remote-control";
import type { RemoteControlCommand, RemoteDeckState, RemoteServerMessage } from "./remote-control";

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
  const [presenterCount, setPresenterCount] = useState(0);
  const [gotoValue, setGotoValue] = useState("1");
  const wsRef = useRef<WebSocket | null>(null);
  const autoConnectPinRef = useRef<string | null>(null);
  const slideCount = state?.slideCount ?? deck.slideCount ?? 1;
  const currentSlideIndex = clampSlideIndex(state?.slideIndex ?? 0, deck);
  const currentSlideNumber = currentSlideIndex + 1;
  const notes = deck.presenterNotes?.[currentSlideIndex] ?? "No presenter notes for this slide.";

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
      </section>

      <div className="remote-control__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

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
