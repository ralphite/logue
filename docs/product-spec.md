# Logue 产品规格 v0.7（clean-slate）

完整 UX 细节以 `docs/design/capture-to-reuse-product-design-2026-08-04.md` 为准。本规格不受当前实现、schema、routes 或现有数据约束；冲突时以用户最新决定与该设计文档为准。

## 产品承诺

Logue 让用户在当前工作现场说一次或保存一次，立即用于当前任务并保留原始证据；以后能找回证据，并把明确选择的证据变成可编辑、可引用的 Page。

它不是聊天首页、自动归档系统或 Agent 平台。产品只闭合：

`Capture → Recall → Make`

## 产品原则

1. **留在当前任务。** 输入和捕获发生在用户正在使用的网页。
2. **先保存，后副作用。** Source 保存成功后才插入宿主；永不自动提交。
3. **原始证据不可覆盖。** 纠正、批注和生成结果独立保存并可追溯。
4. **上下文必须明确。** 生成只使用用户选择的 Sources 和当前 Project。
5. **Search 返回证据。** 不把无来源聊天答案伪装成记忆。
6. **正常操作安静。** 连接、autosave、成功和系统记录默认不可见。
7. **删除整理工作。** 不自动归 Project，不使用 Tags、Inbox、Needs review 或 Daily。
8. **不保留 prototype legacy。** 旧 UI、对象、routes、schema 和数据无保留权。

## 信息架构

一级导航只有：

- `Library`
- `Projects`
- `Settings`

全局 `Search` 位于侧栏顶部；Page 从 Library 或 Project 打开；Skills 位于 Settings。

删除 `Stream / Documents / Skills / Generate / Ask / Inbox / Daily / Agents` 一级入口。

## 核心对象

### Source

用户主动保存的 voice 或 selection。保存原始音频/文字、机器转写、准备插入文字、来源 URL/title、时间与 request ID。原始内容只读；annotation/correction 独立保存。v1 不保存整页快照。

### Page

持续编辑的笔记、回复、QA、PRD 或文档。可空白创建或从 Sources 起草；支持 Markdown、autosave、citation 与 Sources panel。

### Project

可选工作范围，包含 brief、confirmed terms、明确加入的 Sources 与 Pages。不得自动归档或跨 Project 静默混入上下文。

### Skill

Settings 中的可复用动作配置。用户可新建、复制、编辑和停用；每次修改产生 revision。Skill 不是一级内容对象，Prompt-only 能力不称为 Agent。

### 权威关系

| 关系 | 规则 |
| --- | --- |
| Page → Project | `0..1`，只由用户明确选择；Project 内新建时预填 |
| Source ↔ Project | 多对多，只由用户 `Add / Remove` |
| Page ↔ Source | 多对多，通过 `Add sources / New page from source` |
| Source → Correction | 最多一个 active；Search/Draft 优先使用，同时保留原文核验 |
| Source → Note | `0..n`；Source picker 的 `Include notes` 逐条选择，默认全不选；Run 记录 annotation IDs |

## 核心旅程

### 1. 网页语音

`Focus editor → Record → Stop and insert / Cancel`

- 麦克风只在真实可编辑目标聚焦时出现。
- `Stop and insert` 自动转写、保存 Source，再写入仍有效的目标。
- `Cancel` 在异步完成前始终有效；迟到结果不得保存、插入或重开 UI。
- 不显示审阅、Project、Tags、Skill 或连接成功。
- 不按 Enter，不发送宿主表单。

### 2. 网页选区

- 右键 `Save to Logue` 立即保存完整选区，成功静默。
- Source detail 的 `Add note` 添加文字/语音 annotation，不覆盖原文。
- 不强迫打开面板、分类或选择 Project。

### 3. 找回

- `Search` 同时查询 Sources、Pages、Projects。
- 使用单一全局排序列表；全部精确命中先于语义结果，类型只由 icon/metadata 表达。
- Search 索引原文、active correction 和 notes，但结果仍指向同一 Source。
- Source 结果可 `Open source` 或 `New page from source`；后者用稳定 request ID 锁定 row action，成功只创建/导航一次，失败在原 row `Retry` 且保留 Search 状态。向已有 Page 添加来源只从 Page 的 `Add sources` 进入。
- 自然语言问题仍返回可核验证据，不创建聊天会话。
- 用户提交 Search 即授权搜索 Library；只有启用 `Semantic search with configured model` 时才向远程模型发送 query 与受限候选摘录，关闭后仍提供本地精确搜索。

### 4. Page

`New page → Add sources → Draft with sources → Edit / cite`

- 生成只使用明确选择的 Sources、当前 Project brief/terms 与指定 Skill revision。
- Run 启动时保存稳定 insertion anchor；anchor 失效时保留结果并提供 `Insert at cursor / Copy / Close`，不得写入偶然的 current caret。
- 模型只能引用真实 Source ID。
- 输出直接进入 Page；取消/失败不创建额外结果对象。
- citation 可回到原始 Source、URL、时间与音频。

### 5. Selection Skills

`Select text → Skills → Apply → Undo`

- 只在稳定、可写的选区上出现。
- Esc 关闭/取消并使迟到结果失效。
- 多行结果保留换行；宿主表单不自动提交。
- Page 替换进入编辑历史；网页只在目标与替换文本仍稳定时提供 Undo。

### 6. Extension 写作

- 网页原位 launcher 始终只有麦克风。
- Side Panel 渐进显示 `Write with sources`。
- 结果可编辑，动作只有 `Insert / Copy / Back`；绝不自动发送。
- Side Panel 单独展示 Sources；`Insert / Copy` 默认只输出正文，不插入 Logue citation token。Run 仍保留 Source IDs 与映射。
- Adopt 后正常成功保持安静；Side Panel 按规范化完整页面 URL 提供可展开 `Sources used`，从 adopted Run 还原 Source 映射。页面 URL 规范化保留 path 与非追踪 query，移除 fragment、`utm_*`、`fbclid`、`gclid` 并统一 scheme/host/default port，不能只匹配 origin。

## 表面职责

| 表面 | 负责 | 不负责 |
| --- | --- | --- |
| 网页 launcher/menu | 语音输入、选区保存、Selection Skills | Project 管理、历史、生成配置 |
| Side Panel | 录音、页面批注、局部错误、On this page、Write with sources | Library 管理、长 Page 编辑 |
| Library | 浏览/搜索 Sources 与 Pages | 自动归档、review queue |
| Projects | brief、terms、明确关联 Sources/Pages | 文件夹树、自动执行器 |
| Page | 写作、来源选择、citation | 独立生成 workspace |
| Settings | Skills、model/privacy、export/backup | 日常内容浏览；Extension Server URL |

## 数据与 API

目标 schema：`sources / source_annotations / pages / page_sources / projects / project_sources / skills / skill_revisions / runs`。`page_sources` 记录是否用于未来 drafting context；`runs` 记录明确的 Source IDs 与 annotation IDs。

目标 routes：`/v1/sources /v1/search /v1/pages /v1/projects /v1/skills /v1/runs /v1/status`。

不保留 `/materials`、Generate workspace、external-agent import、project bundle 或兼容 aliases。首次基础切换必须原子完成：backup → best-effort import → 新 schema/routes → Extension/Web 切换 → 最小 Library 核验 → 删除旧 schema/routes/import code。失败记录不阻塞发布，也不得留下双 schema。

## 隐私与部署

- Web/API 由同一个可安装服务提供，可运行在受控 macOS/Linux，目标机不需要开发依赖。
- Mac Chrome Extension 可连接用户明确配置的 `http(s)` origin；不得扫描 LAN。
- Model provider credentials 只由安装器/服务环境配置，不进入 Web/Extension；`Model & privacy` 只显示语义搜索开关、发送范围和非敏感 provider 名称。默认不抓取整页正文。
- 当前服务没有公网认证，只允许受防火墙保护的可信 LAN/VPN 或受控反向代理。

## 不做

- 自动 Project 归档、Tags、Needs review、Daily resurfacing；
- 聊天式 Ask、独立 Generate workspace、生成历史页；
- Agent 市场、Skill 市场、外部 Agent import；
- 云账号、云同步、自动公网 tunnel、多服务器 dashboard；
- legacy schema/routes、双格式 parser、旧 UI fallback；
- 为迁移 prototype 数据推迟更好的产品结构。

## 删除语义

- Source/Page/Project 的 overflow 都提供明确删除动作。
- Page 删除不删除 Sources；Project 删除只解除 Sources 关联并把 Pages 变为无 Project。
- Source 若被引用，删除前显示受影响 Page/citation 数量；确认后删除 Source、音频与对应 citations。
- Page 中已有 citations 的 Source 只能 `Exclude from future drafts`，不静默删除 citations；被排除项显示 `Not used for new drafts / Include in drafts`，citation 随正文编辑删除。

## 完成门槛

- 日常内容只有 Source、Page、Project；配置复用动作时额外理解 Skill。
- Capture 在真实 ChatGPT、textarea、contenteditable、Google Docs 可靠完成。
- Search 返回可核验证据；Page grounded drafting 的每条 citation 都可解析。
- Cancel、断连、目标失效、Chrome/MV3/服务重启均可恢复。
- 正常成功保持安静；没有旧 IA、旧对象或兼容债务。
- 产品范围、交互和视觉一致性的独立设计审查均无 blocker/major。
