/**
 * A tiny trend line with a filled area and a dot on the latest value. Values
 * are drawn on a fixed 0-100 scale, since everything it shows is a percentage.
 */
export function Sparkline({
  values,
  label,
  width = 96,
  height = 28,
}: {
  values: number[];
  /** For screen readers, e.g. "Attendance over the last 6 meetings". */
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const pad = 3;
  const x = (i: number) => (i * (width - pad * 2)) / (values.length - 1) + pad;
  const y = (v: number) => height - pad - (v / 100) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="shrink-0 overflow-visible text-primary"
    >
      <polygon
        points={`${x(0)},${height - pad} ${points} ${x(last)},${height - pad}`}
        fill="currentColor"
        fillOpacity={0.12}
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last)} cy={y(values[last])} r={3} fill="currentColor" />
    </svg>
  );
}
