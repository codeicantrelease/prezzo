import type { SpectacleThemeOverrides } from "spectacle";

export const prezzoTheme: SpectacleThemeOverrides = {
  size: {
    width: 1600,
    height: 900,
    maxCodePaneHeight: 620,
  },
  colors: {
    primary: "#f8f3e7",
    secondary: "#101418",
    tertiary: "#ff5a36",
    quaternary: "#1f9d88",
    quinary: "#f3b23a",
  },
  fonts: {
    header: '"Inter", "Avenir Next", system-ui, sans-serif',
    text: '"Inter", "Avenir Next", system-ui, sans-serif',
    monospace: '"SFMono-Regular", "Cascadia Code", Consolas, monospace',
  },
  fontSizes: {
    h1: "96px",
    h2: "64px",
    h3: "44px",
    text: "32px",
    monospace: "24px",
  },
  space: [0, 8, 16, 24, 32, 48, 64, 96],
};
