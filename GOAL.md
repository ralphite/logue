# Logue 权威产品目标与完成契约

状态：**进行中，尚未实现 clean-slate 目标。**

本文件完整替代旧目标。用户最新要求、本文和 `docs/design/capture-to-reuse-product-design-2026-08-04.md` 是产品真相；旧代码、UI、schema、routes、测试、截图和本地数据都不构成保留约束。

## 1. 最终结果

Logue 让用户在当前工作现场说一次或保存一次，内容立即用于当前任务且原始证据不丢；以后能自然找回，并把明确选择的证据变成可编辑、可引用的 Page。

产品只闭合：

`Capture → Recall → Make`

- Extension 是现场入口：语音输入、选区保存、页面批注、选区改写、基于来源写作。
- Web App 是长期空间：Library、Projects、Page editor、Settings。
- 服务可运行在受控 macOS/Linux；Mac Chrome 作为独立客户端，不要求本机启动服务。
- 完成判断只看真实任务是否安静、直接、稳定、可核验；文档、代码、测试、截图和提交只是证据。

## 2. Clean-slate 权限与数据

- 当前代码、设计、导航、组件、对象名、schema、routes、defaults、文件格式和数据都是可删除的 prototype 输入。
- 只从本目标和最新产品规格设计；不得因迁移成本或“已经存在”而保留旧结构。
- 当前数据无需保证保留。破坏性切换前在可行时备份并尝试一次 best-effort 导入；失败记录只需报告，不能阻塞发布。
- 切换后删除迁移代码、旧 schema/routes、aliases、fallback、兼容 fixtures 和双版本 UI。
- Export/restore 只对新 schema 构成交付要求；installer rollback 只需恢复程序版本，不要求恢复 redesign 前 prototype 数据。
- 任何实质影响流程、数据、权限、架构或交付的决定必须先记录在 `DECISIONS_AND_RISKS.md`。

## 3. 产品模型

### 3.1 一级 IA

Web App 只有：

- `Library`
- `Projects`
- `Settings`

全局 `Search` 位于侧栏顶部。Page 从 Library/Project 打开；Skills 位于 Settings。

删除 `Stream / Documents / Skills / Generate / Ask / Inbox / Daily / Agents` 一级入口。

### 3.2 用户对象

- **Source**：用户主动保存的 voice 或 selection；原始证据不可覆盖。v1 不保存整页快照。
- **Page**：可持续编辑的笔记、回复、QA、PRD 或文档；可空白创建或从 Sources 起草。
- **Project**：可选范围，包含 brief、confirmed terms、明确关联的 Sources 与 Pages；不得自动跨项目混合。

`Skill` 是 Settings 中的可复用动作配置。`Run / citation / revision / annotation` 是系统记录。Prompt-only 能力不得称为 Agent。

删除用户可见 `Material / Document / Tag / Inbox item / Daily item / Agent workspace / Generation result`。

### 3.3 权威关系

| 关系 | Cardinality | 用户动作 | 下游 Context |
| --- | --- | --- | --- |
| Page → Project | `0..1` | 明确选择；Project 内新建时预填 | 仅该 Project brief/terms |
| Source ↔ Project | 多对多 | `Add / Remove` | picker 默认范围 |
| Page ↔ Source | 多对多 | `Add sources / New page from source` | citation 与 drafting |
| Source → Correction | `0..1 active` | `Correct transcript` | Search/Draft 优先文本，保留原文核验 |
| Source → Note | `0..n` | `Add note`；picker 中 `Include notes` 逐条选择 | 默认全不选；Run 记录 annotation IDs |

### 3.4 表面职责

| 表面 | 负责 | 不负责 |
| --- | --- | --- |
| 网页 launcher/menu | 语音输入、选区保存、Selection Skills | Project 管理、历史、复杂配置 |
| Chrome Side Panel | 捕获、页面批注、局部错误、On this page、Write with sources | Library 管理、长 Page 编辑 |
| Library | 浏览/查找 Sources 与 Pages | 自动归档、review queue |
| Projects | brief、terms、明确关联 Sources/Pages | 文件夹树、后台执行器 |
| Page | 写作、Sources、citation | 独立生成 workspace |
| Settings | Skills、model/privacy、export/backup | 日常内容浏览；Extension Server URL |

## 4. 核心功能合同

### 4.1 Universal Capture

默认语音路径：

`Focus editor → Record → Stop and insert / Cancel`

- 只有真实可编辑目标聚焦时显示麦克风。
- 录音态只显示时长、`Stop and insert`、`Cancel`；无 Project、Skill、Tag、Reference 或审阅。
- Side Panel 无输入目标的页面批注使用 `Stop and save`。
- `Cancel` 在 starting、recording、transcribing、saving 和插入完成前始终有效；立即使 request token 失效。迟到结果不得保存、插入或重开 UI。
- 顺序必须是：音频 → 转写 → 保存 Source → 插入仍有效目标。
- 一次操作只创建一条 Source、一次插入、零自动提交；网络重试用稳定 request ID 幂等。
- 保存失败时不写入宿主；目标失效时 Source 已安全保存并可 `Insert again / Copy`。
- 成功保持安静；错误局部显示恢复动作，不暴露端口、request ID、进程或模型品牌。

### 4.2 Selection capture 与 annotation

- 右键 `Save to Logue` 立即保存完整选区，成功静默。
- 不自动打开 Side Panel，不要求选择 Project 或填写表单。
- Source detail 提供 `Correct transcript`（最多一个 active correction）与 `Add note`（可多条文字/语音）。
- 原始 Source 只读；Search/Draft 优先 active correction，同时保留原文核验。Source picker 在存在 Notes 时提供折叠 `Include notes`，逐条 checkbox 默认全不选；Run 记录 annotation IDs。
- 静态网页不做原文就地替换。

### 4.3 Search / recall

- 全局 Search 同时查询 Sources、Pages、Projects。
- 使用单一全局排序列表；全部精确命中先于语义结果，类型只由 icon/metadata 表达。
- Search 索引原文、active correction 和 notes，但结果仍指向同一 Source。
- 自然语言问题返回可核验证据，不创建 Ask 会话或无来源答案。
- Source 结果支持 `Open source / New page from source`；后者首次激活后锁定 row action、使用稳定 request ID，成功只创建并导航一次，失败在原 row `Retry` 且保留 Search 状态。创建后关联 Source、聚焦正文，不改变 Project 归属。向已有 Page 添加来源只从 Page 内 `Add sources` 进入。
- 打开结果再返回时恢复 query、filter、scroll 与焦点。
- 用户提交 Search 即授权搜索 Library；只有启用 `Semantic search with configured model` 时才向远程模型发送 query 与受限候选摘录，关闭后仍提供本地精确搜索。

### 4.4 Page 与 grounded drafting

核心路径：

`New page → Add sources → Draft with sources → Edit / cite`

- Page 可空白创建，标题默认 `Untitled`，正文立即可编辑；最多属于一个 Project，从 Project 新建时预填。
- 统一 Source picker 默认限制当前 Project，可显式切换 `All sources`。
- 生成只使用明确 Sources、当前 Project brief/terms、指定 Skill revision。
- 模型只能引用真实 Source ID；citation 可回到原文、URL、时间和音频。
- 生成中保留 instruction/Sources，提供 Cancel；失败可 Retry；迟到结果失效。
- Run 启动时保存稳定 insertion anchor；结果只插入该 anchor。Anchor 失效时保留结果并显示 `Insertion point changed.` 与 `Insert at cursor / Copy / Close`，不得使用偶然的 current caret。
- 输出直接进入 Page，不创建结果 workspace、生成历史页或额外内容对象。
- Markdown、Undo/Redo、autosave、citation、Sources panel 和 selection replacement 在真实 editor 中稳定。
- Sources panel 桌面可调整宽度；窄屏用覆盖 drawer，不能隐藏功能。
- 未被引用的 Source 可 `Remove from page`；已有 citations 时只允许 `Exclude from future drafts`，保留已有证据。被排除项显示 `Not used for new drafts / Include in drafts`；Header 数量统计全部关联 Sources，drafting 数量只在 Compose 表达。Citation 只随正文编辑删除。

### 4.5 Selection Skills

- Page 与网页可编辑目标的稳定非空选区附近显示轻量 Skills 入口。
- 菜单支持完整键盘导航；Esc 关闭/取消并恢复原选区。
- 写回前再次校验目标与 selection snapshot；目标失效或选择漂移后不得写回。
- 多行结果保留真实换行；不自动提交宿主表单。
- Page 替换进入同一编辑 history；网页只在安全时提供一次 Undo。
- 快捷键必须依据真实 Notion/宿主行为验证后定稿，不能凭记忆发明。

### 4.6 Extension Write with sources

- 网页原位 launcher 始终只有麦克风。
- Side Panel 渐进披露 `Write with sources`，使用明确 Sources 和默认 Skill。
- 结果可编辑，动作是 `Insert / Copy / Back`；Sources 在编辑框外展开，插入/复制默认只输出正文，不输出 Logue citation token，也绝不自动发送。
- 实际 Source IDs、annotation IDs、Skill revision、instruction、output 和 adopted target 写入 Run。
- Adopt 后不弹成功提示；Side Panel 在该规范化完整页面 URL 下保留可展开 `Sources used`，从 adopted Run 还原 Source 映射，允许之后重新打开证据。

### 4.7 On this page

- 只显示与当前规范化完整页面 URL 精确相同的 Sources，按 captured time 倒序、最多 5 条；规范化保留 path 与非追踪 query，移除 fragment、`utm_*`、`fbclid`、`gclid` 并统一 scheme/host/default port，不得退化成 origin 匹配。无法可靠取得 page URL 时不显示；第一版不做语义扩展或显示 Pages。
- 页面切换后立即刷新，不把旧页面内容继续显示为当前上下文。
- 点击结果在新标签打开 Web detail，不关闭 Side Panel，不抢宿主编辑焦点。

### 4.8 Projects

- Project brief 和 confirmed terms 可编辑、静默 autosave。
- Sources/Pages 只能由用户明确添加或移除。
- 不自动归 Project，不使用 Tags、Needs review、confidence 或 review queue。
- Project context 只作用于当前明确 Project，不跨项目混入。

### 4.9 Skills

- Settings 中支持 create、duplicate、rename、enable/disable、edit instruction。
- 修改产生 revision；Run 保留实际 revision 与来源。
- 无真实需求前不做模板市场、Agent 权限页、模型矩阵或工具编排。

### 4.10 删除

- Source/Page/Project overflow 都提供明确 `Delete…`。
- Page 删除不删除 Sources；Project 删除只解除 Source 关联并把 Pages 变为无 Project。
- Source 若被引用，确认层显示受影响 Page/citation 数量；确认后删除 Source、音频和对应 citations。

## 5. LAN / Linux 服务

- 同一可安装服务在 macOS/Linux 提供 production Web + API；目标机不需要开发依赖或项目原生构建工具。
- Linux 可显式监听可信 LAN/VPN 或位于受控反向代理后；当前无公网认证，安装与设置必须明确这一边界。
- Mac Chrome 使用独立、带校验和的 Extension 客户端资产，不要求 Mac 启动本地服务。
- Server URL 接受规范化 `http(s)` origin，拒绝凭据、query、fragment 与非 Web scheme，只存 `chrome.storage.local`。
- 只有当前页面是带 Logue product marker 的同源 Web App 时，才可建议精确 `Connect to {host}`；不得扫描 LAN、猜 host 或自动切换。
- 所有 Extension API 必须由 background 使用当前 Server URL；不得旁路直连 localhost。
- Chrome/MV3 worker、浏览器、Extension 和服务重启后必须恢复连接配置并完成真实工作流。

## 6. 数据、隐私与 API

目标 schema：

- `sources`
- `source_annotations`
- `pages`
- `page_sources`
- `projects`
- `project_sources`
- `skills` / `skill_revisions`
- `runs`

目标 routes：

- `/v1/sources`
- `/v1/search`
- `/v1/pages`
- `/v1/projects`
- `/v1/skills`
- `/v1/runs`
- `/v1/status`

删除 `/materials`、旧 Generate、external-agent import、project bundle 与所有兼容 aliases。首次基础切换必须原子完成：backup → best-effort import → 新 schema/routes → Extension/Web 切换 → 最小 Library 核验 → 删除旧 schema/routes/import code；不得留下双 schema。

- Model provider credentials 只由安装器/服务环境配置，不进入浏览器、Extension storage、内容或日志；Web 不提供输入、展示或复制。`Model & privacy` 只保留语义搜索开关、发送范围说明和非敏感 provider 名称。
- 默认只读取用户明确提供的 selection、目标文字、Source 和 Project context，不抓取整页正文。
- 网页内容始终是不可信引用，不能覆盖系统或 Skill 指令。
- 新 schema 的 export/restore 包含 Sources、audio、annotations、Pages、Projects、Skills、runs 与 settings。

## 7. UI/UX 与可访问性

- 使用共享 page/editor/reading axes、type scale、spacing、button、tooltip、row、drawer、dialog 和 resizer patterns。
- Minimalism 通过删除 UI 实现，不通过小字体或窄 panel 实现。
- 正常 connection、autosave、capture success 和后台记录保持安静。
- 每个区域最多一个主动作；无重复标题、重复来源、重复动作或常驻技术说明。
- Menu/Dialog/Drawer 关闭后恢复触发器焦点；loading 使用 polite status，失败使用 alert。
- icon button 至少 32px，有 accessible name、hover、focus-visible；颜色不单独表达状态。
- 支持 reduced motion；CJK 换行、单滚动归属和窄屏 drawer 必须真实检查。
- 视觉质量以当前 app.notion.com 和 chatgpt.com 真实页面为基准，比较层级、密度、轴线、可读性、状态与噪音。

## 8. 明确删除/不做

- Stream、Documents、Skills、Generate、Ask、Inbox、Daily、Agents 一级页面；
- Material、Document、Tag、Needs review、Daily item、Generation result 等旧对象；
- 自动 Project 归档、自动 Tags、低置信度 review queue；
- 聊天式记忆搜索、独立生成 workspace、生成历史页；
- external-agent UI/API、project bundles、Skill/Agent marketplace；
- 云账号、云同步、自动公网 tunnel、多服务器 dashboard；
- legacy schema/routes、双格式 parser、旧名称 fallback、兼容 fixtures；
- 为迁移现有 prototype 数据推迟更好的结构。

## 9. 交付顺序

1. **P0-A Capture → Recover**：同一原子批次完成 backup/best-effort import、新 schema/routes、Extension/Web 切换与旧存储删除；交付语音、选区、LAN、最小 Library/Source detail、删除、取消/幂等/目标失效。
2. **P0-B Recall → Make**：本地精确 Search、`New page from source`、基础 Page、Source picker、内置 Draft revision、grounded draft、citation；无 Project 时使用 All sources，Projects 上线前 Search 只返回 Sources/Pages 且 Page 不读取 Project context。
3. **P1-A Rich recall & reuse**：语义 Search、correction/annotations、Skill CRUD/revision、Side Panel Write with sources 与 adopted Run 的 Sources used。
4. **P1-B Project & selection**：Projects、Page 单 Project/Source 多 Project、Selection Skills、完整 Markdown shortcuts。
5. **P2 Page memory**：On this page 精确 URL Sources。
6. **Release gate**：新 schema export/restore、installer upgrade/rollback、clean install 与 legacy cleanup。

## 10. 真实验收

必须在真实环境完成：

1. ChatGPT、普通 textarea、contenteditable、Google Docs 的语音捕获、保存后插入、不自动提交。
2. starting/recording/transcribing/saving 取消，迟到结果不写回；目标失效后 Source 可恢复。
3. 右键保存完整选区，随后添加文字/语音 annotation，不重复原文。
4. Search 找回精确和语义证据；打开/返回状态完整恢复。
5. Page 空白创建、选择 Sources、grounded draft、Markdown、citation、Sources 定位/删除/Undo。
6. Page 与网页 Selection Skill 的取消、换行、目标漂移和 Undo。
7. Side Panel Write with sources 可编辑、插入、复制且不发送。
8. Linux Web/API、Mac Extension 精确 origin 连接、Chrome/MV3/服务重启。
9. 新 schema export/restore；prototype import 失败不影响发布。
10. Product scope、interaction、consistency 三名独立设计师分别审查，所有 blocker/major 修复后再次 PASS。

## 11. 完成定义

- 日常内容只有 Source、Page、Project；配置复用动作时额外理解 Skill。
- Capture、Recall、Make 三条主路径真实端到端通过。
- 每个关键事实都能回到真实 Source；生成不会静默扩大上下文。
- 正常体验安静、可读、一致；没有旧 IA、旧对象、兼容 routes 或双 schema。
- Web、Extension、Linux release、installer upgrade/rollback、export/restore 与清洁环境验收均通过。
- `DECISIONS_AND_RISKS.md` 没有未披露 blocker；独立设计审查全部 PASS。
- 全部验证证据对应当前实际安装版本、当前数据服务和当前代码，不用旧截图或 fixture 代替。
