import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DeckConfig } from "../deck-types";

type DubDubTokChallengeProps = {
  config: NonNullable<NonNullable<DeckConfig["runtime"]>["hiddenPages"]>["dubdubtok"];
  deck: DeckConfig;
};

const HANDLE_WIDTH = 128;

function clampPercent(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Number(value)));
}

function normalizeDegrees(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return ((Number(value) % 360) + 360) % 360;
}

function positiveNumber(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || Number(value) <= 0) return fallback;
  return Number(value);
}

function degreeDistance(value: number, target: number) {
  const directDistance = Math.abs(normalizeDegrees(value, 0) - normalizeDegrees(target, 0));
  return Math.min(directDistance, 360 - directDistance);
}

export function DubDubTokChallenge({ config }: DubDubTokChallengeProps) {
  const targetPercent = clampPercent(config?.targetPercent, 64);
  const targetYPercent = clampPercent(config?.targetYPercent, 42);
  const targetRotationDegrees = normalizeDegrees(config?.targetRotationDegrees, 235);
  const toleranceDegrees = Math.max(1, Math.min(45, Number(config?.toleranceDegrees ?? 8)));
  const sourceAspectRatio = positiveNumber(config?.sourceAspectRatio, 1);
  const imageUrl = config?.imageUrl ?? "/assets/dubdubtok-one-piece-source.webp";
  const pieceImageUrl = config?.pieceImageUrl ?? imageUrl;
  const [sliderValue, setSliderValue] = useState(0);
  const [solved, setSolved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const trackRef = useRef<HTMLSpanElement>(null);
  const distance = degreeDistance(sliderValue, targetRotationDegrees);
  const sliderProgress = sliderValue / 360;

  const style = useMemo<CSSProperties & Record<string, string>>(
    () => ({
      "--dubdub-handle": `${(sliderValue / 360) * 100}%`,
      "--dubdub-image": `url("${imageUrl}")`,
      "--dubdub-piece-image": `url("${pieceImageUrl}")`,
      "--dubdub-rotation": `${sliderValue - targetRotationDegrees}deg`,
      "--dubdub-source-aspect": `${sourceAspectRatio}`,
      "--dubdub-target": `${targetPercent}%`,
      "--dubdub-target-y": `${targetYPercent}%`,
      "--dubdub-slider-progress": `${sliderProgress}`,
      "--dubdub-handle-width": `${HANDLE_WIDTH}px`,
    }),
    [imageUrl, pieceImageUrl, sliderProgress, sliderValue, sourceAspectRatio, targetPercent, targetRotationDegrees, targetYPercent],
  );

  const markSolved = () => {
    setSliderValue(targetRotationDegrees);
    setSolved(true);
  };

  const testSolution = (value = sliderValue) => {
    if (degreeDistance(value, targetRotationDegrees) <= toleranceDegrees) markSolved();
  };

  const updateSliderFromPointer = useCallback(
    (clientX: number, shouldTest = false) => {
      const track = trackRef.current;
      if (!track || solved) return;

      const rect = track.getBoundingClientRect();
      const usableWidth = Math.max(1, rect.width - HANDLE_WIDTH);
      const progress = Math.max(0, Math.min(1, (clientX - rect.left - HANDLE_WIDTH / 2) / usableWidth));
      const nextValue = Math.round(progress * 360);

      setSliderValue(nextValue);
      if (shouldTest) testSolution(nextValue);
    },
    [solved, testSolution],
  );

  return (
    <main className="dubdubtok-page" style={style}>
      <div className="dubdubtok-video-surface" aria-hidden="true">
        <div className="dubdubtok-side-controls">
          <span>♪</span>
          <span>...</span>
        </div>
        <div className="dubdubtok-player-controls">
          <span>▶</span>
          <span>0:00</span>
          <i />
          <span>♬</span>
          <span>□</span>
          <span>⋮</span>
        </div>
      </div>

      {!dismissed && (
      <section
        className={`dubdubtok-challenge ${solved ? "dubdubtok-challenge--solved" : ""}`}
        aria-label="DubDubTok hidden challenge"
      >
        <header className="dubdubtok-challenge__header">
          <h1>{solved ? "Verified" : "Drag the slider to fit the puzzle"}</h1>
          <button
            aria-label={solved ? "Dismiss challenge" : "Locked until solved"}
            className="dubdubtok-challenge__close"
            disabled={!solved}
            onClick={() => setDismissed(true)}
            type="button"
          >
            x
          </button>
        </header>

        <div className="dubdubtok-puzzle">
          <div className="dubdubtok-puzzle__image">
            <div className="dubdubtok-puzzle__ring dubdubtok-puzzle__ring--outer" />
            <div className="dubdubtok-puzzle__hole" />
            <div
              className={`dubdubtok-puzzle__piece ${
                config?.pieceImageUrl ? "dubdubtok-puzzle__piece--precut" : ""
              }`}
            />
          </div>
        </div>

        <label
          className="dubdubtok-slider"
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerDown={(event) => {
            if (solved) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            updateSliderFromPointer(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateSliderFromPointer(event.clientX);
            }
          }}
          onPointerUp={(event) => {
            if (solved) return;
            updateSliderFromPointer(event.clientX, true);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
        >
          <span className="dubdubtok-slider__track" aria-hidden="true" ref={trackRef}>
            <span className="dubdubtok-slider__handle">→</span>
          </span>
          <input
            aria-label="DubDubTok challenge slider"
            disabled={solved}
            max="360"
            min="0"
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              setSliderValue(nextValue);
              testSolution(nextValue);
            }}
            onInput={(event) => {
              const nextValue = Number(event.currentTarget.value);
              setSliderValue(nextValue);
              testSolution(nextValue);
            }}
            onKeyUp={() => testSolution()}
            onPointerUp={() => testSolution()}
            step="1"
            type="range"
            value={sliderValue}
          />
        </label>

        <footer className="dubdubtok-challenge__footer">
          <span className="dubdubtok-audio-mark">♬</span>
          <strong>Audio</strong>
          <span className="dubdubtok-challenge__token">20260528035539FD2CEE0983A71DDBDUB</span>
          <button
            aria-label={solved ? "Dismiss challenge from footer" : `Puzzle locked, off by ${Math.round(distance)} degrees`}
            className="dubdubtok-challenge__icon-button"
            disabled={!solved}
            onClick={() => setDismissed(true)}
            type="button"
          >
            ↻
          </button>
          <button
            aria-label="Reset challenge"
            className="dubdubtok-challenge__icon-button"
            onClick={() => {
              setSolved(false);
              setSliderValue(0);
            }}
            type="button"
          >
            ◷
          </button>
        </footer>

      </section>
      )}
    </main>
  );
}
