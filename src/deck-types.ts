import type { ComponentType } from "react";

export type RemotionDeckConfig = {
  id: string;
  component: ComponentType<any>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  defaultProps?: Record<string, unknown>;
};

export type DeckConfig = {
  slug: string;
  label: string;
  description?: string;
  slideCount?: number;
  component: ComponentType;
  remotion?: RemotionDeckConfig;
};
