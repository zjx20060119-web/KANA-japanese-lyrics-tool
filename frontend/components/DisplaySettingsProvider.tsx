"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_DISPLAY_SETTINGS,
  loadDisplaySettings,
  normalizeDisplaySettings,
  resetDisplaySettings,
  saveDisplaySettings,
  type DisplaySettings,
} from "@/lib/displaySettings";

type DisplaySettingsContextValue = {
  settings: DisplaySettings;
  updateSettings: (settings: Partial<DisplaySettings>) => void;
  resetSettings: () => void;
};

const DisplaySettingsContext =
  createContext<DisplaySettingsContextValue | null>(null);

export function DisplaySettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<DisplaySettings>(
    DEFAULT_DISPLAY_SETTINGS,
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (active) {
        setSettings(loadDisplaySettings());
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<DisplaySettingsContextValue>(
    () => ({
      settings,
      updateSettings: (patch) => {
        setSettings((current) => {
          const next = normalizeDisplaySettings({
            ...current,
            ...patch,
          });
          saveDisplaySettings(next);
          return next;
        });
      },
      resetSettings: () => {
        setSettings(resetDisplaySettings());
      },
    }),
    [settings],
  );

  return (
    <DisplaySettingsContext.Provider value={value}>
      {children}
    </DisplaySettingsContext.Provider>
  );
}

export function useDisplaySettings(): DisplaySettingsContextValue {
  const context = useContext(DisplaySettingsContext);
  if (!context) {
    throw new Error(
      "useDisplaySettings must be used inside DisplaySettingsProvider.",
    );
  }
  return context;
}
