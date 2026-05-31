import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { FocusTimerState } from "./PresentationShell";

type FocusTimerOverlayProps = {
  state: FocusTimerState;
};

type PresentationFrame = {
  right: number;
  top: number;
};

function fallbackFrame(): DOMRect {
  const ratio = 16 / 9;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(viewportWidth, viewportHeight * ratio);
  const height = width / ratio;
  const x = (viewportWidth - width) / 2;
  const y = (viewportHeight - height) / 2;

  return new DOMRect(x, y, width, height);
}

function findPresentationFrame(): PresentationFrame {
  const slideContent = document.querySelector(".slide-shell");
  let frame = fallbackFrame();

  if (slideContent) {
    let current: Element | null = slideContent;

    while (current && current !== document.body) {
      const rect = current.getBoundingClientRect();
      const ratio = rect.width / rect.height;
      const isSlideLike =
        rect.width > window.innerWidth * 0.5 &&
        rect.height > window.innerHeight * 0.5 &&
        Math.abs(ratio - 16 / 9) < 0.08;

      if (isSlideLike) frame = rect;

      current = current.parentElement;
    }
  }

  return {
    right: Math.max(0, window.innerWidth - frame.right + 24),
    top: Math.max(0, frame.top + 24),
  };
}

export function FocusTimerOverlay({ state }: FocusTimerOverlayProps) {
  const [presentationFrame, setPresentationFrame] = useState<PresentationFrame>(() => findPresentationFrame());
  const progress =
    state.durationSeconds > 0 ? (state.durationSeconds - state.remainingSeconds) / state.durationSeconds : 0;

  useEffect(() => {
    const updateFrame = () => {
      const nextFrame = findPresentationFrame();
      setPresentationFrame((current) =>
        current.right === nextFrame.right && current.top === nextFrame.top ? current : nextFrame,
      );
    };
    const resizeObserver = new ResizeObserver(updateFrame);

    updateFrame();
    resizeObserver.observe(document.body);
    window.addEventListener("resize", updateFrame);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFrame);
    };
  }, []);

  const style = useMemo<CSSProperties & Record<string, string>>(
    () => ({
      "--focus-timer-progress": `${Math.max(0, Math.min(100, progress * 100))}%`,
      "--focus-timer-right": `${presentationFrame.right}px`,
      "--focus-timer-top": `${presentationFrame.top}px`,
    }),
    [presentationFrame.right, presentationFrame.top, progress],
  );

  return (
    <aside
      aria-label={`Focus timer: ${state.remainingSeconds} seconds remaining`}
      className={`focus-timer-overlay ${state.isExpired ? "focus-timer-overlay--expired" : ""}`}
      style={style}
    >
      <div className="focus-timer-overlay__clock" aria-hidden="true">
        <div className="focus-timer-overlay__face">
          <strong>{state.remainingSeconds}</strong>
        </div>
      </div>
    </aside>
  );
}
