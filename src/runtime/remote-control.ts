import type { RemoteAudioState, RemoteDeckState } from "./remote-types";

export type { RemoteAudioState, RemoteDeckState } from "./remote-types";

export type RemoteAudioCommand = "toggle-play" | "toggle-mute" | "seek" | "volume";

export type RemoteAudioControlMessage = {
  command: RemoteAudioCommand;
  type: "audio-control";
  value?: number;
};

export type RemoteAccessDetails = {
  controlUrls: string[];
  pin: string;
  remoteUrl: string;
};

export type RemoteControlCommand = {
  command: "goto" | "next" | "previous";
  slideIndex?: number;
  stepIndex?: number;
  type: "control";
};

export type RemotePresenterStateMessage = {
  slideCount: number;
  slideIndex: number;
  stepIndex: number;
  type: "presenter-state";
};

export type RemoteServerMessage =
  | {
      state: RemoteDeckState | null;
      type: "hello" | "state";
    }
  | {
      command: "goto" | "next" | "previous";
      slideIndex?: number;
      stepIndex?: number;
      type: "control";
    }
  | {
      controllers: number;
      presenters: number;
      type: "connections";
    }
  | {
      audio: RemoteAudioState | null;
      type: "audio-state";
    }
  | {
      command: RemoteAudioCommand;
      type: "audio-control";
      value?: number;
    };

export const REMOTE_CONTROLLER_CONNECTED_EVENT = "prezzo:remote-controller-connected";

// Bridge between the slide-local AudioPlayer and the presenter websocket
// (RemoteDeckBridge), which live in separate component trees. The player
// dispatches REMOTE_AUDIO_STATE_EVENT (detail: RemoteAudioState) when its
// playback changes; the bridge forwards remote commands as
// REMOTE_AUDIO_COMMAND_EVENT (detail: { command, value }).
export const REMOTE_AUDIO_STATE_EVENT = "prezzo:audio-state";
export const REMOTE_AUDIO_COMMAND_EVENT = "prezzo:audio-command";

export function remoteWebSocketUrl(deckSlug: string, role: "controller" | "presenter", token?: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({
    deck: deckSlug,
    role,
  });

  if (token) params.set("token", token);

  return `${protocol}//${window.location.host}/__prezzo_remote/ws?${params.toString()}`;
}

export async function fetchRemotePin() {
  try {
    const response = await fetch("/__prezzo_remote/pin");
    const payload = (await response.json()) as { error?: string; pin?: string };

    if (!response.ok || !payload.pin) {
      throw new Error(payload.error ?? "PIN is not available.");
    }

    return payload.pin;
  } catch (error) {
    if (error instanceof Error && error.message.includes("PIN is not available")) {
      throw error;
    }

    throw new Error("Failed to fetch remote PIN. Check the dev server connection.");
  }
}

export async function fetchRemoteAccess(deckSlug: string) {
  try {
    const response = await fetch(`/__prezzo_remote/access?deck=${encodeURIComponent(deckSlug)}`);
    const payload = (await response.json()) as RemoteAccessDetails & { error?: string };

    if (!response.ok || !payload.remoteUrl || !payload.pin || !Array.isArray(payload.controlUrls)) {
      throw new Error(payload.error ?? "Remote access details are not available.");
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.includes("not available")) {
      throw error;
    }

    throw new Error("Failed to fetch remote access details. Check the dev server connection.");
  }
}
