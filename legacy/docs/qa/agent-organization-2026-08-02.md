# 真实资料 Agent 自动整理复核

时间：2026-08-02 12:31（America/Los_Angeles）

这是一条真实运行证据，不是完成声明。使用当前 `.logue-data`、Go 服务、终端环境中的 Gemini Key 与 `gemini-3.6-flash`，重新整理用户最新四条真实语音资料；资料正文、音频、来源与 capture id 均未改动。

## 修复

- 分类先从正文判断任务、决策或主题，再与项目 overview/glossary 做语义匹配；来源页面只作为出处。
- 产品总项目和具体子项目同时匹配时优先具体子项目；通常只选一个最相关项目。
- `known_tags` 只用于命名参考，不能按已有、常用或项目共现机械关联。
- 每个 Tag 必须有正文直接依据；过滤 `tool-use`、`e2e`、`transaction` 等无关实现/夹具噪音，并禁止同义标签重复。
- 高置信度安静写入；低于 0.75 或没有可靠项目时只保留可审阅建议，不改真实项目与 Tag。
- 新增安全的重新整理入口，仅重置组织状态并重新排队；不改正文、来源、音频或现有人工分配。

## 最新四条真实结果

| 资料 | 结果 |
|---|---|
| 录音 Enter / Esc 快捷键 | 85%，安静归入 `浏览器扩展`，Tag 为 `快捷键 / 录音` |
| 错误 Tag 应改用 Agent classification | 80%，安静归入 `Logue`，Tag 为 `标签关联 / 自动整理`；已删除错误 `tool-use` |
| ASR / audio 产品体验调研 | 65%，未强行归项目，只建议 `语音识别 / 产品调研 / 用户体验` |
| “测试一下语音输入” | 60%，未强行归项目，只建议 `语音输入` |

四条资料中真实或建议 Tag 的 `tool-use` 命中数为 0；工作区总资料数保持 43。

## 真实界面

- `docs/qa/audit-2026-08-02-1905/33-agent-organized-mobile.png`：320×568，安静展示已归 `浏览器扩展` 以及可编辑的 `快捷键 / 录音`。
- `docs/qa/audit-2026-08-02-1905/34-agent-review-mobile.png`：320×568，60% 结果保持未归项目，理由与单个建议可审阅，未制造错误关联。

## 自动验证

- Go 全量测试通过；覆盖重新整理不改资料、API 重新排队与分类提示质量约束。
- 真实 Go/Gemini 四条连续后台处理完成；没有新增资料、重复资料或内容改写。

## 旧资料安全重整

fresh-context 复核后，继续处理旧资料时使用严格保护边界：只选择 `organization` 缺失且当前项目、Tag 都为空的 10 条；另外 23 条已有旧项目或 Tag 的资料视为可能含人工/验收上下文，完全未进入队列。

- 10 条由当前 Gemini 整理：7 条高置信度写入具体项目与正文支持的 Tag，3 条信息不足，仍为空项目/Tag，只显示复核建议。
- 高置信度示例：Chrome 右键选区验收归入 `浏览器扩展`；明确写出 Agent Harness 的来源链记录归入 `Agent Harness`。
- 低置信度示例：`Atomic context snapshot verification` 和通用语音输入测试没有被强行归项目。
- 处理前后工作区均为 43 条资料，pending 最终为 0；正文、转写、批注、来源、父子关系、capture id、创建时间、actor 与 applied context 的全量规范化 SHA-256 均为 `e70809c194d7698438b14d6b29dd794a05476c18eee0db78c1f3c8db3542f9b9`。
- 23 条受保护旧分配仍保持 `organization` 缺失，证明没有被批量覆盖。

## 人工确认保护闭环

在真实 320×568 Web App 中使用语音 QA 资料 `mat_14cb8609c9021c47` 完成：

1. 初始为 65% 低置信度，资料流有轻量“待确认”，详情显示理由并仅建议 `语音输入`，实际项目/Tag 仍为空。
2. 点击“采用建议”，再直接点选 `浏览器扩展`；标记立即消失，API 持久为 `organization.status=confirmed`、confidence 1、项目 `浏览器扩展`、Tag `语音输入`。
3. 重启同一 Go 服务和数据目录并刷新 Web，项目、Tag、原始录音、转写、来源和 confirmed 状态全部保持。
4. 对 confirmed 资料再次请求自动整理得到 HTTP 409；服务端拒绝重排，项目、Tag、组织时间、正文、capture id 与来源均未变化。

截图：

- `docs/qa/audit-2026-08-02-1905/35-review-before-confirm.png`
- `docs/qa/audit-2026-08-02-1905/36-confirmed-after-edit.png`
- `docs/qa/audit-2026-08-02-1905/37-confirmed-after-restart.png`
