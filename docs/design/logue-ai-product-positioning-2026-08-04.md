# Logue V2 产品定义

创建：2026-08-04
重写：2026-08-05
状态：V2 产品设计的唯一权威稿；用户已授权基于本文重建 UI mock；不构成生产实现冻结

## 0. 文档角色

- 已发布产品统一视为 V1。V1 的代码、界面、数据和设计不限制 V2。
- 本文先定义 Logue 要解决什么问题、为谁解决、为什么值得存在，再定义功能与交互合同。
- 竞品研究、独立审查和 mock 只是支持证据。它们不能覆盖本文，也不能反向决定产品。
- 现有 Storybook V2 mock 已被用户否决，降级为历史探索。新 mock 只能在本文经用户确认后重新设计。
- 当前不定义 Release、MVP、排期或兼容方案，也不开始实现。
- V2 的 reference platform 是 Mac + Chrome Extension + Logue Host/Web App；Host 默认在当前 Mac，也可显式连接自有 LAN Host。其他桌面浏览器、Windows、Linux client 与 Mobile 属于后续平台扩展，不进入下一版 mock。

---

## 1. 产品决策摘要

### 1.1 Logue 是什么

Logue 是一个 local-first、voice-native 的个人 Project Context 产品。

它帮助需要跨网页阅读和持续产出的人：

1. 在正在阅读或写作的位置，用语音、文字、网页或选区记录输入；
2. 保留输入与原始证据之间的关系；
3. 把有用内容形成受控、可纠正的 Project Context；
4. 在之后任意写作位置找回这些 Context，生成并采用实际产出。

对外不能用 “Voice + Log + AI” 解释产品。这三个词描述机制，不描述用户结果。

### 1.2 一句话定位

> Logue 把你在网页上说过、看过和判断过的内容，变成有来源的项目 Context，并在你下一次写作时直接带回来。

英文方向：

> Turn what you notice and say across the web into sourced context for the work you are doing — then use it wherever you write.

最短承诺：

> 记录当下，带回工作。

“说一次，记住来源，用回当前工作”仍可用于解释核心循环，但不是唯一品牌文案。

### 1.3 产品类别

仅用于团队内部对齐的工作定义，不作为首页或用户文案：

> Voice-native Project Context layer for browser knowledge work

用户不需要理解 “layer”。用户看到的是三件连续的事：

- Speak or capture here
- Keep the source
- Use it in this project

### 1.4 首个可信切口

Logue 的切口不是单个 feature，而是一个跨表面的 round trip：

> 当前网页或精确选区 → 用户的语音/文字判断 → 有来源的私人记录 → 受控 Project Context → 在另一个输入位置提问、起草和插入

只有这条完整路径明显优于 “Wispr + Readwise + ChatGPT” 的手工组合，Logue 才有独立产品价值。

### 1.5 Logue 不是什么

Logue 不是：

- 更好的通用听写工具；
- 收藏网页后再搜索的稍强版书签；
- 以聊天为首页的通用 AI 助手；
- 需要用户手工维护图谱的 second brain；
- Notion、Confluence 或完整团队 Wiki；
- 连接企业 SaaS 后统一检索的 enterprise search；
- 被动录制屏幕、会议或全天活动的 surveillance product；
- 用开源、本地部署或模型可替换本身作为价值主张的技术产品。

Voice、local-first、开放数据和可替换模型是重要能力与信任条件，不是单独的市场定位。

---

## 2. 为什么现在值得做

AI 已经让个人产出速度大幅提高，但真正稀缺的 Context 仍散落在：

- 用户读到的原文；
- 当时说出的判断；
- 临时输入框中的解释、修改和决定；
- 多个网页、文档、聊天与项目之间；
- AI 生成前没有被正式写进文档的推理过程。

现有产品通常只解决其中一段：

- Voice 产品让输入更快，却不保留可靠的项目证据链；
- 阅读产品保留来源和标注，却不把它们带回任意写作位置；
- PKM 产品积累资料，却要求用户回到自己的知识库组织和使用；
- AI Workspace 能基于项目生成，却无法低摩擦捕获用户在开放网页现场形成的判断；
- Enterprise Search 从已经存在的文档和聊天开始，通常错过正式文档产生之前的个人判断。

Logue 的机会是连接 “判断形成的现场” 与 “实际产出的现场”，并让 Context 在两者之间持续积累。

---

## 3. 目标用户

### 3.1 首要用户

按行为而不是职位定义：

> 围绕至少一个活跃 Project，每周把 20+ 网页或文档来源转成至少两次需要核验出处的决策材料或对外产出的个人工作者。

PM、Founder、Researcher、Analyst、Consultant、Writer 或 UX Researcher 只是招募例子，不是多个并列 persona。首要用户必须满足大部分行为：

- 每周处理约 20 个以上网页或文档来源；
- 至少有一个持续两周以上的活跃 Project，通常同时维护约 3–10 个；
- 阅读时会形成自己的判断，而不只是收藏；
- 每周至少两次把若干来源转成邮件、PRD、报告、分析或决策材料；
- 经常遇到 “我记得看过或说过，但找不到出处”；
- 不愿为了记录而频繁切到另一个知识库整理。

### 3.2 首要场景

- 市场、竞品和用户研究；
- 产品与技术方案决策；
- 顾问或分析报告；
- 写作、课程或内容研究；
- 长期客户、合作与尽调项目；
- 任何需要 “多来源阅读 → 自己判断 → 持续产出” 的工作。

### 3.3 不优先服务

- 只需要偶尔听写短消息的人；
- 主要在会议中获取信息、很少阅读网页的人；
- 需要成熟团队 Wiki、复杂审批或企业连接器的人；
- 期待产品自动记录所有屏幕和对话的人；
- 只想存收藏、没有后续项目产出的人；
- 需要移动端优先或多人实时协作的人。

这不是永久排除，而是避免首个产品同时进入太多成熟类别。

---

## 4. 用户问题与期望结果

### 4.1 用户问题

1. **输入很容易消失。** 用户在邮件、聊天或 AI 输入框中说过的重要内容通常只存在于最终发送结果，原始意图和上下文丢失。
2. **来源与判断分离。** 收藏保留了页面，笔记保留了想法，但用户很难知道某个判断当时基于哪一段证据。
3. **项目 Context 不连续。** 同一个项目分散在网页、AI 对话、文档和临时输入之间，每次重新生成都要再次解释背景。
4. **知识库增加整理工作。** 先捕获、再分类、再写笔记、再找回的流程成本过高。
5. **AI 产出难以核验。** 生成结果可能引用了不相关、过期或低权威内容，用户不知道实际用了什么。
6. **输入工具与知识工具断开。** Voice 让用户说得更快，但没有让说过的内容在项目中产生复利。

### 4.2 用户采用 Logue 的唯一结果

> 减少重新解释和返找出处，把阅读现场的判断直接变成当前工作中可采用、可核验的产出。

以下能力是这个结果的证明条件和信任护栏，不是六个并列卖点：

- 说过或保存过的内容不会丢；
- 重要判断保留当时的原始证据；
- 一个 Project 越做越懂术语、目标、事实和用户选择；
- 在当前页面即可调用这些 Context，不必回到另一个应用；
- AI 结果能说明使用了哪些 Sources；
- 用户始终能纠正分类、替换 Context、查看原始版本并删除。

当前不假定 Logue 必须采用订阅 SaaS。是否开源、open core、一次性付费、支持服务或其他模式属于后续策略；用户研究仍要验证用户是否愿意安装、长期依赖、推荐、贡献或付费支持这条 round trip。

---

## 5. 产品目标与衡量方式

### 5.1 五个当前产品目标

#### G1 — 零丢失的主动输入

所有用户完成或明确 Stop/Save 后交给 Logue 的语音、文字、网页和选区输入都先成为私人记录，直到用户明确删除。录音中的 Cancel 是用户明确放弃本次未完成输入，不建立 Source。

成功不是 “录音成功”，而是用户在页面变化、目标丢失或转换失败后仍能找回原始输入。

#### G2 — 高质量的 Project Context

Logue 必须帮助用户把相关、重要、新颖的 Sources 放进正确 Project，同时抑制临时、重复和无关内容。

成功不是 “自动分类数量”，而是用户不需要不断清理错误 Context。

#### G3 — 完成有来源的工作闭环

用户必须能从捕获走到实际采用：在另一个页面基于 Project Sources 找回、提问或起草，并 Copy、Insert 或继续编辑。

成功不是 “生成次数”，而是生成内容进入真实工作。

#### G4 — 建立可核验的信任

任何关键结果都能回到实际使用的 Source；原始内容、转换结果和最终采用版不相互冒充；AI 不静默扩大 Context 或可见范围。

#### G5 — 让最高频意图几乎没有操作负担

Logue 必须让用户在当前页面用最少必要动作完成记录、评论、听写和采用，不要求用户先理解或操作内部持久化模型。默认流程使用渐进披露：快速路径只显示当前决定，高级控制进入 Side Panel 或 Web App。

成功不是 “功能入口都可见”，而是用户无需教学就能完成核心动作；Selection Voice Comment 的基线是 `Mic → Accept` 两次点击，并同时提供 `Enter / Esc` 键盘等价操作。

### 5.2 North Star

**Weekly Sourced Round Trips：每周完成的有来源工作闭环数。**

一次有效 round trip 必须同时满足：

1. 用户主动保存了一个或多个 Sources；
2. Sources 被用于一个明确 Project 的 Ask、Draft 或 Action；
3. 结果在 Web App 中被继续编辑，或 Copy/Insert 到另一个真实工作位置；
4. 使用过的 Sources 可查看。

单次听写、单次收藏、打开搜索或未采用的生成都不计入。

### 5.3 关键指标

- **Activation：** 首次使用 10 分钟内完成 “选区 Comment → Project → Draft → Adopt”。
- **Capture reuse：** 新 Source 在 7 天内被 Find、Ask、Draft 或 Action 使用的比例。
- **Project precision：** 自动加入和建议被保留的比例；用户移除率单独统计。
- **Adoption：** Draft/Action 结果被 Insert、Copy 或继续编辑的比例。
- **Grounding comprehension：** 用户能否在 10 秒内回答结果来自哪里。
- **Trust failures：** 错误 Project 污染、来源无法打开、原始输入丢失、未经同意写入或共享的次数。

这些指标默认由 Logue Host 本地计算并只对 owner 可见。产品不为测量 North Star 强制上传行为数据；用户研究期通过知情同意的本地 report/export 或观察收集。未来如提供匿名 telemetry，必须单独 opt in、可预览事件、可随时关闭，且不上传 Source content、audio、transcript、URL 或 Project 名。

### 5.4 失败信号

- 多数活跃用户只使用 Voice Write；
- Capture 数量增长，但很少再次使用；
- 用户频繁清理自动归类；
- Project Context 越积越多，生成质量反而下降；
- 用户把 Logue 描述为 “另一个听写/笔记/Chat”；
- 用户为了核验结果必须离开当前流程或学习内部对象。

---

## 6. 不可破坏的产品原则

### 6.1 主动记录，不做被动监控

只有用户明确开始 Voice Write、Comment、Capture、Clip、Action 或其他输入时才记录。Logue 不后台监听麦克风，不默认录屏，也不自动采集用户没有交给它的页面内容。

### 6.2 永久保存与 Project Context 是两件事

- **永久保存：** 所有主动输入先保存在 owner-controlled Host 的私人库，直到用户删除。
- **Context membership：** 只有显式选择、已允许的自动规则或用户确认的建议才能进入 Project Context。

保存不代表重要；重要不代表共享。

### 6.3 原始版本永不被转换覆盖

语音保留原始录音、raw transcript、清理后的文本和实际采用版。网页保留 URL、标题、时间、选区快照与必要上下文。任何 Re-transcribe、Translate、Shorten、Combine 或 Draft 都形成新版本或派生结果。

### 6.4 Project 是意图、归属与 AI 使用边界

Project 不是普通标签，也不是当前不存在的成员权限系统。它决定：

- 哪些 Sources 默认可被 Project AI 使用；
- 哪些术语和说明影响转写与生成；
- 用户当前要完成什么工作；
- 哪些自动组织规则可以运行。

用户显式加入、排除和纠正永远优先于自动规则。

### 6.5 Topic 是发现，不是边界

Topic 是系统根据内容动态发现的主题集合，可以变动、合并或消失。Topic 不自动获得 Project 的权限，也不能静默污染 Project Context。

### 6.6 AI 建议，用户采用

AI 可以转写、整理、分类、建议和生成，但：

- 不自动提交宿主表单；
- 不把转换后的文字冒充原话；
- 不把 AI output 冒充 Web evidence；
- 不因生成结果看起来重要就自动共享；
- 高影响采用必须可查看、撤销或纠正。

### 6.7 正常操作保持安静

保存成功、后台索引和高置信的已授权规则不需要反复 toast。只有低置信度、冲突、失败、隐私变化或需要用户决定时出现提示。

### 6.8 Context 最小化

每次转写或生成只使用完成当前任务所需的最小 Context，并允许用户查看 “What was used”。Project Context 是可用范围，不代表每次都把全部内容发给模型。

### 6.9 Local-first，不引入虚构账号

当前产品采用 owner-controlled single Host：默认 Host 是当前 Mac；用户可以在高级设置中显式连接自己控制的 LAN Host。两种情况都只有一个 owner：

- 没有登录、profile、workspace switcher、成员或套餐；
- Extension 与 Web App 连接同一个 Logue Host；
- 官网 logue.ai 负责介绍、下载与文档，不承担当前数据账号；
- Export、Backup、Delete 和模型连接属于当前 Logue Host 设置。

### 6.10 最快主路径，渐进披露高级控制

Logue 的高频默认路径围绕用户正在完成的意图设计，不围绕 Source、Run、membership、linking 或 transcription revision 等内部对象设计。

- 默认路径只要求当前意图不可缺少的用户决定；
- 已授权、可撤销、低风险的保存、转写、来源关联和分类在后台安静完成；
- 不把 `Stop → Save → Link → Add to Project` 之类系统状态逐项变成按钮；
- 只有真实不确定、不可撤销、高影响或隐私边界变化才阻断并要求确认；
- 文本输入、标签、多 Project、分类理由、版本、lineage 和自定义 Skills 通过已打开的 Side Panel 或 Web App 渐进披露；
- 快速路径必须支持清晰、可预测的键盘等价操作，并在完成后保留局部 Undo 或可恢复入口；
- Guided Demo 暴露出的额外步骤首先视为产品 UX 缺陷，不能用教程说明来合理化。

首个强制基线是 Selection Voice Comment：选中文字后直接出现轻量 Mic；点击后只显示 `Accept ↵` 与 `Cancel Esc`。Accept 同时停止录音、保存原音与转写、创建 Comment bundle，并应用当前 tab 已授权的 Project 规则；Cancel 放弃本次未完成录音。无 active Project 时保持 Saved only，在 Side Panel 非阻塞建议归类。

---

## 7. 产品模型与术语

### 7.1 用户必须理解的三个概念

#### Project

一个持续目标及其受控 Context，例如 “Mobile market research” 或 “Q3 pricing decision”。Project 是 Web App 的核心组织单位，也是 Extension 中当前操作的 Context。

#### Source

用户主动完成/保存、可回溯来源的一条记录，或用户明确采用/保存的 AI 结果。Ask prompt、Voice Command 等用户输入仍会永久保存，但标记为 Activity subtype；未采用的 AI output 只属于 Run history，不是 Source，也不会进入 Project Context。Source 只在保存、核验、搜索、纠正和引用时出现，不必成为一级导航。

#### Skill

可复用的处理行为，例如转写清理、翻译、精简、页面总结、分类或起草。日常触发点显示具体动作名；只有配置时使用 Skills 这一总称。

### 7.2 系统需要但不必始终显性的概念

#### Project Context

当前可被某 Project 使用的 Sources、Project instructions、术语与用户确认规则的计算结果。Document 本身不直接进入 Project Context；用户只能把一个明确 Document revision 执行 `Pin revision as Source`，再按 Source 合同进入 Context。Project Context 不是另一份数据副本，也不是一个需要手工维护的文件夹。

#### Topic

系统动态发现的一组相关 Sources。它帮助用户找回、发现关系、建议 Project 或提供词汇建议，但不是 AI 使用边界。

#### Document

项目中的长期可编辑产出。Document 保留引用、版本和采用历史，可以被 Copy、Export 或 Insert 到其他工作位置。

#### Draft

生成或修改内容的动作，不是长期对象。Draft 必须选择输出目标：当前 input target、Clipboard、现有/新 Document，或明确 Save as Source。它不要求先创建 Document。

#### Ask

一次面向 Project Context 的找回或分析交互。用户的问题永久保存为 You / Activity Source；未采用的 AI 回答保留在 Run history 中用于恢复和 lineage，但不进入 Library 默认视图或 Project Context。用户明确 Save、Pin、Copy 或 Insert 时才 materialize AI Source；写入 Document 只建立 Document revision，之后只有显式 `Pin revision as Source` 才建立 AI Source。

#### Knowledge

用户明确确认 “值得持续依赖” 的判断、决定、结论或方法。当前个人体验不需要 Knowledge 一级导航；它主要为未来显式分享保留语义。

### 7.3 Source 的来源类型

所有内容都可以成为 Source，但必须区分 Origin：

| Origin | 内容 | 可信含义 |
| --- | --- | --- |
| Web | 页面、选区、Clip、未来 PDF/截图等 | 外部证据，不代表内容正确 |
| You | Voice Write、Comment、文字 Note、纠正、采用版 | 用户输入，不代表永远有效 |
| AI | 用户明确保存或采用的 Summary、Translation、Analysis、Draft | 派生内容，不能冒充原始证据；未采用结果只属于 Run |

每条 Source 至少保留：

- 原始内容或引用；
- Origin；
- 创建时间与所在页面；
- 父 Source 与派生关系；
- 所属 Project/Topic 状态；
- 实际使用过的 Skill revision；
- 用户是否采用、纠正或排除；
- 删除状态。

### 7.4 Source 的可用内容层

不同 Source 只创建适用的层，不强迫网页或纯文字具有不存在的版本：

1. **Raw：** 原音、原始转写、原页面/选区快照；只在存在原始载荷时出现。
2. **Normalized：** 清理、结构化或翻译后的可读版本；只有实际运行转换时出现。
3. **Adopted：** 用户实际插入、Copy、Save as Source 或写入 Document 的版本；只有用户采用时出现。

三者不能静默互相覆盖。

在用户 Insert、Copy、Save 或写入 Document 前，处理结果统一称为 **Candidate**；Candidate 是 Run 中待采用的 revision，不得提前称为 Adopted。

### 7.5 用户事件与对象 topology

一次 UI 操作可以创建一组相关对象，但 Source 始终只有一个 Origin。UI 可以把关联对象显示为一个紧凑 bundle，citation、membership、删除和去重仍按真实对象处理。

| 用户事件 | 创建对象与数量 | Library 默认可见 | Project Context 资格 | 删除规则 |
| --- | --- | --- | --- | --- |
| Voice Write → Stop | 1 个 You Source；包含 audio、raw transcript、normalized candidate，Insert 后追加 adopted revision | Saved content | 默认 Saved only；即使 tab 有 active Project 也只 Suggest | 删除 Source 同时删除其 audio/revisions；不撤销已写入宿主的文字 |
| Save page/selection，无 Comment | 1 个 Web Source | Saved content | 按 tab Project 授权加入，否则 Suggest | 删除 Web Source 不自动删除引用它的 Comment；Comment 保留必要快照/tombstone |
| Selection Voice Comment → Accept | 原子创建或复用 1 个 Web Source，并创建 1 个含 audio、transcript 与 normalized version 的 You Comment Source；以 comments-on 连接 | 作为一个 bundle 显示，可展开为 Web / You | 按当前 tab 已授权 Project 规则一起加入；无授权时 Saved only | Recording 中 Cancel/Esc 删除未完成录音；已接受后提供 Delete comment 与 Delete bundle |
| Advanced Voice Comment → Stop，尚未 Accept | 立即建立 1 个 Saved-only You Comment Source，保留 audio、transcript、Candidate 与待关联 target metadata；不建立 Web Source 或 membership | Saved content 中显示 Unlinked comment，可 Finish linking | 无；必须 Accept 才能关联 Web evidence 和 Project | Esc 只关闭高级 review；用户之后可 Finish linking 或明确 Delete |
| Page/Selection Text Comment → Save | 创建或复用 1 个 Web Source；创建 1 个 You Comment Source，并以 comments-on 连接 | 作为一个 bundle 显示，可展开为 Web / You | 两个 Sources 默认共享本次 membership 决定，但可分别排除 | 默认提供 Delete comment 与 Delete bundle 两种明确动作 |
| Text Note | 1 个 You Source | Saved content | 显式加入或 Suggest | 只删除该 Source 及其未采用派生 Run |
| Voice Command / Ask prompt | 1 个 You / Activity Source + 1 个 Run | All activity；不在 Saved content | prompt 默认不进入 Context；用户 Pin/Save 后才可加入 | 删除 Activity 时可同时删除未采用 Run；已采用依赖先预览 |
| AI Candidate 未采用 | 只存在于 Run，不是 Source | Project/Global History，可从 All activity 打开 | 永不进入 Context | 可单独删除 Run；没有 adopted dependency 时完全删除 |
| AI Candidate → Copy/Insert/Pin/Save as Source | materialize 1 个 AI Source，Adopted 是其 revision/state，不是第二个对象 | Saved content | 默认加入本次 Project，但用户可在采用前取消 | 删除 AI Source 不删除它引用的 Web/You Sources |
| AI Candidate → Document | 更新 1 个 Document revision 并连接 Run/Sources；不再重复创建 AI Source，除非用户显式执行 Pin revision as Source | Documents | Document/revision 不直接进入 Context；Pin 后 materialize 1 个 AI Source，再按 Source membership 规则处理 | 删除 revision 保留必要 lineage；删除 Document 先预览引用关系；删除已 Pin 的 Source 不删除 Document revision |

Comment bundle、Run 和 Document revision 都不能改变 Web / You / AI 的 Origin。任何级联删除都先列出将被删除、仅断开关系和仍会保留的对象。

### 7.6 Activity 与 Run 生命周期

- Voice Command、Ask 和 Draft prompt 是永久的 You / Activity Sources；
- 每次执行建立一个 Run，状态为 Running / Succeeded / Failed / Cancelled；
- Run 保存 parsed intent、实际 Context、Skill revision、Candidate、错误和 adopted target；
- Project 内 Run 从 Project History 打开；没有 Project 的 Run 从 Library → All activity 打开；
- 用户可以重新打开未采用 Run，恢复 Candidate、Retry、Save/Pin 或 Delete；
- Activity 与未采用 Run 默认不进入 Project Context；
- Export 默认包含 Saved content 与 adopted lineage；用户可额外选择 Include all activity and unadopted runs；
- 删除 Activity/Run 前预览 adopted AI Source 或 Document dependency；没有 dependency 时完全删除，有 dependency 时可连同依赖删除，或只删除详细内容并保留最小 provenance tombstone。

---

## 8. Context 架构

“Context” 不能是一个模糊的大词。Logue 至少区分四类：

### 8.1 Transcription Context

用于把语音准确转成文字，只包含：

- 当前语言与语言切换；
- Project 术语、人物、组织、产品名和缩写；
- 用户词典与发音纠正；
- 当前页面或输入框附近的最小文字片段；
- 目标格式，例如段落、列表、标题或邮件；
- 用户选定的 transcription Skill。

默认不把整个 Project 的全部 Sources 发送给转写模型。

### 8.2 Action Context

用于 Translate、Shorten、Rewrite、Summarize、Combine 等局部动作：

- 用户选择的文字、页面或 Source；
- 用户当前指令；
- 该 Skill 明确允许的 Project instruction；
- 必要的局部页面上下文。

Action 不自动读取整个 Project，除非用户选择 “Use project context” 或 Skill 明确要求。

### 8.3 Project Generation Context

用于 Find、Ask、Compare、Draft：

- 用户当前问题或产出目标；
- Project instructions；
- 从 Project Context 中检索出的最相关 Sources；
- 用户明确固定或排除的 Sources；
- Source origin、时间、采用状态与重复关系；
- 本次输出格式或 Skill。

系统必须显示实际使用的 Sources，而不是只显示整个 Project 名。

### 8.4 Target Context

用于把结果写回当前工作位置：

- 当前 App/网页与输入目标类型；
- 光标前后必要文本；
- 当前选区；
- 用户希望 Insert、Replace、Append 或 Copy；
- 宿主是否仍可写入。

Target Context 不能扩大保存或 Project membership，也不能自动提交。

### 8.5 Active Project 的选择与保持

Active Project 必须可预测，不能使用“最近打开的全局 Project”静默影响所有页面。

- Web App 的 active Project 由当前 Project route 决定；
- Extension 默认按浏览器 tab 保存 active Project，同一 tab 内导航时保持；
- 浏览器恢复同一 tab session 时可以恢复；新 tab 默认没有 Project；
- 用户可以显式选择 “Remember for this page/document” 或 “Remember for this site”，形成可见、可删除的关联规则；
- Inline Voice Write 继承当前 tab 的 Project；没有时使用 Global Voice defaults；
- Side Panel 始终显示当前 Project 或 No project；
- 本次动作的一次性 Project 选择只影响本次，不改变 tab rule；
- 一个动作需要多个 Projects 时，用户必须显式选择，系统不自动混合 Context。

如果转写使用了错误 Project Transcription Profile，用户切换 Profile 后 Re-transcribe；这不改变 Source membership。如果 Source 进入了错误 Project Context，用户修改 membership 后重新运行 Ask/Draft；这不触发 Re-transcribe。两种情况都保留旧版本与旧 lineage。

这里的 tab Project 有两个不同作用：

- 对 Voice Write：只提供 transcription context，并在保存后给出 Project Suggestion；绝不自动加入 Project Context；
- 对 Page/Selection Comment、Page/Selection Capture 与 Web Clip：用户显式选择 tab Project 即授权后续这类 Source 默认加入，直到切回 No project。

Voice Command、Ask prompt 与其他 Activity 也不因 tab Project 自动进入 Context；它们只有在用户 Pin/Save 时加入。

### 8.6 Current Input Target

“Insert into current input”只在 Extension 持有一个仍有效的 target session 时成立：

- session 属于明确的 tab、frame 和编辑目标；
- 只在目标仍存在且允许写入时有效；
- 用户切换 tab、目标失焦过久、页面重载或编辑器替换节点后，session 失效；
- Web App 只有在用户明确选择一个仍有效的 target session 时才能 Send to input；
- 没有可靠 target 时只提供 Copy，不假装可以远程写入；
- Insert 永不包含 Submit，Undo 只作用于该次写入。

---

## 9. Project / Topic 的转写 Context 定制

这是 V2 的核心功能，不属于普通全局设置的附属项。

### 9.1 设计目标

用户在不同 Project 中说同一个专业词、产品名或人名时，Logue 应使用对应 Project 的语言环境提高准确率，同时防止一个 Project 的词汇污染另一个 Project。

### 9.2 可配置内容

每个 Project 有一个 Transcription Profile：

- Primary language 与允许混合的语言；
- People、companies、products、places；
- Acronyms 与期望展开方式；
- Domain terms；
- Preferred spelling/capitalization；
- Phrases to preserve；
- Terms to avoid or never autocorrect；
- Formatting preference，例如 concise prose、bullets、Markdown 或 email；
- 默认 transcription Skill；
- 是否允许系统从该 Project 的已确认 Sources 提议新词。

### 9.3 词汇来源

Project Profile 的词汇可以来自：

1. 用户手动添加；
2. 用户纠正转写时选择 “Remember for this project”；
3. 系统从已确认进入 Project 的 Sources 中提出建议；
4. 用户从 Topic Vocabulary 的建议中明确选择 “Add to project”。

系统发现的词在用户确认前只是 Suggestion，不能自动成为跨 Project 规则。

每个 Topic 可以有一份独立 **Topic Vocabulary**，只保存用户确认的术语，不包含 Topic 的全部 Sources。用户确认建议时必须选择加入 Topic、加入 Project 或加入 Global；三者不自动复制。

### 9.4 优先级

一次转写最多使用一个明确的 active Project 和一个用户本次显式选择的 Topic Vocabulary。Context 优先级为：

1. 本次录音的一次性显式指令；
2. 本次显式选择的 Topic Vocabulary；
3. active Project 的 Profile；
4. Global Voice defaults；
5. 模型默认行为。

无 active Project 时，用户仍可为本次显式选择一个 Topic Vocabulary；如果也未选择 Topic，则只使用 Global defaults。Topic 只提供术语，不授予任何 Sources 或 Project Context。系统可以在保存后建议 Project，但不能倒推并静默改变已经采用的文字。

§10.12 的 Skill 优先级决定“使用哪个 transcription instruction”；本节决定该 Skill 实际接收哪些语言/术语 Context，两者不是两套竞争规则。

### 9.5 用户可见状态

开始录音时以轻量方式显示：

- Mobile research transcription profile
- Using global voice settings
- No project profile · Global voice settings

用户可以在录音前切换 Project Transcription Profile、临时关闭 Project Profile，或选择一次性语言。切换 Profile 后可以 Re-transcribe；它不改变 Source membership 或生成用的 Project Context。日常使用不弹出完整设置。

Topic Vocabulary 默认不参与；只有用户从轻量 Context picker 显式选择时，当前录音才显示 “+ [Topic] vocabulary”。

Project 设置中提供三个状态：

- **Inherited：** 仅使用 global defaults；
- **Customized：** 使用 Project Profile；
- **Off for voice：** 该 Project 不影响转写，但仍可用于生成。

### 9.6 纠错与重新转写

- 用户可查看 Raw transcript 与 cleaned version；
- 修改术语时可选择仅修改本次、记住到 Topic、记住到 Project 或记住到 Global；
- Re-transcribe 会生成新 revision，不覆盖原始版本；
- Project Transcription Profile 选错时可以切换后 Re-transcribe，且不改变 Source membership；
- 系统显示实际使用了哪个 Profile 和 Skill revision。

### 9.7 Topic 的角色

Topic 只能：

- 提议词汇；
- 帮助发现相关 Project；
- 保存用户确认过的 Topic Vocabulary；
- 在用户明确选择某 Topic 作为本次 Context 时，只提供这份词汇。

Topic 不能：

- 自动成为 Project；
- 自动获得 Project Sources 的使用权限；
- 把 Topic Sources 发送给转写模型；
- 把未确认词汇加入 Transcription Profile；
- 在用户不知情时跨 Project 影响转写。

### 9.8 验收条件

- 同一个缩写可在两个 Project 中得到不同的正确写法；
- 录音前能看出正在使用哪个 Context；
- 无 Project 时不会泄漏其他 Project 的术语；
- 用户一次纠正后可选择仅本次、Topic、Project 或 Global；
- 切换 Project Transcription Profile 后可以 Re-transcribe，并保留两版结果；
- 用户能查看本次转写实际使用的 Context。
- 无 Project 时可显式使用一个 Topic Vocabulary，且不会取得该 Topic 的 Source content。

---

## 10. 功能合同

### 10.1 Universal Voice Write

**目的：** 在任意技术上可访问的文字输入位置，用语音替代键盘，同时把主动输入保存为私人 Source。

**主流程：**

1. 用户把光标放在输入目标；
2. 用固定 shortcut 或麦克风入口开始 Voice Write；
3. 界面显示 Recording、当前 Transcription Profile（或 Global voice settings）和 Cancel；
4. Stop 后立即保存原音；
5. 转写完成后追加 raw transcript，再应用 transcription Skill 并显示可编辑的 Candidate；
6. Enter/Insert 将文字写入原目标，Esc 关闭采用界面但不删除已保存 Source；
7. Insert 后提供局部 Undo；永不自动发送或提交。

**必要行为：**

- Voice Write 与 Voice Command 使用不同 gesture/状态，不能猜；
- 默认不要求先选 Project；
- 用户可在采用前切换 Project Transcription Profile 或一次性 Topic Vocabulary 并 Re-transcribe；切换只改变转写，不授予 Project Context membership；
- Recording 中的 Cancel 明确结束并删除这次未完成录音；Stop 才形成永久 Source；
- 目标丢失时保留 Source，并提供 Copy 与 Open in Logue；
- 插入、加入 Project 与永久保存是三个独立状态；
- Password、支付与浏览器明确标记的敏感字段不提供 Voice Write；这是不开始记录，不是记录后丢弃。

**完成标准：** 用户在任意支持的输入目标中说话、检查、插入，不打开 Web App；稍后仍能从 Logue 找回原始输入。

### 10.2 Voice Command

**目的：** 用语音要求 Logue 对当前选区、页面、Project 或 Sources 执行动作。

Voice Command 的唯一入口 owner 是 **Extension Command Launcher**：它由独立 shortcut 或 Voice Write 控件中的明确 “Command” 切换打开，作为靠近当前 cursor/selection 的 Logue overlay；不是 Web App 聊天框，也不靠识别句子内容自动触发。

Voice Command 必须：

- 通过独立 shortcut 或明确 Command mode 进入；
- 始终显示作用对象，例如 Selection、Page、Project 和 current input target；
- 完整、低风险的单步 intent 静默解析，并由一次 `Enter` 直接执行，不把 Parse 与 Generate 暴露为两次确认；
- 只有缺少或冲突的 Project、作用对象或输出目标才渐进披露可读字段，让用户就地补齐或编辑；
- Enter 执行，Esc 取消并把焦点还给原目标；
- 高影响动作先预览；
- 生成/改写后显式 Replace、Insert、Save 或 Copy；
- 不因语句内容类似命令就从 Voice Write 自动切换。

轻量局部结果可在 Command Launcher 内预览；需要多来源引用或较长 Draft 时，Launcher 把结果交给同一 tab 的 Side Panel preview，target session 保持不变。状态为：

Idle → Recording / Editing → Submit → Running → Preview → Adopted

只有不完整或冲突的请求进入 `Needs clarification → Editing → Submit`；简单请求不经过额外确认。

解析失败时保留录音和 Activity Source，显示 “Couldn’t understand the action”，允许 Retry transcription、Edit intent 或 Switch to Voice Write；绝不执行猜测动作。

命令例子：

- “Translate this selection to Chinese”
- “Summarize this page for Mobile research”
- “Add this thought to Pricing decision”
- “Using Project A, draft a reply”
- “Find what I said about offline transcription”

“Add this thought to Pricing decision”会创建一个新的 You Source，并连接产生它的 Command Activity/Run；Command prompt 本身仍是 Activity Source，不直接进入 Project Context。

### 10.3 Page / Selection Comment

**目的：** 保存用户对当前页面或精确选区的判断，而不是只收藏内容。

支持：

- Page Comment：针对整页；
- Selection Comment：针对精确文字；
- Voice 或 text；
- Capture 可以只有 Web evidence；Comment 必须同时保留 Web anchor 与 You Comment；
- 保存到一个或多个 Projects，或保持 Saved only。

Voice Comment 的持久化边界：

1. Recording 中 Cancel 才明确放弃本次未完成录音；
2. Stop 立即保存一个独立 You Comment Source，不等待转写、Web capture 或 Project 选择；
3. Save 创建或复用 Web Source、建立 comments-on 关系，并应用用户选择的 membership；
4. Stop 后 Esc 只关闭待关联界面，保留 `Unlinked comment`；用户可从 Saved content 继续 Finish linking 或明确删除。

上面的四步是高级 review path 的数据合同，不是高频 Selection Voice Comment 的默认 UI。默认路径必须是：

1. 选中文字后，就近显示轻量 Mic；
2. 点击 Mic 开始录音，录音态只显示 `Accept ↵` 与 `Cancel Esc`；
3. Accept 同时 Stop、保存原音与转写、创建或复用 Web Source、建立 comments-on 关系，并应用当前 tab 已授权的 Project 规则；
4. Cancel 删除本次未完成录音，不建立 Source；
5. 无 active Project 时 bundle 保持 Saved only，Side Panel 可非阻塞建议 Project；
6. 文本 Comment、tag、多 Project、分类原因、转写修订与重新关联只在打开 Side Panel 后渐进披露。

默认路径不能再要求 `Add comment → Voice → Stop → Link comment`。需要先审查转写的用户可以在 Side Panel 启用高级 review path，但它不是所有人的默认流程。

每条 Comment 保留：

- 页面 URL、标题、时间与必要快照；
- 精确选区及其前后上下文；
- 用户原音、raw transcript、Candidate 与保存后的 Comment revision；
- 页面之后变化时的快照与重新锚定状态；
- Project classification 与纠正历史。

页面重新打开时，能恢复锚点则定位原处；不能恢复则显示保存的快照和 “Page changed”。

### 10.4 Capture / Web Clip

**目的：** 保存页面、选区或用户输入为以后可用的 Source。

V2 基线：

- Page；
- Selection；
- Voice；
- Text；
- Web Clip；
- 用户采用的 Action/Draft。

截图、图片、PDF、文件和会议是未来 Source 类型。它们必须沿用同一 Raw → Normalized → Adopted 与 provenance 合同，不能另建不兼容流程。

### 10.5 Page / Selection Actions

高频默认动作：

- Translate；
- Shorten；
- Rewrite；
- Summarize selection；
- Summarize page；
- Explain；
- Save to Project；
- Add Comment。

动作合同：

- 明确显示当前作用范围；
- 默认只使用所选内容；
- 需要 Project Context 时明确说明；
- 原内容不被覆盖；
- 结果可以 Replace、Insert、Copy、Save as Source；
- 编辑目标支持 Undo；静态网页只 Copy/Save，不伪装可替换。

### 10.6 Project

一个 Project 至少包含：

- Name 与可选 goal；
- Project instructions；
- active / inactive 状态；
- Sources 与其 membership 状态；
- Project Transcription Profile；
- Topics 与建议；
- Ask/Draft 历史；
- Documents；
- Context review；
- Export 与 delete。

用户可以：

- 创建、切换、重命名和归档多个 Projects；
- 将一条 Source 加入多个 Projects；
- Pin 或 exclude Sources；
- 查看 “Why this is in context”；
- 临时为一次生成选择不同 Sources；
- 清除某个 Source 的 Project membership，而不删除私人原件。

首次没有 Project 时，Extension Side Panel 提供轻量 Create Project：只要求 Name，可选一句 goal；创建成功后立即设为当前 tab 的 active Project。完整 instructions、Voice Profile、Skills、Sources 和 archive/delete 进入 Web App Project settings。用户也可以先 Saved only，之后再建 Project。

### 10.7 自动分类

本节的 **Capture** 专指 Page/Selection Capture、Comment 与 Web Clip，不包含 Voice Write、Voice Command、Ask 或其他 Activity。

分类评估五个维度：

- Relevance；
- Importance；
- Novelty；
- Complementary value；
- Duplicate/noise。

用户可见状态：

| 状态 | 含义 | 默认行为 |
| --- | --- | --- |
| Saved only | 永久私存，不进入 Project | 可 Find，不用于 Project AI |
| Suggested | 可能属于某 Project | 等用户接受或拒绝 |
| Auto-added | 命中用户已允许的自动规则 | 可撤销并显示原因 |
| Added | 用户显式加入 | 用户决定优先 |
| Excluded | 用户明确排除 | 后台不得重新加入 |
| Duplicate-linked | 与现有 Source 重复 | 保留原件，不重复放大权重 |

自动加入只发生在以下任一条件：

- 用户为当前 tab 显式选择 active Project；这个动作同时授权该 tab 中后续 Page/Selection Capture、Comment 与 Web Clip 默认加入该 Project，Side Panel 持续显示该状态；
- 用户为该 Project 开启了明确的 auto-include rule，且置信度足够高。

没有 tab-scoped active Project、也没有用户授权规则时，系统只能 Suggest，不能静默加入。用户可以随时把 active Project 切回 No project；用户纠正会成为该 Project 后续分类规则的高优先级信号。

### 10.8 Topics

Topics 负责：

- 动态聚类 Saved Sources；
- 显示跨来源重复、冲突和补充关系；
- 建议新 Project 或现有 Project；
- 提议 Project vocabulary；
- 帮助 Find 和回顾。

用户可以 rename、merge、hide、split 或 convert to Project。Topic 不作为一级导航的前提是用户仍能从 Project 和 Find 中发现它。

### 10.9 Find

Find 同时支持 exact 与 semantic search。

用户可以查：

- 自己说过的话；
- 页面或选区原文；
- Comment；
- Project；
- Topic；
- Source origin；
- 时间、网站和内容类型；
- adopted output。

每个结果说明：

- 为什么匹配；
- 来自 Web / You / AI；
- 属于哪个 Project；
- 原始时间与页面；
- 可直接打开 Source、加入 Project 或用于 Draft。

Find 不是默认首页，也不是一条要求用户整理的永久记录流。

### 10.10 Ask / Compare / Draft

用户可以在一个 Project 内用语音或文字：

- Ask：回答事实或找回过去判断；
- Compare：比较 Sources、观点、时间变化或方案；
- Draft：生成邮件、PRD、摘要、报告、QA 或自定义格式；
- Continue：基于已有 Draft 迭代。

每次运行必须：

- 显示当前 Project；
- 允许固定、排除或补充 Sources；
- 使用检索到的最小 Context；
- 对关键结论提供直接 Sources；
- 区分 Web evidence、Your thought 与 AI output；
- 允许用户编辑；
- 支持 Copy、Insert、Create/Update Document；
- 记录 actual inputs、Skill revision、output 与 adopted version。

如果证据不足，系统应说明缺口并建议需要的 Source，而不是用全局常识伪装成 Project 事实。

Ask、Draft 与 Document 的关系：

- **Ask** 产生可引用的回答，用于理解和找回；
- **Draft** 是创建或修改内容的动作，必须选择输出目标；
- **Document** 是长期保存、继续编辑和导出的产出对象；
- **Adopted output** 是用户实际 Insert、Copy 或写入 Document 的 revision，不是独立对象；
- 未采用的 AI output 只保留在 Run history 中用于恢复和 lineage，不是 Source，也不进入 Project Context，避免 AI 反复引用自己。

### 10.11 Document editor

Web App 需要一个真正可编辑的长内容表面，而不是只显示 Chat replies。

核心最小编辑面：

- 连续文字/Markdown 编辑；
- Inline citations；
- Undo/redo；
- autosave；
- Copy 与回到有效 target session 的 Insert；
- 次日恢复最近编辑位置；
- 生成 revision 与实际 Sources 的 lineage。

加强能力：

- Heading、list、quote、code、link；
- 选中文字运行 Action；
- 基于 Project 或指定 Sources 继续生成；
- 完整版本浏览；
- Export 与高级格式。

它不需要成为完整 Notion clone；目的只是把多来源 Project Context 变成可持续编辑的产出。

Project 第二天打开时：

- 有未完成 Document 时，优先恢复最近编辑位置；
- 没有 Document 时，显示 Project goal、最近采用的结果和一个明确的 Ask / Draft composer；
- 低置信 classification 建议只在会影响当前工作时出现，不建立维护 Inbox；
- Sources、Topics 和历史 Ask 通过次级入口查看，不抢占主编辑轴。

### 10.12 Skills

Skill 是可复用的处理方式，不是独立工作空间，也不是 Agent。五类 Skill 使用同一执行合同：

1. Transcription；
2. Transformation；
3. Page / Selection；
4. Organization；
5. Generation。

#### 10.12.1 类型、来源与生命周期

每个 Skill 至少定义：

- Name 与用途；
- Trigger；
- Allowed input scope；
- Instruction；
- Output format；
- Default language/tone；
- 是否允许 Project Context；
- 保存结果的方式；
- Revision。

Skill 有两种来源：

- **Built-in：** Logue 随产品提供；用户可置顶、隐藏、调整默认绑定或复制为自定义版本，但不能直接修改或删除系统定义；
- **My Skill：** 用户创建；可以编辑、复制、归档和恢复。编辑产生新 revision，历史 Run 继续指向执行时的旧 revision。

Global 与 Project-specific 不是第三、第四种 Skill 文件，而是两层绑定：

- **Global binding：** 定义所有页面和 Project 的默认 Skill，以及 Selection menu 的 pinned actions；
- **Project binding：** 对一个 Project 继承 Global、改绑另一个 Skill，或基于 built-in/My Skill 建立 Project override；Reset 恢复继承，不复制一份难以同步的配置。

每个运行点只解析出一个明确 Skill revision，优先级为：

1. 本次动作显式选择；
2. 当前 Project binding / override；
3. Global binding / default；
4. System default。

没有 active Project 时不得暗中采用最近 Project 的 Skill；只使用 Global 或本次显式选择。一次性 Topic Vocabulary 可以作为输入 Context，但不改变 Skill binding。

#### 10.12.2 高频执行模型

日常界面显示 `Translate`、`Shorten`、`Draft reply` 等具体动作名，不先要求用户进入 `Run Skill`：

- 选区旁直接显示 pinned / recent Skills；点击具体 Skill 一次即运行；
- `More Skills…` 才打开完整选择器，显示 Built-in、My Skills、最近使用和搜索；选择后立即运行，不再出现第二个 Run；
- Voice Write 与 Voice Comment 默认静默使用解析后的 transcription/transformation Skill；只有用户打开高级 review 时才切换 Skill；
- Project Ask/Draft 使用解析后的 Generation Skill；只有本次确实需要改变处理方式时才显式选择；
- Organization Skill 在后台生成建议；只有低置信或会改变 Context 时才要求用户处理。

所有表面复用一个执行原语：`input scope → resolved Skill ID/revision → Candidate → contextual adoption`。Run 必须记录 Skill ID、revision、解析来源（explicit / Project / Global / system）、实际 Context 和结果状态。

#### 10.12.3 结果动作

结果动作由用户正在完成的任务决定，不使用含糊的通用 `Save`：

| 场景 | 默认结果动作 | 高级持久化动作 |
| --- | --- | --- |
| Voice Comment | `Accept ↵` / `Cancel Esc` | Side Panel 中编辑、tag、多 Project、revision |
| Voice Write | `Insert ↵` / `Cancel Esc` | 加入 Project、Re-transcribe、保存为独立 Note |
| 可编辑选区 | `Replace` / `Cancel` | `Keep in Logue` 仅在明确物化 AI Source 时出现 |
| 静态页面/选区 | `Copy` / `Cancel` | `Keep in Logue` |
| Ask / Draft | `Insert` 或 `Copy` / `Cancel` | `Save as document` 或 `Keep in Logue` |

`Keep in Logue` 的唯一含义是把 Candidate 物化为永久 AI Source；`Save as document` 的唯一含义是写入新的或当前 Document revision。按钮必须使用完整结果名，不能显示无法预测终态的 `Save`。

#### 10.12.4 管理入口

- **Settings → Skills：** 分为 Built-ins 与 My Skills；支持搜索、创建、复制、编辑、归档、恢复、设置 Global default 与 pinned actions；
- **Project → Settings → Skills：** 显示每类当前解析结果和来源，支持 inherit / override / reset；
- **运行时 More Skills：** 只负责发现和本次选择，不承担完整管理；
- **Run details：** 只读显示实际 Skill revision 与解析来源，保证结果可解释和可重现。

Agents 保留给以后拥有 trigger、tools、permissions 和 runs 的自主能力，不能混用。

### 10.13 Local data controls

当前没有账号。用户必须能在本机完成：

- 查看数据目录与占用；
- Backup；
- Export；
- Delete Source / Project / all local data；
- 选择导出是否包含原始录音；
- 管理 Extension 连接与麦克风权限；
- 配置本地或远程模型连接；
- 查看一次任务实际发送给模型的 Context。

删除合同：

- 从 Project 移除不等于删除 Source；
- 删除 normalized/adopted version 不自动删除 raw；
- 删除整个 Source 时明确说明会删除哪些原始与派生内容；
- 已导出的副本不受本机删除影响；
- 未来 Publication 的撤回与私人 Source 删除是不同动作。

### 10.14 Local-first 数据权威与连接

当前产品使用单 owner、单 Logue Host 模型：

- Logue Host 的数据目录是唯一权威数据；
- Web App 由 Host 提供或连接 Host；
- Extension 是 client，只保留完成当前捕获所需的本地状态和未上传成功的 pending capture；
- Host 可以运行在当前 Mac，也可以是用户明确选择的同一 LAN 设备；
- LAN 连接仍代表同一个 owner，不是多用户系统，不提供成员或权限隔离；
- 配对使用本机/设备连接凭据，不等于用户账号；
- 开始前已离线时，Extension 仍可录制 Voice/Comment，并明确显示 “Offline · saved on this Mac until Host reconnects”；只有确认本机 pending queue 可写时才允许开始；
- 录音中途断线时，Extension 完成当前录音并持久写入同一个 pending queue；不丢片段，也不伪装已经转写；
- 重连后按创建时间上传 pending captures，Host 去重并返回 Saved 终态；用户可在 Settings 查看、Retry、Export audio 或 Delete pending；
- 云模型不可用时，本地保存、浏览、编辑和导出仍可工作，依赖模型的转写/生成进入可重试状态；
- 当前不支持两个 Host 之间的自动同步或冲突合并；迁移通过 Backup/Restore 完成。

用户必须能在 Settings 中看到当前 Host、数据目录、连接状态、pending captures、最近备份和模型处理边界；还能查看已配对 Extension clients、命名设备并撤销单个 pairing credential。

### 10.15 模型 readiness 与首次设置

Logue 没有账号，因此不能假装首启时已有一个不可解释的云模型。Host 只有在以下两项都 Ready 后才进入主产品：

- 一个 transcription provider；
- 一个 generation provider。

首次设置提供两条平级路径：

1. **Use recommended local models：** 下载并运行 Logue 验证过的本地转写和生成模型；
2. **Connect my provider：** 连接用户控制的 OpenAI/Anthropic-compatible endpoint 或其他受支持 provider，并保存到 Host。

默认推荐本地模型；设备不满足要求或用户更看重质量时选择自己的 provider。全程不需要 Logue account。Setup 必须在把页面、选区或录音发给远程模型前说明 provider、发送范围和存储边界。

J1 的 10 分钟产品证明从 Host 显示 Voice ready / AI ready 后开始；另行测量从安装到 Model ready 的 setup completion time，不用跳过下载/配置时间来伪装 activation。

---

## 11. 产品表面与职责

### 11.1 Extension

Extension 是现场交互层，不是缩小版 Web App。

#### Inline Voice

- 任意支持的输入目标开始 Voice Write；
- 显示 Recording、Context、Stop、Cancel；
- 转写后编辑、Insert、Undo；
- 目标丢失时 Copy/Open in Logue。

#### Command Launcher

- 通过独立 shortcut 或明确模式切换打开；
- 显示 current target、selection/page scope 与 Project；
- 呈现可编辑 parsed intent、clarification、Running、Error 与 Cancel；
- 局部结果原位预览；多来源 Draft 进入同 tab Side Panel；
- 关闭后焦点回到原目标，永不触发宿主 Submit。

#### Selection menu

- Comment；
- Save；
- Translate / Shorten / Rewrite / Explain；
- Run Skill；
- Use in Project。

#### Side Panel

- 当前页面/选区与 Comments；
- active Project；
- classification 建议；
- 当前 Project 的轻量 Ask/Draft；
- Source inspector；
- Copy/Insert 与失败恢复。

Side Panel 不承担完整 Project 管理、长文编辑或复杂 Settings。

### 11.2 Web App

Web App 是持续项目工作层：

- **Projects：** 继续 active Project、恢复 Document、Ask/Draft，并查看 Context；
- **Library：** 浏览所有永久私存的 Sources，支持 search、filter、批量 Project membership、export 和 delete；默认 Saved content 视图隐藏 Ask prompt、Command 等 Activity subtype，用户可切换 All activity 查看和管理；
- **Settings：** Voice、Skills、Host、Privacy、Models、Export/Backup。

Project 内部提供：

- Project workspace；
- Documents；
- Sources / Context review；
- Topics；
- Ask / Compare / Draft；
- Project Voice/Skills settings。

Global Find 作为随时可用的搜索入口，同时打开 Library 中的匹配结果。它不能替代 Library 的无查询浏览、批量管理和删除能力。

默认首页应优先帮助用户继续 active Projects，而不是展示技术日志、统计 dashboard 或聊天欢迎页。

### 11.3 logue.ai

官网只负责：

- 解释产品结果；
- 下载本地应用与 Extension；
- 安装说明；
- 文档、隐私与开源/许可证信息；
- 以后可能的更新通道。

当前不出现 Sign in、Account、Team plan 或 Workspace。

### 11.4 动作与唯一表面 owner

| 动作 | 发起表面 | 完成/预览表面 | 不属于谁 |
| --- | --- | --- | --- |
| Voice Write | Extension Inline Voice | Inline Candidate / Insert | Web App 不接管当前 target |
| Voice Command | Extension Command Launcher | 局部结果在 Launcher；多来源 Draft 在同 tab Side Panel | 不从 Web Chat 猜测命令 |
| Page/Selection Comment | Selection menu 或 Side Panel | Side Panel bundle preview | Web App 不负责 live anchor 创建 |
| Create first Project | Side Panel 轻量 Name/goal | Side Panel 设为 active tab；完整设置在 Web | Inline overlay 不承载表单 |
| Project/Topic Voice context | 录音前 Context picker 做本次选择 | Web Project settings 管理 Profile/Vocabulary | Topic 不授予 Source Context |
| Project Ask/Draft from current input | Command Launcher | Side Panel preview → Insert/Copy/Save Document | Web App 无有效 target 时不承诺 Insert |
| Long Document | Web App | Web Document editor | Side Panel 不做长文编辑器 |
| Browse/manage permanent content | Web Library | Library / Source inspector | Find 不是管理替代品 |
| Citation/evidence | Side Panel 或 Web citation | 同表面 inspector；可选打开原页 | AI output 不冒充 Evidence |
| Host/Models/Export/Delete | Web Settings | Host-owned terminal state | 官网不管理用户数据 |

---

## 12. 关键状态模型

### 12.1 Voice Write

Idle → Recording → Saved raw → Transcribing → Candidate ready → Inserted

可恢复分支：

- Recording → Cancelled：立即停止并删除这次未完成录音，不建立 Source；这是用户明确放弃，不是保存失败；
- Transcribing → Failed：保留音频，可 Retry 或 Copy raw transcript；
- Candidate ready → Dismissed：不插入，Source 仍可 Find；
- Candidate ready → Target lost：Copy 或 Open in Logue；
- Inserted → Undo：只撤销这次写入，不删除 Source。

### 12.2 Source membership

Saved only → Suggested / Auto-added / Added

之后可以：

- Suggested → Added / Rejected；
- Auto-added → Removed / Excluded；
- Added → Removed / Excluded；
- 任意状态 → Duplicate-linked；
- 私人 Source → Deleted。

Excluded 是用户规则，后台不得重新覆盖。

### 12.3 Action / Draft

Selected input → Context assembled → Preview → Edited → Adopted

Adopted 可以是 Replace、Insert、Copy、Save as Source 或 Create/Update Document。取消 Preview 不删除原始 input。

### 12.4 Page anchor

Anchored → Page changed → Re-anchored / Snapshot only

即使不能重新定位，保存的选区快照、Comment、URL 和时间仍可核验。

### 12.5 高频动作、手势与持久终态

| 动作 | 明确入口 | Stop / Enter | Cancel / Esc | 持久终态 |
| --- | --- | --- | --- | --- |
| Voice Write | Inline mic / Voice Write shortcut | Stop 保存 audio；Enter Insert Candidate | Recording 中 Cancel 删除未完成录音；Candidate 中 Esc 只关闭 | You Source；Insert 后有 Adopted revision |
| Voice Command | Command shortcut / explicit mode switch，并直接进入 Recording | Enter/Stop 结束录音并一次提交；简单 intent 静默解析 | Esc 丢弃未提交录音并恢复原焦点 | You Activity（含音频/转写）+ Run；采用后才有 AI Source/Document revision |
| Voice Comment | 选区旁 Inline mic；Side Panel 提供高级 composer | 默认 `Accept / Enter` 同时 Stop、保存并建立 bundle；高级 review path 可先 Stop 再编辑 | Recording 中 `Cancel / Esc` 删除未完成录音；高级 review 中 Esc 只关闭并保留 Unlinked comment | 默认 Accept 后直接得到 Web + You bundle；无 active Project 时 Saved only |
| Text Comment | Comment action 后 textarea | Save 建立 bundle | Esc 关闭且不保存未提交文字 | Web Source + You Comment Source |
| Page/Selection Action | Selection menu / Side Panel | Preview 后 Replace/Insert/Copy/Save | Esc 关闭 Candidate，不改原文 | Run；采用后 AI Source 或 target revision |
| Project Ask/Draft | Command Launcher 或 Web Project composer | Run 后 Preview；选择 Insert/Copy/Document | Cancel 保留 prompt Activity，可删除 Run | Activity + Run；采用后 materialize output |

---

## 13. 端到端用户旅程

### J1 — 无账号首次使用

**目标：** 10 分钟内证明核心价值。

1. 用户从 logue.ai 安装本地 Logue 与 Extension；
2. Host 检查 Voice / AI readiness；未配置时选择 recommended local models 或连接自己的 provider；
3. Extension 自动发现当前 Mac 的默认 Logue Host 并完成本地配对；自有 LAN Host 只从 Advanced connection 显式选择；
4. 用户只授予一次 Extension 麦克风权限；
5. 在文章 A 先创建/选择 Project A 作为当前 tab 的 active Project；选中段落后点击就近 Mic，说出判断，再用 Accept 或 Enter 完成，首条 Web + You bundle 直接进入 Project A；
6. 在同一 tab 导航到文章 B，再保存一个判断；它按 tab 授权进入 Project A；
7. 在 Side Panel 核验两条 Web evidence 与自己的 Comments；
8. 在邮件或文档输入框进入独立 Voice Command mode，明确选择或说出 “Using Project A, draft a reply”；
9. 查看两个 Comment bundles（两条 Web + 两条 You Sources），Insert，再 Undo。

完成条件：全程不需要账号，用户能说出 Logue 保留了什么、属于哪个 Project、结果来自哪里。

### J2 — 任意输入框 Voice Write

前置条件：当前页面存在支持的 input target；Project 可选。没有 active Project 时只使用 Global Voice defaults 或用户显式选择的一次性 Topic Vocabulary。

1. 光标进入支持的编辑目标；
2. 开始 Voice Write，看到当前 Transcription Profile（或 Global voice settings）；
3. Stop 后原音已保存，转写完成后出现可编辑 Candidate；
4. 用户修正一个术语；有 active/explicit Project 时可记住到该 Project，没有时只能选择 Topic、Global 或仅本次，直到用户显式选择 Project；
5. Enter/Insert 写入目标；
6. 页面不被自动提交；
7. 用户稍后在 Find 中找到 raw 与 adopted version。

完成条件：输入比键盘更快，且保存、Project membership 与 Insert 三个状态不会混淆。

### J3 — 选区判断进入 Project

1. 选择页面段落，就近出现轻量 Mic；
2. 点击 Mic，说出为什么它重要；录音态只显示 `Accept ↵` 与 `Cancel Esc`；
3. Accept 同时结束录音并让 Logue 创建或复用 Web Source、创建 comments-on 的 You Comment Source；
4. tab 已显式授权 active Project 时两个 Sources 默认一起加入；没有授权时保持 Saved only，并在 Side Panel 非阻塞建议；
5. 只有需要高级控制时，用户打开 Side Panel 输入文字、加 tag、换/加多个 Projects、查看或纠正分类；
6. 在 Project 中打开 Comment bundle，分别查看 Web evidence 与自己的判断。

完成条件：返回原页面或快照能核验选区；错误分类一次操作可纠正。

### J4 — 为 Project 定制 Transcription Profile

1. 用户打开 Project Transcription Profile；
2. 添加产品名、缩写、语言与 preferred spelling；
3. 接受或拒绝系统从确认 Sources 提议的术语；
4. 在网页输入框录音，看到 [Project] transcription profile；
5. 发现 Profile 选错，切换 Project Transcription Profile 并 Re-transcribe；
6. 两版转写和原音都保留。

完成条件：不同 Project 的术语不会互相污染；用户能查看本次用了哪个 Profile、Topic Vocabulary 与 Target Context。

### J5 — 对页面或选区使用 Skill

1. 用户选择文字或整页；
2. pinned / recent 的 Translate、Summarize 或 My Skill 直接出现在选区菜单；用户点击一次即运行；
3. 用户预览结果；对可编辑选区 `Replace`，对静态页面 `Copy`，两者都可 `Cancel`；
4. 只有需要其他 Skill、切换 Selection/Page scope 或改变 Project Context 时才打开 `More Skills…`；选择后立即运行；
5. 只有用户明确要永久保留 AI 结果时才使用 `Keep in Logue`，需要继续写作时使用 `Save as document`；
6. 原文、实际 Skill revision、实际 Context 与派生关系在高级详情中可查看。

完成条件：用户不会误以为原文已被覆盖，也不会误把 AI output 当作证据。

### J6 — 多来源 Ask / Draft 并原位采用

**前置条件：** 用户在一个外部输入目标中打开 Extension Command Launcher，并明确选择 Project；这样 Side Panel 持有同一 tab 的有效 target session。若从 Web App 开始，则输出目标只能是 Document/Copy，除非用户另外选择一个仍有效的 Extension target。

1. 用户在 Command Launcher 中语音或文字提出任务；
2. Logue 检索相关 Sources，并显示实际选择；
3. 用户 Pin 一个关键 Source、排除一个不相关 Source；
4. Side Panel 生成带引用 Draft preview；
5. 用户在 Side Panel 编辑，或 Save as Document 后在 Web editor 继续；
6. Insert/Copy 后记录 adopted version；
7. Citation 一步打开原 Source。

完成条件：结果进入实际工作，且关键结论可回到 Web / You / AI 的具体来源。

### J7 — 自动分类纠错

1. 新 Source 被 Suggested 或按已授权规则 Auto-added；
2. 用户看到一句简短原因；
3. 用户接受、移除、排除或换 Project；
4. 后台将纠正用于以后建议；
5. 同一 Source 不再被原规则反复加回。

完成条件：用户信任自动组织，不需要维护另一个 Inbox。

### J8 — 找回过去说过的内容

1. 用户搜索 “上周关于 LAN 录音失败的结论”；
2. 结果同时匹配用户原话、相关页面和 Project；
3. 每条说明为什么匹配；
4. 用户打开 Source、查看时间/页面/录音；
5. 将其加入当前 Draft 或另一个 Project。

完成条件：用户能找到准确片段，而不是得到无法核验的全库回答。

### J9 — 本地导出与删除

1. 用户选择 Project 或全部私人库；
2. 选择是否包含原始音频；
3. 预览导出范围并创建本地副本；
4. 删除 Source 时查看受影响的 Projects 与派生结果；
5. 明确确认后删除；
6. 不涉及账号、云端 workspace 或成员。

完成条件：用户知道数据在哪里、能带走什么、删除影响什么。

### 13.1 Journey 验收矩阵

| Journey | 前置条件 | 主表面 | 必须到达的持久终态 |
| --- | --- | --- | --- |
| J1 首次使用 | Host Voice/AI Ready；Extension paired；mic permission | Extension + Side Panel | Project A、2 个 Comment bundles、1 个 adopted AI Source、1 次 Insert/Undo lineage |
| J2 Voice Write | editable target；pending queue 可写 | Inline Voice | You Source + Candidate；可选 Adopted revision；不得自动入 Project |
| J3 选区判断 | 页面可读；Project 可选 | Selection menu + Side Panel | Web Source + You Comment Source；明确 membership |
| J4 Voice Context | Project 或显式 Topic Vocabulary | Web Settings + Inline Context picker | Profile/Vocabulary revision + 可核验 re-transcription revisions |
| J5 Selection Skill | selection/page scope 明确 | Selection menu / Side Panel | Run；采用后 AI Source 或 target revision；原文保留 |
| J6 多来源 Draft | 外部 target + Command Launcher + 显式 Project，或 Web Document target | Command Launcher + Side Panel / Web | Run + citations + adopted AI Source/Document revision；target 行为可核验 |
| J7 分类纠错 | Suggested/Auto-added Source | Side Panel 局部建议或 Project Context review | Added/Excluded/Removed 状态与纠正规则 |
| J8 Find | 至少一个永久 Source | Global Find → Library | 打开的真实 Source；可选新的 membership/Document use |
| J9 Export/Delete | Host 可用；owner 明确范围 | Web Settings/Library | 已下载 export 或已确认 delete；pending/Run/dependency 结果清楚 |

任何 Journey 如果只能显示成功 toast、固定 Draft 或静态文案，而没有上述持久终态，不算 mock 完成。

### 13.2 Mock 完整性门槛

每个 Journey 只有同时满足以下条件才可标记为 `WORKING`：

1. 从真实入口开始，默认路径不依赖 Storybook 控件、说明卡或虚构 Next；
2. 默认路径中的每个主按钮、菜单项、快捷键和输入都能操作；静态按钮按缺失功能计算；
3. 操作写入三表面共享的 domain state，并到达 §13.1 的持久终态；
4. 重新打开相关 Extension、Side Panel 或 Web App 后仍能看到同一结果；
5. 用户能取消或恢复本次高频动作；不可逆操作按 §14 提供确认；
6. Story 同时提供正常、空、关键失败和恢复状态；
7. 用浏览器实际完成整条路径，而不是只验证截图、单个组件或 reducer 测试。

功能审计按 `MISSING / STATIC / PARTIAL / WORKING` 四级记录。只有 `WORKING` 计入完整覆盖；UI polish、Guided Demo 和竞品视觉比较必须等所有 P0 Journey 与 Skills 执行闭环达到 `WORKING` 后再开始。

---

## 14. 失败与恢复合同

| 失败 | 产品行为 |
| --- | --- |
| 麦克风未授权 | 在 Extension origin 提供一次清晰授权路径；不在每个网站重复请求 |
| 开始前 Host 不可用 | 显示 Offline；本机 pending queue 可写时允许录音并延后转写，否则明确阻止开始 |
| 录音中途 Host 断开 | 完成并持久保存当前片段到 pending queue；重连后上传、去重并显示 Saved |
| 转写失败 | 保留原音；Retry、切换模型或稍后处理 |
| Model 未 Ready / credential 失效 | 停留在 Setup/Needs attention；不进入会必然失败的 J1，提供 Test connection |
| 低置信转写 | 标记具体词段；允许一次性、Project 或 Global 纠正 |
| Command 无法解析 | 不执行；保留 audio/Activity，允许 Edit intent、Retry 或 Switch to Voice Write |
| 目标输入框消失 | 不丢 Source；Copy 或 Open in Logue |
| 页面内容变化 | 尝试重新锚定；失败则显示保存快照 |
| 错误 Project | 一步移除/排除；后台不得再次覆盖 |
| 重复 Source | 关联已有 Source，不重复增加 Context 权重 |
| 生成证据不足 | 说明缺口并请求 Sources，不把常识伪装成 Project 事实 |
| Source 无法打开 | 保留快照、URL、时间与 Comment |
| 模型离线或超时 | 保存请求与选定 Sources；Retry 不重复建立 Source |
| 敏感输入目标 | 不提供 Voice Write，不启动记录 |
| 多 Project 冲突 | 要求明确 active Project；不混合 Context |
| Insert 失败 | Draft 仍保留；提供 Copy 与重新选择目标 |
| pending queue 不可写或容量不足 | 开始前阻止录音并给出清理/导出路径；不得录完后才宣告丢失 |

错误必须局部、可恢复，并说明哪些内容已经安全保存。正常后台状态保持安静。

### 14.1 键盘与无障碍合同

- Voice Write、Voice Command、Comment 与常用 Actions 必须有可发现且可修改的快捷键；
- Enter 是 mode-local：Command `Ready` 中执行命令，Candidate/Preview 中执行当前明确的 Insert/Adopt；其他状态不执行隐式主动作，且所有模式都必须阻止事件冒泡触发宿主 Submit；
- Esc 关闭当前轻量层；如果录音仍在进行，先清楚区分 Stop 与 Cancel，不能含糊丢弃；
- 所有 dialogs、drawers 和 menus 具有正确初始 focus、focus trap 与返回焦点；
- 录音状态、转写进度、错误和完成状态除视觉外也提供屏幕阅读器状态；
- 不只依赖颜色区分 Web / You / AI、selected、confidence 或 error；
- 关键按钮保持可读文字或可靠 accessible name；
- Motion 不承担唯一状态表达，并尊重 reduced motion；
- 原始音频具备播放、暂停、时长、进度和 transcript。

---

## 15. 能力完整性与优先关系

当前不定义某个 Release 的范围，但产品能力有清晰依赖。

### 15.1 产品身份核心

只有这一条价值链承担定位、首页心智、首次 Journey 和 North Star：

1. 在 live web 对页面/选区留下语音或文字判断；
2. 判断与原始证据进入用户控制的 Project Context；
3. 在当前写作位置基于实际 Sources 生成、核验并采用结果。

如果这条 round trip 不成立，增加听写、编辑器或更多 AI 功能也不能让 Logue 成立。

### 15.2 闭环支撑能力

这些能力直接保证身份核心可靠：

- 所有主动输入永久私存；
- Source provenance、Raw/Normalized/Candidate/Adopted 与 Web/You/AI；
- 显式/自动 classification 与 Project Context review；
- Find / Ask / Draft；
- 最小单次 Voice Command mode；
- citation、Copy/Insert、Undo 与 target recovery；
- Extension + Side Panel + Web App 的跨表面连续状态；
- Library、Host Export/Backup/Delete。

### 15.3 完整产品的相邻能力

用户已经确认 Logue 可以完整覆盖听写、PKM、AI Workspace 与编辑器。这些不是待删除的范围，但不与产品身份并列：

- Universal Voice Write：最低摩擦输入入口；
- Project/Topic Transcription Profile 与 Re-transcribe：让 Context 提高 Voice 质量；
- Topics、多 Project、关系发现与自动组织：形成个人 PKM；
- Custom Skills 与 Project override：复用处理方式；
- 最小 Document editor 与高级格式/版本/Actions：承接长期产出；
- 高级 Voice Command：多步命令、跨对象命令与复杂参数。

完整 mock suite 必须覆盖这些能力；canonical slice、首屏和对外定位只呈现完成身份核心所需的部分。

### 15.4 后续 Source 与自动化扩展

- Screenshot / Image / PDF / File；
- Meeting；
- Mobile；
- Daily resurfacing；
- Agents；
- Skill marketplace；
- 被动 capture。

这些扩展只有在沿用现有 Source、Context、provenance 与用户控制合同的前提下才能加入。

---

## 16. 竞争定位与必须胜出的体验

### 16.1 竞品已经占据的能力

- Wispr Flow、Superwhisper、Willow：跨应用 Voice 与 contextual transformation；
- Readwise Reader、Hypothesis：网页、选区、批注与可靠来源；
- Mem、Tana、Voicenotes：Voice、自动组织、个人 Context 与生成；
- Notion、ChatGPT Projects、NotebookLM：Project/Source-grounded generation；
- [ChatGPT 内置浏览器](https://help.openai.com/en/articles/20001277-using-the-built-in-browser-in-the-chatgpt-desktop-app)、[Dia](https://www.diabrowser.com/getting-started)、[Perplexity Comet](https://www.perplexity.ai/help-center/en/articles/13531023-managing-comet-assistant-permissions)、[Gemini in Chrome](https://blog.google/products-and-platforms/products/chrome/gemini-3-auto-browse/)：直接取得当前页/多 tab Context，在浏览器内总结、生成、连接工具或执行动作；
- Microsoft、Glean、Atlassian、Slack、Onyx：团队内容连接、搜索与 AI。

因此，任何单个 feature 都不能成为 Logue 的定位。

AI 浏览器是最直接的平台风险：它们天然拥有页面、tab、输入目标和低切换成本。Logue 不与它们竞争“理解当前页面”“跨 tab 总结”或通用浏览器 Agent；Logue 必须证明以下差异：

- 数据和 Project Context 归属于 owner-controlled Host，不锁定某个浏览器账号或单一模型；
- 保存的是用户主动判断与精确 evidence lineage，而不是模糊的浏览历史 memory；
- Project membership、实际生成 Sources 与 adopted output 可长期核验和纠正；
- 即使 reference client 先是 Chrome，Host 中的数据模型与导出仍保持 browser/model independent。

### 16.2 Logue 必须胜出的组合

1. **现场判断：** 在 live web 上以语音或文字对页面/精确选区留下判断；
2. **有来源积累：** 原始证据、用户输入、AI 派生与采用结果形成可信 lineage；
3. **受控 Project Context：** 自动帮助，但 Project 不被静默污染；
4. **Context 跟随用户：** 不要求回到 Logue 才能调用；
5. **原位产出：** 在当前写作位置基于实际 Sources 生成、核验并采用；
6. **本地信任：** 私人输入由用户控制，Context 最小化、可查看、可导出。
7. **不被浏览器吞没：** 价值落在可迁移的 Project evidence 与 adopted lineage，而不是当前 tab 的临时 AI convenience。

### 16.3 可能形成的防御

功能本身可被复制。真正可能累积的是：

- 用户在网页现场留下的判断与精确证据；
- Project-specific vocabulary 与纠错历史；
- 用户对 classification 的修正；
- 哪些 Sources 最终被采用到真实产出；
- 跨宿主的可靠 round trip；
- Source → transformation → adopted output 的 lineage。

这些只有在长期节省用户返工时才是防御，不应提前宣称 moat。

### 16.4 必须通过的产品测试

用同一任务比较：

> 在文章 A、B 留下判断 → 形成一个 Project Context → 在邮件或文档中生成有来源的回复 → 插入并能返回原文

Logue 必须在切换次数、重复解释、找回准确度、来源核验和最终采用上明显优于手工组合。只在界面美观或功能数量上相似不算通过。

---

## 17. 未来团队扩展的自然接缝

当前 V2 不提供账号、团队、成员、Workspace 或共享 UI，但保留以下语义：

1. Private Source 永远不因分类而自动共享；
2. 用户可以从 Sources 形成明确确认的 Knowledge；
3. 未来通过 Publication 把某个 Knowledge revision 与允许公开的证据发布到 Project/Team；
4. 发布产生独立快照，不让私人原件的修改静默改变团队内容；
5. AI 可以建议分享，不能自动发布；
6. 撤回 Publication 与删除私人 Source 是两个动作；
7. 团队不能看到未共享输入、被拒绝建议、个人捕获量或隐私历史。

这使个人价值先成立，同时避免以后把私人记录库直接改造成员工监控或企业搜索产品。

未来团队 Knowledge 只接收用户已经确认或采用的内容；Publication 不进入当前个人 North Star，也不能反向要求用户维护团队候选 Inbox。

---

## 18. 验证计划

进入用户验证阶段后，招募 8–12 名符合行为条件的用户，持续至少两周。

### 18.1 要验证的假设

1. live-web Comment 比普通收藏更能保留用户意图；
2. 用户愿意让所有主动输入在本机永久保留；
3. Project-specific Transcription Profile 能显著降低专业术语纠错；
4. 自动分类在不增加维护 Inbox 的情况下保持足够精度；
5. 用户会在真实写作位置调用 Project Context；
6. 有来源的原位采用明显优于多个工具手工切换。
7. 用户愿意安装并长期依赖这条 round trip，并至少表现出推荐、贡献、付费支持或购买相关服务中的一种；具体商业模式不预设为订阅 SaaS。

### 18.2 建议门槛

- 至少 60% 的活跃用户首周完成一次 sourced round trip；
- 首次 Capture 后至少 50% 在 24 小时内再次主动 Capture/Comment；
- 每位活跃用户每周至少两次从 Project Sources 生成并采用结果；
- Project 建议保留率至少 80%，自动加入移除率必须足够低；
- 用户能在 10 秒内说明结果来自哪里；
- 多数用户将产品描述为 “把现场判断变成可用的项目 Context”，而不是听写、笔记或 Chat。

指标失败时先修正闭环、Context 质量或目标用户，不用增加更多 capture 类型掩盖问题。

---

## 19. 下一版 UI mock 的产品门槛

用户已在 2026-08-05 授权基于本文从零重建 UI mock。后续产品想法仍直接改写本文，并同步调整 mock；不能因开始 UI 而把当前判断伪装成不可修改的最终冻结。

### 19.1 Next mock canonical slice

下一版 mock 的主验收只证明一条连续 round trip，不能把所有功能堆进同一页面：

1. 在文章 A 先为当前 tab 显式选择 Project A，再对精确选区添加 Voice Comment；首条 Comment 直接加入 Project A；
2. 在同一 tab 导航到文章 B，添加第二条 text Comment；它按 tab 授权自动进入同一 Project；
3. 在 Project A 查看两条 Web evidence 与两条 Your thoughts；
4. 在邮件输入框进入 Voice Command mode，要求基于 Project A 起草回复；
5. 在 Side Panel 的轻量 Draft preview 中查看实际 Sources、编辑并 Insert；之后可选 Save as Document；
6. 先在邮件 tab Undo，确认只撤销本次 Insert；再在 Side Panel 打开 citation 快照，之后可选返回原网页。

主切片只显示完成当前决定所需的 UI。Project Transcription Profile、Library 管理、Topics、Skills、Export/Delete、错误恢复等仍必须在 mock suite 的独立 Stories 中完整覆盖，但不能常驻或阻塞主流程。这样保持用户要求的“能力完整性优先”，同时避免做成总览拼贴。

共享 scenario 至少包含：

- 两个真实不同页面；
- 三条以上 Sources；
- 两个 Projects；
- 一个重复或冲突 Source；
- 一次低置信 Project suggestion；
- 一次 target lost；
- 一次真实的多来源 citation mapping；
- 一个未采用 AI Run，证明它不会进入 Project Context 或 Library 默认视图。

独立 Stories 还必须覆盖：

- 无 Project 时在 Side Panel 轻量创建；
- Voice Command 的 parsed intent、clarification、cancel 与 parse error；
- Host 开始前离线、录音中断线、pending upload/duplicate/failed；
- Library → All activity 的 Activity/Run restore、export 与 delete；
- Comment bundle 的 Delete comment / Delete bundle；
- AI Source 与 Document revision 的 adopted lineage；
- 无 Project 的 one-shot Topic Vocabulary；
- target expired 后只 Copy/Open in Logue；
- Voice/AI provider 未 Ready 的 setup 与 Test connection。

新 mock 开始后必须：

1. 每个界面和状态都映射到本文的 Goal、Feature contract 或 Journey；
2. Extension 与 Web App 使用同一份真实状态，不做总览拼贴；
3. 整个 mock suite 覆盖核心能力；canonical slice 只呈现完成该 round trip 所需的状态，再优化 journey、UX 和 UI；
4. 不出现账号、Workspace、成员、套餐或虚构云同步；
5. 不把 Work、Log、Source、Topic、Run 等内部词随意做成导航；
6. 明确 Project-specific Transcription Profile；
7. 真实操作永久保存、classification、Find、Ask/Draft、citation、Insert/Undo、Export/Delete；
8. 用 Notion 与 ChatGPT 的真实界面只作为层级、密度、排版和交互质量基准；
9. 完成后分别由独立产品设计师、ChatGPT.com、Claude 网页版与 Claude Code 审查；
10. 任何 review 的 PASS 只证明符合已确认产品定义，不能替代用户确认。

---

## 20. 当前设计决定与待验证

### 本稿已作出的设计决定（等待用户确认）

- 产品名是 Logue，官网是 logue.ai；
- **用户已确认：** 完整产品可以包含听写、PKM、AI Workspace 与编辑器，但只能由“现场判断 → Project evidence → 原位有来源采用”一条身份核心组织；
- 产品是 local-first、single-owner Logue Host 产品，默认 Host 在当前 Mac，当前没有账号；
- Reference platform 是 Mac + Chrome Extension + Host/Web App；
- Extension 与 Web App 缺一不可；
- Project 是用户意图和 Context 边界，统一使用 Project，不再使用 Work 作为同义词；
- Web App 的一级入口采用 Projects / Library / Settings；Global Find 打开 Library 结果；
- Topic 是动态发现层，不是 Project Context 或 AI 使用边界；
- Topic 可以保存用户确认的 Vocabulary，并只在本次显式选择时影响转写；
- 所有完成或明确 Stop/Save 的用户主动输入永久私存，直到用户删除；录音中的 Cancel 明确放弃未完成输入；
- 永久保存、进入 Project 和采用/插入是三个不同决定；
- Project 可定制 Transcription Profile；
- Active Project 默认按 tab 保持，不使用最近全局 Project 静默影响新页面；
- tab Project 只让 Page/Selection Capture、Comment 与 Clip 默认加入；Voice Write 只 Suggest，Activity 只有显式 Pin/Save 后才有资格进入；
- Voice Write 与 Voice Command 必须是不同模式；
- Voice Command 由 Extension Command Launcher 发起，多来源结果在同 tab Side Panel 预览；
- Voice Write 的 Stop 先保存并形成可编辑 Candidate，Insert/Enter 后才产生 Adopted revision 并写入宿主目标；
- 自动分类可以帮助 Project，但没有 active Project 或用户授权规则时只能 Suggest；
- 关键 AI 结果必须保留 Sources 与 lineage；
- Ask、Draft 与 Document 分离；未采用 AI output 默认不反向进入 Project Context；
- Selection Comment 创建相互关联的 Web Source 与 You Comment Source；AI Adopted 是 AI Source/Document revision 的状态，不是第二个对象；
- 未采用 AI output 属于可恢复、可删除、可选导出的 Run；
- Logue Host 的数据目录是权威来源，Extension/Web App 是单 owner clients；
- Host 必须有 Ready 的 transcription/generation providers；首设选择 recommended local models 或连接自己的 provider，不需要 Logue account；
- North Star 默认在 Host 本地计算，不强制上传 Source 或行为 telemetry；
- 当前不做团队 UI，但保留显式 Publication 边界；
- 现有 V2 mock 无效，不作为后续约束。

### 需要用研究而不是主观决定验证

- 首个目标用户是否真的把这条 round trip 视为高频刚需；
- “所有主动输入永久私存”是否带来可接受的信任与噪音负担；
- explicit adoption 是否比自动插入更可靠且仍足够快；
- Project classification 是否能达到用户无需持续维护的精度；
- Project-specific transcription profile 是否比普通全局词典产生足够明显的价值；
- 用户是否愿意在真实工作中从 Project 生成并采用，而不是只捕获；
- 这套体验是否真的优于 Wispr + Readwise + ChatGPT 的组合；
- 面对 Dia、Comet、Gemini in Chrome 与 ChatGPT 内置浏览器，owner-controlled Project evidence 和 adopted lineage 是否足够形成独立价值；
- 用户是否愿意安装、长期依赖、推荐、贡献或付费支持；商业模式不预设为订阅 SaaS；
- recommended local models 与 BYOK/provider setup 能否在首用中达到可接受的时间与质量。

本文将在用户继续提供想法时直接重写相应章节，保持一份可理解、无历史补丁堆叠的产品定义。
