# Logue V2 功能完整性与交互成本审计

日期：2026-08-05
结论：**进行中 — J3 Selection Voice Comment 与 J5 Page/Selection Skill 已达到 WORKING；J1、J2、J4、J6–J9 仍未达到完整性门槛。**

本轮只判断功能、持久终态与默认路径，不以 Story 数、截图、静态说明或视觉完成度替代产品完成度。审计由主产品检查、两名独立只读 agent 与浏览器实证共同完成。

## Journey 状态

| Journey | 状态 | 主要缺口 |
| --- | --- | --- |
| J1 首次 sourced round trip | PARTIAL | Voice Comment 激活已原子化；Command 仍暴露 Parse / Generate 内部步骤，Guided Journey 教授旧模型 |
| J2 Voice Write | PARTIAL | 默认路径被 Profile、Stop/review、版本和分类阻断；跨表面持久终态不完整 |
| J3 Selection Voice Comment | WORKING | 选区旁直接 `Mic → Accept`；Enter/Esc；active Project / Saved only；原子 bundle；跨 Side Panel/Web Project 重开 |
| J4 Project transcription context | PARTIAL | Profile、Vocabulary、Edit、Review、Re-transcribe 多为静态或无共享持久对象 |
| J5 Page/Selection Skill | WORKING | pinned/recent/Project default 一击运行；Copy/Replace/Cancel/Undo；Run 固化 revision、解析来源与实际 Context |
| J6 Ask / Draft / Insert | PARTIAL | 暴露 Parse/Generate；Copy、Save document 与部分 Side Panel 入口无终态 |
| J7 Classification correction | PARTIAL | Web correction 已可操作；Side Panel、Change Project 与 learned rule 不完整 |
| J8 Find / recovery | PARTIAL | 可搜索并打开 Source；semantic match、why、filters、加入 Draft/Project 不完整 |
| J9 Export / Backup / Delete | STATIC | 没有真实范围、预览、download、dependency summary 或确认终态 |

## Skills 完整性

| 能力 | 当前状态 | 必须达到 |
| --- | --- | --- |
| Built-in Skills | WORKING | 稳定 ID/revision；可置顶、隐藏、复制；一击运行 |
| Global defaults | WORKING | 五类 binding、pinned actions、真实 fallback 与 revision 可见 |
| My Skills | WORKING | 创建、搜索、编辑 revision、复制、归档、恢复；完整高级策略 |
| Project-specific Skills | PARTIAL | inherit、改绑、reset 已工作；Project-local Customize 留待下一批 |
| Runtime resolver | WORKING | `explicit > Project > Global > system`；五类 Run 记录 revision/source/Context；revision instruction 决定结果 |
| Selection/Page | WORKING | Project default、pinned/recent 一击运行；More Skills 选择即运行；Replace/Copy/Cancel/Undo |
| Voice Comment | WORKING | transcription + transformation 静默解析并留 Run；`Mic → Accept` 原子写入；Cancel/Esc 无残留；bundle 可跨表面重开 |
| Voice Write | PARTIAL | transcription + transformation 已静默解析并留 Run；默认 Profile、Stop/review、版本与分类旅程仍待收敛 |
| Organization | PARTIAL | 捕获后产生带 Skill Run 的可纠正 suggestion；Side Panel correction 仍未完整连接 |
| Ask/Draft | PARTIAL | Generation Skill 已决定 Run 与 cited Candidate；仍需收敛默认 Command 旅程和完整终态 |
| Settings management | PARTIAL | Built-ins、My、Global、Project inherit/bind/reset 已工作；Project-local Customize 尚缺 |

## 问题实证（修复前）

1. [选区后的现有入口](./01-selection-start.png)
2. [Comment 模式二次选择](./02-comment-mode-picker.png)
3. [录音后仍需 Stop](./03-recording-stop.png)
4. [Stop 后仍需 Link comment](./04-link-comment.png)
5. [Selection Skills 的假入口与通用 Save](./05-selection-skills-current.png)
6. [Settings 中三条静态 Skill](./06-skills-settings-current.png)

## P0 修复顺序

1. 建立 Skill、SkillRevision、Global/Project binding、Run resolution 的共享 domain state；
2. 连接 Built-in / My Skills / Project overrides 的创建、管理和一击执行；
3. 将 Selection Voice Comment 改成 `Mic → Accept` 原子动作；
4. 收敛 Voice Write、Selection、Ask/Draft 的默认路径，并让结果动作到达真实持久终态；
5. 补齐 J7–J9 与失败/恢复状态；
6. 全部 P0 达到 WORKING 后，才重建 Guided Demos 和进行 UI polish。

## WORKING 判定

一个能力必须从真实入口完成、所有可见主控件可操作、写入共享 domain state、跨表面可重新打开、具有取消/恢复，并经浏览器走完正常与关键失败路径。STATIC、固定 fixture、toast-only 或 Storybook 说明均不计完成。

## 修复进展

2026-08-05 第一批已通过浏览器与测试验证：

- 建立 Built-in / My Skill、revision、Global / Project binding 与唯一 resolver；
- resolver 严格执行 `explicit > Project > Global > system`，Run 固化 Skill ID、revision 与解析来源；
- Selection 菜单直接显示 pinned / recent concrete Skills，点击一次运行；
- `More Skills…` 按 Recent / My Skills / Built-ins 分组，选择后立即关闭并运行；
- 静态选区只显示 `Copy / Cancel`；可编辑选区只显示 `Replace / Cancel`，Replace 后提供局部 Undo；
- 已移除 Selection 中的 `Run Skill`、通用 `Save` 与 `Save as source`。

2026-08-05 第二批完成 Settings → 实际运行闭环：

- My Skill revision 现在包含 Trigger、Allowed input scope、Output、Language/tone、Project Context 与结果策略；非高频字段折叠在 `Advanced`；
- 共享 executor 不再按 Skill ID 硬编码，创建或编辑 revision 会真实改变 Candidate；
- Selection、Voice transcription/transformation、Organization、Ask/Draft 均使用同一 resolver；
- Global 与 Project Settings 显示实际来源和 revision；不兼容 scope 不能绑定；归档/隐藏立即清理悬空 binding；
- Selection 的 Project default 一击运行，Run details 显示实际 revision、解析来源和 Context；嵌套 `Esc` 只关闭最上层，窄宽度 picker 不再越界。

J5 现为 `WORKING`。Skills 整体仍为 `PARTIAL`：下一批必须完成 Project-local Customize，并把 Voice、Organization 与 Ask/Draft 各自的默认 Journey 收敛到产品合同后，才可宣称 Skills 完整。

2026-08-05 第三批完成 Selection Voice Comment 原子旅程：

- 选区旁直接显示 Mic；录音态只显示 `Accept / Cancel`，并暴露 Enter/Escape 快捷键语义；
- 单个 `accept-voice-comment` 事件创建或复用 Web Source、写入带 audio/raw/normalized/candidate 的 You Comment Source、建立 `comments-on`，并按 tab 授权写入 Project；
- No Project 时 bundle 明确显示 `Saved only`；Cancel/Esc 不创建 Source、Run 或 membership；重复 Accept 幂等；
- Side Panel 与 Web Project 从同一共享 domain state 重开相同 bundle；旧 Stop/Edit/Link/Unlinked 中间态已删除；
- 真实 Chrome 四条旅程与独立完整性审查均通过；最终设计 gate 为 GO/PASS 9.2/10，无 P0/P1。

J3 与 J5 现为 `WORKING`。下一批仍应一次只关闭一个最高价值旅程，不能用 Guided Demo 或视觉优化代替剩余完整性。
