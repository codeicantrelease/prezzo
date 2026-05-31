import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DeckConfig } from "../deck-types";
import { QuakeTerminal } from "./QuakeTerminal";

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

type PresentationShellProps = {
  deck: DeckConfig;
  children: ReactNode;
};

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
      if (event.code !== "Backquote") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      event.preventDefault();
      setIsTerminalOpen((current) => !current);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasTerminal]);

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

  return (
    <>
      {children}
      {hasTerminal ? (
        <QuakeTerminal
          deck={deck}
          hasTimer={hasTimer}
          isOpen={isTerminalOpen}
          onClose={() => setIsTerminalOpen(false)}
          onOpen={() => setIsTerminalOpen(true)}
          timer={timerState}
          timerControls={timerControls}
        />
      ) : null}
    </>
  );
}
