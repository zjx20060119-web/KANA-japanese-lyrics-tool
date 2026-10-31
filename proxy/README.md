# KANA 歌词搜索代理

Cloudflare Worker 代理用于加速 LRCLIB 搜索：

- `/search?q=...` 只返回歌曲元数据，不返回歌词正文
- `/source/{id}` 只在用户选中歌曲后返回歌词
- 响应带 CORS 和缓存头

## 部署

```powershell
cd proxy
npx wrangler login
npx wrangler deploy
```

部署完成后，将终端输出的 Workers URL 写入 `frontend/.env.local`：

```env
NEXT_PUBLIC_LYRICS_PROXY_URL=https://kana-lyrics-proxy.<你的子域>.workers.dev
```

然后重新生成 APK：

```powershell
cd frontend
npm run build:apk
```
