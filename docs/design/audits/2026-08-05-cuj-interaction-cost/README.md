# Logue V2 功能完整性与交互成本审计

日期：2026-08-05
结论：**FAIL — 当前没有一条 J1–J9 Journey 达到 WORKING。**

本轮只判断功能、持久终态与默认路径，不以 Story 数、截图、静态说明或视觉完成度替代产品完成度。审计由主产品检查、两名独立只读 agent 与浏览器实证共同完成。

## Journey 状态

| Journey | 状态 | 主要缺口 |
| --- | --- | --- |
| J1 首次 sourced round trip | PARTIAL | Voice Comment 与 Command 仍暴露 Link / Parse / Generate 内部步骤；Guided Journey 教授旧模型 |
| J2 Voice Write | PARTIAL | 默认路径被 Profile、Stop/review、版本和分类阻断；跨表面持久终态不完整 |
| J3 Selection Voice Comment | PARTIAL | 仍需 `Add comment → Voice → Stop → Link comment`，未实现 `Mic → Accept` |
| J4 Project transcription context | PARTIAL | Profile、Vocabulary、Edit、Review、Re-transcribe 多为静态或无共享持久对象 |
| J5 Page/Selection Skill | PARTIAL | `Run Skill` 硬编码 Explain；通用 Save 与 Save as source 无终态；没有四层解析 |
| J6 Ask / Draft / Insert | PARTIAL | 暴露 Parse/Generate；Copy、Save document 与部分 Side Panel 入口无终态 |
| J7 Classification correction | PARTIAL | Web correction 已可操作；Side Panel、Change Project 与 learned rule 不完整 |
| J8 Find / recovery | PARTIAL | 可搜索并打开 Source；semantic match、why、filters、加入 Draft/Project 不完整 |
| J9 Export / Backup / Delete | STATIC | 没有真实范围、预览、download、dependency summary 或确认终态 |

## Skills 完整性

| 能力 | 当前状态 | 必须达到 |
| --- | --- | --- |
| Built-in Skills | STATIC | 稳定 ID/revision；可置顶、隐藏、复制；一击运行 |
| Global defaults | STATIC | 每类默认 binding、pinned actions、解析来源可见 |
| My Skills | MISSING | 创建、编辑 revision、复制、归档、恢复、运行 |
| Project-specific Skills | MISSING | inherit、override/bind、reset；不重复复制对象 |
| Runtime resolver | MISSING | `explicit > Project > Global > system`，每次 Run 记录 revision/source |
| Selection/Page | PARTIAL | pinned/recent 一击运行；More Skills 选择即运行；Replace/Copy/Cancel |
| Voice Write/Comment | MISSING | 默认静默解析；高级 review 才切换；结果动作与任务一致 |
| Organization | MISSING | 产生可纠正建议并记录所用 Skill |
| Ask/Draft | PARTIAL | 单次 Run；实际 citations；Insert/Copy/Save as document 终态 |
| Settings management | STATIC | Global 与 Project 两个真实管理入口；所有按钮可操作 |

## 当前实证

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

该纵向切片现为 `WORKING`；J5 总体仍为 `PARTIAL`，直到 Global Settings、Project inherit/override/reset、Run details 与其他 Page/Selection 入口共用同一 registry 并完成浏览器验收。
