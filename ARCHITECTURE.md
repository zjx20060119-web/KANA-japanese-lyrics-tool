# 技术架构文档

- 项目：日语歌词智能注音工具
- 版本：V1.0
- 架构目标：适合零基础开发者逐步实现的轻量 Web 应用
- 平台：电脑浏览器、手机浏览器

## 1. 架构概览

采用前后端分离的 Web 架构：

```text
电脑浏览器 / 手机浏览器
          |
          v
Next.js + TypeScript + Tailwind CSS
          |
          | HTTP API（JSON）
          v
Python + FastAPI
          |
          +--> 歌词文本预处理与换行保留
          +--> SudachiPy 分词与词典读音候选
          +--> 读音确认与人工修正规则
          +--> 假名 / Ruby 结构化结果
          +--> 罗马音转换模块
          |
          v
首版：内存或浏览器本地状态（按功能需要）
后续：共享数据库，用于历史记录与跨设备同步
```

核心原则：

1. 先把手动输入到注音显示的 P0 流程做正确。
2. 歌词来源与注音引擎分离，避免来源变化影响核心处理。
3. 将原文、系统推测读音和用户确认读音分别保存。
4. 罗马音由最终生效的假名读音生成。
5. 本地开发与真正的跨设备同步是两件事：同步需要可共同访问的服务和共享存储。

## 2. 技术栈选择及原因

| 技术 | 用途 | 选择原因 |
| --- | --- | --- |
| Next.js | 前端 Web 框架 | 适合构建页面和响应式 Web 应用，后续部署路径清晰 |
| React | 前端组件与状态管理 | 输入、结果展示和修正界面可拆成小组件 |
| TypeScript | 前端类型系统 | 有助于减少数据结构不一致，便于工具辅助生成和检查代码 |
| Tailwind CSS | 样式 | 可以快速实现电脑和手机适配，减少手写样式负担 |
| Python | 后端语言 | 日语文本处理生态成熟，适合初学者逐步调试 |
| FastAPI | HTTP API | 能将前端与注音逻辑分离，并自动提供 API 文档 |
| SudachiPy | 日语分词、词形分析 | 能输出词语切分与词典信息，为读音处理提供基础 |
| Sudachi 词典 | 词语读音候选 | 为常见词提供词典读音，但仍需处理多音、上下文和歌词表达 |
| HTML Ruby | 假名注音展示 | 浏览器原生支持 `<ruby>` 与 `<rt>`，适合在汉字上方显示假名 |
| 独立罗马音模块 | 假名转罗马音 | 让罗马音生成可单独测试，并确保人工修正后可以重新生成 |
| 浏览器本地存储 / 可选 SQLite | 本地状态或历史 | 首版可以保持简单；需要共享时再引入服务端数据库 |

### 为什么不把所有功能放在前端

日语分词和词典处理依赖 Python 生态。将其放在 FastAPI 后端，可以让前端专注于交互与展示，后端专注于文本处理；两者通过清晰的 JSON API 通信。

### 为什么不在第一版就强制使用数据库

P0 首要目标是验证注音、修正与罗马音联动。若暂时只处理当前输入，可以不配置数据库；本地历史可以后加。若要求电脑和手机自动共享历史与修正，则必须使用两端共同访问的后端存储，不能只依赖浏览器本地存储。

## 3. 项目目录结构

建议采用以下目录。实际代码生成后，可根据已有脚手架微调，但应保持模块职责清晰。

```text
japanese-lyrics-tool/
├── README.md
├── PRD.md
├── ARCHITECTURE.md
├── frontend/
│   ├── package.json
│   ├── .env.local.example
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── LyricsInput.tsx
│   │   ├── LyricsDisplay.tsx
│   │   ├── RubyText.tsx
│   │   ├── ReadingEditor.tsx
│   │   └── RomajiLine.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── storage.ts
│   └── public/
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── api/
│       │   └── routes_lyrics.py
│       ├── schemas/
│       │   └── lyrics.py
│       ├── services/
│       │   ├── analyzer.py
│       │   ├── reading_service.py
│       │   ├── ruby_builder.py
│       │   └── romaji.py
│       ├── repositories/
│       │   └── lyrics_repository.py
│       └── tests/
│           ├── test_analyzer.py
│           ├── test_reading_service.py
│           └── test_romaji.py
└── .gitignore
```

目录说明：

- `frontend/app/`：页面入口、全局布局和样式。
- `frontend/components/`：歌词输入、注音展示、读音修正和罗马音等 UI 组件。
- `frontend/lib/api.ts`：统一封装后端 API 请求。
- `frontend/lib/types.ts`：前后端共享概念对应的 TypeScript 类型。
- `frontend/lib/storage.ts`：封装可选的浏览器本地存储；不要把它误当作跨设备同步方案。
- `backend/app/main.py`：创建 FastAPI 应用、注册路由和配置 CORS。
- `backend/app/api/`：HTTP 接口层，只负责接收请求、校验参数、返回响应。
- `backend/app/schemas/`：请求和响应的数据结构。
- `backend/app/services/`：分词、读音选择、Ruby 结构和罗马音等核心逻辑。
- `backend/app/repositories/`：后续统一管理持久化读写，首版可使用简单实现。
- `backend/app/tests/`：对读音优先级、换行保留、罗马音转换等关键行为进行测试。

## 4. 核心模块说明

### 4.1 前端模块

**LyricsInput**

- 输入或粘贴多行歌词。
- 保留用户输入的换行。
- 触发注音请求并展示处理状态与错误信息。

**LyricsDisplay**

- 按原始行序展示处理结果。
- 保留空行、标点和未能识别的文本。
- 每行显示歌词内容及其罗马音。

**RubyText**

- 将后端返回的结构化片段渲染成普通文本或 HTML Ruby。
- 对有注音的片段使用 `<ruby>原文<rt>假名</rt></ruby>`。
- 不把未经清理的外部内容直接作为原始 HTML 注入页面。

**ReadingEditor**

- 展示系统候选读音。
- 允许用户确认或修改读音。
- 修改后更新 `confirmed_reading`，并请求或触发罗马音重新生成。

**RomajiLine**

- 展示由当前生效读音生成的罗马音。
- 不单独维护一份可能与假名失去同步的手工结果。

### 4.2 后端模块

**API 路由层（`api/routes_lyrics.py`）**

- 校验输入。
- 调用服务层。
- 返回结构化 JSON。
- 不在路由中堆放复杂的分词和读音规则。

**分析器（`services/analyzer.py`）**

- 调用 SudachiPy 分词。
- 获取词语、词形和词典可提供的读音信息。
- 保留原文片段顺序；不要简单地用拼接后的分析结果覆盖原文。

**读音服务（`services/reading_service.py`）**

- 生成 `detected_reading`。
- 管理用户确认的 `confirmed_reading`。
- 计算当前用于显示的 `effective_reading`。
- 对词典缺失或无法可靠判断的部分保留原文并允许人工修正。

**Ruby 构建器（`services/ruby_builder.py`）**

- 将原文片段和读音组织成前端可渲染的数据。
- 不负责歌词来源检索，也不负责罗马音规则。

**罗马音模块（`services/romaji.py`）**

- 将当前生效的假名转换为罗马音。
- 单独测试长音、促音、拗音、拨音及标点等情况。
- 用户修改读音后重新计算相关行的罗马音。

**歌词来源模块（P1）**

- 独立处理歌曲检索和歌词来源。
- 记录来源及获取状态。
- 遵守来源网站的服务条款、版权和访问限制；无法合法获取时提示用户粘贴歌词。

## 5. 数据模型设计

### 5.1 设计原则

- 原始歌词是基准数据，不因注音失败而丢失。
- 按行和片段存储，避免只保存一整段 HTML。
- 系统检测结果与用户确认结果分离。
- `effective_reading` 是根据优先级计算出的值，原则上不需要作为独立真值重复存储。
- 首版可以在请求处理中使用这些结构；引入数据库时再映射为表。

### 5.2 建议数据结构

#### LyricsDocument（歌词文档）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 文档唯一标识 |
| `title` | string / null | 歌曲名称（可选） |
| `artist` | string / null | 歌手（可选） |
| `source_url` | string / null | 歌词来源链接（P1，可选） |
| `original_text` | string | 原始歌词全文，包含换行 |
| `lines` | array of LyricsLine | 结构化歌词行 |
| `created_at` | datetime / null | 创建时间；持久化后使用 |
| `updated_at` | datetime / null | 更新时间；持久化后使用 |

#### LyricsLine（歌词行）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 行标识 |
| `line_index` | integer | 原始行序，从 0 或 1 开始并在项目内保持一致 |
| `segments` | array of LyricsSegment | 按顺序排列的文本片段 |
| `romaji` | string | 根据当前生效读音生成的整行罗马音 |
| `is_blank` | boolean | 是否为空行，用于保留排版 |

#### LyricsSegment（歌词片段）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 片段标识 |
| `surface` | string | 歌词中的原始表记 |
| `part_of_speech` | string / null | 词性信息（可选） |
| `dictionary_form` | string / null | 词典形（可选） |
| `detected_reading` | string / null | 系统推测读音，通常为假名 |
| `confirmed_reading` | string / null | 用户确认读音；未确认时为空 |
| `reading_source` | string / null | 读音来源或处理说明 |
| `reading_type` | string / null | 词典可支持时记录音读、训读、混合或未知等辅助分类 |
| `needs_review` | boolean | 是否建议人工检查 |

有效读音的规则：

```text
effective_reading =
  confirmed_reading（存在且非空）
  否则 detected_reading
```

罗马音必须根据 `effective_reading` 生成。对于本身就是假名、标点或不需注音的片段，应允许 `detected_reading` 为空，并由展示逻辑保留原文。

### 5.3 API 请求与响应示例

请求：

```json
{
  "text": "夜に駆ける\n沈むように溶けてゆくように"
}
```

响应示意（字段仅用于说明结构，真实读音应由处理模块生成）：

```json
{
  "lines": [
    {
      "line_index": 0,
      "segments": [
        {
          "surface": "夜",
          "detected_reading": "よる",
          "confirmed_reading": null,
          "reading_type": "unknown",
          "needs_review": false
        }
      ],
      "romaji": "yoru",
      "is_blank": false
    }
  ]
}
```

示例响应为结构说明，不代表实际分词、读音判断或罗马音实现已完成。生产代码应返回完整文本片段，不能只返回示例中的单个词。

## 6. API 设计建议

| 方法 | 路径 | 用途 | 阶段 |
| --- | --- | --- | --- |
| `POST` | `/api/lyrics/analyze` | 分析文本并返回结构化行、片段与读音候选 | P0 |
| `PATCH` | `/api/lyrics/{document_id}/segments/{segment_id}` | 保存用户确认的读音并更新罗马音 | P0（有文档持久化后） |
| `GET` | `/api/lyrics/search` | 按歌名/歌手搜索可用来源 | P1 |
| `GET` | `/api/lyrics/source` | 获取选定来源允许提供的歌词内容或来源信息 | P1 |
| `GET` | `/api/health` | 检查后端服务状态 | 开发阶段 |

首版可以先实现 `POST /api/lyrics/analyze`，人工修正先由前端状态管理完成；若需要保存修正记录，再增加持久化接口。API 路径可以按实际代码调整，但前后端需保持一致。

## 7. 存储与跨设备同步

### 阶段 A：核心流程验证

- 只处理当前输入时，可以不使用数据库。
- 临时结果由前端状态和后端请求处理维护。
- 可选使用浏览器本地存储保存当前设备的历史。
- 本地存储只属于当前浏览器/设备，不应宣称支持自动跨设备同步。

### 阶段 B：个人历史与同步

当需要手机和电脑共享同一份歌词、修正结果时：

- 将前后端部署到两端均可访问的环境。
- 使用共享数据库保存歌词文档、行、片段和用户修正。
- 为个人使用场景配置访问控制，避免公开暴露个人数据。
- 使用 HTTPS；限制 CORS 来源；不要将数据库密钥放进前端代码。
- 冲突处理可先采用更新时间或版本号检查，避免静默覆盖较新的人工修正。

SQLite 适合简单的单机持久化，但若部署环境需要多个服务实例或稳定的远程共享，应选择与部署平台匹配的共享数据库。不要把“使用 SQLite”本身当作跨设备同步的完整方案。

## 8. 代码规范

### 通用原则

- 保持模块单一职责：路由负责 HTTP，服务层负责业务，组件负责界面。
- 函数尽量短小，命名表达用途；避免把所有逻辑写进一个文件。
- 不为尚未需要的功能提前引入复杂抽象。
- 修改核心逻辑后，至少手动验证正常输入、空输入和特殊字符输入。

### 前端规范

- 使用 TypeScript，避免随意使用 `any`。
- React 组件使用 PascalCase，例如 `LyricsDisplay.tsx`。
- 普通变量和函数使用 camelCase。
- API 请求统一放在 `lib/api.ts`，不要在多个组件中重复拼接地址。
- UI 与读音判断逻辑分离；不要在展示组件里实现复杂的日语分析。
- 通过环境变量配置 API 地址，避免将本地地址硬编码到业务组件中。

### 后端规范

- 使用 Python 4 空格缩进，函数和变量使用 `snake_case`。
- 为请求/响应定义 Pydantic schema，避免返回随意拼装的字典。
- API 层、服务层、数据访问层保持职责分离。
- 不使用 `eval` 执行用户输入；不要将外部歌词内容作为可信 HTML。
- 对异常给出可理解的错误信息，不向用户返回敏感的堆栈或环境变量。
- 依赖版本写入 `requirements.txt`，后续可使用锁定版本确保可复现。

### 测试重点

- 原始换行、空行、标点和未识别文本能够保留。
- `confirmed_reading` 存在时优先于 `detected_reading`。
- 修改假名后，罗马音同步变化。
- 常见假名转换规则（促音、拗音、长音、拨音）有测试。
- 空文本、只有假名、混合汉字与假名、数字和标点等输入不会导致崩溃。
- 前端在窄屏幕上仍可完成输入、查看和修正。

## 9. 开发里程碑

1. 建立前后端项目骨架和健康检查接口。
2. 完成手动歌词输入与分析 API。
3. 完成结构化片段、Ruby 注音展示。
4. 完成逐行罗马音和人工修正联动。
5. 补充测试并验证电脑、手机浏览器布局。
6. 再实现合法来源的歌词搜索与获取。
7. 根据实际使用需求增加历史、导出、PWA 和跨设备同步。
