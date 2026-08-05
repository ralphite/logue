# Logue 未完成工作

只记录尚未真正完成的用户结果；已解决项不保留在这里。测试、构建、截图或文档不是完成证据。

| 优先级 | 范围 | 状态 | 仍未完成的用户结果 | 完成证据要求 |
|---|---|---|---|---|
| P0 | Source → Library clean-slate 切换 | IN_PROGRESS | 现有 `Material / Document / Tag / Stream` 原型仍是实际 Web、API 与 Extension 路径。必须直接替换为 `Source / Page / Project`，不保留旧 UI、schema 或 API alias。 | 在真实桌面 Chrome 捕获一次或保存一次选区，只产生一条 Source，并立刻出现在 Library；取消零写入、正常成功静默。 |
| P0 | Linux / LAN 远程服务 | READY_FOR_REAL_ENV | 缺目标 Linux 的 systemd user service、真实防火墙动态域名、Mac Chrome 完整重启和服务重启恢复。隔离 Ubuntu/临时 HTTPS 只证明替代路径。 | 目标 Linux + Mac Chrome 使用当前客户端完成连接、保存、读取；分别重启 Chrome 与服务后重复成功。 |
| P0 | Google Docs 人声输入 | READY_FOR_REAL_ENV | Docs 可到达 launcher、`Enter` / `Esc` 控制已验证；缺真实人声的一次保存、一次插入和不触发 Docs 命令。 | 在实际 Docs 编辑区口述短句，恰好保存一条 Source、插入一次、零宿主命令；Esc 零写入。 |
| P1 | Page 与来源写作 | PENDING | 缺空白 Page、明确 Source picker、grounded draft、Markdown 编辑、citation 与可调整 Sources panel 的新产品闭环。 | 真实 Sources 起草并编辑一个 Page；每条 citation 可定位到对应 Source，取消/失败不创建额外结果。 |
| P1 | Skills 与 Extension 复用 | IN_PROGRESS | Selection Skill 的 Esc/SPA 迟到结果已有局部真实 Chrome 证据；仍需按新 Source/Page 模型完成真实网页与 Page 写回、Undo、可追溯 run。 | 多行选区在 Page 与网页各应用一次并可安全 Undo；不自动提交、漂移或取消不写回。 |
| P1 | Projects | PENDING | 缺 brief、confirmed terms、用户明确关联 Sources/Pages 的新项目模型；不得恢复 Tags 或自动归档。 | 创建 Project、明确添加/移除 Source 与 Page；重启后关联和静默 autosave 保持。 |
| P1 | Evidence search | PENDING | 缺统一搜索 Sources、Pages、Projects 的真实数据闭环与可解释语义命中。 | 用真实 Source/Page 查询集验证精确命中优先、语义理由、来源打开与返回焦点/滚动恢复。 |
| P1 | 设计系统与终审 | PENDING | clean-slate 后需更新生产 Story、移除旧组件，并以真实 Notion/ChatGPT 对照复审。 | Storybook 生产组件状态无缺口；两名独立审查者在真实 runtime 无 P0/P1 blocker。 |
| P1 | Release 跨机验收 | PENDING | 必须等待当前 clean-slate `main` 的全部桌面流程与真实环境验收完成；不得复用旧 Release 证据。 | 另一台机器通过公开 Release 全新安装和覆盖升级，服务、独立 Extension 与数据/回滚策略按新模型通过。 |

## 维护规则

- 真实用户流程通过后立即删除对应行；不把已解决任务或历史证据留在此文件。
- iPhone 与移动端不在当前支持范围，不进入本清单。
- Linux / Docs 的真实环境缺口保持开放，不得以 fixture、临时环境或文档关闭。
