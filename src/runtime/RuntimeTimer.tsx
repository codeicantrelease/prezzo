import type { TimerState } from "./PresentationShell";

type RuntimeTimerProps = {
  state: TimerState;
};

function formatClock(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "-" : "";
  const absolute = Math.abs(totalSeconds);
  const minutes = Math.floor(absolute / 60);
  const seconds = absolute % 60;

  return `${sign}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RuntimeTimer({ state }: RuntimeTimerProps) {
  const remaining =
    state.mode === "countdown" && state.durationSeconds
      ? state.durationSeconds - state.elapsedSeconds
      : undefined;
  const displaySeconds = remaining ?? state.elapsedSeconds;
  const isOvertime = typeof remaining === "number" && remaining < 0;

  return (
    <div className={`runtime-timer ${isOvertime ? "runtime-timer--overtime" : ""}`}>
      <span>{state.mode === "countdown" ? "countdown" : "elapsed"}</span>
      <strong>{formatClock(displaySeconds)}</strong>
      <span>{state.isRunning ? "running" : "paused"}</span>
    </div>
  );
}
