import type { LyricsDocument } from "@/lib/types";

type AnalyzeInput = {
  text: string;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
};

type WorkerResponse =
  | { id: number; ok: true; document: LyricsDocument }
  | { id: number; ok: false; message: string };

type PendingRequest = {
  resolve: (document: LyricsDocument) => void;
  reject: (error: Error) => void;
  abortHandler?: () => void;
  signal?: AbortSignal;
};

let worker: Worker | null = null;
let requestSequence = 0;
const pendingRequests = new Map<number, PendingRequest>();

function rejectAllPending(message: string): void {
  for (const pending of pendingRequests.values()) {
    pending.signal?.removeEventListener("abort", pending.abortHandler ?? (() => {}));
    pending.reject(new Error(message));
  }
  pendingRequests.clear();
}

function getWorker(): Worker {
  if (worker) {
    return worker;
  }

  worker = new Worker(
    new URL("../workers/offlineAnalyzer.worker.ts", import.meta.url),
    { type: "module" },
  );

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const pending = pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    pendingRequests.delete(response.id);
    pending.signal?.removeEventListener(
      "abort",
      pending.abortHandler ?? (() => {}),
    );

    if (response.ok) {
      pending.resolve(response.document);
    } else {
      pending.reject(new Error(response.message));
    }
  };

  worker.onerror = () => {
    rejectAllPending("离线注音引擎加载失败，请刷新页面后重试。");
    worker?.terminate();
    worker = null;
  };

  return worker;
}

export function analyzeLyricsLocally(
  input: AnalyzeInput,
  signal?: AbortSignal,
): Promise<LyricsDocument> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  const id = ++requestSequence;
  const activeWorker = getWorker();

  return new Promise<LyricsDocument>((resolve, reject) => {
    const pending: PendingRequest = { resolve, reject, signal };

    if (signal) {
      pending.abortHandler = () => {
        if (!pendingRequests.delete(id)) {
          return;
        }
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", pending.abortHandler, { once: true });
    }

    pendingRequests.set(id, pending);
    activeWorker.postMessage({
      id,
      text: input.text,
      title: input.title ?? null,
      artist: input.artist ?? null,
      album: input.album ?? null,
    });
  });
}
