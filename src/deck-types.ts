import type { ComponentType } from "react";

export type PrezzoDeckRuntimeProps = {
  remote?: {
    enabled: boolean;
    slideCount?: number;
    slug: string;
  };
};

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
  presenterNotes?: string[];
  component: ComponentType<PrezzoDeckRuntimeProps>;
  runtime?: {
    hiddenPages?: {
      dubdubtok?: {
        enabled: boolean;
        imageUrl: string;
        pieceImageUrl?: string;
        sourceAspectRatio?: number;
        targetRotationDegrees?: number;
        targetPercent?: number;
        targetYPercent?: number;
        toleranceDegrees?: number;
      };
      blackjack?: {
        enabled: boolean;
      };
    };
    timer?: {
      enabled: boolean;
      mode?: "elapsed" | "countdown";
      durationMinutes?: number;
    };
    terminal?: {
      enabled: boolean;
    };
  };
  remotion?: RemotionDeckConfig;
};
