type SongCoverProps = {
  title: string | null;
  artist: string | null;
  favorite?: boolean;
};

const COVER_SCHEMES = [
  { background: "#0f0f0f", foreground: "#ffffff", accent: "#ff0000" },
  { background: "#ff0000", foreground: "#ffffff", accent: "#0f0f0f" },
  { background: "#1f1f1f", foreground: "#f2f2f2", accent: "#ff4d4d" },
  { background: "#f2f2f2", foreground: "#0f0f0f", accent: "#ff0000" },
] as const;

function colorIndex(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash % COVER_SCHEMES.length;
}

export default function SongCover({
  title,
  artist,
  favorite = false,
}: SongCoverProps) {
  const displayTitle = title || "未命名歌曲";
  const glyph = Array.from(displayTitle.trim())[0] || "歌";
  const scheme = COVER_SCHEMES[colorIndex(displayTitle)];

  return (
    <div
      aria-hidden="true"
      className="relative aspect-video overflow-hidden rounded-xl"
      style={{
        backgroundColor: scheme.background,
        color: scheme.foreground,
      }}
    >
      <span
        className="absolute left-3 top-3 h-1.5 w-8 rounded-full sm:left-4 sm:top-4 sm:h-2 sm:w-10"
        style={{ backgroundColor: scheme.accent }}
      />
      <span className="font-japanese absolute -bottom-4 right-3 text-[4.75rem] leading-none opacity-95 sm:-bottom-6 sm:right-4 sm:text-[6.75rem] xl:-bottom-8 xl:text-[7.5rem]">
        {glyph}
      </span>
      <span className="absolute bottom-3 left-3 max-w-[72%] truncate text-[10px] font-medium tracking-[0.08em] sm:bottom-4 sm:left-4 sm:text-xs">
        {artist || "未知歌手"}
      </span>
      {favorite && (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="absolute right-3 top-3 h-5 w-5 fill-white drop-shadow"
        >
          <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
        </svg>
      )}
    </div>
  );
}
