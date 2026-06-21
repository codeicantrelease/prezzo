import { useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SlideContext, useSteps } from "spectacle";

type VideoStartTrigger = "enter" | "step";

type VideoPlayerProps = {
  src: string;
  poster?: string;
  // "enter" (default): start the moment the slide becomes active (autoplay on
  // slide transition). "step": the slide appears with the video paused on its
  // poster/first frame; the next Next press starts it (it occupies one Spectacle
  // step), then a further Next advances the deck — so the video plays "as if it
  // were the next part" of the slide.
  startOn?: VideoStartTrigger;
  loop?: boolean;
  // Explicitly muted playback (always autoplay-allowed). When false we try with
  // sound and fall back to muted + unmute-on-gesture, mirroring the AudioPlayer.
  muted?: boolean;
  // Show the browser's native transport. Off by default — playback is driven by
  // slide/step state, not by on-screen controls.
  controls?: boolean;
  fit?: "contain" | "cover";
  className?: string;
};

type PlaybackStatus = "idle" | "playing" | "paused" | "blocked" | "error";

export function VideoPlayer({
  src,
  poster,
  startOn = "enter",
  loop = false,
  muted = false,
  controls = false,
  fit = "contain",
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [isMuted, setIsMuted] = useState(muted);

  // Spectacle keeps every slide's children mounted, so gate playback on the
  // active slide (outside a Slide the context is null → treat as active so the
  // player is usable standalone).
  const slideContext = useContext(SlideContext);
  const isSlideActive = slideContext ? slideContext.isSlideActive : true;

  // In "step" mode the video registers one step, so the first Next press lands
  // on it (starts playback) before the deck advances. In "enter" mode it owns no
  // steps and Next leaves the slide immediately. The placeholder must render for
  // the step to register with the deck.
  const { isActive: isStepActive, placeholder } = useSteps(startOn === "step" ? 1 : 0);

  const shouldPlay = isSlideActive && (startOn === "enter" || isStepActive);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (!shouldPlay) {
      // Off-screen or not yet stepped to: pause and rewind so the next visit /
      // step replays from the top, leaving the poster frame showing.
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // currentTime can throw before metadata loads; safe to ignore.
      }
      setStatus("paused");
      return undefined;
    }

    let cancelled = false;

    const unmuteOnGesture = () => {
      const current = videoRef.current;
      if (current) {
        current.muted = false;
        setIsMuted(false);
        if (current.paused) void current.play().catch(() => undefined);
      }
      removeGestureListeners();
    };
    const removeGestureListeners = () => {
      window.removeEventListener("pointerdown", unmuteOnGesture);
      window.removeEventListener("keydown", unmuteOnGesture);
    };
    const armUnmuteOnGesture = () => {
      window.addEventListener("pointerdown", unmuteOnGesture);
      window.addEventListener("keydown", unmuteOnGesture);
    };

    const play = async () => {
      try {
        video.muted = muted;
        setIsMuted(muted);
        await video.play();
        if (cancelled) {
          video.pause();
          video.currentTime = 0;
          return;
        }
        setStatus("playing");
        // Started with sound but the browser only allowed it because it's muted?
        // If we wanted sound, arm a gesture to unmute.
        if (!muted && video.muted) armUnmuteOnGesture();
      } catch {
        // Unmuted autoplay blocked: fall back to muted autoplay (always allowed)
        // and unmute on the first interaction.
        try {
          video.muted = true;
          setIsMuted(true);
          await video.play();
          if (cancelled) {
            video.pause();
            video.currentTime = 0;
            return;
          }
          setStatus("playing");
          if (!muted) armUnmuteOnGesture();
        } catch {
          if (!cancelled) {
            setStatus("blocked");
            if (!muted) armUnmuteOnGesture();
          }
        }
      }
    };

    void play();

    return () => {
      cancelled = true;
      removeGestureListeners();
      video.pause();
    };
  }, [muted, shouldPlay]);

  return (
    <div
      className={`video-player video-player--${status}${className ? ` ${className}` : ""}`}
      style={{ "--video-fit": fit } as CSSProperties}
    >
      <video
        ref={videoRef}
        className="video-player__el"
        src={src}
        poster={poster}
        loop={loop}
        muted={isMuted}
        controls={controls}
        playsInline
        preload="auto"
        onPlay={() => setStatus("playing")}
        onPause={() => setStatus((current) => (current === "blocked" ? current : "paused"))}
        onEnded={() => setStatus("paused")}
        onError={() => setStatus("error")}
      />
      {status === "error" ? (
        <p className="video-player__status" role="status">
          Video file not found (referenced at runtime, not committed).
        </p>
      ) : null}
      {placeholder}
    </div>
  );
}
