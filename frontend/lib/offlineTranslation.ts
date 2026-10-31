import type { LyricsDocument, LyricsLine } from "@/lib/types";

type DictionaryIndex = {
  shards: string[];
};

type DictionaryEntry = [
  surface: string,
  reading: string,
  tags: string[],
  definitions: string[],
  examples: unknown[],
  score?: number,
];

let dictionaryPromise: Promise<Map<string, string[]>> | null = null;

function normalizeGlosses(definitions: string[]): string[] {
  return definitions
    .flatMap((definition) => definition.split(/\r?\n/))
    .map((definition) => definition.trim())
    .filter(Boolean);
}

async function loadShard(fileName: string): Promise<unknown[]> {
  const compressed = await fetch(`/lookup/ja-zh/${fileName}`, {
    cache: "force-cache",
  });
  if (compressed.ok && compressed.body) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("当前浏览器不支持离线词典解压。");
    }
    const decompressed = compressed.body.pipeThrough(
      new DecompressionStream("gzip"),
    );
    return (await new Response(decompressed).json()) as unknown[];
  }

  const plainName = fileName.replace(/\.gz$/, "");
  const plain = await fetch(`/lookup/ja-zh/${plainName}`, {
    cache: "force-cache",
  });
  if (!plain.ok) {
    throw new Error("离线日中词典加载失败。");
  }
  return (await plain.json()) as unknown[];
}

export function loadOfflineDictionary(): Promise<Map<string, string[]>> {
  if (!dictionaryPromise) {
    dictionaryPromise = (async () => {
      try {
        const indexResponse = await fetch("/lookup/ja-zh/index.json", {
          cache: "force-cache",
        });
        if (!indexResponse.ok) {
          throw new Error("离线日中词典索引加载失败。");
        }
        const index = (await indexResponse.json()) as DictionaryIndex;
        if (!Array.isArray(index.shards)) {
          throw new Error("离线日中词典索引格式不正确。");
        }

        const dictionary = new Map<string, string[]>();
        for (const shard of index.shards) {
          const entries = await loadShard(shard);
          for (const value of entries) {
            if (!Array.isArray(value)) {
              continue;
            }
            const entry = value as DictionaryEntry;
            const surface =
              typeof entry[0] === "string" ? entry[0].trim() : "";
            const definitions = Array.isArray(entry[3])
              ? normalizeGlosses(entry[3])
              : [];
            if (surface && definitions.length > 0) {
              dictionary.set(surface, definitions);
            }
          }
        }
        return dictionary;
      } catch (error) {
        dictionaryPromise = null;
        throw error;
      }
    })();
  }
  return dictionaryPromise;
}

function formatDefinition(definitions: string[]): string {
  return definitions.slice(0, 2).join("；");
}

export async function translateLineOffline(
  line: LyricsLine,
  dictionary: Map<string, string[]>,
): Promise<string> {
  if (line.is_blank || !line.original_text.trim()) {
    return "";
  }

  const exact = dictionary.get(line.original_text.trim());
  if (exact) {
    return formatDefinition(exact);
  }

  const glosses: string[] = [];
  const seen = new Set<string>();
  for (const segment of line.segments) {
    if (
      !segment.surface.trim() ||
      ["助詞", "助動詞", "記号"].includes(segment.part_of_speech ?? "")
    ) {
      continue;
    }
    const lookupTerm =
      segment.dictionary_form?.trim() || segment.surface.trim();
    const definitions = dictionary.get(lookupTerm);
    if (!definitions || seen.has(lookupTerm)) {
      continue;
    }
    seen.add(lookupTerm);
    glosses.push(
      `${segment.surface}：${formatDefinition(definitions)}`,
    );
    if (glosses.length >= 6) {
      break;
    }
  }

  return glosses.join("；");
}

export async function translateDocumentOffline(
  document: LyricsDocument,
): Promise<Record<string, string>> {
  return translateLinesOffline(
    document.lines.filter((line) => !line.is_blank),
  );
}

export async function translateLinesOffline(
  lines: LyricsLine[],
): Promise<Record<string, string>> {
  const dictionary = await loadOfflineDictionary();
  const translations: Record<string, string> = {};
  for (const line of lines) {
    if (line.is_blank) {
      continue;
    }
    const translation = await translateLineOffline(line, dictionary);
    if (translation) {
      translations[line.original_text] = translation;
    }
  }
  return translations;
}
