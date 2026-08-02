# 真实 Chrome：多项目 Context 隔离

时间：2026-08-02 11:53（America/Los_Angeles）

这是一条真实运行证据，不是完成声明。使用当前 production Extension、真实 Chrome、真实 Go/Gemini、扬声器到麦克风的实际录音链路和同一 `.logue-data`。

## 冲突项目

- `隔离验收·北极星`：术语 `NovaKey`，规则为“蓝色协议”；背景明确禁止 `AmberKey / 橙色协议`。
- `隔离验收·琥珀`：术语 `AmberKey`，规则为“橙色协议”；背景明确禁止 `NovaKey / 蓝色协议`。
- 使用独立来源域 `alpha.localhost` 与 `beta.localhost`，每个域只有对应项目的三条真实资料。

## 语音输入

- 北极星页面实际录音后转写并插入：`请记录 NovaKey 采用蓝色协议。`
  - `applied_context.reference_project` 只有 `隔离验收·北极星`。
  - glossary 只有该项目的 `NovaKey / 蓝色协议`；recent adopted 三条全部来自北极星。
  - 自动整理置信度 0.95，只归北极星。
- 随后真实重启 Go；两项目的域名建议和北极星持久 `applied_context` 均保持。
- 琥珀页面实际录音后转写并插入：`请记录 AmberKey 采用橙色协议。`
  - `applied_context.reference_project` 只有 `隔离验收·琥珀`。
  - glossary 只有该项目的 `AmberKey / 橙色协议`；recent adopted 三条全部来自琥珀。
  - 自动整理置信度 0.95，只归琥珀。
- 两个页面的宿主提交计数始终为 0。

## Extension Agent 生成

相同指令：`只用当前项目资料回答：术语和协议是什么？不得提及其他项目。`

- 北极星 run：只使用 4 条北极星资料，输出 `术语为 NovaKey，协议为蓝色协议，NovaKey 采用蓝色协议。`
- 琥珀 run：只使用 4 条琥珀资料，输出 `术语为 AmberKey，采用橙色协议。`
- 两次结果均通过 Extension 插入当前输入框且没有自动提交；来源列表没有跨项目资料。

## 证据与清理

- `docs/qa/audit-2026-08-02-1905/22-extension-project-alpha.png`
- `docs/qa/audit-2026-08-02-1905/23-extension-project-beta.png`
- 验收后，两个临时项目、六条种子资料、两条语音资料、两段音频、两个 Agent run 和宿主输入均已从真实工作区移除；截图保留直接证据。
