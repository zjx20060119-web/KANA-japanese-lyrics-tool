export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
};

export type AnalysisStatus = "idle" | "processing" | "success" | "error";

export type AnalysisWarning = {
  code: string;
  message: string;
  line_index: number | null;
  segment_index: number | null;
};

export type LyricsSegment = {
  id: string;
  segment_index: number;
  surface: string;
  part_of_speech: string | null;
  part_of_speech_detail: string[];
  dictionary_form: string | null;
  detected_reading: string | null;
  confirmed_reading: string | null;
  effective_reading: string | null;
  reading_source: string | null;
  reading_type: string | null;
  needs_review: boolean;
  is_oov: boolean;
  notes: string[];
};

export type LyricsLine = {
  id: string;
  line_index: number;
  original_text: string;
  segments: LyricsSegment[];
  romaji: string;
  is_blank: boolean;
};

export type LyricsDocument = {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  source_url: string | null;
  original_text: string;
  lines: LyricsLine[];
  created_at: string | null;
  updated_at: string | null;
  warnings: AnalysisWarning[];
};

export type LyricsSearchResult = {
  source: "lrclib";
  source_id: string;
  title: string;
  artist: string;
  album: string | null;
  duration_seconds: number | null;
  has_plain_lyrics: boolean;
  has_synced_lyrics: boolean;
};

export type LyricsSearchResponse = {
  query: string;
  results: LyricsSearchResult[];
  manual_paste_fallback: boolean;
};

export type LyricsSourceContent = {
  source: "lrclib";
  source_id: string;
  title: string;
  artist: string;
  album: string | null;
  lyrics_text: string;
  source_url: string;
  attribution: string;
  has_synced_lyrics: boolean;
};

export type SavedDocumentSummary = {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  source_url: string | null;
  preview: string;
  line_count: number;
  confirmed_count: number;
  revision: number;
  is_favorite: boolean;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedDocumentDetail = {
  summary: SavedDocumentSummary;
  document: LyricsDocument;
};

export type SavedDocumentList = {
  documents: SavedDocumentSummary[];
};
