import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SlideContext } from "spectacle";
import { REMOTE_AUDIO_COMMAND_EVENT, REMOTE_AUDIO_STATE_EVENT } from "../runtime/remote-control";
import type { RemoteAudioControlMessage, RemoteAudioState } from "../runtime/remote-control";

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

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function AudioPlayer({ src, title, subtitle, autoStart = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<PlaybackStatus>("loading");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Spectacle keeps *every* slide's children mounted (each renders into its own
  // portal), so a plain mount effect would autostart on deck load and keep
  // playing across slides. SlideContext.isSlideActive tells us when this slide
  // is the one on screen. Outside a Slide the context is null, so we treat the
  // player as always active (usable standalone).
  const slideContext = useContext(SlideContext);
  const isSlideActive = slideContext ? slideContext.isSlideActive : true;

  const activeRef = useRef(isSlideActive);
  activeRef.current = isSlideActive;
  const wasActiveRef = useRef(false);
  const lastPublishedSecondRef = useRef(-1);

  // Publish playback to the remote controller (via a window event that the
  // presenter websocket bridge forwards). Only the active slide publishes, so
  // the phone only shows controls for the audio that is actually on screen.
  const publishState = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const detail: RemoteAudioState = {
      hasAudio: true,
      playing: !audio.paused && !audio.ended,
      muted: audio.muted,
      volume: audio.volume,
      currentTime: audio.currentTime,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      title,
      subtitle,
    };

    window.dispatchEvent(new CustomEvent<RemoteAudioState>(REMOTE_AUDIO_STATE_EVENT, { detail }));
  }, [subtitle, title]);

  const publishCleared = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent<RemoteAudioState>(REMOTE_AUDIO_STATE_EVENT, {
        detail: { hasAudio: false, playing: false, muted: false, volume: 1, currentTime: 0, duration: 0 },
      }),
    );
  }, []);

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
      setCurrentTime(0);
      if (wasActiveRef.current) {
        wasActiveRef.current = false;
        publishCleared();
      }
      return;
    }

    wasActiveRef.current = true;
    publishState();

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
        // The slide may have deactivated while play() was pending; if so the
        // cleanup already ran, so undo this late start instead of leaking audio.
        if (cancelled) {
          audio.pause();
          audio.currentTime = 0;
          return;
        }
        setStatus("playing");
      } catch {
        // Audible autoplay was blocked. Start muted (always permitted) and
        // unmute the instant the presenter touches the deck.
        try {
          audio.muted = true;
          setMuted(true);
          await audio.play();
          if (cancelled) {
            audio.pause();
            audio.currentTime = 0;
            return;
          }
          setStatus("playing");
          armUnmuteOnGesture();
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
  }, [autoStart, isSlideActive, publishCleared, publishState]);

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

  const onSeek = useCallback(
    (value: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = value;
      setCurrentTime(value);
      if (activeRef.current) publishState();
    },
    [publishState],
  );

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }, []);

  const setVolumeTo = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = clamp01(value);
    audio.volume = next;
    // Raising the volume implies you want to hear it.
    if (next > 0 && audio.muted) {
      audio.muted = false;
      setMuted(false);
    }
    setVolume(next);
  }, []);

  // Respond to remote audio commands, but only on the active slide so a phone
  // never drives audio that is off screen.
  useEffect(() => {
    if (!isSlideActive) return undefined;

    const onCommand = (event: Event) => {
      const detail = (event as CustomEvent<RemoteAudioControlMessage>).detail;
      if (!detail) return;

      if (detail.command === "toggle-play") togglePlay();
      else if (detail.command === "toggle-mute") toggleMute();
      else if (detail.command === "seek" && typeof detail.value === "number") onSeek(detail.value);
      else if (detail.command === "volume" && typeof detail.value === "number") setVolumeTo(detail.value);
    };

    window.addEventListener(REMOTE_AUDIO_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(REMOTE_AUDIO_COMMAND_EVENT, onCommand);
  }, [isSlideActive, onSeek, setVolumeTo, toggleMute, togglePlay]);

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
          setVolume(event.currentTarget.volume);
          if (status === "loading") setStatus("paused");
          if (activeRef.current) publishState();
        }}
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime;
          setCurrentTime(time);
          // Throttle remote updates to whole-second changes.
          const second = Math.floor(time);
          if (activeRef.current && second !== lastPublishedSecondRef.current) {
            lastPublishedSecondRef.current = second;
            publishState();
          }
        }}
        onPlay={() => {
          setStatus("playing");
          if (activeRef.current) publishState();
        }}
        onPause={() => {
          setStatus((current) => (current === "blocked" ? current : "paused"));
          if (activeRef.current) publishState();
        }}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
          if (activeRef.current) publishState();
        }}
        onEnded={() => {
          setStatus("paused");
          if (activeRef.current) publishState();
        }}
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
          style={{ "--audio-progress": `${progress}%` } as CSSProperties}
          type="range"
          value={Math.min(currentTime, duration || 0)}
        />
        <span className="audio-player__time">{formatTime(duration)}</span>
      </div>

      <p className="audio-player__status" role="status">
        {muted ? statusLabel[status] : `${statusLabel[status]} · vol ${Math.round(volume * 100)}%`}
      </p>
    </div>
  );
}
