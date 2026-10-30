# 日语歌词智能注音工具

一个面向个人学习使用的响应式 Web 应用：把日语歌词转换为便于阅读和跟唱的注音排版，在保留原文、换行和标点的前提下，为日语汉字添加假名，并在每行下方显示罗马音。

> 当前文档对应 P0 核心注音、人工校对、歌词来源搜索和共享 SQLite 数据库（6A/6B）。HTML 导出、PWA 和更完整的多用户体系属于后续功能。

## 当前开发状态

**阶段 3 核心注音、阶段 4 人工校对、阶段 5 稳定性测试、阶段 6A 歌词搜索和阶段 6B 跨设备同步已完成。**

- 三份项目文档位于仓库根目录。
- 前端使用 Next.js 16、React 19、TypeScript 和 Tailwind CSS 4。
- 后端使用 FastAPI，已提供 `GET /api/health` 健康检查。
- 首页已提供歌曲名称、歌手、多行歌词输入，以及“开始注音”操作。
- 结果区已支持原文、HTML Ruby 假名、逐行罗马音和读音修正界面。
- 后端已使用 SudachiPy 0.7 和 SudachiDict Core 实现分词、词性与读音分析。
- `POST /api/lyrics/analyze` 已可接收多行歌词并返回结构化结果。
- 前端已调用真实分析接口，展示 Ruby 假名、逐行罗马音和待确认提示。
- 读音修正可更新 `confirmed_reading`，并立即重新计算本行罗马音。
- 支持单独确认系统候选；未修改的候选不会被“应用修正”自动确认。
- 校对结果保存在当前浏览器，再次分析或刷新后可以恢复。
- 提供“清除本曲校对”，可删除当前歌词对应的浏览器本地修正。
- 手机长歌词、超长英文、重复行、特殊符号和深度位置修正均已验证。
- 可按歌名或歌手（至少填写一项）搜索 LRCLIB 公开歌词来源，并在填入歌词前选择候选版本。
- 歌词搜索失败或来源无歌词时，界面会提示继续手动粘贴，不阻断注音流程。
- 歌词来源模块与分词、读音、罗马音模块解耦。
- 歌词、注音结果和人工修正可保存到服务端 SQLite 共享库。
- 后端保存、列表和读取接口使用个人 Bearer 访问口令保护；前端通过 Next.js 服务端代理携带口令，页面可直接打开歌词库。
- 两台设备使用同一后端地址时，可直接打开同一份歌词并看到对方的修正。
- 新增“我的歌词库”页面，支持搜索、收藏筛选、重命名、复制和删除。
- 从歌词库打开歌曲时显示只读歌词页，直接使用数据库中的注音快照；输入、校对和保存功能收在“修改歌词”按钮中。
- 只读歌词页与注音结果区使用相同的固定字号与间距参数，罗马音采用本地 Calisto MT（`CALIST.TTF`）字体。
- 歌词一览页最下方可将歌名、歌手/专辑和全部歌词导出为 PNG 图片。
- 页头保留后端连接状态，可手动重新检查。

## 项目简介

### 解决什么问题

网上的日语歌词注音版本可能不完整，或存在读音错误。本项目希望提供一个可以自行检查和修正的工具，重点是：

- 保留歌词原文、换行和标点。
- 对日语文本进行分词，并利用词典和上下文信息推测读音。
- 将汉字读音以假名形式显示在汉字上方。
- 在每行歌词下方显示罗马音。
- 区分系统推测的读音和用户确认的读音；人工修正后，以用户确认的读音为准，并同步更新罗马音。
- 支持按歌名或歌手搜索歌词；同时保留手动粘贴歌词作为备用入口。

### 目标平台与使用方式

- 电脑浏览器和手机浏览器。
- 响应式页面，同一网址跨设备访问。
- 第一阶段以本地开发运行为主，不需要注册或独立安装 App。
- **跨设备同步说明：**当前使用电脑上的 FastAPI + SQLite 作为共享服务，并可通过 Tailscale 让手机访问同一后端。浏览器本地存储仍只属于当前设备，不能单独完成跨设备同步。

## 技术栈

| 层级 | 技术 | 用途 |
| --- | --- | --- |
| 前端 | Next.js、React、TypeScript | 页面、交互、类型约束和响应式 Web 应用 |
| 样式 | Tailwind CSS | 页面布局与响应式样式 |
| 后端 | Python、FastAPI | 提供注音处理 HTTP API |
| 日语处理 | SudachiPy、日语词典 | 分词、词形分析及候选读音获取 |
| 注音展示 | HTML Ruby（`<ruby>` / `<rt>`） | 将假名显示在汉字上方 |
| 罗马音 | 独立转换模块 | 根据已确认的假名生成罗马音 |
| 共享存储 | 服务端 SQLite | 保存歌曲、歌词分析结果和人工修正 |
| 设备本地存储 | 浏览器 `localStorage` | 保存当前设备的读音覆盖缓存 |

## 如何运行

### 前置条件

本项目在当前电脑上已验证以下工具版本：

- Node.js `v24.16.0`
- npm `11.13.0`
- Python `3.13.13`
- Git `2.54.0`

可用以下命令确认：

```powershell
node --version
npm --version
python --version
git --version
```

### 目录约定

以下命令假设项目采用本文 `ARCHITECTURE.md` 中的目录结构：

```text
japanese-lyrics-tool/
├── README.md
├── PRD.md
├── ARCHITECTURE.md
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── .env.local.example
└── backend/
    ├── app/
    ├── tests/
    ├── requirements.txt
    └── requirements-dev.txt
```

### 一键启动（Windows）

在项目根目录双击：

```text
启动歌词工具.bat
```

脚本会自动检查 3000 和 8000 端口，启动前后端并打开 <http://localhost:3000>。运行日志位于 `.runtime/`。

停止服务时双击：

```text
停止歌词工具.bat
```

如果端口已经被其他程序占用，停止脚本会跳过该进程，不会误杀其他程序。

### 同步到 Obsidian（Windows）

默认同步目录为：

```text
E:\知识库\日常\歌词库
```

如需修改目录，编辑项目根目录的 `obsidian-sync-config.json`。该文件只保存在本机，已加入 `.gitignore`。

双击项目根目录的：

```text
同步歌词库到Obsidian.bat
```

脚本会自动完成：

- 如果歌词工具没有运行，先启动前后端。
- 从歌词库读取每首歌的完整注音结果。
- 在 Obsidian 目录中为每首歌生成一个 Markdown 笔记。
- 写入歌名、歌手、专辑、来源、更新时间和标签 frontmatter。
- 使用 HTML Ruby 保留假名注音，并在每行下方写入罗马音。
- 根据 `updated_at` 只更新发生变化的歌曲，不删除已有笔记。

当前采用“应用 → Obsidian”单向同步：应用中的歌曲更新后，再次运行同步会覆盖对应的 Markdown 笔记；不会自动把 Obsidian 中的修改写回应用。

首次同步会在目标目录创建 `.kana-sync-index.json`，用于记录歌曲对应的 Markdown 文件名，Obsidian 会忽略这个隐藏文件。

Obsidian 中可以使用 Dataview 查看歌词库：

````markdown
```dataview
TABLE artist, album, updated_at
FROM "歌词库"
SORT updated_at DESC
```
````

### 1. 启动后端

在项目根目录打开终端：

```bash
cd backend
python -m venv .venv
```

激活虚拟环境：

Windows PowerShell：

```powershell
.venv\Scripts\Activate.ps1
```

macOS / Linux：

```bash
source .venv/bin/activate
```

安装运行依赖：

```powershell
python -m pip install -r requirements.txt
```

如需运行接口测试，安装开发依赖：

```powershell
python -m pip install -r requirements-dev.txt
```

启动后端：

```powershell
Copy-Item .env.example .env
python -m uvicorn app.main:app --env-file .env --reload --reload-dir app --host 127.0.0.1 --port 8000
```

首次使用请在 `backend/.env` 中设置：

```env
APP_ACCESS_TOKEN=一段足够长的个人访问口令
DATABASE_PATH=data/lyrics.db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

`.env` 和 `data/` 已加入 `.gitignore`，不会提交到 Git。未配置 `APP_ACCESS_TOKEN` 时，注音和歌词搜索仍可使用，但共享歌词库接口会返回 503。

启动后可在电脑浏览器打开：

- API 文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/api/health>

健康检查正常时返回：

```json
{
  "status": "ok",
  "service": "japanese-lyrics-api",
  "version": "0.1.0"
}
```

运行后端测试：

```powershell
python -m pytest -q
```

### 歌词分析接口

接口地址：

```text
POST /api/lyrics/analyze
```

请求：

```json
{
  "text": "夜に駆ける\n\n沈むように",
  "title": "示例歌曲",
  "artist": "示例歌手"
}
```

`title` 和 `artist` 可选，用于把歌曲信息带入分析结果。

PowerShell 调用示例：

```powershell
$body = @{ text = "夜に駆ける`n`n沈むように" } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/lyrics/analyze" `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
```

响应保留原始行序和空行，并为每个片段返回：

- `surface`：原文表记。
- `part_of_speech`：主要词性；详细分类在 `part_of_speech_detail`。
- `detected_reading`：Sudachi 词典提供的自动读音，统一为平假名。
- `confirmed_reading`：人工确认读音，当前接口固定为 `null`。
- `effective_reading`：当前有效读音；后端初次返回时等于 `detected_reading`，前端确认后更新为人工读音。
- `reading_source`：读音来源，例如词典、OOV 估计、无需注音或无法获取。
- `needs_review`：是否建议人工确认。
- `notes`：单个片段的分析提示。
- `romaji`：根据当前有效读音生成的整行罗马音，位于行对象中。

顶层 `warnings` 汇总需要人工检查的片段或整行分析失败信息。`line_index` 从 `0` 开始。

当前限制：分析接口本身不保存人工修正。确认读音保存在当前浏览器的 `localStorage` 中，因此同一浏览器、同一歌词可以恢复；换浏览器或换设备不会同步。Sudachi 会结合上下文选择一个读音，但歌词中的专有名词、特殊唱法、古语和 OOV 词仍可能需要人工修正。

### 歌词搜索与来源接口

搜索候选：

```text
GET /api/lyrics/search?title=夜に駆ける&artist=YOASOBI
```

获取选定来源的歌词：

```text
GET /api/lyrics/source?source=lrclib&source_id=36467462
```

当前来源为 [LRCLIB](https://lrclib.net/) 的公开 API。搜索接口只返回曲目、歌手、专辑、时长和可用歌词类型；用户选择候选后才获取歌词正文。来源模块位于 `backend/app/services/lyrics_source.py`，不依赖注音引擎。

使用时请遵守 LRCLIB 的来源条款和歌曲版权要求。上游暂时繁忙、没有歌词或网络失败时，前端会显示原因，并保留下方手动粘贴入口。

### 共享歌词库与访问控制

保存当前结果：

```text
POST /api/documents
Authorization: Bearer <APP_ACCESS_TOKEN>
```

读取列表、打开文档和更新修正：

```text
GET /api/documents
GET /api/documents/{document_id}
PUT /api/documents/{document_id}
```

SQLite 数据库默认位于 `backend/data/lyrics.db`。每份文档保存歌词原文、完整分析快照和人工确认读音；更新时会递增版本号。当前采用个人使用的“最后保存覆盖”策略，不提供多人并发冲突合并。

前端通过 `/api/library` 服务端代理访问这些接口。代理会从 `frontend/.env.local` 的 `LYRICS_LIBRARY_TOKEN` 读取口令；未设置时自动读取 `../backend/.env` 中的 `APP_ACCESS_TOKEN`，因此浏览器不需要输入或保存口令。

前端“我的歌词库”面板：

1. 完成注音后点击“保存当前结果”。
2. 在另一台设备打开同一前端地址。
3. 点击歌词库中的歌曲，即可读取同一份歌词、注音和人工修正。
4. 修改后再次保存，另一台设备刷新并重新打开即可看到更新。

### 我的歌词库

电脑访问 <http://localhost:3000/library>。页面会直接加载歌词库，可以：

- 按歌名、歌手或歌词搜索。
- 只看收藏歌曲。
- 重命名歌曲、歌手或专辑。
- 复制、删除歌曲。
- 打开已经生成的歌词，直接读取 SQLite 注音快照，不重新运行 SudachiPy。

歌曲仍需点击“保存当前结果”或“保存当前修改”才会进入歌词库。当前是一份个人总库加收藏筛选，不包含多个自定义歌单；跨设备更新采用最后保存覆盖。

### 2. 启动前端

新开一个终端：

```bash
cd frontend
npm install
```

在 `frontend/.env.local` 中设置后端地址（变量名需与项目代码保持一致），例如：

```env
# 留空时自动使用当前页面主机的 8000 端口
NEXT_PUBLIC_API_BASE_URL=
NEXT_TELEMETRY_DISABLED=1

# 歌词库服务端代理；这些变量不会发送到浏览器
LYRICS_API_BASE_URL=http://127.0.0.1:8000
# 留空时自动读取 ../backend/.env 的 APP_ACCESS_TOKEN
LYRICS_LIBRARY_TOKEN=
```

保持 `NEXT_PUBLIC_API_BASE_URL` 为空时：

- 电脑打开 `http://localhost:3000` 会连接 `http://localhost:8000`。
- 手机通过 Tailscale 打开 `http://100.106.62.63:3000` 会连接 `http://100.106.62.63:8000`。
- 通过局域网 IP 打开时也会使用相同 IP 的后端端口。

如需强制指定其他 API 地址，再填写完整的 `http://host:port`。

首次运行可复制示例文件：

```powershell
Copy-Item .env.local.example .env.local
```

`.env.local` 是本地配置，不提交到 Git；`.env.local.example` 会提交，供其他环境参考。

启动开发服务器：

```bash
npm run dev
```

在电脑浏览器打开 <http://localhost:3000>。

页面应显示歌词输入工作台，页头状态为“服务正常”。

手动验证基础页面：

1. 在歌曲名称和歌手输入框填写“夜に駆ける / YOASOBI”，点击“搜索歌词”。
2. 检查候选是否显示歌名、歌手、专辑、时长和来源；点击一个候选后，歌词应填入下方输入框。
3. 点击“开始注音”，应出现真实分词、Ruby 假名和逐行罗马音。
4. 在“我的歌词库”快速面板点击“保存当前结果”。
5. 打开“我的歌词库”页面，检查搜索、收藏、重命名、复制和删除。
6. 从歌词库打开歌曲，应直接显示只读歌词页：大写歌名、歌手与专辑、假名注音和逐行罗马音；点击红色“修改歌词”后才出现编辑功能。
7. 在另一台设备打开同一歌曲并修改读音，保存后回到第一台设备刷新，应看到更新。
8. 点击“修正读音”，把第一行“夜空”的读音从 `よぞら` 改成 `よる`，点击“应用修正”。只有这个片段应显示“已确认”，罗马音应变成 `yoru ni utau`。
9. 在不修改输入的情况下点击“确认候选”，对应片段应显示已确认。
10. 输入包含“龘”等词典缺失汉字的歌词，应出现“需要人工检查”和“待校对”提示。

自动化和浏览器回归已覆盖：

- 汉字、平假名、片假名、英文、数字和特殊符号混排。
- 空行、重复行、标点和 OOV 待确认提示。
- 同字多音、读音修正、重新分析、刷新恢复和清除校对。
- 桌面 1440px 和手机 390×664 布局。
- 手机端 60 行以上长歌词、输入框内部滚动、深度位置修正和超长英文换行。

前端质量检查：

```powershell
npm run lint
npm run build
```

### 3. 手机如何访问

手机和电脑连接同一个 Wi-Fi 后，开发服务器需要监听局域网地址，而不能只监听 `127.0.0.1`。例如前端可用：

```bash
npm run dev -- --hostname 0.0.0.0
```

后端也需按需监听 `0.0.0.0`，并配置 CORS，只允许可信的开发来源。随后在手机浏览器中打开电脑的局域网 IP 地址，例如 `http://192.168.x.x:3000`（请替换为电脑的实际 IP）。

注意：

- 手机访问 `localhost` 指的是手机自身，不是电脑。
- 手机访问时，`NEXT_PUBLIC_API_BASE_URL` 也必须是电脑的局域网 IP，不能写 `127.0.0.1`。
- 后端启动时可按需设置 `CORS_ORIGINS`，例如 `$env:CORS_ORIGINS="http://192.168.1.10:3000"`。
- 防火墙可能需要允许开发端口。
- 局域网访问适合开发测试，不等同于公网部署。
- 若要在不同网络、不同地点使用同一网址并同步数据，需要部署前后端并配置共享数据库、HTTPS 和访问控制。

## Git 使用约定

首次使用前设置提交身份：

```powershell
git config user.name "你的名字"
git config user.email "你的邮箱"
```

每完成一个独立功能后提交：

```powershell
git add .
git commit -m "完成 XX 功能：说明本次具体改动"
```

查看历史：

```powershell
git log --oneline --decorate
```

需要回退到某个历史版本时，先确认提交 ID 和工作区状态，再执行：

```powershell
git reset --hard <commit-id>
```

`git reset --hard` 会丢弃未提交修改，使用前应确认没有需要保留的内容。

## 常见问题

- 页面显示“后端尚未连接”：确认后端在 `127.0.0.1:8000` 运行，并重新加载页面。
- 端口被占用：关闭占用 `3000` 或 `8000` 的程序，或按实际端口同步修改前端环境变量。
- Windows 上 Next.js 构建出现配置文件重命名错误：确认 `.env.local` 中包含 `NEXT_TELEMETRY_DISABLED=1`。

## 推荐开发顺序

1. **P0：核心注音**——手动粘贴歌词、分词与读音候选、假名注音、逐行罗马音、人工修正。
2. **P1：歌词获取**——输入歌名/歌手并从允许使用的来源检索歌词；保留手动粘贴入口。
3. **后续增强**——本地历史、HTML 导出、PWA，以及需要时的共享数据库和跨设备同步。

## 重要说明

- 自动分词和词典读音只是候选结果，不能保证完全正确；歌词中的倒装、缩略、古语、专有名词和特殊唱法尤其需要人工检查。
- 音读/训读的区分应结合词语、词形和上下文判断，不应只按单个汉字机械判断。
- 歌词获取功能应遵守来源网站的使用条款、版权和访问限制；不要绕过登录、付费墙或技术访问控制。
- 本项目优先服务个人学习与校对，不承诺自动生成的读音百分之百准确。
