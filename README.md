<div align="center">
  <img src="./docs/app-icon.png" width="96" height="96" alt="KANA 图标" />
  <h1>KANA · 日语歌词智能注音</h1>
  <p>保留原歌词排版，自动生成汉字假名、逐行罗马音与中文翻译。</p>

  [![Next.js](https://img.shields.io/badge/Next.js-16.4-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Android](https://img.shields.io/badge/Android-Capacitor-3DDC84?logo=android&logoColor=white)](https://capacitorjs.com/)
</div>

> 面向个人日语学习与歌词校对的离线优先工具。支持浏览器和 Android APK，歌词库保存在当前设备，不要求注册账号。

## 功能

- **日语歌词注音**：为汉字生成 Ruby 假名，保留原文、换行、空行和标点。
- **逐行罗马音**：每行歌词下方自动显示对应罗马音。
- **人工读音校对**：可以修改单个词的读音、确认系统候选，并自动更新罗马音。
- **多音词提示**：明确标记系统读音、人工确认读音和待检查项目。
- **歌词搜索**：按歌名或歌手从 LRCLIB 查找歌词；失败时仍可手动粘贴。
- **本地歌词库**：保存、搜索、收藏、重命名、复制和删除已生成歌词。
- **歌词一览**：以大字歌名、歌手/专辑、假名注音和罗马音阅读歌词。
- **截图导出**：将当前歌词页导出为 PNG；Android 端保存到 `Pictures/KANA`。
- **混合翻译**：优先使用微软翻译，网络失败时自动回退到本地日中词典。
- **响应式界面**：适配电脑和手机，可独立显示或隐藏罗马音与翻译，并调整字号、行间距和翻译间距。
- **应用内更新**：通过公共 GitHub Release 检查新版本，并由 Android 系统完成安装确认。

## 技术方案

当前 Web 与 APK 主流程采用**离线优先架构**：

- 浏览器端使用 Kuromoji 完成日语分词与读音分析。
- 歌曲、注音结果、人工修正和设置保存在 IndexedDB / localStorage。
- Capacitor 将静态 Next.js 页面封装为 Android APK。
- Cloudflare Worker 可选，用于歌词搜索代理和微软翻译失败后的备用代理。
- 微软翻译只用于逐行中文翻译，不参与假名或罗马音计算。

仓库同时保留 FastAPI + SudachiPy 后端，用于接口开发、测试和服务端部署实验。**当前离线 Web/APK 不要求启动这个后端。**

### 技术栈

| 模块 | 技术 |
| --- | --- |
| Web 界面 | Next.js 16、React 19、TypeScript、Tailwind CSS 4 |
| 日语分析 | Kuromoji、IPADIC 词典 |
| 本地数据 | IndexedDB（Dexie）、localStorage |
| Android | Capacitor 8、Java、Android SDK |
| 在线翻译 | Microsoft Edge 翻译接口，离线词典回退 |
| 可选代理 | Cloudflare Workers |
| 可选后端 | Python、FastAPI、SudachiPy、SQLite |

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- npm 10 或更高版本
- Git

当前已验证环境：

```text
Node.js 24.16.0
npm 11.13.0
```

### 启动网页版

```powershell
git clone https://github.com/<你的用户名>/<仓库名>.git
cd <仓库名>
cd frontend
npm ci
npm run dev
```

打开：

```text
http://localhost:3000
```

首次运行时可以复制环境变量模板：

```powershell
Copy-Item .env.local.example .env.local
```

所有变量都有默认回退值；不使用可选代理或自动更新时，可以保持为空。

### Windows 一键启动

在 Windows 上也可以双击项目根目录的：

```text
启动歌词工具.bat
```

停止服务时双击：

```text
停止歌词工具.bat
```

一键脚本会同时启动前端和可选 FastAPI 后端。后端尚未安装时，建议直接使用上面的 `npm run dev`。

## Android APK

### 构建要求

- Windows
- JDK 21
- Android SDK API 36
- Android Build Tools
- Node.js 22+

构建脚本会读取 `JAVA_HOME` 和 `ANDROID_HOME`；如果项目根目录存在 `.tools/` 本地构建环境，也会自动使用。

```powershell
cd frontend
npm ci
npm run build:apk
```

生成的 APK：

```text
KANA-debug.apk
```

构建 Web 静态版本：

```powershell
npm run build:web
```

同步到 Android 工程：

```powershell
npm run cap:sync
```

### 发布带版本号的 APK

```powershell
npm run build:apk -- -VersionName 1.1.0 -VersionCode 2
```

Android 更新规则：

- `versionCode` 必须递增。
- 新 APK 必须使用与已安装版本相同的签名。
- 当前默认构建使用 debug 签名，适合个人测试。
- 公开分发前建议配置固定的 release keystore，并备份签名文件。

## 环境变量

模板文件：[`frontend/.env.local.example`](./frontend/.env.local.example)

```env
# 可选 FastAPI 后端
NEXT_PUBLIC_API_BASE_URL=
LYRICS_API_BASE_URL=http://127.0.0.1:8000
LYRICS_LIBRARY_TOKEN=

# 可选 Cloudflare Worker：歌词搜索与翻译备用代理
NEXT_PUBLIC_LYRICS_PROXY_URL=

# 可选：公共 GitHub Release 仓库，格式为 owner/repo
NEXT_PUBLIC_UPDATE_REPO=

NEXT_TELEMETRY_DISABLED=1
```

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 否 | 可选 FastAPI 服务地址 |
| `LYRICS_API_BASE_URL` | 否 | Next.js 服务端访问 FastAPI 的地址 |
| `LYRICS_LIBRARY_TOKEN` | 否 | 可选歌词库访问口令；不要提交真实值 |
| `NEXT_PUBLIC_LYRICS_PROXY_URL` | 否 | Cloudflare Worker 地址 |
| `NEXT_PUBLIC_UPDATE_REPO` | 否 | 自动更新使用的公共 GitHub 仓库 |
| `NEXT_TELEMETRY_DISABLED` | 否 | 建议设为 `1` |

不会提交到 Git 的文件：

- `frontend/.env.local`
- `backend/.env`
- `proxy/.dev.vars`
- 本地数据库、歌词迁移数据、APK 和签名文件

## 歌词搜索与翻译

### 歌词搜索

歌词搜索优先请求 LRCLIB。配置 `NEXT_PUBLIC_LYRICS_PROXY_URL` 后，会先尝试 Cloudflare Worker，失败时直接连接 LRCLIB。

歌词搜索只用于提供用户主动选择的内容。请遵守 [LRCLIB](https://lrclib.net/) 的服务条款、速率限制和歌曲版权要求。

### 微软翻译

网页和 APK 会直接调用 Microsoft Edge 提供的翻译接口，将多行日语歌词批量翻译为简体中文。

- 不需要 Azure API Key。
- 网络异常时自动回退离线日中词典。
- 翻译结果会缓存在当前设备。
- 该免费接口可能发生限流或服务调整；长期公开使用建议换成 Azure 官方翻译服务。

### 可选 Cloudflare Worker

```powershell
cd proxy
npm ci
npx wrangler login
npx wrangler deploy
```

部署后，把 Worker URL 写入：

```env
NEXT_PUBLIC_LYRICS_PROXY_URL=https://<your-worker>.workers.dev
```

Worker 提供：

| 路径 | 用途 |
| --- | --- |
| `GET /search?q=...` | 搜索 LRCLIB 曲目 |
| `GET /source/{id}` | 获取选定曲目的歌词 |
| `POST /translate` | 微软翻译备用代理 |
| `GET /health` | 健康检查 |

## GitHub Release 自动更新

1. 创建**公共** GitHub 仓库。
2. 使用类似 `v1.1.0` 的标签创建 Release。
3. 将 APK 作为 Release 资产上传，建议命名为 `KANA.apk`。
4. 在应用设置中填写 `用户名/仓库名`，或设置 `NEXT_PUBLIC_UPDATE_REPO`。
5. 应用启动后会在后台检查最新 Release；设置中也可手动检查。

Android 不支持应用自行静默覆盖安装。下载完成后，应用会打开系统安装确认界面。

## 常用命令

在 `frontend/` 目录中运行：

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run lint` | 运行 ESLint |
| `npm run build:web` | 构建静态 Web 版本 |
| `npm run build:apk` | 构建并复制 Android APK |
| `npm run cap:sync` | 构建 Web 并同步 Capacitor 工程 |
| `npm run cap:android` | 使用 Android Studio 打开工程 |
| `npm run icons:android` | 重新生成 Android 图标和启动图 |

## 可选后端

后端用于 SudachiPy 分析接口和共享 SQLite 歌词库实验。

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --env-file .env --reload --port 8000
```

接口文档：

```text
http://127.0.0.1:8000/docs
```

健康检查：

```text
GET http://127.0.0.1:8000/api/health
```

运行后端测试：

```powershell
python -m pytest -q
```

## 项目结构

```text
.
├── frontend/
│   ├── app/                       # Next.js 页面与全局样式
│   ├── components/                # 工作台、歌词库、翻译与设置
│   ├── lib/                       # 注音、罗马音、本地库、翻译和更新
│   ├── workers/                   # 浏览器端离线分析 Worker
│   ├── public/                    # 字体、Kuromoji、日中词典
│   ├── android/                   # Capacitor Android 工程
│   └── scripts/                   # Web/APK 构建脚本
├── backend/                       # 可选 FastAPI + SudachiPy 服务
├── proxy/                         # 可选 Cloudflare Worker
├── PRD.md                         # 产品需求
├── ARCHITECTURE.md                # 架构说明
├── start-app.ps1                  # Windows 启动脚本
└── stop-app.ps1                   # Windows 停止脚本
```

## 本地字体

界面中文使用仓库内包含的思源黑体。为了保持日文歌词和罗马音的原始视觉效果，项目支持以下本地 Windows 字体：

```text
frontend/public/fonts/yumin.ttf
frontend/public/fonts/CALIST.TTF
```

这两个字体因授权限制不会提交到 Git。缺少文件时，浏览器会使用系统后备字体；需要完全一致的显示效果时，请从本机合法安装的字体目录复制。

详细说明：[`frontend/public/fonts/README.md`](./frontend/public/fonts/README.md)

## 测试

```powershell
cd frontend
npm run lint
npm run build:web
```

```powershell
cd backend
python -m pytest -q
```

建议手动检查：

- 汉字、平假名、片假名、英文、数字和特殊符号混排。
- 多行歌词、空行、重复行、长歌词和移动端滚动。
- 修正读音后假名与罗马音同步更新。
- 保存歌词后重新打开，人工修正仍然存在。
- 在线和离线翻译切换，以及截图导出。
- 设置面板、字号间距调整和更新检查。

## 数据与隐私

- 歌词库默认保存在当前设备的 IndexedDB。
- 显示设置和读音修正保存在当前设备的 localStorage。
- 自动更新只向 GitHub 请求公共 Release 元数据。
- 歌词搜索会把歌名或歌手发送给 LRCLIB 或自建 Worker。
- 使用在线翻译时，待翻译歌词行会发送给微软翻译服务。
- 仓库不会包含用户歌词、访问口令、数据库或 APK 签名文件。

## 已知限制

- 自动注音不能保证歌词中的专有名词、古语、特殊唱法或上下文多音词完全正确。
- 微软免费翻译接口不是稳定性保证；不可用时会显示离线词典释义。
- 当前歌词库默认只在同一设备、同一浏览器中可见。
- 歌词搜索依赖外部来源，可能遇到限流、超时或没有歌词。
- 当前 APK 是个人测试版本，不是 Google Play 发布包。

## 第三方资源

- Kuromoji 与 IPADIC 词典：许可信息见 [`frontend/public/kuromoji-dict/NOTICE.md`](./frontend/public/kuromoji-dict/NOTICE.md)。
- 日中词典数据：CC BY-SA 4.0，许可见 [`frontend/public/lookup/ja-zh/NOTICE.md`](./frontend/public/lookup/ja-zh/NOTICE.md)。
- 思源黑体：许可见 [`frontend/public/fonts/LICENSE-SourceHanSans.txt`](./frontend/public/fonts/LICENSE-SourceHanSans.txt)。
- 歌词来源：[LRCLIB](https://lrclib.net/)。
- 在线翻译：Microsoft Edge 翻译服务。

## 许可证

当前仓库尚未添加项目级开源许可证。在添加许可证前，原项目代码默认保留所有权利；上述第三方资源和词典继续遵循各自许可证。

如果你计划允许他人复制、修改或分发本项目，请在发布前补充合适的 `LICENSE` 文件，例如 MIT 或 Apache-2.0。

---

如果这个项目对你有帮助，欢迎通过 Issue 提交问题或改进建议。请勿在 Issue 中粘贴完整受版权保护的歌词、访问口令或其他敏感数据。
