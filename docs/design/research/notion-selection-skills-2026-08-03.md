# Notion Skills：真实交互观察与 Logue 设计契约

日期：2026-08-03。观察对象为用户已登录的 `app.notion.com`，只读查看；未创建、编辑或执行 Notion Skill。

## 已观察到的事实

- Notion AI Settings 的 Skills 区域说明：Skill 可在 Agent chat 中 `@` 提及，也可通过页面文字选择后出现的菜单使用。
- 一个 Skill 是普通的可编辑页面，顶部只有轻量 `Configure`；名称与提示词是页面内容，不是另一套重型管理表单。
- 在该 Skill 页的编辑文字中选择一句后，Notion 在选区附近显示格式工具条；其中 `Skills` 是一个紧凑子菜单，列出现有 Skill（例如 Translate、Improve Writing、Proofread、Explain、Reformat）。
- 菜单不显示常驻说明、来源卡片、成功状态或额外确认。选择后由用户任务本身决定下一步。

截图（不含凭据，未提交）：

- `docs/design/audits/2026-08-03/10-notion-skills-settings.png`
- `docs/design/audits/2026-08-03/11-notion-selection-skills-menu.png`

## Logue 的实现契约

1. Document 与可编辑网页目标有非空选区时，才显示一个选区附近的 `Skills` 入口；空选区、静态正文和失焦目标不显示。
2. 入口先保持为一个安静的 pill；点击才显示已启用、可在当前 surface 使用、输出为插入文本的 Skill 列表。禁止常驻侧栏、说明卡片或第二次确认。
3. 选择 Skill 时锁定原始选区与目标。生成完成后只替换同一仍有效的范围；选区或目标变化时不写入，并给出局部可恢复提示。
4. 写回调用宿主的标准 input 事件，但绝不按 Enter、提交或发送表单。Document 写回保持自动保存模型。
5. 每次执行保留 Skill revision、选区原文、页面/Document 上下文、输出与采用结果。文字已写入但来源登记暂时失败时，不可误报成“失败”；显示 `Applied` 与可重试的 history 保存动作，重试不得再次替换文字。静态网页选区只进入保存/Side Panel 路径，绝不承诺就地改写。
6. 菜单水平边界属于当前 editor/target 的可用矩形，不得覆盖 Sources 或相邻 pane；默认状态不增加任何噪音。选区变化时给出短暂、本地的重新选择提示。

## 有意不复制的部分

- 不复制 Notion 的格式工具栏；Logue 没有自己的富文本格式化产品面。
- 不在 Extension 中开放静态网页原文直接替换；这会破坏页面和来源真实性。
- 不为 Prompt-only Skills 重命名为 Agents，也不增加复杂权限、工具或运行矩阵。
