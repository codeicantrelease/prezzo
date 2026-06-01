import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { DeckConfig } from "../deck-types";
import type { FocusTimerControls, TimerControls, TimerState } from "./PresentationShell";
import { RuntimeTimer } from "./RuntimeTimer";

type QuakeTerminalProps = {
  deck: DeckConfig;
  focusTimerControls: FocusTimerControls;
  hasTimer: boolean;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  timer: TimerState;
  timerControls: TimerControls;
};

type VimInputMode = "insert" | "normal";
type VimOperator = "d";
type VimChange = {
  cursor?: number;
  nextCommand: string;
};

function parseDurationMinutes(value: string) {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(m|min|s|sec)?$/);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2] ?? "m";

  return unit.startsWith("s") ? amount / 60 : amount;
}

function parseDurationSeconds(value: string | undefined, defaultSeconds: number) {
  if (!value) return defaultSeconds;

  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(m|min|s|sec)?$/);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  const seconds = unit.startsWith("m") ? amount * 60 : amount;

  return Math.max(1, Math.round(seconds));
}

function formatTimer(timer: TimerState) {
  const elapsed = `${Math.floor(timer.elapsedSeconds / 60)}m ${timer.elapsedSeconds % 60}s`;

  if (timer.mode === "elapsed") return `elapsed ${elapsed} (${timer.isRunning ? "running" : "paused"})`;

  const remaining = (timer.durationSeconds ?? 0) - timer.elapsedSeconds;
  return `countdown ${Math.floor(remaining / 60)}m ${Math.abs(remaining % 60)}s (${timer.isRunning ? "running" : "paused"})`;
}

function goToHiddenPage(deckSlug: string, pageSlug: string) {
  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = `/${deckSlug}/${pageSlug}`;
  nextUrl.search = "";
  window.location.assign(nextUrl);
}

function goToSlide(deckSlug: string, slide: number) {
  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = `/${deckSlug}`;
  nextUrl.searchParams.set("slideIndex", String(Math.max(0, slide - 1)));
  nextUrl.searchParams.set("stepIndex", "0");
  window.location.assign(nextUrl);
}

function clampCursor(cursor: number, value: string) {
  return Math.max(0, Math.min(cursor, value.length));
}

function normalCursor(cursor: number, value: string) {
  if (!value) return 0;
  return Math.max(0, Math.min(cursor, value.length - 1));
}

function isWhitespace(character: string) {
  return /\s/.test(character);
}

function isKeywordCharacter(character: string) {
  return /[A-Za-z0-9_]/.test(character);
}

function characterKind(character: string) {
  if (!character) return "empty";
  if (isWhitespace(character)) return "space";
  return isKeywordCharacter(character) ? "keyword" : "symbol";
}

function nextWordStart(value: string, cursor: number) {
  let index = clampCursor(cursor, value);
  const currentKind = characterKind(value[index]);

  if (currentKind === "space") {
    while (index < value.length && isWhitespace(value[index])) index += 1;
    return index;
  }

  while (index < value.length && characterKind(value[index]) === currentKind) index += 1;
  while (index < value.length && isWhitespace(value[index])) index += 1;

  return index;
}

function previousWordStart(value: string, cursor: number) {
  let index = Math.max(0, Math.min(cursor - 1, value.length - 1));

  while (index > 0 && isWhitespace(value[index])) index -= 1;

  const currentKind = characterKind(value[index]);
  while (index > 0 && characterKind(value[index - 1]) === currentKind) index -= 1;

  return index;
}

function wordEnd(value: string, cursor: number) {
  let index = clampCursor(cursor, value);

  if (isWhitespace(value[index])) {
    while (index < value.length && isWhitespace(value[index])) index += 1;
  } else if (index + 1 < value.length) {
    index += 1;
  }

  const currentKind = characterKind(value[index]);
  while (index + 1 < value.length && characterKind(value[index + 1]) === currentKind) index += 1;

  return index;
}

function deleteRange(value: string, from: number, to: number): VimChange {
  const start = clampCursor(Math.min(from, to), value);
  const end = clampCursor(Math.max(from, to), value);
  const nextCommand = `${value.slice(0, start)}${value.slice(end)}`;

  return {
    cursor: normalCursor(start, nextCommand),
    nextCommand,
  };
}

function applyVimOperator(operator: VimOperator, motion: string, value: string, cursor: number): VimChange | undefined {
  if (operator !== "d") return undefined;

  if (motion === "d") {
    return { cursor: 0, nextCommand: "" };
  }

  if (motion === "w") return deleteRange(value, cursor, nextWordStart(value, cursor));
  if (motion === "b") return deleteRange(value, previousWordStart(value, cursor), cursor);
  if (motion === "e") return deleteRange(value, cursor, wordEnd(value, cursor) + 1);
  if (motion === "$") return deleteRange(value, cursor, value.length);
  if (motion === "0") return deleteRange(value, 0, cursor);

  return undefined;
}

export function QuakeTerminal({
  deck,
  focusTimerControls,
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
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [vimEnabled, setVimEnabled] = useState(true);
  const [vimInputMode, setVimInputMode] = useState<VimInputMode>("insert");
  const [pendingVimOperator, setPendingVimOperator] = useState<VimOperator | null>(null);
  const commandHistoryRef = useRef<string[]>([]);
  const draftCommandRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const vimModeLabel = vimEnabled ? vimInputMode.toUpperCase() : "OFF";

  const setInputSelection = (input: HTMLInputElement, cursor: number, value: string) => {
    const nextCursor = vimEnabled && vimInputMode === "normal" ? normalCursor(cursor, value) : clampCursor(cursor, value);
    const nextEnd = vimEnabled && vimInputMode === "normal" && value.length > 0 ? nextCursor + 1 : nextCursor;

    input.setSelectionRange(nextCursor, nextEnd);
  };

  const setCommandWithCursor = (nextCommand: string, cursor?: number) => {
    setCommand(nextCommand);
    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;

      setInputSelection(input, cursor ?? nextCommand.length, nextCommand);
    });
  };

  const selectCommandHistory = (direction: "older" | "newer") => {
    const entries = commandHistoryRef.current;
    if (entries.length === 0) return;

    if (direction === "older") {
      const nextCursor = historyCursor === null ? entries.length - 1 : Math.max(0, historyCursor - 1);

      if (historyCursor === null) draftCommandRef.current = command;
      setHistoryCursor(nextCursor);
      setCommandWithCursor(entries[nextCursor]);
      return;
    }

    if (historyCursor === null) return;

    const nextCursor = historyCursor + 1;

    if (nextCursor >= entries.length) {
      setCommandWithCursor(draftCommandRef.current);
      draftCommandRef.current = "";
      setHistoryCursor(null);
      return;
    }

    setHistoryCursor(nextCursor);
    setCommandWithCursor(entries[nextCursor]);
  };

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        if (vimEnabled && document.activeElement === inputRef.current) return;

        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, vimEnabled]);

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
        hasTimer
          ? "commands: help, deck, dubdubtok, vim, vim on, vim off, timer, timer 2m, timer start, timer start 90s, timer stop, timer pause, timer resume, timer reset, timer elapsed, timer countdown 20m, goto 3, clear, close"
          : "commands: help, deck, dubdubtok, vim, vim on, vim off, goto 3, clear, close",
      timer: () => formatTimer(timer),
    }),
    [deck.label, deck.slug, hasTimer, onClose, timer],
  );

  const runCommand = (rawCommand: string) => {
    const input = rawCommand.trim();
    if (!input) return;

    if (commandHistoryRef.current.at(-1) !== input) {
      commandHistoryRef.current = [...commandHistoryRef.current, input];
    }

    setHistoryCursor(null);
    draftCommandRef.current = "";

    const [base, ...rest] = input.split(/\s+/);
    let output = "";

    if (base === "dubdubtok") {
      const page = deck.runtime?.hiddenPages?.dubdubtok;
      output = page?.enabled ? "opening DubDubTok challenge" : "dubdubtok is not enabled for this deck";
      setHistory((current) => [...current, `> ${input}`, output]);
      if (page?.enabled) goToHiddenPage(deck.slug, "dubdubtok");
      return;
    }

    if (base === "goto") {
      const slide = Number(rest[0]);
      output = Number.isFinite(slide) && slide > 0 ? `going to slide ${slide}` : "usage: goto <slide-number>";
      setHistory((current) => [...current, `> ${input}`, output]);
      if (Number.isFinite(slide) && slide > 0) goToSlide(deck.slug, slide);
      return;
    }

    if (base === "timer") {
      const action = rest[0];
      const shorthandSeconds = action ? parseDurationSeconds(action, 120) : undefined;

      if (!hasTimer) output = "timer runtime is disabled for this deck";
      else if (!action) output = commands.timer();
      else if (shorthandSeconds) {
        focusTimerControls.start(shorthandSeconds);
        output = `overlay timer started: ${shorthandSeconds}s`;
        onClose();
      } else if (action === "pause") {
        timerControls.pause();
        output = "timer paused";
      } else if (action === "resume") {
        timerControls.resume();
        output = "timer running";
      } else if (action === "start") {
        const seconds = parseDurationSeconds(rest[1], 120);
        if (!seconds) output = "usage: timer start 120s";
        else {
          focusTimerControls.start(seconds);
          output = `overlay timer started: ${seconds}s`;
          onClose();
        }
      } else if (action === "stop") {
        focusTimerControls.stop();
        output = "overlay timer stopped";
      } else if (action === "reset") {
        timerControls.reset();
        output = "timer reset";
      } else if (action === "elapsed") {
        timerControls.setElapsed();
        output = "timer set to elapsed";
      } else if (action === "countdown") {
        const minutes = parseDurationMinutes(rest[1] ?? "");
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

    if (base === "vim") {
      const action = rest[0];

      if (!action) output = `vim mode ${vimEnabled ? `on (${vimInputMode})` : "off"}`;
      else if (action === "on" || action === "enable") {
        setVimEnabled(true);
        setVimInputMode("insert");
        setPendingVimOperator(null);
        output = "vim mode on";
      } else if (action === "off" || action === "disable") {
        setVimEnabled(false);
        setVimInputMode("insert");
        setPendingVimOperator(null);
        output = "vim mode off";
      } else {
        output = "usage: vim on | vim off";
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
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectCommandHistory("older");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectCommandHistory("newer");
      return;
    }

    if (vimEnabled && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      const input = event.currentTarget;
      setVimInputMode("normal");
      setPendingVimOperator(null);
      const cursor = input.selectionStart ?? command.length;
      const normalCursor = command.length > 0 && cursor === command.length ? command.length - 1 : cursor;
      window.setTimeout(() => {
        const nextCursor = clampCursor(normalCursor, command);
        const nextEnd = command.length > 0 ? nextCursor + 1 : nextCursor;
        input.setSelectionRange(nextCursor, nextEnd);
      });
      return;
    }

    if (vimEnabled && vimInputMode === "normal") {
      const input = event.currentTarget;
      const rawCursor = input.selectionStart ?? command.length;
      const cursor = command.length > 0 && rawCursor === command.length ? command.length - 1 : rawCursor;

      if (pendingVimOperator) {
        event.preventDefault();
        const change = applyVimOperator(pendingVimOperator, event.key, command, cursor);
        setPendingVimOperator(null);

        if (change) {
          setCommandWithCursor(change.nextCommand, change.cursor);
        }

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        runCommand(command);
        setCommand("");
        setVimInputMode("insert");
        return;
      }

      if (event.key === "i") {
        event.preventDefault();
        setPendingVimOperator(null);
        setVimInputMode("insert");
        window.setTimeout(() => input.setSelectionRange(cursor, cursor));
        return;
      }

      if (event.key === "a") {
        event.preventDefault();
        setPendingVimOperator(null);
        setVimInputMode("insert");
        window.requestAnimationFrame(() => {
          const nextCursor = clampCursor(cursor + 1, command);
          input.setSelectionRange(nextCursor, nextCursor);
        });
        return;
      }

      if (event.key === "I") {
        event.preventDefault();
        setPendingVimOperator(null);
        setVimInputMode("insert");
        window.requestAnimationFrame(() => input.setSelectionRange(0, 0));
        return;
      }

      if (event.key === "A") {
        event.preventDefault();
        setPendingVimOperator(null);
        setVimInputMode("insert");
        window.requestAnimationFrame(() => input.setSelectionRange(command.length, command.length));
        return;
      }

      if (event.key === "d") {
        event.preventDefault();
        setPendingVimOperator("d");
        return;
      }

      if (event.key === "h") {
        event.preventDefault();
        setInputSelection(input, cursor - 1, command);
        return;
      }

      if (event.key === "l") {
        event.preventDefault();
        setInputSelection(input, cursor + 1, command);
        return;
      }

      if (event.key === "w") {
        event.preventDefault();
        setInputSelection(input, nextWordStart(command, cursor), command);
        return;
      }

      if (event.key === "b") {
        event.preventDefault();
        setInputSelection(input, previousWordStart(command, cursor), command);
        return;
      }

      if (event.key === "e") {
        event.preventDefault();
        setInputSelection(input, wordEnd(command, cursor), command);
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setInputSelection(input, 0, command);
        return;
      }

      if (event.key === "$") {
        event.preventDefault();
        setInputSelection(input, command.length, command);
        return;
      }

      if (event.key === "x") {
        event.preventDefault();
        setCommandWithCursor(`${command.slice(0, cursor)}${command.slice(cursor + 1)}`, cursor);
        return;
      }

      if (event.key === "k") {
        event.preventDefault();
        setPendingVimOperator(null);
        selectCommandHistory("older");
        return;
      }

      if (event.key === "j") {
        event.preventDefault();
        setPendingVimOperator(null);
        selectCommandHistory("newer");
        return;
      }

      if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
      }

      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();
    runCommand(command);
    setCommand("");
  };

  return (
    <section className={`quake-terminal ${isOpen ? "quake-terminal--open" : ""}`} aria-hidden={!isOpen}>
      <div className="quake-terminal__bar">
        <strong>Prezzo terminal</strong>
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
          className={vimEnabled && vimInputMode === "normal" ? "quake-terminal__input--vim-normal" : ""}
          onChange={(event) => {
            setCommand(event.target.value);
            setHistoryCursor(null);
            draftCommandRef.current = "";
          }}
          onKeyDown={onInputKeyDown}
          ref={inputRef}
          spellCheck={false}
          value={command}
        />
        <div className="quake-terminal__input-status">
          <span
            className={`quake-terminal__vim-mode ${vimEnabled ? "quake-terminal__vim-mode--active" : ""}`}
            title={pendingVimOperator ? `Vim operator pending: ${pendingVimOperator}` : undefined}
          >
            <span className="quake-terminal__vim-icon" aria-hidden="true">V</span>
            <span>{vimModeLabel}</span>
          </span>
          {hasTimer ? <RuntimeTimer state={timer} /> : null}
        </div>
      </form>
    </section>
  );
}
