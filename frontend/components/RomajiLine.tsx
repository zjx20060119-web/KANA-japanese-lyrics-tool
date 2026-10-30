type RomajiLineProps = {
  romaji: string;
  showMarker?: boolean;
  variant?: "default" | "reader";
  fontSize?: number;
};

export default function RomajiLine({
  romaji,
  showMarker = true,
  variant = "default",
  fontSize,
}: RomajiLineProps) {
  const textClass =
    variant === "reader"
      ? "text-[0.82rem] leading-6"
      : "text-xs leading-5";

  return (
    <p
      style={
        fontSize
          ? {
              fontSize: `${fontSize}px`,
              lineHeight: `${Math.round(fontSize * 1.7)}px`,
            }
          : undefined
      }
      className={`font-romaji flex min-w-0 flex-1 items-start gap-2 break-words text-muted [overflow-wrap:anywhere] ${textClass}`}
      aria-label={`罗马音：${romaji || "暂无"}`}
    >
      {showMarker && (
        <span aria-hidden="true" className="pt-0.5 text-brand">
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3v6h8" />
            <path d="m8.5 6.5 3 3-3 3" />
          </svg>
        </span>
      )}
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {romaji || "—"}
      </span>
    </p>
  );
}
