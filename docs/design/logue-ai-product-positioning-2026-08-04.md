# LOGUE.ai 总体产品定位

日期：2026-08-04
状态：定位、首个用户与持久 Log 边界已获用户确认；首轮 MVP 验证范围待最终确认；不得作为实现授权

## 1. 结论

LOGUE.ai 的长期方向成立，但 `Voice / Log / AI` 是产品原则，不是足够独特的市场定位。首个定位必须围绕一个连续结果：

> **LOGUE.ai 让需要跨网页研究和写作的人，直接在任意页面或精确选区上用语音留下判断，把这些带来源的记录沉淀为项目记忆，并在任意输入位置基于它们继续写作。**

短句：

> **说一次，记住来源，用回当前工作。**

英文方向：

> **Think on any page. Build project memory. Write with what you’ve learned.**

LOGUE.ai 不应以“另一个语音输入工具”“second brain”“个人 OS”或“AI 知识库”进入市场。它首先解决的是：**用户在阅读时形成的判断不会脱离原始证据，也不会在真正写作时丢失。**

## 2. 首个用户与购买结果

首个 beachhead 是：

> **每天围绕一个活跃项目，在网页、ChatGPT、Google Docs 和邮件之间阅读、判断并写作的个人知识工作者。**

优先招募产品经理、独立研究者、顾问和创始人，但按行为筛选：

- 每周处理大量网页或文档来源。
- 阅读时会形成自己的判断，而不只是收藏。
- 经常把多个来源综合成邮件、PRD、报告或决策材料。
- 经常因为“记得看过或说过，但找不到出处”而返工。

用户购买的不是 Voice、Log 或 AI 本身，而是：

> **不离开当前工作，就能把看过、选过和主动说过的内容变成以后可找回、可核验、可继续产出的项目记忆。**

## 3. 三个产品原则

### Voice

语音是通用交互层：

- 在任意技术上可访问的编辑目标中直接听写。
- 对当前页面或精确选区添加语音 Comment。
- 在明确的 Project Context 中用语音找回、分析和生成。
- 长期支持以语音执行保存、翻译、总结、整理等命令。

首版保持普通听写零决策；复杂 Voice Command 不与输入主流程竞争。

### Log

Log 是所有用户主动输入的永久记录：

- Page Comment
- Selection + text/voice Comment
- Text Note
- Web selection / Web clip
- Voice Write
- Skill result / adopted output
- 未来 Screenshot、Image、PDF/File

所有 Voice Write、Capture、Comment 和其他用户输入都形成 Source，并永久保存在私人 Log 中，直到用户明确删除。原始页面、选区、URL、时间、用户 Comment 和后续产出保留关联；转换不覆盖原始证据。

### AI

AI 作用于用户自己的 Log 和 Project evidence：

- Transcription cleanup
- Shorten / Rewrite / Translate / Combine
- Page or selection summarization
- Project suggestion and later Topic clustering
- Grounded find / ask / compare / draft
- Source-linked generation

重要结果必须能回到具体 Source；正常后台处理保持安静。

## 4. 永久 Log 与 Project Memory 的边界

用户已经确认：**永久保存与进入 Project Memory 是两个不同决定。**

### Voice Write

`Focus editable target → Record → clean transcript → Insert`

- 目标是替代键盘，默认不增加分类或保存决定。
- 停止后先永久保存为私人 Log Source，再插入当前目标。
- 永不自动提交宿主表单。
- 永久保存本身不等于进入 Project Memory；只有显式选择或分类结果才能让它进入。

### Capture / Comment

`Page or selection → voice/text Comment → Save source → explicit/automatic Project classification`

- 明确建立持久 Source。
- 保留原页面/精确选区及用户判断。
- 可以由用户显式加入 Project Memory，也可以交给自动分类。

### Project Memory classification

每个永久 Source 都经过分类，但分类不改变其 Log 保存状态：

- **Explicit**：用户选择一个或多个 Projects，立即进入对应 Project Memory。
- **Auto include**：系统判断与某 Project 高相关、重要，并提供新信息或关键补充时，可安静加入。
- **Suggest**：相关但置信度不足时，只建议用户确认。
- **Log only**：无关、低价值、临时或重复内容继续永久保存在 Log，但不进入 Project Memory。
- **Duplicate link**：重复内容关联到已有 Source，不重复放大其在 Context 中的权重。

用户显式选择、排除和纠正永久优先于自动分类；后台不得再次覆盖。Project Memory 是可用于 Project AI 的受控 Context，不是另一份存储副本。

## 5. 唯一核心循环

`Any user input → permanent Source in Log → explicit or automatic Project classification → ask/draft from Project evidence → copy/insert in current editor`

用户只需理解：

1. 在现场说、写或保存一次，Logue 永久记住内容和来源。
2. 用户或系统决定它是否值得进入某个 Project Memory。
3. 需要时在当前工作中直接用回来。

长期内部循环仍为：

`Voice / Text / Clip / future Screenshot → Source → Skills → Projects / Topics → Ask / Analyze / Generate → Derived Source / Page → Log`

但不能把这个内部模型直接变成首日 UI 或市场文案。

## 6. 对象与可见性

| 层级 | 对象 | 用户何时看见 |
| --- | --- | --- |
| 首日核心 | Log、Project | 捕获、找回和产出时始终可理解 |
| 上下文能力 | Skill | 选区、页面或写作动作中出现；配置放在 Settings |
| 渐进披露 | Source | 用户核验出处、修正 Project 或查看 Comment 时出现 |
| 长内容 | Page | 需要持续编辑产出时出现，不阻塞首版闭环 |
| 自动组织 | Topic | 先作为筛选/建议，不要求用户管理 |
| 系统内部 | Derived Source、Run | 用于 provenance、Undo、审计和调试；默认不成为导航对象 |

Comment 是附着于页面或精确选区的 Source，不增加一级对象。

所有可用内容都可以进入 Log 和 Context，但必须区分 authority，不能把它们当作同等证据：

- **Web**：网页、选区及以后加入的 PDF、Screenshot 等外部 Evidence。
- **You**：用户的语音/文字 Comment、判断与纠正。
- **AI**：摘要、翻译、分析和生成结果。

UI 只需显示轻量的 `Web / You / AI` 标识；底层保留父子链、实际 input 和 adopted result。AI output 不得伪装成原始 Evidence。

## 7. 首版信息架构

一级工作区只保留：

1. **Log**：全部永久 Sources、搜索、分类状态和低置信度待确认。
2. **Projects**：Project Memory、Sources、已确认知识、找回与产出。
3. **Settings**：Voice、Privacy、Skills、Extension/server、Export/backup。

全局动作：`Search`、`Voice Write`。Skills 不作为首版一级导航；它在内容上下文和 Settings 中渐进出现。Topic、Source、Page、Run 不各自建立一级入口。

## 8. 产品表面

### In-place voice launcher

只负责当前编辑目标的 Voice Write；一个麦克风入口，默认无额外选择。

### Selection menu

对当前选区提供 `Comment`、`Save to Project` 和少量高频 Skills。静态选区与可编辑选区具有不同采用语义。

### Chrome Side Panel

负责页面/选区 Comment、当前 Project、来源核验、Ask/Draft、Copy/Insert 和局部错误恢复。它是闭环的主要产品表面，不复制完整 Web App。

### Web App

负责长期 Log、Projects、搜索、来源链、配置和以后出现的长 Page。

## 9. Skills 模型

统一底层 Skill 模型仍是长期核心，支持：

- Transcription
- Transformation
- Page / Selection
- Organization
- Generation

首版只暴露：

- 一个默认 transcription cleanup。
- 少量 contextual actions，例如 Translate、Shorten、Summarize。
- 一个简单的 custom transformation 入口，用来验证用户是否真的需要自定义。

Skill revision、实际 Context、raw output 和 adopted result 由系统记录，但完整 pipeline editor 与版本管理后移。

## 10. 最窄但完整的 MVP

“先证明一个 Project”只是一条首轮验收场景，不是产品或数据模型只支持一个 Project。产品仍允许创建、选择和切换多个 Projects，一条 Source 也可属于多个 Projects；首轮只要求用一个 active Project 把端到端价值证明清楚，避免同时用复杂多项目管理掩盖闭环问题。

必须有：

1. 常见网页编辑目标中的 Voice Write，并在插入前永久保存为 Source。
2. 对当前页面或精确选区添加语音/文字 Comment。
3. 保存 URL、页面标题、选区、时间、Comment 和必要的原始录音。
4. 用户可显式加入一个或多个 Projects；自动分类能区分高相关重要补充、低置信度建议、重复和 Log-only 内容。
5. 在该 Project 内用语音或文字 Find / Ask / Draft。
6. 每个关键结论显示直接 Sources，可打开原文。
7. 结果可 Copy/Insert；永不自动提交；Cancel、Undo 和纠正可靠。
8. 一个简单 custom transformation，用于验证 Skills 需求。

Project 是用户意图和 Context 权限边界：有明确 active Project 或高置信度分类时可自动加入；低置信度只建议。用户修正永久优先于后台分类。

明确推迟：

- 全局通用 Voice Command。
- 完整自定义 transcription pipeline 和 Skill editor。
- 自动分类的高级配置、显式 Topic 管理和复杂关系发现；基础 Project auto-include / suggest 属于 MVP。
- Derived Source / Run 用户界面和完整 Page editor。
- Screenshot/Image/PDF/File、会议录音、Daily、Agents、marketplace。
- 多用户协作、企业权限与全量 ambient recording。

这些长期能力没有被删除；它们必须等待首个 `capture → project memory → cited creation → insert` 闭环被真实用户证明。

## 11. 竞争边界

### 已是 table stakes

- 任意输入框听写。
- AI cleanup、rewrite、translate、summarize。
- 自定义 prompt/mode。
- Web clip、search、auto tag。
- 对 notes/sources 的问答和生成。
- 来源、历史、Cancel、Undo、导出和隐私控制。

### 可验证的差异化组合

- Live-web anchored voice/text Comment。
- 原始证据 + 用户判断 + 派生结果的 lineage。
- 明确、可修正的 Project Memory，而不是模糊的全局 second brain。
- 从阅读现场捕获，再回到任意写作现场基于同一证据原位产出。

这仍不是已建立的 moat。真正的防御只能来自长期累积的项目证据链、用户纠正、采用反馈和跨宿主可靠性。

## 12. 验证计划

先用 8–12 名符合行为条件的用户持续两周，验证：

1. 至少 60% 的活跃用户在首周完成一次完整 round trip，而不是只使用听写。
2. 首次 Capture 后，至少 50% 在 24 小时内再次主动 Capture/Comment。
3. 每位活跃用户每周至少两次从 Project Sources 生成并采用结果。
4. 用户能在 10 秒内说明一段结果来自哪里。
5. Project 建议接受率达到 80%；否则不得默认自动归档。
6. 用户能复述为“把网页上的判断变成项目记忆”，而不是“另一个语音输入或笔记工具”。

## 13. 当前待用户确认

1. **已确认：** 市场定位收窄为“网页现场判断 → 带来源 Project Memory → 原位产出”。
2. **已确认：** 首个用户按行为聚焦于研究/写作密集的个人知识工作者。
3. **已确认：** 所有用户输入永久进入私人 Log；通过显式选择或自动分类决定是否进入 Project Memory。
4. **待确认：** 是否同意首轮验收只用一个 active Project 证明完整闭环；这不限制产品支持多个 Projects，也不删除长期能力。
