"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useDisplaySettings } from "@/components/DisplaySettingsProvider";
import {
  saveTranslationCache,
  translateDocumentHybrid,
  type TranslationEngine,
} from "@/lib/translationClient";
import type { LyricsDocument, LyricsLine } from "@/lib/types";

type TranslationState =
  | { phase: "idle" }
  | { phase: "loading" }
  | {
      phase: "success";
      engine: TranslationEngine;
      translations: Record<string, string>;
    }
  | { phase: "error"; message: string };

type TranslationContextValue = {
  state: TranslationState;
  isVisible: boolean;
  start: () => void;
  show: () => void;
  hide: () => void;
  retry: () => void;
  translationFor: (line: LyricsLine) => string;
};

const TranslationContext =
  createContext<TranslationContextValue | null>(null);

function getTranslationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "翻译暂时不可用，请稍后重试。";
}

export function TranslationProvider({
  document,
  children,
}: {
  document: LyricsDocument;
  children: ReactNode;
}) {
  const [state, setState] = useState<TranslationState>({ phase: "idle" });
  const { settings, updateSettings } = useDisplaySettings();
  const isVisible = settings.showTranslation;

  const start = useCallback(() => {
    updateSettings({ showTranslation: true });
    setState((current) => {
      if (current.phase === "loading" || current.phase === "success") {
        return current;
      }
      return { phase: "loading" };
    });
  }, [updateSettings]);

  useEffect(() => {
    if (state.phase !== "loading") {
      return;
    }

    let active = true;
    translateDocumentHybrid(document)
      .then((result) => {
        if (!active) {
          return;
        }
        if (Object.keys(result.translations).length === 0) {
          setState({
            phase: "error",
            message: "这组歌词暂时没有可用的翻译结果。",
          });
          return;
        }
        saveTranslationCache(result.translations);
        setState({
          phase: "success",
          engine: result.engine,
          translations: result.translations,
        });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            phase: "error",
            message: getTranslationErrorMessage(error),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [document, state.phase]);

  const value = useMemo<TranslationContextValue>(
    () => ({
      state,
      isVisible,
      start,
      show: () => updateSettings({ showTranslation: true }),
      hide: () => updateSettings({ showTranslation: false }),
      retry: () => {
        setState({ phase: "loading" });
        updateSettings({ showTranslation: true });
      },
      translationFor: (line) =>
        state.phase === "success"
          ? state.translations[line.original_text] ?? ""
          : "",
    }),
    [isVisible, start, state, updateSettings],
  );

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation(): TranslationContextValue {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error(
      "useTranslation must be used inside TranslationProvider.",
    );
  }
  return context;
}
