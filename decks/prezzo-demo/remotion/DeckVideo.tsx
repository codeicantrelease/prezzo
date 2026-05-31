import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type DeckVideoProps = {
  title: string;
  subtitle: string;
};

export function DeckVideo({ title, subtitle }: DeckVideoProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 14, mass: 0.7 } });
  const lineWidth = interpolate(frame, [30, 115], [0, 760], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(frame, [72, 128], [90, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#101418",
        color: "#f8f3e7",
        fontFamily: "Inter, Avenir Next, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(135deg, rgba(255,90,54,0.9), rgba(31,157,136,0.72))",
          clipPath: "polygon(52% 0, 100% 0, 100% 100%, 34% 100%)",
        }}
      />
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "0 150px",
          position: "relative",
          transform: `scale(${scale})`,
          transformOrigin: "left center",
          width: 1200,
        }}
      >
        <div style={{ color: "#f3b23a", fontSize: 34, fontWeight: 900 }}>
          rendered with Remotion
        </div>
        <h1 style={{ fontSize: 172, lineHeight: 0.92, margin: "26px 0 28px" }}>{title}</h1>
        <div style={{ height: 8, width: lineWidth, background: "#ff5a36", marginBottom: 34 }} />
        <p style={{ color: "rgba(248,243,231,0.82)", fontSize: 54, margin: 0 }}>{subtitle}</p>
      </div>
      <div
        style={{
          background: "rgba(248,243,231,0.95)",
          borderRadius: 8,
          bottom: 110,
          boxShadow: "0 36px 90px rgba(0,0,0,0.28)",
          color: "#101418",
          padding: 38,
          position: "absolute",
          right: 132,
          transform: `translateY(${cardY}px)`,
          width: 420,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 10 }}>video layer</div>
        <div style={{ color: "rgba(16,20,24,0.68)", fontSize: 24 }}>
          frame-perfect, data-driven, reusable in the live deck
        </div>
      </div>
    </AbsoluteFill>
  );
}
