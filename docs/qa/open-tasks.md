# Logue 未完成任务

更新时间：2026-08-04（America/Los_Angeles）

这是唯一的日常进度文件，只记录尚未完全满足的用户结果。完成项必须立即从本文件删除，不保留 `PASS` 行；历史证据保留在 Git、Release、审查记录和 [`bug-feature-status.md`](./bug-feature-status.md) 中。

状态只使用：`IN_PROGRESS`、`READY_FOR_REAL_ENV`、`DEFERRED`、`BLOCKED`。

| 优先级 | 范围 | 状态 | 仍未完成的用户结果 | 完成证据要求 |
|---|---|---|---|---|
| P0 | Linux / LAN 远程服务（F22） | READY_FOR_REAL_ENV | 当前 `v0.2.13` 已在 Disposable Ubuntu Python 服务的随机 HTTPS 域名上，由真实 Mac Chrome 完成逐域名授权、地址替换、空 QA 资料保存、Web/Side Panel 读回、页面 Reload 及 Extension Reload 后配置/资料保持；随后已恢复本机地址并关闭临时域名。安装器也已提供 `0.0.0.0` / `127.0.0.1` 选择并默认前者。仍缺目标 Linux 的真实 systemd user service、防火墙分配且可能变化的内部域名、完整 Chrome 重启与 Linux 服务重启恢复。 | 在目标 Linux + Mac Chrome 完成真实 systemd 安装、动态内部域名连接、浏览器完整重启和服务重启。 |
| P0 | Google Docs 行内语音（F25） | READY_FOR_REAL_ENV | 已将当前 `v0.2.10` 构建装入既有 unpacked Extension 身份，并在真实 Docs canvas 进入 Start → Cancel/Stop → Transcribing；Docs 编辑器聚焦后 `Tab` 聚焦启动器、`Enter` 开始、`Esc` 取消并回到编辑器，取消未写入内容。自动化采集没有人声，Gemini 因此没有返回文字。仍缺真实口述后的单次保存与单次插入证明。 | 用真实口述短句完成保存一次、插入一次、不触发 Docs 命令；Esc 取消保持零写入。 |
| P1 | Extension 核心可靠性（B03、B27、F04） | IN_PROGRESS | 当前稳定安装已在真实独立 Google 页面完成首次 Chrome 麦克风授权 → `Cancel` / `Stop` 录音态 → Cancel 回 launcher，焦点回到 Search、服务资料保持原 2 条（零写入）。还以真实 Mac Chrome 录制并 Stop 非人声环境音到临时 Ubuntu HTTPS 服务，只发布的 manifest 已确认该 capture 的 `.webm` 和 context 文件落盘。仍缺真实人声 Stop/保存/插入、选区文字/语音批注、无输入框页面录音、页面历史即时刷新、目标丢失、断线重试幂等，以及 `Cmd+Shift+L` 重开后的焦点完整实测。 | 当前 Release 在真实 Chrome 覆盖以上路径；不丢资料、不重复保存/插入、不自动 submit。 |
| P1 | Selection Skills 最终防护（F06、F18） | IN_PROGRESS | Document 与当前 unpacked Extension 的 textarea/contenteditable 已真实通过菜单稳定、外部关闭、重新选择及多行写回。当前构建已在真实 Mac Chrome 的 Google 顶层输入框验证：`Draft reply` 后立即 `Esc`，等待隔离 Gemini 返回，原输入不变、菜单不重开、页面不提交，run 无 `adopted_output`。仍缺当前 Release 的同一路径，以及切换选区/目标/SPA 路由后的迟到结果验证。 | 当前 Release 在真实 Chrome 完成取消与漂移回归，原文保持不变，菜单不被迟到事件唤回，提交计数为 0。 |
| P1 | 自动整理与历史资料（B06、F05） | READY_FOR_REAL_ENV | 当前真实服务只有两条无可判断语义的录音测试，均为 `Unfiled` / `Needs review`；没有待安全迁移的旧资料，故不对现有数据批量重分类。新资料的高/低置信分类、人工确认不可覆盖已有真实验证。 | 新增有意义的真实资料后，验证高置信安静归档；低置信显示可理解理由且人工确认在服务重启后不被后台覆盖。 |
| P1 | 语义检索 | IN_PROGRESS | Gemini 已对资料与文档返回受限的语义排序和理由，只有完整查询短语才算直接本地命中，12 秒模型失败后回到本地；真实 Stream 已以 `homes for sale` 找到既有 Redfin 资料并在 Reload 后复验，中文长句也不再被双字重叠误标为正文命中。当前真实文档数为 0，尚未有人类文档查询集可验收。 | 以真实文档和资料查询集验证语义召回、排序、解释及长期用量；不能将本地字段命中说明当作语义检索。 |
| P1 | Release 跨机验收（F13） | READY_FOR_REAL_ENV | `v0.2.10` 的 Python-only 跨平台包、公开校验和、独立 Extension、服务首装/覆盖和数据保留已通过隔离验证；仍缺另一台真实 Linux/Mac 的服务安装、Chrome Load unpacked/Reload、数据保留和覆盖升级。 | 从公开 Release 在另一台机器完成首次安装和覆盖升级，真实数据不被覆盖，失败可回滚。 |

## 维护规则

- 日常状态回复只报告本文件中的行，不再列已完成项。
- 测试、截图、文档、提交和 Storybook 本身不能把任务移出本文件；必须有对应真实用户流程证据。
- 一项完全满足后直接删除该行，并在提交信息中记录关闭范围。
- 新 Bug 或 Feature 先按用户价值合并到现有行；只有独立验收结果时才新增行，避免重复队列。
