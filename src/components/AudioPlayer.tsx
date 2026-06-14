import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { SlideContext } from "spectacle";

type AudioPlayerProps = {
  src: string;
  title?: string;
  subtitle?: string;
  autoStart?: boolean;
};

type PlaybackStatus = "loading" | "playing" | "paused" | "blocked" | "error";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, title, subtitle, autoStart = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<PlaybackStatus>("loading");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  // Spectacle keeps *every* slide's children mounted (each renders into its own
  // portal), so a plain mount effect would autostart on deck load and keep
  // playing across slides. SlideContext.isSlideActive tells us when this slide
  // is the one on screen. Outside a Slide the context is null, so we treat the
  // player as always active (usable standalone).
  const slideContext = useContext(SlideContext);
  const isSlideActive = slideContext ? slideContext.isSlideActive : true;

  // Drive playback off slide activation:
  //  - active + autoStart -> play (audible first, muted fallback that unmutes
  //    on the first interaction; muted autoplay is always permitted)
  //  - inactive -> pause and rewind so the next visit replays from the top
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isSlideActive) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    if (!autoStart) return;

    let cancelled = false;

    const unmuteOnGesture = () => {
      const current = audioRef.current;
      if (current) {
        current.muted = false;
        setMuted(false);
        if (current.paused) {
          void current.play().then(() => setStatus("playing")).catch(() => undefined);
        }
      }
      removeGestureListeners();
    };

    const removeGestureListeners = () => {
      window.removeEventListener("pointerdown", unmuteOnGesture);
      window.removeEventListener("keydown", unmuteOnGesture);
    };

    const armUnmuteOnGesture = () => {
      window.addEventListener("pointerdown", unmuteOnGesture, { once: false });
      window.addEventListener("keydown", unmuteOnGesture, { once: false });
    };

    const tryPlay = async () => {
      try {
        audio.muted = false;
        setMuted(false);
        await audio.play();
        if (!cancelled) setStatus("playing");
      } catch {
        // Audible autoplay was blocked. Start muted (always permitted) and
        // unmute the instant the presenter touches the deck.
        try {
          audio.muted = true;
          setMuted(true);
          await audio.play();
          if (!cancelled) {
            setStatus("playing");
            armUnmuteOnGesture();
          }
        } catch {
          if (!cancelled) {
            setStatus("blocked");
            armUnmuteOnGesture();
          }
        }
      }
    };

    void tryPlay();

    return () => {
      cancelled = true;
      removeGestureListeners();
      audio.pause();
    };
  }, [autoStart, isSlideActive]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio
        .play()
        .then(() => setStatus("playing"))
        .catch(() => setStatus("blocked"));
    } else {
      audio.pause();
      setStatus("paused");
    }
  }, []);

  const onSeek = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !audio.muted;
    audio.muted = next;
    setMuted(next);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const statusLabel: Record<PlaybackStatus, string> = {
    loading: "Loading…",
    playing: muted ? "Playing muted — click or press any key for sound" : "Autostart succeeded — playing",
    paused: "Paused",
    blocked: "Autoplay blocked by the browser — press play",
    error: "Audio file not found (referenced, not committed)",
  };

  return (
    <div className={`audio-player audio-player--${status}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          if (status === "loading") setStatus("paused");
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setStatus("playing")}
        onPause={() => setStatus((current) => (current === "blocked" ? current : "paused"))}
        onEnded={() => setStatus("paused")}
        onError={() => setStatus("error")}
      />

      <div className="audio-player__top">
        <button
          aria-label={status === "playing" ? "Pause" : "Play"}
          className="audio-player__play"
          disabled={status === "error"}
          onClick={togglePlay}
          type="button"
        >
          {status === "playing" ? "❚❚" : "►"}
        </button>
        <div className="audio-player__meta">
          {title ? <strong>{title}</strong> : null}
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <button aria-label={muted ? "Unmute" : "Mute"} className="audio-player__mute" onClick={toggleMute} type="button">
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <div className="audio-player__scrubber">
        <span className="audio-player__time">{formatTime(currentTime)}</span>
        <input
          aria-label="Seek"
          className="audio-player__seek"
          max={Math.max(1, duration)}
          min={0}
          onChange={(event) => onSeek(Number(event.target.value))}
          step={0.1}
          style={{ "--audio-progress": `${progress}%` } as React.CSSProperties}
          type="range"
          value={Math.min(currentTime, duration || 0)}
        />
        <span className="audio-player__time">{formatTime(duration)}</span>
      </div>

      <p className="audio-player__status" role="status">
        {statusLabel[status]}
      </p>
    </div>
  );
}
