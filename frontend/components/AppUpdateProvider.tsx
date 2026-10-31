"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  checkForUpdate,
  getAppInfo,
  getUpdateRepo,
  installLatestRelease,
  isNativeApp,
  saveUpdateRepo,
  type AppInfo,
  type LatestRelease,
  type UpdateCheckResult,
} from "@/lib/updater";

export type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "current"; latest: LatestRelease }
  | { phase: "available"; result: UpdateCheckResult }
  | { phase: "installing"; result: UpdateCheckResult }
  | { phase: "needs-permission"; result: UpdateCheckResult }
  | { phase: "error"; message: string }
  | { phase: "message"; message: string };

type AppUpdateContextValue = {
  repo: string;
  appInfo: AppInfo | null;
  isNative: boolean;
  state: UpdateState;
  setRepo: (value: string) => void;
  checkNow: (repoValue?: string) => Promise<void>;
  install: () => Promise<void>;
};

const AppUpdateContext =
  createContext<AppUpdateContextValue | null>(null);

export function AppUpdateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [repo, setRepoState] = useState(getUpdateRepo);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const isNative = useMemo(() => isNativeApp(), []);
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const activeRequestRef = useRef(0);

  useEffect(() => {
    if (!isNative) {
      return;
    }
    let active = true;
    getAppInfo()
      .then((info) => {
        if (active) {
          setAppInfo(info);
        }
      })
      .catch(() => {
        // The update panel still works with the GitHub release feed.
      });
    return () => {
      active = false;
    };
  }, [isNative]);

  const runCheck = useCallback(async (repoValue: string) => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setState({ phase: "checking" });
    try {
      const result = await checkForUpdate(repoValue);
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setAppInfo(result.current);
      setState(
        result.hasUpdate
          ? { phase: "available", result }
          : { phase: "current", latest: result.latest },
      );
    } catch (error) {
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setState({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "检查更新失败，请稍后重试。",
      });
    }
  }, []);

  useEffect(() => {
    if (!isNative || !repo) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void runCheck(repo);
    }, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [isNative, repo, runCheck]);

  const setRepo = useCallback((value: string) => {
    const saved = saveUpdateRepo(value);
    setRepoState(saved);
    if (state.phase !== "idle") {
      setState({ phase: "idle" });
    }
  }, [state.phase]);

  const checkNow = useCallback(async (repoValue?: string) => {
    const requestedRepo = saveUpdateRepo(repoValue ?? repo);
    if (!requestedRepo) {
      setState({
        phase: "error",
        message: "请先填写公开发布 APK 的 GitHub 仓库。",
      });
      return;
    }
    if (requestedRepo !== repo) {
      setRepoState(requestedRepo);
    }
    await runCheck(requestedRepo);
  }, [repo, runCheck]);

  const install = useCallback(async () => {
    const result =
      state.phase === "available" || state.phase === "needs-permission"
        ? state.result
        : null;
    if (!result) {
      return;
    }
    setState({ phase: "installing", result });
    try {
      const installResult = await installLatestRelease(result.latest);
      if (installResult === "permission") {
        setState({ phase: "needs-permission", result });
      } else {
        setState({
          phase: "message",
          message:
            installResult === "web"
              ? "已打开 GitHub Release 页面。"
              : "安装包已下载，请在系统确认窗口中完成更新。",
        });
      }
    } catch (error) {
      setState({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "下载更新失败，请稍后重试。",
      });
    }
  }, [state]);

  const value = useMemo<AppUpdateContextValue>(
    () => ({
      repo,
      appInfo,
      isNative,
      state,
      setRepo,
      checkNow,
      install,
    }),
    [appInfo, checkNow, install, isNative, repo, setRepo, state],
  );

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
    </AppUpdateContext.Provider>
  );
}

export function useAppUpdate(): AppUpdateContextValue {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error(
      "useAppUpdate must be used inside AppUpdateProvider.",
    );
  }
  return context;
}
