import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { DeckConfig } from "../deck-types";
import type { TimerControls, TimerState } from "./PresentationShell";
import { RuntimeTimer } from "./RuntimeTimer";

type QuakeTerminalProps = {
  deck: DeckConfig;
  hasTimer: boolean;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  timer: TimerState;
  timerControls: TimerControls;
};

function parseDuration(value: string) {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(m|min|s|sec)?$/);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2] ?? "m";

  return unit.startsWith("s") ? amount / 60 : amount;
}

function formatTimer(timer: TimerState) {
  const elapsed = `${Math.floor(timer.elapsedSeconds / 60)}m ${timer.elapsedSeconds % 60}s`;

  if (timer.mode === "elapsed") return `elapsed ${elapsed} (${timer.isRunning ? "running" : "paused"})`;

  const remaining = (timer.durationSeconds ?? 0) - timer.elapsedSeconds;
  return `countdown ${Math.floor(remaining / 60)}m ${Math.abs(remaining % 60)}s (${timer.isRunning ? "running" : "paused"})`;
}

function goToSlide(slide: number) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("slideIndex", String(Math.max(0, slide - 1)));
  nextUrl.searchParams.set("stepIndex", "0");
  window.location.assign(nextUrl);
}

export function QuakeTerminal({
  deck,
  hasTimer,
  isOpen,
  onClose,
  onOpen,
  timer,
  timerControls,
}: QuakeTerminalProps) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([
    "Prezzo terminal ready. Press ` to toggle. Type help for commands.",
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const commands = useMemo(
    () => ({
      clear: () => {
        setHistory([]);
        return "";
      },
      close: () => {
        onClose();
        return "closed";
      },
      deck: () => `${deck.slug} - ${deck.label}`,
      help: () =>
        "commands: help, deck, timer, timer pause, timer resume, timer reset, timer elapsed, timer countdown 20m, goto 3, clear, close",
      timer: () => formatTimer(timer),
    }),
    [deck.label, deck.slug, onClose, timer],
  );

  const runCommand = (rawCommand: string) => {
    const input = rawCommand.trim();
    if (!input) return;

    const [base, ...rest] = input.split(/\s+/);
    let output = "";

    if (base === "goto") {
      const slide = Number(rest[0]);
      output = Number.isFinite(slide) && slide > 0 ? `going to slide ${slide}` : "usage: goto <slide-number>";
      setHistory((current) => [...current, `> ${input}`, output]);
      if (Number.isFinite(slide) && slide > 0) goToSlide(slide);
      return;
    }

    if (base === "timer") {
      const action = rest[0];

      if (!action) output = commands.timer();
      else if (action === "pause") {
        timerControls.pause();
        output = "timer paused";
      } else if (action === "resume" || action === "start") {
        timerControls.resume();
        output = "timer running";
      } else if (action === "reset") {
        timerControls.reset();
        output = "timer reset";
      } else if (action === "elapsed") {
        timerControls.setElapsed();
        output = "timer set to elapsed";
      } else if (action === "countdown") {
        const minutes = parseDuration(rest[1] ?? "");
        if (!minutes) output = "usage: timer countdown 20m";
        else {
          timerControls.setCountdown(minutes);
          output = `countdown set to ${rest[1]}`;
        }
      } else {
        output = "unknown timer command";
      }

      setHistory((current) => [...current, `> ${input}`, output]);
      return;
    }

    const handler = commands[base as keyof typeof commands];
    output = handler ? handler() : `unknown command: ${base}`;

    if (output) {
      setHistory((current) => [...current, `> ${input}`, output]);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runCommand(command);
    setCommand("");
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    runCommand(command);
    setCommand("");
  };

  return (
    <section className={`quake-terminal ${isOpen ? "quake-terminal--open" : ""}`} aria-hidden={!isOpen}>
      <div className="quake-terminal__bar">
        <strong>Prezzo terminal</strong>
        {hasTimer ? <RuntimeTimer state={timer} /> : null}
        <span>{deck.slug}</span>
      </div>
      <div className="quake-terminal__history">
        {history.map((line, index) => (
          <div key={`${line}-${index}`}>{line}</div>
        ))}
      </div>
      <form className="quake-terminal__form" onSubmit={onSubmit}>
        <span>&gt;</span>
        <input
          aria-label="Prezzo terminal command"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={onInputKeyDown}
          ref={inputRef}
          spellCheck={false}
          value={command}
        />
      </form>
    </section>
  );
}
