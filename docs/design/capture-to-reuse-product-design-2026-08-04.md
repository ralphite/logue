# Logue clean-slate 产品与 UX 设计 v2

日期：2026-08-04
状态：目标产品合同；尚未代表实现完成
范围：Desktop Web App + Mac Chrome Extension

## 0. 设计权限与迁移立场

本方案从用户结果出发，不以当前代码、UI、对象、schema、routes、测试或本地数据为约束。旧实现只有在恰好符合本方案时才复用；不保留旧名称、旧入口、兼容 route、双 schema 或新旧并行 UI。

切换新模型前，可在成本合理时备份并做一次 best-effort 导入；失败记录只需报告，不能阻塞新产品发布。切换后删除迁移代码与旧存储。

## 1. 产品承诺

> 在任何工作现场说一次或保存一次，内容立即用于当前任务且原始证据不丢；以后能自然找回，并把明确选择的证据变成可编辑、可引用的产出。

Logue 不做另一个聊天首页，也不做需要持续整理的知识库。它只闭合三件事：

1. **Capture**：在当前网页输入或保存来源。
2. **Recall**：按内容和语义找回可核验的证据。
3. **Make**：把明确选择的证据变成 Page 或插回当前工作现场。

Extension 是现场入口；Web App 是长期记忆与写作空间。

## 2. 最小产品模型

用户只需要理解三个内容对象：

| 对象 | 用户理解 | 核心规则 |
| --- | --- | --- |
| **Source** | 保存下来的语音或网页选区 | 原始证据不可覆盖；批注与纠正独立保存 |
| **Page** | 可持续编辑的笔记、回复、QA、PRD 或文档 | 可空白创建或从 Sources 起草；引用可回到原始证据 |
| **Project** | 可选的工作范围 | 包含 brief、confirmed terms、明确关联的 Sources 与 Pages；不自动跨项目混合 |

`Skill` 是 Settings 中的可复用动作配置，不是一级内容对象。`Run / citation / revision / annotation` 是系统记录，不进入一级导航。

不再使用：`Material / Document / Tag / Inbox item / Daily item / Agent workspace / Generation result`。

### 2.1 权威关系与上下文

| 关系 | Cardinality | 用户动作 | 下游 Context |
| --- | --- | --- | --- |
| Page → Project | `0..1` | 明确选择；Project 内新建时自动预填 | 仅使用该 Project 的 brief/terms |
| Source ↔ Project | 多对多 | `Add / Remove` | Source picker 的默认范围 |
| Page ↔ Source | 多对多 | `Add sources / New page from source` | citation 与 drafting |
| Source → Correction | `0..1 active` | `Correct transcript` | Search/Draft 优先文本 |
| Source → Note | `0..n` | `Add note` | 默认不进入生成；用户需明确选择 |

Search 同时索引原文、active correction 和 notes，但结果始终指回同一 Source。Draft 默认使用 active correction，同时保留只读原文用于核验。Source picker 在存在 Notes 时提供折叠的 `Include notes`，展开后逐条 checkbox，默认全不选；request 与 Run 记录明确的 `annotation_ids`。Citation 仍指向 Source，detail 同时展示原文、correction、变更来源和本次使用的 Note。

## 3. 信息架构

### 3.1 一级结构

左侧导航只有：

- `Search`：侧栏顶部全局动作和快捷键，不属于一级导航，也不是聊天页。
- `Library`：默认入口；统一浏览 Sources 与 Pages。
- `Projects`：明确限定工作范围。
- `Settings`：Skills、Model & privacy、Export & backup。

不保留 `Stream / Documents / Skills / Generate / Ask / Inbox / Daily / Agents` 一级入口。

### 3.2 Library

- Header：`Library` 与唯一主动作 `New page`。
- 筛选：`All / Sources / Pages`，不显示数量徽章或分类状态。
- Source 使用 `captured_at`，Page 使用 `updated_at`；Library 为两类保留稳定结果配额，避免频繁 autosave 的 Page 长期挤掉新 Source。Source 显示摘录、来源、时间；Page 显示标题、项目、更新时间。
- 点击 Source 打开可调整宽度的详情 drawer；点击 Page 进入完整编辑器。
- 空状态：`Save something from the extension, or create a page.`
- 不出现 `Needs review / Unfiled / Filed / Tags / Organizing automatically`。

### 3.3 Projects

- 列表只显示名称、brief 摘要和内容数量。
- Project 内直接显示 `Sources / Pages` 两个分区；不复制 Library 的复杂筛选。
- Header 主动作 `New page`；次动作 `Add sources`。
- brief 与 confirmed terms 可直接编辑并静默 autosave。
- Project 归属只能由用户明确添加/移除。系统可以在未来建议，但不得后台静默写入。

### 3.4 Settings

- `Skills`
- `Model & privacy`
- `Export & backup`

Server URL 只属于 Extension 的断连恢复与 `Advanced`，因为它存于该 Chrome 安装；Web Settings 不复制该字段。Provider credentials 只由安装器/服务环境配置，Web 不输入、展示或复制。`Model & privacy` 只保留语义搜索开关、发送范围说明和非敏感 provider 名称；未配置模型时，在用户启用相关能力的位置显示局部配置指引。正常连接、保存和后台工作保持安静。

## 4. 功能取舍

| 候选 | clean-slate 决定 | 优先级 |
| --- | --- | --- |
| Universal Capture | 核心；极简语音 + 选区保存 | P0 |
| LAN / remote connection | 捕获基础设施，不做独立功能面 | P0 |
| Evidence search | 本地精确检索；不做聊天页 | P0-B |
| Semantic search | 配置模型后的远程语义扩展 | P1-A |
| Source-grounded drafting | 基础 Page draft + citation | P0-B |
| Markdown editor | 基础编辑 P0-B；完整 shortcuts P1-B | 分阶段 |
| Selection Skills | 保留为选区附近的可撤销动作 | P1-B |
| Page memory side panel | 保留为非空时出现的 `On this page` | P2 |
| Automatic organization | 删除；不自动归 Project，不建 review 状态 | 删除 |
| Tags | 删除；Search + Project 已覆盖价值 | 删除 |
| Daily resurfacing | 无重复用户需求，不做 | 删除 |
| Configurable Agents | 当前只有 Prompt 配置，继续叫 Skills | 删除 |

## 5. 工作流一：Capture

### 5.1 网页语音输入

默认流程：

`Focus editor → Record → Stop and insert / Cancel`

- 只有真实可编辑目标获得焦点时显示麦克风 launcher。
- 录音态只显示时长、`Stop and insert` 与 `Cancel`；不显示 Project、Skill、历史或连接成功。
- 仅在 recording 且非 IME composition/key repeat 时消费 `keydown`：`Enter` 停止，`Esc` 取消；事件不得传播到宿主或触发默认 submit。
- Side Panel 中无有效输入目标的页面批注使用 `Stop and save`。

事务顺序：

1. 停止采集并保留音频。
2. 转写。
3. 先保存 Source：音频、机器转写、准备插入文字、URL/title、时间、request ID。
4. 保存成功后写入仍有效的原目标。
5. 不按 Enter，不提交宿主表单。

`Cancel` 在 `starting / recording / transcribing / saving` 和插入完成前始终可用。它立即使 request token 失效，并在每个副作用前重新校验 token。Source commit 前取消不创建 Source；commit 后、插入前取消则保留已保存 Source、取消插入，并显示局部 `Saved to Library.` 与 `Insert again / Copy`。迟到回调不得继续保存、插入或重开 UI。

成功保持安静。错误只显示本地恢复动作：

| 问题 | 文案 | 动作 |
| --- | --- | --- |
| 麦克风权限 | `Microphone access is required.` | `Allow microphone` |
| 转写失败但音频仍在 | `Couldn't transcribe. Recording kept.` | `Retry` / `Cancel` |
| 保存失败 | `Couldn't save. Nothing was inserted.` | `Save again` / `Cancel` |
| 原目标失效，Source 已保存 | `The original editor is no longer available.` | `Insert again` / `Copy` |
| 服务不可达 | `Can't reach Logue.` | `Retry` / `Change server…` |

### 5.2 保存网页选区

- 右键 `Save to Logue` 立即保存完整选区；预览可以截断，保存内容不可截断。
- 成功保持安静，不强迫打开 Side Panel、选 Project 或填写表单。
- 保存失败时在原选区附近显示 `Couldn't save to Logue.`，动作 `Retry / Change server… / Dismiss`；保留同一 selection snapshot 与 request ID，重试不得重复创建，也不自动打开 Side Panel。
- Source detail 提供 `Add note`；支持文字或语音，每条 note 是独立 annotation，不覆盖原文。
- 静态网页的原文不做就地替换。

### 5.3 LAN / server

- 正常连接不显示状态。
- 断开时只在当前任务附近显示 `Can't reach Logue.`。
- `Change server…` 只存在于 Extension，接受规范化 `http(s)` origin；验证成功后保存并回到原任务。
- 只有当前页面是带产品 marker 的 Logue Web App 时，才能建议精确 `Connect to {host}`；不得扫描 LAN 或猜 host。
- Model provider credentials 只在服务端；默认不读取整页正文。
- 单一可安装服务提供 Web/API，可运行在受控 macOS/Linux，目标机不需要开发依赖；Mac Extension 不要求本机服务。

## 6. 工作流二：Recall

### 6.1 全局 Search

- 侧栏顶部入口；平台快捷键使用 `Mod+…` 表述并在真实宿主验证后定稿。任何快捷键不得在 input/textarea/contenteditable、IME 或 editor selection 中接管。打开后焦点进入搜索框。
- 搜索 Sources、Pages、Projects；不创建会话或回答历史。
- 精确命中优先；语义结果显示一句可理解的匹配理由。
- 结果使用一个全局排序列表，类型只由 icon/metadata 表达；全部精确命中先于语义结果。需要时使用 `All / Sources / Pages / Projects` filter，不增加分组标题。
- 自然语言问题返回证据，不直接生成无来源结论。
- 用户提交 Search 即授权服务搜索当前 Library。只有启用 `Semantic search with configured model` 时，服务才向远程模型发送 query 与受限候选摘录；该范围在 `Model & privacy` 一次性说明，不逐次弹窗。关闭后仍提供本地精确搜索。
- 打开结果前记录 row ID；返回时恢复 query、filter、scroll 和焦点。
- Search 使用 latest-query-wins：新 query、Clear 或关闭自动取消旧请求，不显示额外 Cancel。无结果显示 `No results` 并保留 query；失败显示 `Couldn't search. Retry.`，焦点留在输入框。loading 使用 polite status；`Clear search` 后焦点回搜索框。

### 6.2 Source detail

信息顺序：

1. 原始内容或转写。
2. 音频（如有）与真实时长。
3. 来源 title / domain / captured time / `Open original`。
4. active correction 与 annotations；原文始终可展开核验。
5. `New page from source` / `Add to project` / overflow `Delete source…`。

不显示 request ID、分类器、置信度、内部 context 或连接成功状态。原始 Source 只读；annotation 可编辑。

`New page from source` 首次激活后锁定该 row action 并使用稳定 request ID；成功只创建并导航一次，关联该 Source、聚焦正文，不改变 Source 的 Project 归属。失败保留完整 Search 状态，在原 row 显示 `Couldn't create page. Retry.`；Retry 复用同一 request ID，该快速 mutation 不额外显示 Cancel。向已有 Page 添加来源只从 Page 的 `Add sources` 进入。

删除 Source 是独立破坏性动作。若被 Page 引用，确认层显示受影响 Page/citation 数量；确认后删除 Source、音频和对应 citations。Project 删除只解除 Source 关联并把其 Pages 的 `project_id` 置空，不删除内容；Page 删除不删除 Sources。

### 6.3 On this page

- Side Panel 只有与当前规范化完整页面 URL 精确相同的 Sources 时显示 `On this page`，否则整段不出现。规范化统一 scheme/host 大小写与默认端口，保留 path 和非追踪 query，移除 fragment、`utm_*`、`fbclid`、`gclid`；不得退化成 origin 匹配。无法可靠取得 page URL 时不显示。
- 最多显示最近 5 条，按 captured time 倒序；第一版不做语义扩展，也不显示 Pages。
- 点击 Source 在新标签打开 Web detail；不关闭 Side Panel，不抢宿主编辑焦点。
- 页面切换后立即刷新，不把旧页面内容继续显示为当前上下文。

## 7. 工作流三：Make

### 7.1 新建与基于来源起草

核心流程：

`New page → Add sources → Draft with sources → Edit / cite`

- `New page` 立即打开空白 Page，标题默认 `Untitled`，焦点进入正文。Page 最多属于一个 Project；从 Project 新建时自动预填该 `project_id`。
- `Add sources` 打开统一 Source picker；Project 内创建默认当前 Project，其他入口默认 `All sources`。空状态无动作，只显示 `No sources yet. Save something with the extension, then return.`，保留标准 Close/Esc；在真实验证 Web→Extension 打开能力前不增加 bridge。
- 至少选择一条 Source 才显示 `Draft with sources`。
- `Draft with sources` 打开行内 compose：instruction、已选 Sources、产品内置且可编辑的默认 `Draft` Skill；`Change skill…` 位于 overflow。运行只使用用户明确选择的 Sources、当前 Project brief/terms 和指定 Skill revision。
- 生成中保留 instruction 与 Sources，显示 `Generating…` 和 `Cancel`；取消使迟到结果失效。
- 失败原地显示 `Retry`；不创建额外 Page、结果 workspace 或历史页。
- Run 启动时保存稳定 insertion anchor；结果只插入该 anchor，绝不覆盖已有正文。Anchor 失效时保留结果，显示 `Insertion point changed.` 与 `Insert at cursor / Copy / Close`，不得使用偶然的 current caret。完成后焦点位于插入内容末尾，并提供一次 Undo。模型不能生成不存在的 Source ID。

### 7.2 Page 编辑器

- 页面标题是第一视觉层级；标题下只显示可操作的 Project 与 `{n} sources`。
- 正文支持 Markdown shortcuts、lists、headings、bold、code 与可解析 citation。
- autosave 成功安静；失败在编辑位置显示 `Retry`，离开前保留本地草稿。
- 行内 citation 与 Sources panel 一一对应；点击 citation 会打开 panel、滚动、高亮并聚焦来源。
- 未被引用的 Source 可直接 `Remove from page`。已有 citations 时动作改为 `Exclude from future drafts`：仅把该 Source 移出后续 drafting context，已有 citations 与证据仍保留；citation 只随用户编辑正文而删除。被排除的 Source 继续显示在 Sources panel，并标记 `Not used for new drafts` 与动作 `Include in drafts`。Header 的 `{n} sources` 统计全部关联来源，drafting 数量只在 Compose 中表达。
- Page overflow 提供 `Delete page…`；删除 Page 不删除其 Sources。Project 删除规则见 §6.2。
- 桌面 Sources panel 可调整宽度；窄屏为覆盖 drawer，不能直接隐藏。
- 更新时间进入 actions/tooltip，不占据正文层级。

### 7.3 Selection Skills

`Select text → Skills → Apply → Undo`

- 只在同一可编辑目标、非空稳定选区、非 IME、非 repeat 时显示入口。
- 菜单打开时首个 Skill 获焦；方向键/Home/End 导航，Enter 执行，Esc 关闭并恢复原选区。
- pending 同时提供可见 `Cancel`；Esc 与 Cancel 等价并使迟到结果失效。
- Page 内替换进入同一编辑历史；网页替换只在目标仍存在且替换后文字未变化时显示 `Undo`。
- 结果返回时若目标或 selection snapshot 已失效，保留结果并显示 `Selection changed.` 与 `Copy / Close`，不得写回。Apply 后焦点位于替换范围末尾；Undo 恢复原文字和原选区；点击外部关闭菜单也恢复原选区。
- 多行结果保留真实换行；绝不自动提交网页表单。
- history 记录失败只能补写 history，不得再次替换文本。
- 快捷键只有在真实 Notion/宿主验证后才能定稿；不凭记忆发明默认组合。

### 7.4 Extension `Write with sources`

- 网页原位 launcher 始终只有麦克风；写作入口在 Side Panel 渐进披露。
- Compose 复用统一 Source picker，只包含 instruction、当前选择的 Sources 和一个默认 Skill；至少一条 Source 后才显示 `Run`，`Change skill…` 位于 overflow。
- 生成期间保留 instruction/Sources 并提供 `Cancel`；失败原地 `Retry`。
- 结果可编辑，主动作 `Insert`，次动作 `Copy`，左上 `Back`。
- 目标失效时禁用 Insert，显示 `The original editor is no longer available.` 与 `Copy`。Insert 后焦点回宿主插入末尾；Copy 使用一次 polite `Copied`；Back 返回 compose 并保留 instruction、Sources 和结果。
- Side Panel 在编辑框外显示可展开 Sources；`Insert / Copy` 默认只输出用户编辑后的正文，不插入或泄露 Logue citation token。Run 保留 Source IDs 与映射；只有 Skill 明确要求时才把引用作为普通输出文字插入。
- Insert/Copy adopted 后不弹成功提示；Side Panel 在该规范化完整页面 URL 下保留渐进展开的 `Sources used`，从 adopted Run 还原 Source 映射，使用户之后仍能打开证据。
- 关闭/取消使迟到结果失效。

## 8. Skills（Settings 内）

- 列表显示名称、适用表面和 enable 状态；没有模板市场或 Agent 权限面板。
- 用户可新建、复制、重命名、启用/停用和编辑 instruction。
- 每次修改形成 revision；Run 记录实际 revision、Source IDs、明确选择的 annotation IDs、Project context、instruction、output 与 adopted target。
- 用户只配置任务与输出；模型、工具权限和内部 JSON 放在 `Advanced` 或完全不暴露。
- 只有真实具备 triggers、tools、permissions、runs 的自治对象未来才命名为 `Agent`。

## 9. 共享交互合同

| 状态 | 主动作 | 次动作 | 迟到结果 | 焦点与播报 |
| --- | --- | --- | --- | --- |
| `idle` | 当前任务动作 | 返回（如需要） | 不适用 | 留在任务入口 |
| `pending` | 禁用重复提交 | `Cancel` | request token 失效后丢弃 | polite status，不抢焦点 |
| `recoverable_error` | `Retry` | `Cancel` / `Copy` | 旧请求不得覆盖新状态 | alert；焦点到恢复动作 |
| `cancelled` | 返回原任务 | 无 | 不得保存、写回或重开 UI | 恢复触发器/原选区 |
| `applied` | 继续原任务 | 安全时一次 `Undo` | history 重试不得再次应用 | 成功安静 |

- Menu/Dialog/Drawer 关闭后恢复原触发器焦点。Dialog/覆盖 Drawer 打开时聚焦标题或首个可用控件，Tab/Shift+Tab 留在浮层内，背景 inert；Esc 先取消 pending，第二次关闭浮层。
- Drawer 和长 Dialog 的 Header 固定，内容只有一个滚动归属；Menu 不使用固定 Header。
- 窄屏主导航折叠为原生 menu/drawer；同一时刻只允许一个覆盖层。Library detail 与 Page Sources 复用 full-width drawer 合同，不产生横向滚动。
- Icon button 至少 32px，有 accessible name、hover、focus-visible。
- 颜色不单独传达状态；支持 reduced motion。
- Chrome 原生 Side Panel 以 360px 为设计基线，但尊重用户实际宽度，不提供自定义关闭或尺寸控件。

## 10. Clean-slate 数据与 API

建议只保留：

- `sources`
- `source_annotations`
- `pages`
- `page_sources`
- `projects`
- `project_sources`
- `skills` / `skill_revisions`
- `runs`

公开 API 直接切为：

- `/v1/sources`
- `/v1/search`
- `/v1/pages`
- `/v1/projects`
- `/v1/skills`
- `/v1/runs`
- `/v1/status`

删除 `/materials`、旧 Generate、external-agent import、project bundle 和所有兼容 alias。若未来出现真实外部集成需求，再从 Source/Page/Project 权限模型单独设计。

一次性切换：`backup → best-effort import → report failures → cut over → delete migration`。迁移成功率不是 release gate。

## 11. 交付顺序与验收

### P0-A — Capture → Recover

- 同一原子批次完成：backup → best-effort import → 新 schema/routes → Extension/Web 切换 → 删除旧 schema/routes/import code；不得留下双轨。
- 语音、右键保存选区、LAN、最小 Library/Source detail、删除、取消/幂等/目标失效在真实 ChatGPT、textarea、contenteditable、Google Docs 通过。
- 一次操作只创建一条 Source、一次插入、零自动提交；记录实际 Extension 版本与资产路径。

### P0-B — Recall → Make

- 本地精确 Search、`New page from source`、基础 Page 编辑、统一 Source picker、内置 Draft revision、grounded draft、citation。
- 无 Project 时使用 `All sources`；Projects 上线前 Search 只返回 Sources/Pages，Page 不读取 Project context。生成取消/迟到结果与 citation 核验通过。

### P1-A — Rich recall & reuse

- 语义 Search、correction/annotations、Skill CRUD/revision、Side Panel `Write with sources` 与 adopted Run 的 `Sources used`。

### P1-B — Project & selection workflows

- Projects、Page 单 Project/Source 多 Project、Selection Skills、完整 Markdown shortcuts。

### P2 — Page memory

- `On this page` 精确 URL Sources；不扩展语义匹配。

### Release gate

- 新 schema export/restore、installer upgrade/rollback、clean install 与 legacy cleanup 完成真实验收。

## 12. 完成门槛

- 日常内容只有 Source、Page、Project 三个对象；用户配置复用动作时额外理解 Skill。
- 所有关键事实都能回到真实 Source、URL、时间和音频。
- Capture、Search、Page drafting、Selection Skill 在真实宿主端到端完成。
- 正常成功、连接、autosave 和后台记录保持安静。
- 没有旧 IA、旧对象、兼容 routes、双 schema 或无真实价值的功能表面。
- 设计师独立审查在产品范围、交互与一致性三个方向均无 blocker/major。
