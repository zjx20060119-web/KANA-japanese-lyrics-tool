import { Capacitor, registerPlugin } from "@capacitor/core";

const DEFAULT_UPDATE_REPO = (
  process.env.NEXT_PUBLIC_UPDATE_REPO ?? ""
).trim();
const REPO_STORAGE_KEY = "kana:update-repo:v1";
const GITHUB_API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 12_000;

type NativeUpdaterPlugin = {
  getInfo(): Promise<{
    versionName: string;
    versionCode: number;
  }>;
  downloadAndInstall(options: {
    url: string;
    fileName: string;
  }): Promise<{
    started: boolean;
    requiresPermission: boolean;
    location?: string;
  }>;
};

const NativeUpdater =
  registerPlugin<NativeUpdaterPlugin>("AppUpdater");

export type AppInfo = {
  versionName: string;
  versionCode: number;
};

export type LatestRelease = {
  repo: string;
  version: string;
  title: string;
  notes: string;
  releaseUrl: string;
  publishedAt: string | null;
  apkUrl: string | null;
  apkName: string | null;
};

export type UpdateCheckResult = {
  current: AppInfo | null;
  latest: LatestRelease;
  hasUpdate: boolean;
};

function isValidRepo(value: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

export function normalizeRepo(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
}

export function getUpdateRepo(): string {
  if (typeof window === "undefined") {
    return normalizeRepo(DEFAULT_UPDATE_REPO);
  }
  try {
    return (
      normalizeRepo(
        window.localStorage.getItem(REPO_STORAGE_KEY) ?? "",
      ) || normalizeRepo(DEFAULT_UPDATE_REPO)
    );
  } catch {
    return normalizeRepo(DEFAULT_UPDATE_REPO);
  }
}

export function saveUpdateRepo(value: string): string {
  const repo = normalizeRepo(value);
  if (typeof window !== "undefined") {
    try {
      if (repo) {
        window.localStorage.setItem(REPO_STORAGE_KEY, repo);
      } else {
        window.localStorage.removeItem(REPO_STORAGE_KEY);
      }
    } catch {
      // The selected repository still applies for this session.
    }
  }
  return repo;
}

export function isNativeApp(): boolean {
  return (
    typeof window !== "undefined" && Capacitor.isNativePlatform()
  );
}

export async function getAppInfo(): Promise<AppInfo | null> {
  if (!isNativeApp()) {
    return null;
  }
  return NativeUpdater.getInfo();
}

function parseVersion(value: string): {
  numbers: number[];
  prerelease: string;
} {
  const normalized = value.trim().replace(/^v/i, "");
  const [main, prerelease = ""] = normalized.split("-", 2);
  return {
    numbers: main.split(".").map((part) => {
      const match = part.match(/^\d+/);
      return match ? Number(match[0]) : 0;
    }),
    prerelease,
  };
}

export function isNewerVersion(
  latest: string,
  installed: string,
): boolean {
  const next = parseVersion(latest);
  const current = parseVersion(installed);
  const length = Math.max(next.numbers.length, current.numbers.length);

  for (let index = 0; index < length; index += 1) {
    const nextPart = next.numbers[index] ?? 0;
    const currentPart = current.numbers[index] ?? 0;
    if (nextPart !== currentPart) {
      return nextPart > currentPart;
    }
  }

  if (!next.prerelease && current.prerelease) {
    return true;
  }
  if (next.prerelease && !current.prerelease) {
    return false;
  }
  return next.prerelease.localeCompare(current.prerelease) > 0;
}

async function fetchLatestRelease(
  repo: string,
): Promise<LatestRelease> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${repo}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (response.status === 404) {
      throw new Error(
        "没有找到公开发布版本，请确认仓库名称和 Release 状态。",
      );
    }
    if (response.status === 403) {
      throw new Error("GitHub 更新检查请求过多，请稍后再试。");
    }
    if (!response.ok) {
      throw new Error(`GitHub 更新检查失败（HTTP ${response.status}）。`);
    }

    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) {
      throw new Error("GitHub 返回了无法识别的版本信息。");
    }
    const record = payload as Record<string, unknown>;
    if (
      typeof record.tag_name !== "string" ||
      typeof record.html_url !== "string"
    ) {
      throw new Error("GitHub Release 缺少版本号或发布地址。");
    }

    const assets = Array.isArray(record.assets)
      ? record.assets.filter(
          (asset): asset is Record<string, unknown> =>
            typeof asset === "object" &&
            asset !== null &&
            typeof (asset as Record<string, unknown>).name === "string" &&
            typeof (asset as Record<string, unknown>)
              .browser_download_url === "string",
        )
      : [];
    const apkAssets = assets.filter((asset) =>
      String(asset.name).toLowerCase().endsWith(".apk"),
    );
    const apk =
      apkAssets.find(
        (asset) =>
          String(asset.name).toLowerCase() === "kana.apk",
      ) ?? apkAssets[0];

    return {
      repo,
      version: record.tag_name,
      title:
        typeof record.name === "string" && record.name.trim()
          ? record.name.trim()
          : record.tag_name,
      notes: typeof record.body === "string" ? record.body.trim() : "",
      releaseUrl: record.html_url,
      publishedAt:
        typeof record.published_at === "string"
          ? record.published_at
          : null,
      apkUrl: apk ? String(apk.browser_download_url) : null,
      apkName: apk ? String(apk.name) : null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("GitHub 更新检查超时，请检查网络后重试。");
    }
    if (error instanceof TypeError) {
      throw new Error("无法连接 GitHub，请检查网络后重试。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkForUpdate(
  repoValue: string,
): Promise<UpdateCheckResult> {
  const repo = normalizeRepo(repoValue);
  if (!isValidRepo(repo)) {
    throw new Error("请填写 GitHub 仓库，格式为“用户名/仓库名”。");
  }

  const [current, latest] = await Promise.all([
    getAppInfo().catch(() => null),
    fetchLatestRelease(repo),
  ]);

  return {
    current,
    latest,
    hasUpdate: current
      ? isNewerVersion(latest.version, current.versionName)
      : true,
  };
}

export async function installLatestRelease(
  release: LatestRelease,
): Promise<"installer" | "permission" | "web"> {
  if (!isNativeApp()) {
    window.open(release.releaseUrl, "_blank", "noopener,noreferrer");
    return "web";
  }
  if (!release.apkUrl) {
    throw new Error("这个 Release 没有附带 APK 文件。");
  }

  const result = await NativeUpdater.downloadAndInstall({
    url: release.apkUrl,
    fileName: release.apkName ?? "KANA.apk",
  });
  return result.requiresPermission ? "permission" : "installer";
}
