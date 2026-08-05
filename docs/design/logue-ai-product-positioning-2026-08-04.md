# LOGUE.ai V2 整体产品设计（持续迭代稿）

创建：2026-08-04；最近更新：2026-08-05
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

长期扩展方向不是把私人 Log 变成团队知识库，而是让用户把工作中已经确认的判断与依据，显式发布为 Project、团队和 AI 可复用的可信 Context。这个方向强化个人闭环，但当前不替换上述个人定位。

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

这里的分类只决定个人 Context membership，不决定共享范围；未来共享遵守第 14 节的显式 Publication 边界。

## 5. 核心循环

`Any user input → permanent Source in Log → explicit or automatic Project classification → ask/draft from Project evidence → copy/insert in current editor`

用户只需理解：

1. 在现场说、写或保存一次，Logue 永久记住内容和来源。
2. 用户或系统决定它是否值得进入某个 Project Memory。
3. 需要时在当前工作中直接用回来。

长期内部循环仍为：

`Voice / Text / Clip / future Screenshot → Source → Skills → Projects / Topics → Ask / Analyze / Generate → Derived Source / Page → Log`

但不能把这个内部模型直接变成用户必须先学习的 UI 或市场文案。

## 6. 对象、来源与可见性

| 层级 | 对象 | 用户何时看见 |
| --- | --- | --- |
| 直接可见 | Log、Project | 捕获、找回和产出时始终可理解 |
| 上下文能力 | Skill | 选区、页面或写作动作中出现；配置放在 Settings |
| 渐进披露 | Source | 用户核验出处、修正 Project 或查看 Comment 时出现 |
| 渐进披露 | Knowledge | 用户确认某项判断、决定、结论或方法值得持续复用时出现；当前不建立一级导航 |
| 长内容 | Page | 需要持续编辑产出时出现，不阻塞首版闭环 |
| 自动组织 | Topic | 先作为筛选/建议，不要求用户管理 |
| 系统内部 | Derived Source、Run、Publication | 用于 provenance、Undo、版本与未来显式发布；默认不成为导航对象 |

Comment 是附着于页面或精确选区的 Source，不增加一级对象。

所有可用内容都可以进入 Log 和 Context，但必须区分 origin、human endorsement 与当前状态，不能把来源类型直接当作权威性：

- **Web**：网页、选区及以后加入的 PDF、Screenshot 等外部 Evidence。
- **You**：用户的语音/文字 Comment、判断与纠正。
- **AI**：摘要、翻译、分析和生成结果。

UI 只需显示轻量的 `Web / You / AI` 来源标识；底层分别记录是谁或什么产生内容、用户是否采纳、内容是否仍有效，以及父子链、实际 input 和 adopted result。Web 可能错误、You 可能过期、AI 也可能被用户确认；AI output 永远不得伪装成原始 Evidence。

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

Project 是用户意图和 Context 边界：有明确 active Project 或高置信度分类时可自动加入个人 Context；低置信度只建议。用户修正永久优先于后台分类。分类与未来共享的关系以第 14 节为准。

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
5. **已确认：** 长期团队扩展采用显式发布边界；底层语义使用 `Source + Knowledge + Scope + Publication`，不再采用五层知识晋升链。
6. **当前开放：** 用户会继续提供产品想法；V2 的完整功能、IA、UX、优先级和实现边界在设计收敛前都可以继续更新。

## 14. 已确认的长期扩展：从个人工作记忆到可信共享 Context

### 14.1 战略角色

AI 普及后，团队成员在阅读、写作、对话、判断和使用 AI 的过程中持续产生大量高意图输入。传统文档、邮件和会议记录通常只保存最终结果，丢失了“为什么形成这个判断”以及它与原始证据之间的关系。

LOGUE.ai 的长期机会是：

> **记录个人工作中形成的判断与依据，只把用户确认过的知识交给 Project、团队和 AI。**

这不是一条把私人 Log 自动升级成团队知识的流水线。个人产品仍以第 1 节的“有来源的工作记忆”为入口；团队能力通过一个明确的 **Publication boundary** 连接，而不是通过共享私人存储连接。

`knowledge maturation layer` 可以描述内部机制，但不作为当前外部类别。LOGUE.ai 不与 Microsoft、Glean、Notion、Atlassian、Google 或 Slack 正面竞争企业搜索、Wiki 和协作套件；它主要工作在正式文档产生之前，并把经过确认的结果写回或开放给现有工具。

### 14.2 核心产品模型

不再采用 `Private Source → Personal Knowledge → Share Candidate → Project Knowledge → Team Knowledge` 五层对象。内容类型、Context、可见范围和成熟状态必须彼此独立：

| 概念 | 严格定义 | 用户心智 |
| --- | --- | --- |
| **Source** | 一次可追溯的记录或证据：网页、选区、语音、文字、Comment、Clip、未来文件，以及 AI 派生结果。原始版本不被静默覆盖 | “当时发生或记录了什么” |
| **Knowledge** | 从一个或多个 Sources 形成，并由用户明确采纳或确认“值得持续依赖”的判断、决定、结论、方法或事实主张；可版本化和替代 | “我认为以后值得继续依赖什么” |
| **Scope** | Personal、Project、未来 Workspace；决定谁可以使用某个明确版本，不改变内容类型 | “谁能看到和使用” |
| **Publication** | 用户把某个 Knowledge revision 及允许公开的证据显式发布到目标 Project/Workspace 的记录 | “这次具体分享了什么” |

补充边界：

- **Log** 是当前用户的私人 Source 视图，不是共享容器，也不能出现 `Share my Log`。
- **Project** 是工作意图和 Context 边界；Source 与 Project 的关联不等于共享授权。
- **Workspace** 是未来的数据、所有权和管理边界；个人 V2 不需要显示 Workspace switcher。
- **Team** 未来只是成员/权限组，不是新的 `Team Knowledge` 内容类型。
- **Actor** 记录谁或什么产生或处理内容；作者身份与内容归属必须分开。
- **Web / You / AI** 只是 origin。权威性来自用户采纳、团队 endorsement、来源质量、新鲜度和当前状态，而不是 origin 标签。

因此：

- `Personal Knowledge`、`Project Knowledge`、`Team Knowledge` 是同类 Knowledge 在不同 Scope 中的使用方式，不是三种对象。
- `Share Candidate` 只是仅作者可见的临时建议或发布预览，不建立长期对象、Inbox、一级导航或待办队列。
- 原始输入是第一方工作记录和 Evidence；这里的 `source of truth` 只表示原始记录不可被伪装或静默改写，不代表其事实判断必然正确。

### 14.3 个人体验保持不变

当前个人闭环仍是：

`Capture / Voice Write / Comment → private Source in Log → personal Project Context → Ask / Draft → adopted result`

- Voice Write 继续零额外决策，先保存、再插入，不要求选择共享范围。
- 页面/选区 Comment 和其他判断首先仍是 Source；只有用户明确采纳或确认值得持续依赖时，才形成 Knowledge。
- 自动分类可以安静维护个人 Project Context；用户只在低置信度或需要纠正时介入。
- AI 可以从 Sources 中发现可复用判断，但默认只生成私人建议；用户忽略建议不会产生通知、团队信号或新的维护负担。
- Knowledge 当前不需要一级导航。只有当用户要复用、核验、修改或分享某个判断时，才渐进出现。

### 14.4 未来最小共享 UX

未来团队能力只增加一个核心动作：`Share to project`。

1. **提炼：** 用户或 AI 从一个或多个 Sources 形成私人 Knowledge draft。
2. **建议：** AI 可安静显示“可能适合 Project Alpha”；只对作者可见，永远不是待办。
3. **预览：** 用户看到团队将获得的正文、引用和证据，以及仍保持私有的内容。
4. **删改与脱敏：** 用户可修改正文、移除敏感段落，或只共享安全摘录。原始音频、完整 transcript、私人 Comment 和中间 AI 过程默认不共享。
5. **发布：** Publication 固定到一个明确 Knowledge revision；发布的正文和摘录成为独立的 Project 快照，私人原件仍保持私人。
6. **使用：** Project 成员和获准 AI 可以搜索、引用和复用已发布内容，并看到作者、状态、更新时间以及自己有权查看的证据。
7. **维护：** 后续修改创建新 revision；旧版本通过 supersedes 关系保留，不被静默覆盖。

发布只表示 Project 可以搜索、引用和使用，不自动证明内容正确，也不自动成为项目事实。是否需要团队 endorsement、负责人、冲突和 freshness 流程，等真实协作行为出现后再设计。

发布预览必须明确告知用户：删除私人原件不会自动删除或撤回已经发布的 Project 快照；停止团队后续使用需要单独执行 `Withdraw`。

如果未来共享 Project 允许用户使用私人材料生成内容，结果必须先保持私人；只有完成上述发布预览后，才可进入共享 Context。

### 14.5 隐私、所有权与生命周期原则

1. **Private by default。** 私人 Source 不得因 Project classification、AI 推断、成员邀请或 Workspace 变化而自动公开。
2. **Publish 必须显式。** AI 可以提议、提炼和检查，永远不能替用户完成首次跨 Scope 发布。
3. **分类与共享分离。** `Source belongs to Project` 只表示 Context membership，不表示 Project 成员可见。
4. **权限不能沿 lineage 自动放宽。** 使用了私人 Context 的 AI output 默认仍是私人内容；发布时只披露用户确认的正文和证据。
5. **发布版本应可独立存活。** 删除私人 Source 不会撤回已经发布的 Project 快照；相关内容转为 `supporting source unavailable`，并停止伪装成完整可核验状态。
6. **删除、解除关联和撤回是不同动作。** 删除私人 Source、从 Project Context 移除、撤回 Publication 分别处理；撤回后停止未来搜索与 AI 使用，历史引用保留最小 tombstone。
7. **团队资产不能夺走私人历史。** 未来成员离开 Workspace 时，明确发布且归属 Workspace 的版本可以保留；未发布的私人 Sources 不自动转移。
8. **不能形成员工监控。** 团队和管理员不得看到未共享内容、被忽略的分享建议、个人捕获量或“谁贡献得少”等人员指标。

当前“永久保存”继续表示：所有主动输入默认长期留在私人 Log，原始版本不被静默覆盖，直到用户明确删除。它不等于永远不可删除、自动共享、团队审计保留或法律保全；这些语义未来必须独立设计。

### 14.6 V2 今天需要保留的语义

以下是产品设计语义，不是当前实现授权，也不要求现在暴露 UI：

- Source、Project、Knowledge 和 revision 使用稳定 ID，不以名称作为关系键。
- 原始 Source 与 normalized/edited representation 分开；派生结果保留 input/output lineage。
- 记录内容的 origin/actor、作者与归属，不让 AI output 静默获得人类权威性。
- Project Context membership 与 visibility/publication 分离。
- Knowledge 使用 revision 与 supersedes 表达更新；Publication 只需要 `active / withdrawn`。
- Publication 记录目标 Scope、固定 revision、作者、发布时间、独立共享快照与允许公开的 Sources/安全摘录。
- 检索和生成在使用时遵守当前 Scope；被撤回内容停止进入未来 Context。
- Export 保留稳定 ID、来源链、版本、Publication 和 tombstone；开放格式、API/MCP 与自托管兼容优先于封闭数据模型。

### 14.7 现在明确延后

- **新内容表面：** Team Knowledge 导航、Share Candidate Inbox、独立团队知识类型、完整协作编辑器。
- **企业管理：** SSO/SCIM、复杂权限、DLP、legal hold、审计后台和数据驻留。
- **知识治理：** 审批、Trust Score、负责人 dashboard、freshness/冲突工作流和 canonical truth。
- **平台扩张：** Enterprise Search、大量 connectors、统一 Knowledge Graph、企业 Agent marketplace 和人员活动分析。

这些能力不是被永久否定；只有在个人复用和自然共享行为得到验证后，才决定是否进入产品，而不能提前污染低摩擦个人体验。

### 14.8 首个协作用户与验证门

个人 beachhead 保持第 2 节不变。未来最合理的首批协作用户是 3–15 人、需要处理外部证据并持续产出结论的 AI-native 研究、产品、战略或咨询团队。

在扩展团队产品前，至少需要验证：

1. 用户保存的主动输入中，有足够比例在 14–30 天内被本人真实找回、引用或用于产出，而不是形成新的内容坟场。
2. 用户价值明显超出语音转写；关闭来源链和 Project Context 后，体验应显著变差。
3. 来源与 lineage 会改变用户对 AI 结果的接受、修改或拒绝，而不只是作为很少打开的技术信息。
4. 用户会在正常发送、发布或完成交付物时自愿分享，而不是依靠新的 Review Inbox 或管理者强制。
5. 被发布的 Knowledge 会被另一名成员实际引用、修订或用于 AI Context；如果团队只要求搜索已有文档，LOGUE.ai 不应扩张成企业知识库。

如果个人复用成立、团队自然发布不成立，应保留个人产品，只提供 Publish API、开放格式、MCP 以及向 Notion、Slack、Confluence 等现有工具的写回能力。

### 14.9 开放策略与仍未决定的问题

开放 schema、完整导出、API/MCP、插件和可检查的 provenance 是当前确定方向。开源或自托管可以增强数据主权、可迁移性和生态，但不能自动解决员工信任、治理、知识质量、社区或商业模式。

以下问题继续开放：

1. Knowledge 在个人 V2 中何时需要成为可直接编辑的用户可见对象，何时只作为 Project 内的渐进状态。
2. Project 是否需要 endorsement、负责人、review date、freshness 和冲突 UX，以及何时出现才不会形成治理负担。
3. 团队 Knowledge 主要留在 LOGUE.ai，还是默认写回现有 Notion、Slack、Confluence、Docs 与 Agent 环境。
4. 雇主 Workspace 中个人数据的归属、删除和离职体验如何与真正的私人空间分离。
5. 是否开源、开放哪些模块、采用何种许可证及托管模式，等待个人价值和生态需求验证后决定。

当前结论：保持个人-first 定位，以 `Source + Knowledge + Scope + Publication` 作为可自然扩展的产品语义；团队方向是受控扩展，不是当前市场入口，也不授权开始实现。
