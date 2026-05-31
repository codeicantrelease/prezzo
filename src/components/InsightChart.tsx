import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { name: "Slides", value: 72 },
  { name: "Motion", value: 88 },
  { name: "Video", value: 81 },
  { name: "Agent", value: 93 },
];

export function InsightChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 16, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="rgba(16,20,24,0.13)" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} />
        <YAxis hide domain={[0, 100]} />
        <Tooltip cursor={{ fill: "rgba(31,157,136,0.08)" }} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#ff5a36" />
      </BarChart>
    </ResponsiveContainer>
  );
}
