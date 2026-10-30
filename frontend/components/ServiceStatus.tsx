"use client";

import { useEffect, useState } from "react";

import { fetchHealth, getApiBaseUrl } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

type ConnectionState =
  | { phase: "checking" }
  | { phase: "online"; health: HealthResponse }
  | { phase: "offline"; message: string };

const REQUEST_TIMEOUT_MS = 5000;

type ServiceStatusProps = {
  compact?: boolean;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "连接超时，请确认后端服务已启动。";
  }

  return error instanceof Error ? error.message : "无法连接后端服务。";
}

export default function ServiceStatus({
  compact = false,
}: ServiceStatusProps) {
  const [state, setState] = useState<ConnectionState>({ phase: "checking" });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    fetchHealth(controller.signal)
      .then((health) => {
        if (active) {
          setState({ phase: "online", health });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ phase: "offline", message: getErrorMessage(error) });
        }
      })
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const retryConnection = async () => {
    setState({ phase: "checking" });
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      const health = await fetchHealth(controller.signal);
      setState({ phase: "online", health });
    } catch (error) {
      setState({ phase: "offline", message: getErrorMessage(error) });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const isOnline = state.phase === "online";
  const isChecking = state.phase === "checking";
  const statusLabel = isChecking
    ? "正在连接"
    : isOnline
      ? "服务正常"
      : "服务离线";
  const statusTitle =
    state.phase === "offline" ? state.message : statusLabel;

  if (compact) {
    return (
      <div
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-canvas pl-3 pr-1 text-xs text-muted"
        title={statusTitle}
        aria-live="polite"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isChecking
              ? "animate-breathe bg-warning"
              : isOnline
                ? "bg-success"
                : "bg-brand"
          }`}
        />
        <span>{statusLabel}</span>
        <button
          type="button"
          onClick={() => void retryConnection()}
          disabled={isChecking}
          aria-label="重新检查后端连接"
          title="重新检查后端连接"
          className="grid h-7 w-7 place-items-center rounded-full text-sm text-muted transition hover:bg-surface hover:text-ink disabled:cursor-wait"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 6V2.5L10.9 4.6A5.5 5.5 0 1 0 13 9.5" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-canvas p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isChecking
                ? "animate-breathe bg-warning"
                : isOnline
                  ? "bg-success"
                  : "bg-brand"
            }`}
          />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            {isChecking
              ? "正在检查后端"
              : isOnline
                ? "前后端连接正常"
                : "后端尚未连接"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {state.phase === "online"
              ? `${state.health.service} · v${state.health.version}`
              : "等待后端响应"}
          </p>
        </div>
      </div>

      {state.phase === "offline" && (
        <p className="mt-4 rounded-md border border-brand/20 bg-[#fff5f5] px-3 py-2.5 text-xs leading-5 text-brand">
          {state.message}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void retryConnection()}
          disabled={isChecking}
          className="h-9 rounded-full bg-ink px-4 text-xs font-medium text-white transition hover:bg-[#272727] disabled:cursor-wait disabled:opacity-55"
        >
          {isChecking ? "检查中…" : "重新检查"}
        </button>
        <button
          type="button"
          onClick={() =>
            window.open(
              `${getApiBaseUrl()}/docs`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="rounded-full px-2 py-2 text-xs font-medium text-link underline decoration-link/25 underline-offset-4 transition hover:underline"
        >
          打开 API 文档 ↗
        </button>
      </div>
    </div>
  );
}
