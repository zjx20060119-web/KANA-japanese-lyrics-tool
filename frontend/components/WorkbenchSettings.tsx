"use client";

import { useEffect, useState } from "react";

import { useAppUpdate } from "@/components/AppUpdateProvider";
import { useDisplaySettings } from "@/components/DisplaySettingsProvider";

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
    </svg>
  );
}

function SliderRow({
  label,
  value,
  minimum,
  maximum,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-xs font-medium text-ink">
        {label}
        <span className="tabular-nums text-muted">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={minimum}
        max={maximum}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-6 w-full cursor-pointer accent-[#ff0000]"
      />
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-lg text-left transition hover:bg-surface"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-muted">
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${
          checked ? "bg-brand" : "bg-surface-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function UpdatePanel() {
  const {
    repo,
    appInfo,
    isNative,
    state,
    checkNow,
    install,
  } = useAppUpdate();
  const [repoDraft, setRepoDraft] = useState(repo);

  const latest =
    state.phase === "available" ||
    state.phase === "installing" ||
    state.phase === "needs-permission"
      ? state.result.latest
      : state.phase === "current"
        ? state.latest
        : null;

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink">版本与更新</h3>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            从 GitHub 公共 Release 检查更新
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[10px] text-muted">
          {appInfo
            ? `v${appInfo.versionName}`
            : isNative
              ? "读取中"
              : "网页版"}
        </span>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium text-ink">
          GitHub 仓库
        </span>
        <input
          type="text"
          value={repoDraft}
          onChange={(event) => setRepoDraft(event.target.value)}
          placeholder="用户名/仓库名"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ink focus:bg-canvas"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void checkNow(repoDraft)}
          disabled={state.phase === "checking" || state.phase === "installing"}
          className="h-9 rounded-full bg-ink px-4 text-xs font-medium text-white transition hover:bg-[#272727] disabled:cursor-wait disabled:opacity-55"
        >
          {state.phase === "checking" ? "正在检查…" : "保存并检查"}
        </button>
        {(state.phase === "available" ||
          state.phase === "needs-permission") && (
          <button
            type="button"
            onClick={() => void install()}
            className="h-9 rounded-full bg-brand px-4 text-xs font-medium text-white transition hover:bg-brand-hover"
          >
            {isNative ? "下载并安装" : "打开 Release"}
          </button>
        )}
      </div>

      <div aria-live="polite" className="mt-3">
        {state.phase === "checking" && (
          <p className="text-xs leading-5 text-muted">正在连接 GitHub…</p>
        )}
        {state.phase === "current" && (
          <p className="rounded-md bg-[#f1faf3] px-3 py-2 text-xs leading-5 text-success">
            已是最新版本 v{state.latest.version.replace(/^v/i, "")}。
          </p>
        )}
        {state.phase === "available" && latest && (
          <div className="rounded-md border border-line bg-surface px-3 py-3">
            <p className="text-xs font-medium text-ink">
              发现新版本 {latest.version}
            </p>
            {latest.notes && (
              <p className="mt-1 whitespace-pre-line text-[11px] leading-5 text-muted">
                {latest.notes.slice(0, 280)}
                {latest.notes.length > 280 ? "…" : ""}
              </p>
            )}
            {!latest.apkUrl && (
              <p className="mt-2 text-[11px] leading-5 text-brand">
                这个 Release 尚未附带 APK。
              </p>
            )}
          </div>
        )}
        {state.phase === "installing" && (
          <p className="text-xs leading-5 text-muted">
            正在下载安装包，完成后会打开系统安装界面…
          </p>
        )}
        {state.phase === "needs-permission" && (
          <p className="rounded-md bg-[#fff8ed] px-3 py-2 text-xs leading-5 text-[#8a4f00]">
            请在系统设置中允许“安装未知应用”，然后返回点击“下载并安装”。
          </p>
        )}
        {(state.phase === "error" || state.phase === "message") && (
          <p
            role={state.phase === "error" ? "alert" : "status"}
            className={`rounded-md px-3 py-2 text-xs leading-5 ${
              state.phase === "error"
                ? "border border-brand/20 bg-[#fff5f5] text-brand"
                : "bg-[#f1faf3] text-success"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>

      <p className="mt-3 text-[10px] leading-4 text-muted">
        Android 会显示系统安装确认；新 APK 必须使用与当前版本相同的签名，并递增
        versionCode。
      </p>
    </div>
  );
}

export default function WorkbenchSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const { settings, updateSettings, resetSettings } =
    useDisplaySettings();
  const { state: updateState } = useAppUpdate();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="workbench-settings-panel"
        aria-label="打开设置"
        title="设置"
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
      >
        <MenuIcon />
        {updateState.phase === "available" && (
          <span
            aria-label="有可用更新"
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-canvas"
          />
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="关闭设置"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <section
            id="workbench-settings-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-2xl bg-canvas p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.14)] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[380px] sm:max-h-none sm:rounded-none sm:rounded-l-2xl sm:p-6 sm:pb-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="settings-title" className="text-lg font-medium">
                  设置
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted">
                  显示修改会立即应用到注音工作台和歌词一览。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-muted transition hover:text-ink"
                aria-label="关闭显示设置"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="text-[11px] font-medium tracking-[0.08em] text-muted">
                显示内容
              </p>
              <div className="mt-2">
                <ToggleRow
                  label="显示罗马音"
                  description="在每行歌词下方显示罗马音"
                  checked={settings.showRomaji}
                  onChange={(showRomaji) =>
                    updateSettings({ showRomaji })
                  }
                />
                <ToggleRow
                  label="显示翻译"
                  description="显示已经生成的逐行中文翻译"
                  checked={settings.showTranslation}
                  onChange={(showTranslation) =>
                    updateSettings({ showTranslation })
                  }
                />
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="text-[11px] font-medium tracking-[0.08em] text-muted">
                字号
              </p>
              <div className="mt-3 space-y-5">
                <SliderRow
                  label="歌词字号"
                  value={settings.lyricSize}
                  minimum={16}
                  maximum={36}
                  onChange={(lyricSize) => updateSettings({ lyricSize })}
                />
                <SliderRow
                  label="罗马音字号"
                  value={settings.romajiSize}
                  minimum={10}
                  maximum={20}
                  onChange={(romajiSize) => updateSettings({ romajiSize })}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="text-[11px] font-medium tracking-[0.08em] text-muted">
                间距
              </p>
              <div className="mt-3 space-y-5">
                <SliderRow
                  label="歌词行间距"
                  value={settings.rowGap}
                  minimum={0}
                  maximum={48}
                  onChange={(rowGap) => updateSettings({ rowGap })}
                />
                <SliderRow
                  label="歌词 ↔ 罗马音"
                  value={settings.romajiGap}
                  minimum={-8}
                  maximum={24}
                  onChange={(romajiGap) => updateSettings({ romajiGap })}
                />
                <SliderRow
                  label="罗马音 ↔ 翻译"
                  value={settings.translationGap}
                  minimum={-8}
                  maximum={32}
                  onChange={(translationGap) =>
                    updateSettings({ translationGap })
                  }
                />
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm font-medium text-ink">逐行翻译</h3>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                在注音结果或歌词一览中点击“翻译歌词”。结果会缓存，也可以通过上方开关隐藏或重新显示。
              </p>
              <p className="mt-2 text-[10px] leading-4 text-muted">
                微软翻译在线优先；请求失败时自动使用离线词典。歌词行会发送到微软翻译服务。
              </p>
            </div>

            <UpdatePanel />

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-[11px] leading-5 text-muted">
                设置保存在当前浏览器。
              </p>
              <button
                type="button"
                onClick={resetSettings}
                className="h-9 shrink-0 rounded-full bg-surface px-4 text-xs font-medium text-muted transition hover:text-ink"
              >
                恢复默认
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
