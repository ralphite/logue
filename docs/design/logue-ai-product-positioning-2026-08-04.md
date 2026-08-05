# LOGUE.ai V2 整体产品设计（持续迭代稿）

日期：2026-08-04
状态：V2 产品设计的唯一权威稿；持续吸收用户后续想法；当前不进入实现

## 0. 文档角色

- 已发布的现有产品统一视为 **V1**。V1 的代码、界面、规格、QA 和 Release 只作为历史证据，不限制 V2。
- 本文档是 **V2 整体产品重设计**的唯一权威产品设计。后续想法直接合并到本文档，不再新增相互竞争的“总体设计稿”。
- 竞品研究与独立 review 是支持证据，不是另一份产品合同。
- 当前处于产品设计迭代阶段；没有 MVP、排期或实现授权。只有用户明确宣布进入实现阶段后，才基于届时的完整 V2 设计制定交付计划。

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

普通听写保持零决策；复杂 Voice Command 不与输入主流程竞争。

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

## 5. 核心循环

`Any user input → permanent Source in Log → explicit or automatic Project classification → ask/draft from Project evidence → copy/insert in current editor`

用户只需理解：

1. 在现场说、写或保存一次，Logue 永久记住内容和来源。
2. 用户或系统决定它是否值得进入某个 Project Memory。
3. 需要时在当前工作中直接用回来。

长期内部循环仍为：

`Voice / Text / Clip / future Screenshot → Source → Skills → Projects / Topics → Ask / Analyze / Generate → Derived Source / Page → Log`

但不能把这个内部模型直接变成用户必须先学习的 UI 或市场文案。

## 6. 对象与可见性

| 层级 | 对象 | 用户何时看见 |
| --- | --- | --- |
| 直接可见 | Log、Project | 捕获、找回和产出时始终可理解 |
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

## 7. V2 信息架构方向

当前建议的一级工作区：

1. **Log**：全部永久 Sources、搜索、分类状态和低置信度待确认。
2. **Projects**：Project Memory、Sources、已确认知识、找回与产出。
3. **Settings**：Voice、Privacy、Skills、Extension/server、Export/backup。

全局动作：`Search`、`Voice Write`。Skills 当前建议作为内容上下文能力和 Settings 中的配置，而不是一级目的地。Topic、Source、Page、Run 不各自建立一级入口。该 IA 会随后续整体产品想法继续迭代，不构成实现冻结。

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

面向用户的设计原则：

- 一个默认 transcription cleanup。
- 少量 contextual actions，例如 Translate、Shorten、Summarize。
- 提供 custom transformation，但不要求用户先理解 pipeline 才能开始使用。

Skill revision、实际 Context、raw output 和 adopted result 由系统记录；完整 pipeline editor 与版本管理的具体 UX 尚待继续设计。

## 10. 当前已确定的 V2 能力基线

当前不定义 MVP，也不使用“只证明一个 Project”作为范围。V2 是整体产品重设计；产品允许创建、选择和切换多个 Projects，一条 Source 也可属于多个 Projects。

已经确认的能力：

1. 常见网页编辑目标中的 Voice Write，并在插入前永久保存为 Source。
2. 对当前页面或精确选区添加语音/文字 Comment。
3. 保存 URL、页面标题、选区、时间、Comment 和必要的原始录音。
4. 用户可显式加入一个或多个 Projects；自动分类能区分高相关重要补充、低置信度建议、重复和 Log-only 内容。
5. 在任意明确的 Project Context 内用语音或文字 Find / Ask / Draft。
6. 每个关键结论显示直接 Sources，可打开原文。
7. 结果可 Copy/Insert；永不自动提交；Cancel、Undo 和纠正可靠。
8. 用户可定制 transcription、transformation、page/selection、organization 与 generation Skills；日常使用保持渐进呈现。

Project 是用户意图和 Context 权限边界：有明确 active Project 或高置信度分类时可自动加入；低置信度只建议。用户修正永久优先于后台分类。

仍属于 V2 长期整体能力、具体 UX 与优先级待继续设计：

- 全局通用 Voice Command。
- 完整自定义 transcription pipeline 和 Skill editor。
- 自动分类的高级配置、显式 Topic 管理和复杂关系发现。
- Derived Source / Run 用户界面和完整 Page editor。
- Screenshot/Image/PDF/File、会议录音、Daily、Agents、marketplace。
- 多用户协作、企业权限与全量 ambient recording。

这些能力没有被删除或确定为某个 Release 范围。后续想法继续合并后，再统一决定 V2 的完整体验、优先级和实现阶段。

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

## 12. 未来验证原则

进入验证阶段后，可以用 8–12 名符合行为条件的用户持续两周，验证：

1. 至少 60% 的活跃用户在首周完成一次完整 round trip，而不是只使用听写。
2. 首次 Capture 后，至少 50% 在 24 小时内再次主动 Capture/Comment。
3. 每位活跃用户每周至少两次从 Project Sources 生成并采用结果。
4. 用户能在 10 秒内说明一段结果来自哪里。
5. Project 建议接受率达到 80%；否则不得默认自动归档。
6. 用户能复述为“把网页上的判断变成项目记忆”，而不是“另一个语音输入或笔记工具”。

## 13. 已确认决定与当前阶段

1. **已确认：** 市场定位收窄为“网页现场判断 → 带来源 Project Memory → 原位产出”。
2. **已确认：** 首个用户按行为聚焦于研究/写作密集的个人知识工作者。
3. **已确认：** 所有用户输入永久进入私人 Log；通过显式选择或自动分类决定是否进入 Project Memory。
4. **已确认：** 当前只继续迭代 V2 整体产品设计，不定义“只证明一个 Project”的 MVP，不开始实现。
5. **当前开放：** 用户会继续提供产品想法；V2 的完整功能、IA、UX、优先级和实现边界在设计收敛前都可以继续更新。

## 14. 候选方向：从个人 Log 到团队 Knowledge（评估中）

### 14.1 方向假设

AI 普及后，团队成员在阅读、写作、对话、判断和使用 AI 的过程中持续产生大量原始输入。传统文档、邮件和会议记录只能保存其中一部分，而且通常等到工作结果已经成形后才被分享。

候选方向是让 LOGUE.ai 成为这条知识沉淀链：

`Private Source Log → Personal Knowledge → Share Candidate → Project Knowledge → Team Knowledge → Human / AI reuse`

这会把 LOGUE.ai 从个人捕获与 Project Memory 产品，扩展为 **AI-native work 的 knowledge maturation layer**：先让个人直接受益，再让经过选择、整理和治理的内容成为团队 Context。

### 14.2 当前评价

这个方向有更大的长期价值，也比“语音 SaaS”“second brain”或“企业搜索”更接近 LOGUE.ai 的独特能力，但有一个必须修正的概念：

> 原始输入是第一方工作记录和 Evidence，不天然是 Truth。

语音、Comment、Clip、截图和 AI 对话可能是临时想法、错误判断、敏感信息、重复内容或已经过期的结论。团队可依赖的 Knowledge 必须保留来源，同时具备作者、状态、适用范围、更新时间和修订关系。未经整理的 Source 不能因为被记录就自动获得“团队事实”的权威性。

### 14.3 建议的知识层级

| 层级 | 含义 | 默认可见性 | 进入下一层的条件 |
| --- | --- | --- | --- |
| Private Source | 原始语音、文字、页面/选区 Comment、Clip、未来截图等不可伪装的记录 | 仅本人 | AI 发现可复用判断，或用户主动整理 |
| Personal Knowledge | 从一个或多个 Sources 提炼出的判断、决定、方法或事实主张 | 仅本人 | 用户选择共享，或 AI 生成 Share Candidate |
| Share Candidate | 已整理、可检查、可删改来源和敏感内容的共享候选 | 仍仅本人 | 用户明确确认目标 Project/受众 |
| Project Knowledge | 项目成员和获准 AI 可用的 Context；有来源、版本和权限 | 指定 Project | 被项目成员接受为跨场景可复用知识 |
| Team Knowledge | 跨项目可复用、有人负责、可判断新鲜度的团队知识 | 指定团队 | 明确 owner、状态、适用范围和审阅机制 |

`Share Candidate` 是关键缓冲层：AI 可以自动分类、去重、提炼和提出共享建议，但不应把私人 Source 静默暴露给团队。

### 14.4 与现有产品的潜在空位

- Microsoft 365 Copilot、Glean、Rovo、Slack Enterprise Search 与 Onyx 主要从已经存在于邮件、聊天、文档和 SaaS 中的组织内容开始，强项是权限感知的搜索、问答和 Agent。
- Khoj、AFFiNE、Outline、Mem0 等开源产品分别覆盖个人 AI、工作区/知识库或 AI Memory；screenpipe 覆盖本地的屏幕与音频活动记录。
- LOGUE.ai 的潜在空位不是再做一个统一搜索框，而是管理 **知识形成之前** 的过程：捕获个人现场判断，把原始 Evidence 逐步转成可控、可追溯、可共享的知识。

这是基于当前竞品能力的定位推断，不是已经验证的市场空白。

### 14.5 对 Voice / Log / AI 的强化

- **Voice**：成为工作现场最低摩擦的输入、命令和知识交互方式，不只是转写功能。
- **Log**：保存个人原始工作记录和完整 lineage，是知识沉淀的私有底座。
- **AI**：负责分类、去重、提炼、发现矛盾、生成 Share Candidate，以及在受控 Context 中协助个人和团队工作。

### 14.6 如果采用该方向，必须成立的产品原则

1. 个人必须先得到独立价值；不能要求用户为了公司知识库额外汇报工作。
2. 私人 Log 默认不共享；AI 可以建议共享，不得静默共享。
3. Derived Knowledge 必须能回到 Sources；AI 不能把推断伪装成事实。
4. 团队可见的证据不得泄露私有或外部来源中未获授权的内容；需要共享结论时，必须生成经本人确认的可分享证据，或明确标注部分来源不可见。
5. 冲突、过期和撤回是正常状态；团队知识不能被设计成只增不改的静态 Wiki。
6. 开源是信任、部署和生态策略，不是用户价值本身；无论最终许可证如何，数据格式、导出和来源 lineage 都应保持可检查、可迁移。

### 14.7 尚未确认的关键问题

1. 第一批真实用户仍是个人研究/写作密集用户，还是已经在同一项目协作的小团队？
2. `Personal Knowledge → Project Knowledge` 必须始终由本人确认，还是可以对某些明确 Project 设置自动发布规则？
3. 谁能把 Project Knowledge 提升为 Team Knowledge，谁负责修订和废弃？
4. 团队是否能看到知识结论但看不到其私人 Sources；如果来源不可见，可信度如何表达？
5. LOGUE.ai 最终做完整的团队协作与权限系统，还是提供开放的 knowledge layer，由现有协作工具消费？
6. 开源的目标是本地信任、社区扩展、私有部署，还是商业分发；许可证与托管模式暂不决定。

当前建议：把它保留为 V2 的高潜力候选产品论点，先确认知识层级与共享边界，再决定是否用它替换第 1 节的当前定位。
