# Logue 未完成任务

更新时间：2026-08-03（America/Los_Angeles）

这是唯一的日常进度文件，只记录尚未完全满足的用户结果。完成项必须立即从本文件删除，不保留 `PASS` 行；历史证据保留在 Git、Release、审查记录和 [`bug-feature-status.md`](./bug-feature-status.md) 中。

状态只使用：`IN_PROGRESS`、`READY_FOR_REAL_ENV`、`DEFERRED`、`BLOCKED`。

| 优先级 | 范围 | 状态 | 仍未完成的用户结果 | 完成证据要求 |
|---|---|---|---|---|
| P0 | Linux / LAN 远程服务（F22） | READY_FOR_REAL_ENV | 打开 Logue Web App 后的明确 host 一键授权已在真实 Mac Chrome + 非回环地址通过，安装器也已提供 `0.0.0.0` / `127.0.0.1` 选择并默认前者；仍缺另一台真实 Linux systemd user service、防火墙分配且可能变化的域名、跨机保存/读取、Chrome/MV3/Linux 重启恢复闭环。 | 在真实 Linux + Mac Chrome 完成连接、地址替换、保存/读取、浏览器重启和服务重启。 |
| P1 | Extension 核心可靠性（B03、B27、F04） | IN_PROGRESS | 标准 input 首击、选区文字/语音批注、无输入框页面录音、页面历史即时刷新、目标丢失、断线重试幂等，以及 `Cmd+Shift+L` 重开后的焦点仍缺当前 Release 的完整实测。 | 当前 Release 在真实 Chrome 覆盖以上路径；不丢资料、不重复保存/插入、不自动 submit。 |
| P1 | Selection Skills 最终防护（F06、F18） | IN_PROGRESS | Document 与当前 unpacked Extension 的 textarea/contenteditable 已真实通过菜单稳定、外部关闭、重新选择及多行写回；仍缺 Gemini 运行中按 Esc、切换选区/目标/SPA 路由后等待迟到结果返回也绝不写回的真实 Chrome 验证。 | 当前 Release 在真实 Chrome 完成取消与漂移回归，原文保持不变，菜单不被迟到事件唤回，提交计数为 0。 |
| P1 | 标准 Overlay / Context Menu | IN_PROGRESS | Dropdown 与更多菜单缺少统一 click-outside、Esc、焦点、层级、方向和边界防溢出行为。 | 生产共享 primitive 覆盖 pointer/keyboard/focus/collision；文档更多菜单及所有迁移菜单在真实浏览器首击、外部点击和视口边缘均正确。 |
| P2 | 滚动区域布局稳定 | IN_PROGRESS | 部分 scrollbar 仍属于页面而非实际滚动 pane，出现/消失时会改变可用宽度。 | 每个长列表/编辑 pane 自身滚动并预留稳定 gutter；切换长短内容时 header、panel 与正文横向位置不跳动。 |
| P1 | 自动整理与历史资料（B06、F05） | IN_PROGRESS | 新资料分类闭环已具备；真实库仍有旧的低置信中文理由需要一次性安全整理，并重新确认人工分类不会被后台覆盖。 | 备份后一次性转换，真实读取/修改/重启验证通过，并删除转换代码。 |
| P1 | 全产品英文（B21） | IN_PROGRESS | Web 和 Installer 的系统文案已为英文；仍需清除 Storybook、fixture、测试可见 copy 和其它正式产品表面的残余中文。用户自有内容不改写。 | 对生产 UI、Extension、Storybook 和安装器做英文扫描与真实页面抽查，无系统中文。 |
| P1 | Storybook 生产 inventory（F20） | IN_PROGRESS | 仍缺完整的 production component → story → applicable state 映射，以及部分页面的 loading/error/offline/overflow/keyboard 状态。 | 根地址可用；每个生产组件及其有意义状态可直接查看，且复用生产组件而非复制 demo。 |
| P1 | 全产品一致性终审（F15） | IN_PROGRESS | Settings 内容轴与焦点、Skills 编辑密度仍需最终统一；之后还缺两名 fresh-context 独立终审。 | 修复真实运行界面；两名独立审查者均无未解决 P0/P1，Notion/ChatGPT 对照达到目标。 |
| P1 | Release 跨机验收（F13） | READY_FOR_REAL_ENV | `v0.2.10` 的 Python-only 跨平台包、公开校验和、独立 Extension、服务首装/覆盖和数据保留已通过隔离验证；仍缺另一台真实 Linux/Mac 的服务安装、Chrome Load unpacked/Reload、数据保留和覆盖升级。 | 从公开 Release 在另一台机器完成首次安装和覆盖升级，真实数据不被覆盖，失败可回滚。 |
| P3 | 手机真机（F10） | DEFERRED | 物理 iPhone 的触控、旋转、刷新和核心页面/文档编辑尚未实测；用户已明确后置。 | 物理 iPhone 完成真实 LAN 流程；不影响当前桌面 P0/P1 排序。 |

## 维护规则

- 日常状态回复只报告本文件中的行，不再列已完成项。
- 测试、截图、文档、提交和 Storybook 本身不能把任务移出本文件；必须有对应真实用户流程证据。
- 一项完全满足后直接删除该行，并在提交信息中记录关闭范围。
- 新 Bug 或 Feature 先按用户价值合并到现有行；只有独立验收结果时才新增行，避免重复队列。
