import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function getBackendBaseUrl(): string {
  return (
    process.env.LYRICS_API_BASE_URL?.trim() || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
}

function getLibraryToken(): string {
  const configuredToken = process.env.LYRICS_LIBRARY_TOKEN?.trim();
  if (configuredToken) {
    return configuredToken;
  }

  try {
    const envPath = join(process.cwd(), "..", "backend", ".env");
    const envContent = readFileSync(envPath, "utf8");
    const match = envContent.match(
      /^\s*APP_ACCESS_TOKEN\s*=\s*(.*)\s*$/m,
    );
    return match?.[1].trim().replace(/^["']|["']$/g, "") ?? "";
  } catch {
    return "";
  }
}

async function proxyLibraryRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const token = getLibraryToken();
  if (!token) {
    return NextResponse.json(
      {
        detail:
          "歌词库服务端尚未配置访问口令。请在 frontend/.env.local 设置 LYRICS_LIBRARY_TOKEN。",
      },
      { status: 503 },
    );
  }

  const { path = [] } = await context.params;
  const suffix = path
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const target = new URL(
    `${getBackendBaseUrl()}/api/documents${suffix ? `/${suffix}` : ""}`,
  );
  target.search = request.nextUrl.search;

  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  });
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    const responseContentType = upstream.headers.get("content-type");
    if (responseContentType) {
      responseHeaders.set("Content-Type", responseContentType);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { detail: "歌词库服务暂时无法连接后端，请确认 FastAPI 正在运行。" },
      { status: 502 },
    );
  }
}

export {
  proxyLibraryRequest as DELETE,
  proxyLibraryRequest as GET,
  proxyLibraryRequest as PATCH,
  proxyLibraryRequest as POST,
  proxyLibraryRequest as PUT,
};
