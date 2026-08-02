# Logue 当前真实验收状态

更新时间：2026-08-02 12:46（America/Los_Angeles）

本文件逐项对应 `/GOAL.md` 的 14 个真实场景，是滚动状态而不是完成声明。`PASS` 必须有真实 Chrome、真实 Go 服务和真实持久数据；单元测试、构建、文档或截图不能单独升级状态。

| # | 场景 | 状态 | 当前证据 / 未关闭项 |
|---|---|---|---|
| 1 | 标准 input/textarea 语音输入 | PASS | 当前生产构建已在真实 Chrome 完成：单击开始、Enter 停止、Gemini 转写、先保存再插入；保留原输入前缀，提交计数始终为 0。启动阶段 Esc 立即关闭且没有迟到录音回写。另已实测保存完成时宿主替换输入框：Extension 保留结果，聚焦新目标后一次重新插入；服务端仍只有 1 条资料，新目标只插入 1 次且不提交。输入框按 Tab 可直接聚焦语音入口，并显示焦点环和 `⌘⇧L` 提示。详见 `docs/qa/target-loss-recovery-2026-08-02.md`。 |
| 2 | 富文本编辑器输入 | PASS | 当前生产构建已在真实 `chatgpt.com` contenteditable 完成同一闭环；输入框出现准确转写，URL 仍为新对话且未发送。证据：`docs/qa/audit-2026-08-02-1905/15-extension-chatgpt-inserted.png`。测试资料、音频和输入框随后已清理。 |
| 3 | 选区保存与文字/语音批注 | PASS | 当前 production Extension 已在真实 Chrome 完成右键选区＋真实语音批注。原文保持只读，批注为独立 `derived`，`parent_ids` 只指向原文；音频、机器转写和最终文字可追溯。期间关闭 Go 后录音保留并可“重新转写”，恢复后只产生一组 source/annotation request id，无重复、无宿主提交。详见 `docs/qa/selection-recovery-2026-08-02.md`。 |
| 4 | 多项目 Context 隔离 | PASS | 当前 production Extension 已用两个冲突术语/背景项目分别完成真实语音与 Agent 生成；每条语音的 `applied_context` 只包含一个 reference project、对应 overview/glossary/recent adopted。Go 重启后隔离保持；两次生成各只使用本项目 4 条来源，输出无跨项目术语，宿主提交计数为 0。详见 `docs/qa/project-isolation-2026-08-02.md`。 |
| 5 | 自动整理、短回复、QA 与文档闭环 | PASS | 最新四条真实语音由可定制整理 Agent 重跑：两条高置信度安静写入准确项目/Tag，两条低置信度只保留建议；错误 `tool-use` 命中为 0。短回复、QA、文档均有真实 Agent run；多来源文档的编辑、自动保存、引用定位和增删已实测。详见 `docs/qa/agent-organization-2026-08-02.md`。 |
| 6 | 创建/修改 Agent 并在 Web 使用 | PASS | 真实工作区保留两个非系统 Agent，均已修改至 revision 2；`简洁回复` 与 `沉淀为资料` 在 Web/Extension 产生完成 run，实际来源可追溯。 |
| 7 | Extension 在聊天输入框生成并插入 | PASS | 当前 production Extension 已在真实 `chatgpt.com` 用独立 Agent 能力基于资料生成并插入；没有发送。证据：`docs/qa/audit-2026-08-02-1905/17-extension-agent-inserted.png`。 |
| 8 | 外部 Agent 只读与幂等写回 | PASS | 缺 actor、缺 source_ids、引用不存在均拒绝；合法写回保留 actor/父来源；稳定 request_id 不重复。 |
| 9 | Go 服务断线与恢复 | PASS | 在选区语音批注录音结束前真实关闭 Go；Extension 显示本机服务不可达、保留录音并提供重新转写。使用同一数据目录和 Gemini 环境重启后重试成功，原文/批注 request id 共用稳定前缀且无重复。 |
| 10 | 刷新/重启持久化与导出恢复 | PASS | 资料、音频、项目、Agent、生成记录、文档、来源和设置跨刷新/服务重启保持；导出恢复在隔离副本验证并创建备份。 |
| 11 | Vibedoc 转写质量对齐 | PASS | 4 段全新同源 48 kHz WAV 覆盖中文长句、英文、中英混合与项目术语；Logue 总 CER 0.28%（1/352），VibeDoc 0.57%（2/352），每类均不低于对照。生产 Extension 的真实 WebM E2E 已单独通过。详见 `docs/qa/transcription/comparison.md`。 |
| 12 | 真实手机完整 Web App | PARTIAL | Web/API 已由同一 Go 服务监听局域网；当前入口使用 `<LAN-IP>:8787`。320/390/768px 已验证资料、项目、生成、详情抽屉、重复资料折叠与底部导航；仍无物理 iPhone，因此真机触控闭环尚未关闭。 |
| 13 | GitHub Release 一行全新安装 | IN PROGRESS | 发布资产、安装器与构建版本协议正在实现；只有从公开 Release 的稳定 URL 在无源码隔离环境真实执行、校验、启动并通过 `/v1/status` 后才能升级为 PASS。 |
| 14 | 同一命令覆盖升级并保留数据 | IN PROGRESS | 必须用同一 Release URL 在已有版本与持久资料的隔离环境重复执行，直接证明旧服务停止、程序原子替换、数据哈希不变、安装后启动，以及接受/拒绝开机自启均正确。 |

## 本批次强一致证据

- 服务端成果从 revision 1 开始；每次 PATCH 必须提交 `expected_revision`，旧 revision 真实返回 `409`，持久内容保持最新版本。
- Web 自动保存按队列串行；成果切换、新建、生成和离开工作区前先等待当前快照落盘。
- 真实 Chrome 完成：连续快速编辑 → 立即切换 → 加入第三来源 → 删除中间来源并重编号 → 刷新 → 重启 Web/Go → 再次读取。
- 最终状态：2 个 source_ids；正文只有 `[来源 1]` 与 `[来源 2]`，没有 `[来源 3]`；快速编辑内容仍存在。
- 截图：`docs/qa/citations/05-lan-restart-result.png`。

## 本批次设计闭环

- 成果来源面板改为低权重轻列表，只突出当前引用；正文恢复第一视觉中心。
- 语音资料显示 `原始录音 → 机器转写 → 最终采用文字 → 后续内容` 的不可变记录链。
- 项目页减少顶层分割线，标题、metadata、正文和辅助区与成果页统一。
- 资料保留右侧快速预览，并新增与项目、成果一致的完整页面；真实 Chrome 已完成打开、返回和父子关系浏览。
- 768×1024 平板运行界面保留“资料流 / 项目 / 生成 / 设置”常驻文字；详情“完整页面 / 关闭”和新建资料关闭按钮均使用至少 44×44px 热区。证据：`docs/qa/audit-2026-08-02-1905/26-tablet-nav-768.png`、`27-tablet-detail-768.png`、`29-tablet-add-dialog-768.png`。
- Extension 输入框按 Tab 的下一站是语音入口；焦点环和 `⌘⇧L` 提示在真实 Chrome 可见。证据：`docs/qa/audit-2026-08-02-1905/28-extension-launcher-keyboard.png`。
- 资料流、生成资料选择器、文档生成对话框和文档来源加入面板共用精确重复折叠：默认一组一行，显示捕获次数；展开后每个 material id 仍可单独选择。真实来源面板的 `Logue Extension QA Fixture` 从 5 次表示为 `4 组 · 5 次`，同名但不同正文通过摘要区分。详见 `docs/qa/source-grouping-2026-08-02.md`。
- 自动整理不再把 known tags 当作机械候选；最新四条真实语音中，快捷键归入具体的 `浏览器扩展`，错误 Tag 反馈归入 `Logue`，两条语义不足的资料维持未归项目并安静复核。证据：`docs/qa/audit-2026-08-02-1905/33-agent-organized-mobile.png`、`34-agent-review-mobile.png`。
- 旧资料安全重整只覆盖 10 条“无 organization 且项目/Tag 为空”的资料；7 条高置信度整理，3 条低置信度只给建议。其余 23 条可能包含人工或验收上下文的旧分配完全未进入队列；全量不可变内容哈希前后一致。详见 `docs/qa/agent-organization-2026-08-02.md`。
- 一条 65% 低置信度语音已在真实移动 Web 完成“查看建议 → 采用 Tag → 人工选择项目 → 标记消失 → 重启保持”；confirmed 资料再次整理返回 409，Agent 不能覆盖人工判断。证据：`docs/qa/audit-2026-08-02-1905/35-review-before-confirm.png` 至 `37-confirmed-after-restart.png`。
- ChatGPT.com 基于最新截图最终复审：原 3 个 P1 全部 `CLOSED`，当前“无未解决 P0/P1”。详见 `docs/qa/design-review-chatgpt.md`。
- 最新截图：`docs/qa/design-review/05-source-panel-lightened.png`、`06-voice-record-chain.png`、`07-project-page-shell.png`、`08-material-full-page.png`。

## 首次启动与真实数据安全

- 默认 `npm run dev` 不再设置 `LOGUE_SEED_DEMO=1`；演示数据只可通过显式的 `npm run dev:demo` 注入，README 已说明不能对真实数据目录使用。
- 使用全新的隔离数据目录启动并重启 Go 服务，两次读取均为 `0` 条资料、`0` 个项目、`0` 份成果，证明默认启动不会暗中写入示例内容。
- 空资料流、空项目和空成果均提供安静、可执行的首次入口；真实 Chrome 已从空成果列表新建文档、进入移动/窄屏编辑器并自动保存正文。
- 当前真实 `.logue-data` 为 `43` 条资料、`4` 个项目、`11` 份文档；本批次仅重新写入最新四条资料的 Agent 组织结果，正文、音频、来源与资料总数均保持不变。

## 浏览器导航恢复

- 顶层资料流、项目、成果、设置与选中资料/项目/成果现在写入稳定 URL；旧 `view=views`、`view=results` 与无参数入口兼容到成果工作区，产品 UI 仍只使用“成果”命名。
- 在真实 LAN 桌面浏览器完成：`?view=stream` 直达与刷新、项目列表→`Agent Harness` 详情→刷新、返回/前进、成果 A↔成果 B→刷新→返回/前进、资料详情→刷新；URL、可见页面和对象逐次一致，控制台无相关错误。
- 在 390×844 完成：项目详情直达、成果编辑器直达、打开成果列表并切换另一份成果；URL 与移动布局一致。
- 重启真实 Web/Go 后再次直达 `doc_5d7173075715c39f`，标题、正文和项目仍正确；Gemini 仍从终端环境读取，真实数据目录清单 SHA-256 仍为 `88e28c7e9076f74a61d5865cb908a43836560f9936d9e7a28af95928e5c47470`。
- Web 16 项、Extension 10 项、Go 全部测试通过；全量 production build 通过。

## 下一轮不能跳过

1. 可用物理 iPhone 出现后，直接访问当前局域网入口，完成资料浏览、项目浏览、生成、文档编辑、引用查看和刷新；保存真机截图。
2. textarea、ChatGPT 富文本、选区语音批注、Go 断线恢复、Extension Agent、多项目隔离、目标输入框丢失恢复和跨选择器重复折叠都已完成真实闭环；后续继续由 fresh-context 审查选择仍可独立关闭的最高价值缺口。
3. 在等待真机外部条件期间，不得把设备不可用变成暂停整个目标的理由。
4. 转写质量门槛已通过；后续自然人声、噪声和口音样本作为增强，不阻塞当前最高价值工作。
