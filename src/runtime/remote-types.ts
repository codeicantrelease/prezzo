export type RemoteDeckState = {
  slideCount: number;
  slideIndex: number;
  stepIndex: number;
  updatedAt: number;
};

export type RemoteAudioState = {
  hasAudio: boolean;
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  title?: string;
  subtitle?: string;
  // Slide index the audio belongs to, stamped by the presenter bridge. The
  // controller only shows the panel when this matches the slide it is on, so a
  // dropped "cleared" message can never leave the panel stuck on a silent slide.
  slideIndex?: number;
};
