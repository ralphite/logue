# Logue clean-slate v2 独立设计终审

日期：2026-08-04

对象：

- `GOAL.md`
- `docs/product-spec.md`
- `docs/interaction-spec.md`
- `docs/design-system.md`
- `docs/design/capture-to-reuse-product-design-2026-08-04.md`

三位 reviewer 独立、只读审查；每轮要求 `0 Blocker / 0 Major` 才能 PASS。旧五导航评审已废止，不作为本方案证据。

## 最终结论

| Reviewer | 终审方向 | 分数 | 结论 |
| --- | --- | --- | --- |
| `review_product_scope` | 产品范围、feature 删留、优先级、端到端切片 | 9.2 / 10 | PASS；0 Blocker / 0 Major |
| `review_interaction` | Capture、Search、Page、Selection、Side Panel、键盘/焦点 | 9.2 / 10 | PASS；0 Blocker / 0 Major |
| `logue_product_designer` | 第一性原则、Notion 级一致性、极简与跨文档合同 | 9.3 / 10 | PASS；0 Blocker / 0 Major |

## 审查推动的关键修订

- 旧五导航收敛为 `Library / Projects / Settings`，Search 是侧栏动作；日常内容只有 Source、Page、Project。
- 数据迁移改为原子基础切换；backup/best-effort import 不阻塞发布，不保留双 schema 或兼容 routes。
- 交付从横向功能改为 `P0-A Capture → Recover`、`P0-B Recall → Make` 的可用纵向切片。
- Search 到写作只有 `New page from source`；防重复、失败恢复和 Search 状态保留完整。
- Source correction/note、Page–Project、Page–Source 与 Run context cardinality 定稿；Notes 默认不进入生成。
- Page draft 使用稳定 insertion anchor；citation context 可排除、可恢复且不会静默丢证据。
- Extension adopted output 通过规范化完整页面 URL 的 `Sources used` 回到真实来源，不把内部 citation token 插入外部文本。
- Capture、Selection Skill、Search、Draft、Side Panel 的取消、迟到结果、Undo、焦点与窄屏 overlay 合同闭合。
- Web 不保存 provider credentials；Extension Server URL 也不在 Web Settings 重复出现。
- 自动归档、Tags、Needs review、Daily、Agents、整页 snapshot、旧 Generate/Agent routes 明确删除或移出当前范围。

## 当前限制

本终审只证明产品与交互合同可进入实现，不代表当前 runtime、Extension、Linux release 或数据切换已经完成。真实实现仍须按 `GOAL.md` 的 P0-A 开始，并在 ChatGPT、textarea、contenteditable、Google Docs 与目标 Linux 环境验收。
