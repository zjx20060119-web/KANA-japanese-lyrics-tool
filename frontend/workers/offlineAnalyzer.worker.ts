import { analyzeLyricsOffline } from "../lib/offlineAnalyzer";
import type { LyricsDocument } from "../lib/types";

type AnalyzeRequest = {
  id: number;
  text: string;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
};

type AnalyzeResponse =
  | { id: number; ok: true; document: LyricsDocument }
  | { id: number; ok: false; message: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<AnalyzeRequest>) => void) | null;
  postMessage: (message: AnalyzeResponse) => void;
};

workerScope.onmessage = (event) => {
  void (async () => {
    const request = event.data;
    try {
      const document = await analyzeLyricsOffline(request);
      workerScope.postMessage({ id: request.id, ok: true, document });
    } catch (error) {
      workerScope.postMessage({
        id: request.id,
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "离线注音分析失败。",
      });
    }
  })();
};
