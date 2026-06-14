import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DeckConfig } from "../deck-types";
import { FocusTimerOverlay } from "./FocusTimerOverlay";
import { QuakeTerminal } from "./QuakeTerminal";
import { RemoteAccessOverlay } from "./RemoteAccessOverlay";
import type { RemoteAccessDetails } from "./remote-control";

export type TimerMode = "elapsed" | "countdown";

export type TimerState = {
  mode: TimerMode;
  durationSeconds?: number;
  elapsedSeconds: number;
  isRunning: boolean;
};

export type TimerControls = {
  pause: () => void;
  reset: () => void;
  resume: () => void;
  setCountdown: (minutes: number) => void;
  setElapsed: () => void;
};

export type FocusTimerState = {
  durationSeconds: number;
  isExpired: boolean;
  isRunning: boolean;
  isVisible: boolean;
  remainingSeconds: number;
};

export type FocusTimerControls = {
  start: (seconds?: number) => void;
  stop: () => void;
};

type PresentationShellProps = {
  deck: DeckConfig;
  children: ReactNode;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']") ||
      target.closest(".quake-terminal"),
  );
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await document.documentElement.requestFullscreen();
}

export function PresentationShell({ deck, children }: PresentationShellProps) {
  const runtime = deck.runtime;
  const hasTimer = Boolean(runtime?.timer?.enabled);
  const hasTerminal = Boolean(runtime?.terminal?.enabled);
  const initialMode = runtime?.timer?.mode ?? "elapsed";
  const initialDuration =
    runtime?.timer?.durationMinutes && runtime.timer.durationMinutes > 0
      ? runtime.timer.durationMinutes * 60
      : undefined;

  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [mode, setMode] = useState<TimerMode>(initialMode);
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(initialDuration);
  const [now, setNow] = useState(() => Date.now());
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [focusDurationSeconds, setFocusDurationSeconds] = useState(120);
  const [focusStartedAt, setFocusStartedAt] = useState<number | null>(null);
  const [remoteAccess, setRemoteAccess] = useState<RemoteAccessDetails | null>(null);
  const presentationFocusRef = useRef<HTMLDivElement>(null);

  const restorePresentationFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;

      if (activeElement instanceof HTMLElement && activeElement.closest(".quake-terminal")) {
        activeElement.blur();
      }

      presentationFocusRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const closeTerminal = useCallback(() => {
    setIsTerminalOpen(false);
    restorePresentationFocus();
  }, [restorePresentationFocus]);

  useEffect(() => {
    if (!hasTimer) return undefined;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, [hasTimer]);

  useEffect(() => {
    if (!hasTerminal) return undefined;

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
  }, [closeTerminal, hasTerminal, isTerminalOpen, remoteAccess]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      void toggleFullscreen();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const effectiveNow = pausedAt ?? now;
  const elapsedSeconds = Math.max(0, Math.floor((effectiveNow - startedAt) / 1000));

  const timerState = useMemo<TimerState>(
    () => ({
      mode,
      durationSeconds,
      elapsedSeconds,
      isRunning: pausedAt === null,
    }),
    [durationSeconds, elapsedSeconds, mode, pausedAt],
  );

  const reset = useCallback(() => {
    const nextNow = Date.now();
    setStartedAt(nextNow);
    setPausedAt(null);
    setNow(nextNow);
  }, []);

  const timerControls = useMemo<TimerControls>(
    () => ({
      pause: () => setPausedAt((current) => current ?? Date.now()),
      reset,
      resume: () => {
        setPausedAt((current) => {
          if (current === null) return null;
          setStartedAt((started) => started + (Date.now() - current));
          return null;
        });
      },
      setCountdown: (minutes) => {
        setMode("countdown");
        setDurationSeconds(Math.max(1, Math.round(minutes * 60)));
        reset();
      },
      setElapsed: () => {
        setMode("elapsed");
        setDurationSeconds(undefined);
        reset();
      },
    }),
    [reset],
  );

  const focusRemainingSeconds =
    focusStartedAt === null ? focusDurationSeconds : focusDurationSeconds - Math.floor((now - focusStartedAt) / 1000);

  const focusTimerState = useMemo<FocusTimerState>(
    () => ({
      durationSeconds: focusDurationSeconds,
      isExpired: focusRemainingSeconds <= 0,
      isRunning: focusStartedAt !== null && focusRemainingSeconds > 0,
      isVisible: focusStartedAt !== null,
      remainingSeconds: Math.max(0, focusRemainingSeconds),
    }),
    [focusDurationSeconds, focusRemainingSeconds, focusStartedAt],
  );

  const focusTimerControls = useMemo<FocusTimerControls>(
    () => ({
      start: (seconds = 120) => {
        setFocusDurationSeconds(Math.max(1, Math.round(seconds)));
        setFocusStartedAt(Date.now());
        setNow(Date.now());
      },
      stop: () => setFocusStartedAt(null),
    }),
    [],
  );

  return (
    <>
      <div
        className="presentation-focus-sentinel"
        data-prezzo-presentation-focus
        tabIndex={-1}
        ref={presentationFocusRef}
      >
        {children}
      </div>
      {hasTimer && focusTimerState.isVisible ? <FocusTimerOverlay state={focusTimerState} /> : null}
      {remoteAccess ? (
        <RemoteAccessOverlay access={remoteAccess} onClose={() => setRemoteAccess(null)} />
      ) : null}
      {hasTerminal ? (
        <QuakeTerminal
          deck={deck}
          focusTimerControls={focusTimerControls}
          hasTimer={hasTimer}
          isOpen={isTerminalOpen}
          onClose={closeTerminal}
          onOpen={() => setIsTerminalOpen(true)}
          onShowRemoteAccess={(access) => {
            setRemoteAccess(access);
            closeTerminal();
          }}
          timer={timerState}
          timerControls={timerControls}
        />
      ) : null}
    </>
  );
}
