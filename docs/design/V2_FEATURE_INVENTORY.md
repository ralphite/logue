# Logue V2 Feature Inventory

唯一依据：[`logue-ai-product-positioning-2026-08-04.md`](./logue-ai-product-positioning-2026-08-04.md)。用户最新明确决定优先。此文件只用于 PHASE 1 burn-down，不是完成证据。

状态定义：

- `MISSING`：没有可映射的 production 实现。
- `CODED`：已有代码，但 production import、API producer-consumer 或跨表面链仍断裂。
- `INTEGRATED`：静态可确认 production consumer 已挂载且 API/Host producer 已连接；仍未做 runtime 验证，不等于 `WORKING`。
- `ACTIVE`：当前唯一 writer 批次。WIP 无法映射到以下 ID 时冻结但不丢弃。

## Platform

- V2-PLAT-01 — INTEGRATED — 产品名 Logue、官网 logue.ai、五个一级入口 Projects / Library / Documents / Skills / Settings。
- V2-PLAT-02 — INTEGRATED — local-first、single-owner、无账号/成员/Workspace/套餐。
- V2-PLAT-03 — INTEGRATED — Web 与 Extension 连接同一个 owner-controlled Host。
- V2-PLAT-04 — INTEGRATED — 仅远程 Gemini / OpenAI-compatible provider；无本地模型产品路径。
- V2-PLAT-05 — INTEGRATED — provider 未 Ready 时仍可浏览本地五个 V2 入口；AI/Voice 动作显示局部恢复并从 Settings 连接。
- V2-PLAT-06 — INTEGRATED — Web、Side Panel、Inline Voice、Selection 的 production root 均挂载 V2 surface；V1 只保留不可见工程原语。

## Source、Context 与 lineage

- V2-LIN-01 — INTEGRATED — Web / You / AI Origin 与 Comment bundle topology。
- V2-LIN-02 — INTEGRATED — Voice audio / raw transcript / normalized transcript / transcript revisions 永久分层。
- V2-LIN-03 — INTEGRATED — Voice/Text/Capture input 永久保存；Extension Voice/Text Command 与 Web Ask/Compare/Draft/Continue 先保存永久 You Activity，再由 Run 链接；Side Panel 直接保留 Host 返回的 failed Run，Retry 使用 `retry_run_id` 复用原 Activity 与 frozen Context，不重复保存 Activity。
- V2-LIN-04 — INTEGRATED — 永久保存与 Project Context membership 分离；Voice Write/Activity 不自动进入 Context。
- V2-LIN-05 — INTEGRATED — Saved only / Suggested / Added / Excluded 与 included/excluded Host 互斥。
- V2-LIN-06 — INTEGRATED — Comment bundle 作为单一用户概念显示并共享 membership 决定。
- V2-LIN-07 — INTEGRATED — Run 冻结 actual Sources、Skill revision、Context 与 Candidate；未采用 Candidate 不成为 Source。
- V2-LIN-08 — INTEGRATED — Copy/Insert/Replace/Keep/Document 追加稳定 adoption event，Run 与 AI Source / Document revision 共享同一事件；Undo 精确标记对应 Insert/Replace event，不覆盖此前 adoption。允许产品已定义的 Insert/Copy 后继续 Save as Document，同时保留两条 target lineage。
- V2-LIN-09 — INTEGRATED — inline citation 编号使用 frozen `source_ids`；完整 Run Context 独立保存。
- V2-LIN-10 — INTEGRATED — Document revision 保存 frozen source snapshots；restore endpoint 与 production consumers 已接。
- V2-LIN-11 — INTEGRATED — AI Source 每次编辑冻结正文、parent IDs 与 exact Source snapshots；历史可核验 Web/You/AI evidence，Restore 始终创建更高 revision 且不改变 membership。
- V2-LIN-12 — INTEGRATED — Page anchor 保留 immutable evidence snapshot；Host 强制 Comment parent identity 与 revision CAS，贯通 Anchored / Page changed / Re-anchored / Snapshot only 及同 Source 重锚。

## Extension — Universal Voice Write (J2)

- V2-VW-01 — INTEGRATED — 支持输入目标的 Inline mic 与 Voice Write shortcut。
- V2-VW-02 — INTEGRATED — Password/支付/敏感字段不启动 Voice Write。
- V2-VW-03 — INTEGRATED — Recording → Saved raw → Transcribing → Candidate；Recording Cancel 零写入。
- V2-VW-04 — INTEGRATED — Candidate 编辑、Insert、Esc dismiss、target lost Copy/Open、局部 Undo，且不触发宿主 Submit。
- V2-VW-05 — INTEGRATED — Voice Write Insert/Copy/Undo 使用永久 Adopted revision，明确持久化 Copy/Insert action 与 target，并保留失败重试。
- V2-VW-06 — INTEGRATED — active Project 只影响 transcription，并产生 Suggested membership，不自动入 Context。
- V2-VW-07 — INTEGRATED — 录音前显示 Profile，并可选 Default/Disabled/另一 Project、一次性语言与 Topic Vocabulary。
- V2-VW-08 — INTEGRATED — 同一原音 Re-transcribe 产生新 revision，保留 Profile/Topic/Skill lineage且不改 membership。
- V2-VW-09 — INTEGRATED — Only this time / Topic / Project / Global 纠词与 Project delta 继承。

## Extension — Voice Command / sourced Draft (J1/J6)

- V2-CMD-01 — INTEGRATED — 独立 Command shortcut/明确 mode 直接录音；页面内 Launcher 是普通网页与 Google Docs 的唯一入口 owner，并显示 scope、Project 与 current target。
- V2-CMD-02 — INTEGRATED — Voice/Text command 一次 Enter 执行；缺失/冲突就地 clarification；Esc/Cancel 恢复焦点并真正取消本次 evidence/Run、保留 Activity。
- V2-CMD-03 — INTEGRATED — Voice/Text Command 提交先创建永久 You Activity Source；pending recovery 与 Activity→evidence→Run 使用稳定幂等 lineage，失败或取消不丢用户输入。
- V2-CMD-04 — INTEGRATED — parse/Model failure 保留可恢复 failed Run/Candidate；Side Panel 的 Voice/Text Command 与 Page/Selection Action 都从同一原 Run Retry，不虚假成功或重建 Source。
- V2-CMD-05 — INTEGRATED — 多来源结果进入同 tab Side Panel，显示 actual Sources，支持 Pin/Exclude 本次 Context。
- V2-CMD-06 — INTEGRATED — Side Panel Ask/Draft Candidate 编辑与 Insert/Copy/Keep/Document 使用统一 adoption 合同；Keep 以稳定 identity 物化永久 AI Source、继承 exact Run Sources 并即时 Undo；Document 明确选择新建或更新当前 Project Document，更新创建新 revision并保留即时 Undo。
- V2-CMD-07 — INTEGRATED — Insert 采用单一 AI Source 并追加稳定 adoption event；Undo 按 event ID 保留 target 与 persistent undone lineage，插入后保存失败可用同 ID 幂等重试。
- V2-CMD-08 — INTEGRATED — target expired 禁用 Insert并保留 Copy/Open in Logue。
- V2-CMD-09 — INTEGRATED — citation inspector 打开 frozen Web/You/AI snapshot 与原 URL。

## Extension — Capture、Comment、Actions (J3/J5)

- V2-CAP-01 — INTEGRATED — Page / Selection Capture 保存 Web Source，并应用 tab-scoped Project/Saved-only 规则。
- V2-CAP-02 — INTEGRATED — Selection Voice Comment 默认 `Mic → Accept/Enter`，原子 Web+You bundle；Cancel/Esc 零写入。
- V2-CAP-03 — INTEGRATED — Page/Selection Text Comment 均通过 production Side Panel 建立原子 Web+You bundle；页面正文/标题保留为可恢复 Web snapshot。
- V2-CAP-04 — INTEGRATED — Side Panel Comment 可编辑正文、tags 与多 Project membership，并显示 Auto-added / Suggested / Excluded / Duplicate-linked reason；保存复用现有 bundle members，不创建重复 Comment。
- V2-CAP-05 — INTEGRATED — Advanced Voice Comment Stop 先在 Host 永久保存原音、冻结 context 与 Unlinked You Comment；转写失败只重试同一 identity，Candidate 与重开页面均可 Finish linking/Delete 成为 Web+You bundle。
- V2-CAP-06 — INTEGRATED — Page/Selection scope 与 Save / Translate / Rewrite / Summarize / Explain 等 Skill 动作。
- V2-CAP-07 — INTEGRATED — pinned/recent 具体 Skills 一击运行，More Skills 选择后立即运行。
- V2-CAP-08 — INTEGRATED — editable selection Replace/Undo、静态 Copy/Keep 与可选 Document target 使用统一 adoption 合同；Document 更新创建新 revision并可从 Candidate 撤销为新的恢复 revision，新建 Document 后保留 Candidate 并可即时 Undo 为可恢复 tombstone；普通页面、Google Docs proxy 与 Side Panel 使用同一 typed adoption。
- V2-CAP-09 — INTEGRATED — 原文不被 Candidate 静默覆盖；Cancel 不改原文。

## Extension — Active Project、Side Panel、offline

- V2-PANEL-01 — INTEGRATED — active Project 按 tab 保存并随同 tab 导航保持；新 tab 默认 No project。
- V2-PANEL-02 — INTEGRATED — Host-owned Remember for page/site 规则可见、可删；page > site，新 tab 自动解析，显式 Project/No project 与同-tab保持优先，Archived/Deleted 不应用。
- V2-PANEL-03 — INTEGRATED — No Project 时 Side Panel 用 Name + 可选 goal 创建真实 Host Project，并立即设为当前 tab 的显式 Active Project。
- V2-PANEL-04 — INTEGRATED — Side Panel 当前页/选区、Comments、Project、classification、Ask/Draft、Source inspector 与 target recovery。
- V2-PANEL-05 — INTEGRATED — 开始前离线只在 pending queue 可写时允许录音；中途断线保存并重连上传。
- V2-PANEL-06 — INTEGRATED — pending capture 的 Retry / Export audio / Delete。
- V2-PANEL-07 — INTEGRATED — Inline/Selection/Side Panel 都在录音前检查本地 pending queue 可写性与容量；满 20 条时 Side Panel 明确阻止录音并保留 Retry / Export audio / Delete 恢复路径。
- V2-PANEL-08 — INTEGRATED — 单次麦克风授权、本地 Host发现/配对、Reconnect 与 LAN Advanced connection。

## Web — Projects (J4/J6/J7)

- V2-PROJ-01 — INTEGRATED — 创建、切换、稳定 ID rename、archive/restore、依赖预览 delete 已接；rename 在单一可回滚 root transaction 中同步当前 Source/Document/Run、classification 与 membership origin。
- V2-PROJ-02 — INTEGRATED — Project name、goal/overview、instructions 的 Host/Web 数据链。
- V2-PROJ-03 — INTEGRATED — 无显式 view 的 Web 根入口默认回到 Projects；workspace 显示并恢复最近 Project、Document、Ask/Compare/Draft 模式与最近工作，Document 路由恢复最近选择、caret 与 scroll；`view=library` / Global Find 明确进入 Library。
- V2-PROJ-04 — INTEGRATED — Context review 的 Suggested/Added/Excluded、reason、Add/Remove/Exclude/Undo exclusion。
- V2-PROJ-05 — INTEGRATED — Context review 区分 Auto-added / Added / Suggested / Excluded / Duplicate-linked；Change Project 使用 bundle 级 Host 合同，重复 Source 保留但 Run/Project retrieval 不重复加权。
- V2-PROJ-06 — INTEGRATED — 本次 Run Sources 可 Pin/Exclude/补充，不改变 membership。
- V2-PROJ-07 — INTEGRATED — production-owned Project Composer 以真实 submit 连接 Ask/Draft Candidate、实际 Sources、Copy、canonical Keep in Logue/Undo，以及明确选择 New Document / 当前 Project Existing Document；Keep 与 Document 均继承 exact Run Sources 和稳定 lineage；不显示无 handler 的重复 Mic。
- V2-PROJ-08 — INTEGRATED — Compare 独立选择 Sources/Topics并要求结构化差异与证据缺口，Activity 持久化为独立 `compare` subtype；Continue/Retry 从历史 Run frozen snapshots 与 model context 创建带 lineage 的新 Run，即使 Source 已删除也不失效；持久化 `model_context` 与 provider 实际输入逐字段一致，并且不覆盖旧 Candidate。
- V2-PROJ-09 — INTEGRATED — Ask/Compare/Draft/Continue 的 prompt 先成为具有准确 subtype 的永久 You Activity Source，再创建带同一 lineage 的 Run。
- V2-PROJ-10 — INTEGRATED — Project History 打开 Run、Candidate、Sources、Skill revision 与 adopted target。
- V2-PROJ-11 — INTEGRATED — Project History 已接 Pin/Unpin、frozen retry lineage、依赖预览与 adopted/downstream-aware 安全删除。
- V2-PROJ-12 — INTEGRATED — Project settings 汇总 Voice Profile、Skill overrides、相关 Topics、Archive/Restore、Project-scope Export 与依赖预览 Delete。
- V2-PROJ-13 — INTEGRATED — Source-linked Classification memory、bundle 去重、Project delete/export 的单一 outcomes schema，以及 rename 的可回滚 transaction / membership origin 已闭合。

## Web — Transcription Profile / Topic Vocabulary (J4)

- V2-VOICE-01 — INTEGRATED — Global Transcription Skill、Personal context/vocabulary、primary/mixed language、preferred spelling。
- V2-VOICE-02 — INTEGRATED — Project Profile Inherited / Customized / Disabled 与 language/custom instructions/Skill override。
- V2-VOICE-03 — INTEGRATED — Default 与 Project Profile 都可管理 phrases / avoid terms / formatting preference；Host 按继承 delta 解析并冻结 applied context，Extension 录音前显示实际 Profile 摘要，Disabled 不读取 Project 字段。
- V2-VOICE-04 — INTEGRATED — Project override 只保存 delta；Global 其他字段继续继承，同词 Project 覆盖不泄漏。
- V2-VOICE-05 — INTEGRATED — Topic Vocabulary 独立词汇集合，不携带 Sources、不授予 Project Context。
- V2-VOICE-06 — INTEGRATED — Web Term suggestions 可逐条 Ignore，或选择 Global / Project / Topic Vocabulary 后 Remember；Project 写入 profile delta，Topic/Global 写入各自 vocabulary，均不改 Source membership。
- V2-VOICE-07 — INTEGRATED — Inline/Side Panel Profile picker 与 one-shot Topic/language。
- V2-VOICE-08 — INTEGRATED — Re-transcribe revision、原音、Profile/Topic/Skill lineage 与 membership 不变。

## Web — Library / Find (J7/J8)

- V2-LIB-01 — INTEGRATED — Saved content / All activity 分区与 content-first list；Comment bundle 单条显示。
- V2-LIB-02 — INTEGRATED — 无查询浏览与本地 exact search。
- V2-LIB-03 — INTEGRATED — Host 在远程 provider Ready 时对 bounded Source/Document candidates 做语义排序并返回可解释 reason；未 Ready/失败时安静回退本地 exact ranking，不阻断 Library。
- V2-LIB-04 — INTEGRATED — Project / Topic / origin / time / site / type / adopted filters 作用于同一 content-first 结果集，可组合并一键清除；Comment bundle 仍保持单条，Global Find 的 Document 结果服从适用筛选条件。
- V2-LIB-05 — INTEGRATED — 可调宽 Source inspector 从 Comment bundle 单条入口核验 Web/You 两层，并呈现 original/raw/transformed/saved、audio、可打开 parents、adopted versions、实际 Profile/Topic/Skill/language lineage。
- V2-LIB-06 — INTEGRATED — Source 打开、回原 URL、Project membership、Exclude/Undo。
- V2-LIB-07 — INTEGRATED — content-first 多选使用 bundle 级 Add/Exclude；普通 Source 与完整 Comment bundle 共用依赖感知 Delete，bundle 内部 Web→You 关系不再产生假 tombstone；所选范围可 Export 或作为指定 Project Draft 的本次 Run Sources而不改变 membership。
- V2-LIB-08 — INTEGRATED — All activity 从 Ask/Compare/Draft/Voice/Text Command 的准确永久 You Activity 打开关联 Run，可恢复未采用 Candidate，并支持 Copy、canonical Keep in Logue → 永久 AI Source、Keep 即时 Undo、选择 New/Existing Project Document、exact frozen Sources、Document update 即时 Undo、failed Run Retry、Pin/Unpin 与依赖预览 Delete；Activity/Run 保持在 Project Context 外。
- V2-LIB-09 — INTEGRATED — Global Find 打开并在 Library 定位真实结果。
- V2-LIB-10 — INTEGRATED — AI Source revision/history/restore 由 V2-LIN-11 与 V2-LIB-05 的 production inspector 完整接通。

## Web — Documents

- V2-DOC-01 — INTEGRATED — 可编辑 rich text/Markdown、heading/list/quote/code/link 与 autosave。
- V2-DOC-02 — INTEGRATED — 最近 Document、caret 与 scroll 可恢复；显式 Undo / Redo 与浏览器原生编辑历史、autosave、dirty state 使用同一正文。
- V2-DOC-03 — INTEGRATED — Web Document 默认 Copy；显式选择 live Extension target 后 Send，Extension 逐次复验并局部 Undo，失效时保留 Document 并回退改选。
- V2-DOC-04 — INTEGRATED — 选区/全文 Action 与指定 Project Sources。
- V2-DOC-05 — INTEGRATED — Action Replace/Copy/Keep 使用统一 AI Source / Document revision adoption 合同；Keep 成功后保留 Candidate，并以原 adoption ID 提供即时 Undo。
- V2-DOC-06 — INTEGRATED — revision history 与 Restore as new revision endpoint。
- V2-DOC-07 — INTEGRATED — frozen exact IDs/snapshots producer-consumer 已接。
- V2-DOC-08 — INTEGRATED — citation inspector 区分 Origin并打开 frozen Source/URL。
- V2-DOC-09 — INTEGRATED — Export Markdown、Delete Document、Pin revision as Source；Pin 会冻结目标 revision 正文并记录 exact Document ID + revision。
- V2-DOC-10 — INTEGRATED — 历史 revision 使用统一 dependency preview / fingerprint / terminal state；无 Pin 依赖时物理删除，有依赖时保留最小 lineage marker，当前版与其他 frozen revision 不改写。

## Web — Skills

- V2-SKILL-01 — INTEGRATED — Built-in / My Skills 两种来源与五类执行合同。
- V2-SKILL-02 — INTEGRATED — My Skill create/edit new revision/copy/archive 与 Built-in copy/bind。
- V2-SKILL-03 — INTEGRATED — My Skill revision history/restore 与 Built-in Pin/Hide 已接真实 Host/Web 状态；最终 runtime 验证留到 Phase 5。
- V2-SKILL-04 — INTEGRATED — Global default bindings 与 Project inherit/override/reset。
- V2-SKILL-05 — INTEGRATED — resolver explicit → Project → Global → system。
- V2-SKILL-06 — INTEGRATED — Selection 快捷条先显示用户配置的 pinned Skills，再按当前 Extension recent use 排序；Built-in 与 My Skills 都可配置 pin，隐藏 Skill 不进入 More Skills，选择后立即运行。
- V2-SKILL-07 — INTEGRATED — Run details 显示 Skill ID/revision、解析来源、actual Context/state。
- V2-SKILL-08 — INTEGRATED — Copy/Replace/Insert/Keep/Document consumers 复用统一 adoption event/revision 合同与稳定 action union；Keep 以稳定 identity 物化永久 AI Source、冻结 exact Run Sources/target/content，并通过同一 event 幂等重试或即时 Undo 为 lineage tombstone；Selection/Page Candidate 新建或更新 Document 后均保留统一恢复入口，同 ID Undo 保留 exact frozen Sources 与 lineage，Document consumers 不保留第二套保存语义。

## Web — Settings / Provider / data controls (J1/J9)

- V2-SET-01 — INTEGRATED — 无显式 route 的首次打开挂载远程 provider Connect/Test/Save Setup；Host 的 Test 与 Save check 都必须以进程内最小 WAV probe 同时验证 generation 与 transcription，成功后才返回 Ready；无账号、无本地模型，并可直接 Browse local Library，不阻断本机内容。
- V2-SET-02 — INTEGRATED — 初始与运行后 readiness 使用 canonical provider health：generation/voice 独立验证、失败、恢复和持久化；overall 只用于 Setup，Projects/Documents 只消费 generation，Extension 保持 Host/local composer 可用并在失败能力局部提供 Retry 与 Models 入口；配置存在不再冒充 Ready。
- V2-SET-03 — INTEGRATED — provider 未 Ready 不阻断本地内容浏览，AI/Voice 使用时提示 Settings → Models。
- V2-SET-04 — INTEGRATED — Host `/v1/status` 以当前 `storage_root` 内普通文件的真实字节数提供 storage usage，Settings 与数据目录、模型处理边界共同消费；pending captures 通过受信任 Extension bridge 提供 List / Retry / Export audio / Delete，Stop-first Comment 删除同步 Host material 与本地 queue。最终真实运行验收留 Phase 5。
- V2-SET-05 — INTEGRATED — paired Extension clients 查看/命名/撤销。
- V2-SET-06 — INTEGRATED — Settings 使用内容列表消费 Host-managed snapshots，支持 fresh/default workspace 创建备份、下载当前 schema `.logue-backup`、安全迁入另一台 Host、明确确认与恢复；Host 在 snapshot staging 物化默认 settings，并以 opaque ID、archive 白名单、workspace barrier/generation、Restore 前备份、可回滚 swap 和 runtime reload 闭合真实 producer-consumer。
- V2-SET-07 — INTEGRATED — V2 Settings 与 Project 使用稳定 Project ID 选择 All saved data / Library / Project；scope-safe Export、classification outcomes 投影、统一 deletion 与 backup 静态合同已闭合。
- V2-SET-08 — INTEGRATED — `Include activity history and unused AI drafts` 明确控制 scope 内 Activity Sources / unadopted Runs；默认只含 Saved content 与 adopted lineage，Project frozen snapshots 不扩权到其他 Project 当前对象。
- V2-SET-09 — INTEGRATED — Host-owned dependency preview / fingerprint / terminal result 已接；普通 Source、Comment bundle、Project classification memory、fresh workspace backup 与失败回滚的静态合同已统一。
- V2-SET-10 — INTEGRATED — 新 Run 在 provider 调用前冻结实际 instruction、Skill instructions/revision、Project/Personal/Page Context 与 Sources；Settings → Privacy 以内容列表打开共享可调宽 Run inspector，不复制第二套 Run 状态。

## Topics / PKM

- V2-TOP-01 — INTEGRATED — dynamic Topics Host/API 与 Library → Topics production workbench 已挂载。
- V2-TOP-02 — INTEGRATED — Topic 以 Comment bundle root 显示 exact duplicate 与 suggested conflict/supplement；Project/Vocabulary suggestions 只有用户明确 Add/Remember 后才写入 Context 或所选 Topic/Project/Global vocabulary；Remember 的目标写入与 resolved 标记使用单一 Host root transaction，任一步失败恢复事务前状态。
- V2-TOP-03 — INTEGRATED — rename/merge/hide/split/convert-to-Project 的 Host/API 与 production consumer 已接通；merge、split、convert 的新旧 Topic、Project 与 Source membership 共享 Host root transaction，窄范围故障注入证明失败完整回滚。
- V2-TOP-04 — INTEGRATED — Topic Vocabulary 与 Project Context 权限隔离。
- V2-TOP-05 — INTEGRATED — Duplicate-linked 保留原 Source；Project retrieval 过滤已链接副本，Host 在同 Run 同时选择 canonical/duplicate 时只冻结一次 evidence。

## Host/API、install、release

- V2-OPS-01 — INTEGRATED — Host 数据目录为唯一权威；Extension 仅持有 client connection、tab/target 与 pending capture 状态；MV3 worker 启动或任一 surface 确认 Host 可达后，以单一 replay 从最旧到最新重试 pending captures，失败项保留且不阻塞后项。
- V2-OPS-02 — INTEGRATED — Source/membership/comment/run/document/profile/topic/skill API 主链已接；所有 Run / Document / Voice adoption 均由调用边界生成且由 Host 强制要求稳定 ID，幂等重试与 Undo 不再退化为隐式新事件或“最近一次”；Run 同时记录 AI Source 与后续 Document adoption，不再用单一字段互相覆盖。
- V2-OPS-03 — INTEGRATED — 当前 `.logue-data` 的 Voice/Profile/revision schema 已完成显式备份和一次性更新；production Python Host 与 Web callers 已删除四条绕过 Run/adoption 的旧 route，通用 Run PATCH 也拒绝直接写 `adopted_output` / `document_id` / `material_id`，无 production 入口且语义冲突的 Go Host 已移除，当前 schema/API/runtime 是唯一权威。
- V2-OPS-04 — INTEGRATED — Material 内嵌 `annotation` 已在 Host、Extension、Web、Search、共享 types 与 Backup/Export schema 中删除；当前唯一旧记录已在外部完整备份后一次性转换为 Web+You Comment bundle，未保留迁移代码或双读。Production V2 Web 的入口解析、导航与 Global Find 只写入和接受权威 `view=library`，不再保留 `view=stream` 别名或双解析。
- V2-OPS-05 — INTEGRATED — installer 在 managed 写入前拒绝 data/snapshot 路径重叠；旧 Linux 默认 workspace 与全部 Host snapshots 使用需确认、停服冻结校验、失败恢复旧 version/unit/path/active/enabled 的一次性迁移；程序 rollback 永不接管 data root。真实安装验收留 Phase 5。
- V2-OPS-06 — INTEGRATED — workspace packages、release tag、Host VERSION、Extension version/version_name、split installer、fixtures 与 remote smoke 已使用同一 release identity；首次 Load 与升级 Reload 状态准确。真实 artifact 发布验收留 Phase 5。
- V2-OPS-07 — INTEGRATED — production bundle 在 logue.ai/www.logue.ai 挂载 V2 Landing，本机仍直接进入 Projects；真实 release/installer、Docs、Privacy 与未擅自选择开源模式的 License section 已连接。

## Failure recovery / keyboard / accessibility

- V2-FAIL-01 — INTEGRATED — Host offline 与 transcription failure 保留本地录音并提供 Retry/Reconnect/Export/Delete；provider 未 Ready 指向 Settings，失败 Run 与 Sources 在 Web/Side Panel 保留并以原 lineage Retry；target lost / insert changed 保留 Candidate/Document 并只提供 Copy、改选 target 或安全局部 Undo。
- V2-FAIL-02 — INTEGRATED — Enter mode-local、Esc/Cancel、阻止宿主 Submit 的 Inline/Command/Comment 键盘合同。
- V2-FAIL-03 — INTEGRATED — Voice Write 与 Voice Command 是独立 Chrome Commands；Settings → Voice 显示实际 shortcut，键盘录入后由 Extension 原子更新，冲突/无效组合保留旧值，并可恢复 manifest 默认值。
- V2-FAIL-04 — INTEGRATED — production V2 OverlayMenu、modal Project dialogs 与共享 inspector 使用统一 focus 合同：键盘打开进入有效控件、Esc 只关当前层、modal 循环焦点，关闭后返回原触发控件。
- V2-FAIL-05 — INTEGRATED — shared ProductStatus 覆盖 Web/Extension 的 AI Run、transcript Candidate、Document action、external Insert、Setup 与显式保存进度；Recording/Transcribing 保留就地 status，失败统一 alert，正常 autosave 不反复播报。
- V2-FAIL-06 — INTEGRATED — Origin/selected/error 不只依赖颜色，主要按钮有 accessible name。
- V2-FAIL-07 — INTEGRATED — Web、Side Panel 与 Shadow DOM Extension surfaces 统一尊重 `prefers-reduced-motion`；spinner/pulse/transition 停止或降为一次静态状态，返回 Source 的 smooth scroll 在 reduced motion 下改为 instant。
- V2-FAIL-08 — INTEGRATED — Source/Activity inspector 使用共享原始音频播放/暂停/进度/时长控件，并并列 raw/transformed/saved transcript。

## 当前唯一实施批次

- `ACTIVE: PHASE 2 — unified code review + V2 product spec comparison`（不运行 Browser/CU、UX/UI review 或全面测试）
- 完成条件：installer overwrite/rollback 保留当前 data root 与 Host-managed snapshots，版本与 release artifact 合同统一；只做阻塞性静态/构建检查，不在 Phase 1 扩展浏览器或安装验收。
- 完成后只更新相关 ID 的状态并选择下一个最高价值 `MISSING/CODED`，不新增复杂报告。
