# LOGUE.ai 产品定位独立审查

日期：2026-08-04
输入：初版《LOGUE.ai 总体产品定位草案》
方法：三位相互独立的只读 agents，加一次独立 ChatGPT.com 红队；各 reviewer 在看到综合结论前分别完成判断。

## 1. 审查结果

| 审查通道 | 关注点 | 对初稿评分/判定 | 核心意见 |
| --- | --- | --- | --- |
| Product designer | 定位心智、对象、IA、MVP、Notion/ChatGPT 对标 | 6.6/10，`REPLAN` | 草案是完整平台，不是今天可理解的产品；只保留一个 round trip，首版 IA 收到 `Log / Projects / Settings` |
| Voice competitor agent | Wispr Flow、Superwhisper、Willow、Voicenotes | 当前差异化 4/10；收窄后 8/10，`REPLAN` | 任意听写、选区命令、自定义 Modes 已同质化；应押注网页锚点 Comment → Project memory → 原位写作 |
| Knowledge competitor agent | Notion、Readwise、Granola、Mem、Tana、Capacities、mymind、Hypothesis 等 | 当前切口 4/10；修订潜力 8/10，当前定位不通过 | Voice + auto-organize + context + generation 已被 Mem/Tana 等覆盖；Project 必须是用户控制的 Context 边界 |
| [ChatGPT.com 独立红队](https://chatgpt.com/c/6a72c769-02d8-83e8-9f9c-9978c94e5a41) | 全市场定位、风险、beachhead、moat | 总体 6/10，`NARROW` | `Voice / Log / AI` 描述系统架构而非购买结果；来源 lineage 与全过程可追溯是最有机会累积的防御 |

## 2. 四个通道的共识

1. **方向不应删除，但市场定位必须收窄。** Voice、Log、AI 是内部原则，不能直接承担首页定位。
2. **当前 MVP 过大。** 原来的四个 MVP 切片合起来等于 dictation + PKM + workspace + AI generation 四类产品。
3. **首个用户必须按行为定义。** 先服务每天跨网页研究并持续产出、围绕少数活跃 Project 工作的人。
4. **单项功能都不是差异化。** Anywhere voice、selection transform、custom prompt、web clip、auto-tag、source QA 和 generation 都已有强竞品。
5. **最可信的切口是一条连续工作流。** `当前网页/选区判断 → 带来源 Log → 用户控制的 Project Context → 当前输入框中的 cited creation`。
6. **对象必须收起来。** 首日只让用户理解 Log 与 Project；Skill 是上下文动作，Source 用于核验，Topic 是建议，Run/Derived Source 是系统记录。
7. **自动组织必须受控。** Topic 可以自动变化，Project 不能被后台静默污染。
8. **来源类型不能混淆。** 原网页 Evidence、用户判断和 AI output 都可进入 Context，但 authority 不同。

## 3. 关键分歧与裁决

### Voice 是否应该从定位中删除

- ChatGPT 红队倾向把 Voice 降得更低，强调可追溯 Source lineage。
- 两位竞品 agents 认为 Voice 仍可构成获客入口，但不能单独成为购买理由。

裁决：**Voice 保留为品牌与交互原则，并出现在具体动作中；外部主张先卖“网页现场判断变成项目记忆并用于当前产出”。** 这样不放弃用户要求，也不与 Wispr 在 dictation 功能表上正面对撞。

### 所有普通听写是否永久保存

- 用户原始愿景是所有主动输入都可成为 Source。
- 两位 agents 独立指出，任意输入框包含敏感内容、临时回复和低价值草稿；默认永久索引会带来隐私恐惧与知识污染。

裁决：这是未解决的用户决定。推荐区分：

- `Voice Write`：默认只插入，短期/本地可恢复，可显式 Keep。
- `Capture / Comment`：明确形成持久 Source 并进入 Project Memory。

即使最终选择永久保存所有 dictation，也应默认不把它们纳入 Project Context，并允许按应用/Project 控制 retention。

### Moat 是 lineage 还是 cross-app workflow

- ChatGPT 强调 immutable lineage 和 AI 全过程可审计。
- agents 强调 live-web anchor、Project Context 和原位 adoption。

裁决：**lineage 是数据防御，cross-app round trip 是用户价值；两者缺一不可。** 首版先让 lineage 服务于可见的来源核验，不建设独立审计控制台。

## 4. 审查后的定位合同

### 对外一句话

> LOGUE.ai 让需要跨网页研究和写作的人，直接在任意页面或精确选区上用语音留下判断，把这些带来源的记录沉淀为项目记忆，并在任意输入位置基于它们继续写作。

### 最短表达

> 说一次，记住来源，用回当前工作。

### 唯一首版闭环

`Voice/text Comment on page or selection → quiet Log → confirm one Project → ask or draft from saved evidence → copy/insert in current editor`

### 十分钟产品证明

1. 在文章 A 选中一段并说出 Comment。
2. 在文章 B 再记录一个判断。
3. 两条记录加入同一 Project。
4. 到邮件或文档输入框说“根据这个项目起草回复”。
5. 预览两个直接 Sources 后插入；返回原文可核验。

如果这条链不能明显优于 `Wispr + Readwise + ChatGPT` 的手工组合，定位尚未成立，不应靠增加更多输入类型或 AI 功能补救。

## 5. 审查门结论

第一轮结论：**NARROW / REPLAN。**

已据此重写定位、对象可见性、IA 和 MVP；长期 Voice / Log / Skills / auto-organization / generation 能力保留在路线图。用户确认前不进入实现。

最终 `logue_product_designer` 复审曾因竞品研究把待决的 Voice Write 保留建议写成既定要求而 `BLOCK — 8.8/10`。修正为“用户确认前继续沿用所有主动 Voice Write 永久形成 Source”并消除核心循环歧义后，最终门禁为：**PASS — 9.3/10**。
