"use client";

import type { ReactNode } from "react";

import { useDisplaySettings } from "@/components/DisplaySettingsProvider";

function RomajiIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16V4h5.2a3.5 3.5 0 0 1 0 7H4.5" />
      <path d="m9.7 11 5.8 5" />
    </svg>
  );
}

function TranslationIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4h8M7 2.5V4M9.5 4c-.5 3-2.2 5.3-5.5 7" />
      <path d="M5.5 7.2c1.1 1.7 2.7 2.9 4.8 3.5M12 17l3-7 3 7M13.1 14.5h3.8" />
    </svg>
  );
}

function VisibilityButton({
  visible,
  label,
  onClick,
  children,
}: {
  visible: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={visible}
      aria-label={`${visible ? "隐藏" : "显示"}${label}`}
      title={`${visible ? "隐藏" : "显示"}${label}`}
      onClick={onClick}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
        visible
          ? "border-ink bg-ink text-white"
          : "border-line bg-canvas text-muted hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function HeaderVisibilityToggles() {
  const { settings, updateSettings } = useDisplaySettings();

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      aria-label="阅读内容显示设置"
    >
      <VisibilityButton
        visible={settings.showRomaji}
        label="罗马音"
        onClick={() =>
          updateSettings({ showRomaji: !settings.showRomaji })
        }
      >
        <RomajiIcon />
      </VisibilityButton>
      <VisibilityButton
        visible={settings.showTranslation}
        label="翻译"
        onClick={() =>
          updateSettings({
            showTranslation: !settings.showTranslation,
          })
        }
      >
        <TranslationIcon />
      </VisibilityButton>
    </div>
  );
}
