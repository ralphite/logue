# 决策与风险记录

这是项目对用户可见的决策记录。它确保设计或工程取舍不会成为功能失败后才被发现的隐藏限制。

## 维护约定

- 每个项目开始时创建本文件，并在首次项目更新中告知用户。
- 在选择会实质影响核心流程、权限、数据、安全、交付、性能、架构或交互的实现方案前，先在下方增加简洁记录。
- 记录用户可见的代价、考虑过的替代方案、已有证据，以及是否需要用户决定；未解决的取舍不得伪装成已完成的功能。
- 依赖任何尚未解决的 **P0/P1** 项或会改变预期工作流的选择前，先告知用户。日常、可逆的实现细节无需单独确认。
- 真实使用暴露问题时，在同一工作批次更新本文件，写明证据和最小修复。只有直接用户流程验证通过后才从本文件删除；历史证据保留在 Git、Release 和 QA 记录中。
- 保持具体。本文件不是推测性风险清单，只记录有可信用户影响或已有真实失败的事项。

## 未解决

### DR-043 — V2 从可操作 mock 转入真实端到端产品构建

- **优先级：** V2 产品 / P0
- **状态：** 用户已授权；首个真实 vertical slice 已在真实 Chrome、Host 与 Web App 闭环验证，完整 V2 继续实施
- **决定：** 旧 Goal 中的功能范围、canonical sourced round trip、完整性优先级和独立审查标准继续作为产品合同，但交付物从 Storybook UI mock 升级为真实可安装产品：Chrome Extension、Logue Host/API、Web App、本机持久数据与发布链路。当前已审查 V2 mock 是产品结构、关键流程、状态与视觉语言的实现蓝图；Storybook 仍用于设计核验，但不能单独作为完成证据。真实产品选择性复用 V1 中仍符合 V2 的成熟部件，例如 resizer、录音桥、目标丢失恢复、文件存储、引用和 installer rollback；不因来源是 V1 而删除，也不因可以复用而保留不符合 V2 的 IA、对象或交互。
- **首个用户可见结果：** 在任意普通网页选择文字后，直接点击轻量 Mic 开始录音；录音态只显示 `Accept ↵` 与 `Cancel Esc`。Accept 原子地永久保存 Web Source、原始录音、转写与 Voice Comment；只有当前 tab 已由用户显式选择一个 Project 时才进入该 Project，默认 `Saved only` 不进入任何 Project。Cancel 不创建 Source。高级文字编辑、标签与 Project 调整只在 Side Panel/Web 渐进披露。
- **本批 UI/对象设计：** 延续现有安静表格行、可调宽详情面板和音频 History，而不新增卡片式总览。Library 与 Project 都把 `Web Source + You Comment` 显示为一条 Comment bundle：评论是主要可读内容，选区是次级证据；打开后直接进入评论详情，提供原音、raw transcript、采用文本、选区及网页链接。搜索命中 Source 或 Comment 都返回同一 bundle；同一 bundle 不因 Source/Comment 两个持久对象而重复计数或平铺。普通非 Comment 内容继续沿用现有列表分组。
- **同 tab Project 合同：** Side Panel 顶部只提供 `Saved only` 或一个显式 Project，选择按 tab session 保存并只作用于该 tab 的 Capture/Comment/Command；录音中隐藏 picker，避免改变正在进行的 capture 归属。background 只信任消息发送者的 `sender.tab.id`，不接受页面伪造 tab id。Voice Command 带显式 Project 时，Host 的自动检索候选也必须限定在该 Project，并把实际 Source ID 与生成时内容快照固化到 Run；无 Project 才使用私人 Library 的全局 Saved 范围。
- **Command / Insert 合同：** Command candidate 与 Host 冻结的 Run sources 在当前 tab session 保留，Side Panel 始终允许编辑结果与打开 citations。Insert 前重新读取真实输入目标并返回一次性 Undo transaction；只有真实 Insert 成功才把采用文本 PATCH 到 Run，Undo 只恢复宿主 DOM，不删除 Run 或已保存 lineage。target lost 不清空 candidate，只提供 Copy/Retry。冻结 Source snapshot 至少包含 `id/content/kind/actor/source(url/title/selection)`，确保后续来源变化也不破坏证据核验。
- **风险与内容处理：** Source 与 Comment 仍是两个可追溯持久对象，但默认界面必须表现为一个用户概念；删除、Project 调整和多评论仍需在后续批次定义 bundle 级行为，当前不得通过隐藏关系制造假成功。转写失败保留可重试终态与原音，成功后才安静消失；不得用 UI toast 代替 Web 中可核验的持久记录。
- **数据与交付边界：** 当前机器是唯一受支持安装；改动 schema 前备份并验证当前 `.logue-data`，不保留完成迁移后的兼容代码。每个批次必须由真实 Extension → API → 本机数据 → Web 用户流程证明；针对性测试随实现运行，完整 CI/build 只在集成节点运行。验证后在 `main` 做小 commit 并立即 push。
- **替代方案：** 继续扩 Storybook 全功能 mock，或先整体重写全部 V2 后再运行。前者不产生真实产品价值；后者延迟真实反馈且容易同时破坏多个表面。采用可独立使用的 vertical slice，逐步替换 V1 行为并保持每批可验证。
- **已有证据：** 用户明确要求停止继续制作 mock，直接实现端到端产品，并再次强调功能完整性、用户旅程与 UX 高于 UI 边角优化。2026-08-05 已把工作区 Extension 构建安装到真实 Chrome，完成 `选区 → Mic → Accept → 安静消失`；Host 原子保存可追溯的 Selection Source、Voice Comment、原音、转写与 `comments-on` 父子关系，默认无 Project 且组织状态为 `confirmed`；真实 Web Library 只显示一条 `Web + You` bundle，详情可核验 Source page、Selected text、Original audio、Machine transcript、Comment 与 Actual context。Host 重启前创建的两条 QA 记录曾因旧进程仍加载旧代码而显示 `pending`，已先备份到 `.logue-data/backups/2026-08-05-selection-comment-runtime-reload/`，再显式修正并于重启后复验新记录为 `confirmed`。原音 API 返回 248273-byte WebM。独立产品设计复审 PASS 9.2/10，无 P0/P1。
- **开放问题：** Comment bundle 的 bundle 级删除、多评论排序与后续团队 Publication 仍待真实使用验证；这些不阻断首个单评论闭环。后续若证明现有数据对象阻断完整产品合同，直接修改并做一次性本机数据更新，不为旧格式保留永久兼容层。

### DR-035 — V2 产品定义必须先于 UI，并废止当前 mock 的产品依据

- **优先级：** 产品基础 / P0
- **状态：** 扩大审查与合同修正已完成；用户已授权据此重建 mock；不构成生产实现授权
- **决定：** 当前 Storybook mock 与《Logue V2 mock — 验收与独立复审》降级为历史探索，不能继续作为产品合同或 UI 依据。先把唯一 V2 产品设计稿重写为完整的产品定义，明确定位、目标用户、目标与非目标、核心对象、Context 规则、功能契约、状态、失败恢复、端到端旅程和验证标准；用户审阅后才能重新设计 mock。
- **用户可见影响：** 后续 UI 不再沿用缺乏产品依据的 Work 命名、导航、设置结构或交互状态。任何界面必须能追溯到已确认的用户结果和产品规则，而不是从现有 Storybook 反推需求。
- **替代方案：** 在旧稿末尾继续追加补丁，或只补几张功能清单。前者会继续混合定位、内部模型、mock 决策与未来团队愿景；后者仍无法定义用户何时、为何以及如何完成任务。
- **已有证据：** 用户明确指出当前文档过于高层、由此生成的 mock 没有用处；对现有文档审计也发现 Project/Work、Topic、Project Context、转写 Context、自动分类和采用状态都缺少可执行定义。扩大审查后，fresh-context 战略红队最初给出 `BLOCK`（2 个定位 P1），产品合同红队最初给出 `BLOCK`（3 个对象/表面 P0），Claude Code Fable 5 Max 给出有条件 `PASS 8.2/10`（5 个 P1）。修订补齐能力层级、Source topology、Command owner、首次模型、tab 归类、AI browser 压力、Run 生命周期与旧决策边界；战略红队和产品合同红队最终均为 `PASS`、无 P0/P1。Claude 的第一轮完整意见已逐项修正；第二次 Fable 5 Max 复跑因本机额度耗尽未完成，不能伪称二次 PASS。
- **开放问题：** 用户仍可在 mock 过程中修改产品判断；任何改变核心 Journey、对象或 Context 边界的新想法必须先改本文和本记录，再同步 UI。

### DR-036 — 完整产品范围服从一条主价值链，而不是缩减为单功能产品

- **优先级：** 产品基础 / P0
- **状态：** 用户已确认范围原则；已写入 V2 产品定义，等待用户审阅具体层级
- **用户决定：** Logue 可以完整覆盖听写、PKM、AI Workspace 与编辑器，不因竞品拥挤而删除这些能力；同时必须保持清晰焦点。
- **产品层级：** 听写与现场 Capture 是入口；有来源的 Project Context 是积累；AI Workspace 与 Document editor 是产出；从现场判断到原位采用的可核验 round trip 是唯一产品身份和差异化主轴。
- **用户可见影响：** 完整 mock suite 仍需覆盖所有已定义能力，但首页、首次 Journey、导航与对外定位不得把四个类别并列呈现。功能是否存在与是否承担产品定位是两件事。
- **替代方案：** 删除 Universal Voice Write、Document editor 或 Project transcription 以追求狭窄 MVP。该方案违背用户确认的整体 V2 方向，也会切断 Voice / Context / Output 的长期闭环。
- **已有证据：** 竞品红队正确指出单项能力已被占据，但用户明确接受较宽产品范围；因此审查问题从“是否删除范围”改为“是否有唯一价值链、对象边界和能力层级”。
- **开放问题：** 首个行为型用户、唯一 adoption outcome 与四层能力 hierarchy 仍需在修订稿和用户研究中验证。

### DR-037 — V2 mock 从规范化共享状态与三个真实表面重建

- **优先级：** V2 mock / P0
- **状态：** 用户已授权实施；旧 mock 已删除；实施前 designer gate 已通过修订方向，正在实现
- **决定：** 新 mock 不复用被否决的 `V2ProductExperience` Story、`.v2-*` CSS、Work IA 或单一巨型 Scenario。新实现使用独立 `v2-mock/` 目录、规范化 DomainState、独立 SurfaceState、纯 reducer/语义事件和每 Story 新 seed；Extension、同 tab Side Panel、Web App 是三个真实组件，共享同一领域状态但不并排拼成总览。Web App 一级入口保持 `Projects / Library / Settings`；Documents 属于 Project，Skills 通过上下文动作和 Settings 配置完整呈现，不为能力清单增加一级导航。
- **现有模式：** 只复用已验证的技术原语，例如 Button/IconButton、Tooltip、PanelResizer、OverlayMenu、RecordingAudioPlayer、Lucide icon library 与 reduced-motion/focus 合同；不继承 V1 NavRail、Material/Work types、`Stop and insert`、旧页面轴数值或旧配色。
- **首批用户可见结果：** 一个连续、可操作的 canonical Story 依次完成文章 A Voice Comment、文章 B Text Comment、Project evidence 核验、邮件输入目标 Voice Command、Side Panel sourced Draft、citation、Insert 与 Undo。主屏保持一个阅读/编辑轴和一个当前主动作；复杂能力放入独立 Stories，不堆进主屏。
- **视觉方向：** 以 2026-08-05 实际捕获的 Notion 页面与 ChatGPT 首页为层级、阅读轴、输入节奏和克制程度基准。实施前 `logue_product_designer` 从三份 ImageGen 方向中选择 `Project Canvas` 作为 Web 主目标，保存于 `docs/design/references/logue-v2-project-canvas-target.png`；实现时必须移除其一级 Skills、正常保存噪音与无 target 时的 Insert，补齐 Project 默认态，并让 Sources inspector 可折叠、可调宽、渐进展开。Extension 与 Side Panel 不继承该 Web 布局，只共享视觉 token 与对象语义。
- **数据与风险：** Stop 后永久保存、Project membership、Insert/Adopt 必须是独立状态；Transcription Profile 不得冒充 Project Generation Context；Web/You/AI 同时用图标与文字区分；target lost、offline pending、未采用 Run 和删除 dependency 必须有可恢复终态。每个 Story 使用独立 seed，避免交互污染其他 Story。
- **替代方案：** 在旧单文件 mock 上继续补功能，或先做静态总览再补交互。前者继承错误对象与 IA，后者不能证明真实 Journey，均拒绝。
- **已有证据：** 权威产品定义第 11–14、19 节；用户指定的真实 Notion `Explain` Skill 页已通过其登录 Chrome 与 Computer Use 双重读取并保存为 `docs/design/references/notion/08-notion-skill-page-explain-20260805.jpeg`、`09-notion-explain-full-20260805.png`，确认 270px 左栏、56px 顶栏、约 720px 单一编辑轴、安静行级导航与渐进操作；真实 ChatGPT 首页、旧 mock 运行截图；独立代码架构审查确认稳定原语可复用但旧 V2 产品组件必须整体弃用。
- **完成证据：** Storybook 真实运行中完成 canonical journey；独立 Stories 覆盖全部合同矩阵；代表性 viewport、键盘/焦点、a11y、console、reload 通过；多位独立 designer、Claude Code Fable 5 Max 与 final goal_supervisor 无 P0/P1。

### DR-038 — Extension 宿主与 Side Panel 在窄窗口中保持可完成，不互相覆盖

- **优先级：** V2 mock / P1
- **状态：** 已在 900px 与窄宽 Chrome 复验；不再阻断主旅程
- **决定：** 桌面宽度继续并排显示宿主和 360–392px Side Panel；900px 附近缩小 Side Panel 但不覆盖宿主；更窄的审查视口改为上下排列，让宿主动作和 Side Panel 都可操作。`This tab` 只显示当前页面的 Comment，Project 全量证据仍从 `Open project` 进入 Web App 核验。
- **用户可见影响：** 用户在较小浏览器窗口仍能完成 Comment、Command、引用和恢复操作，不会被侧栏遮住；切换文章后不会把另一页的 Comment 误称为当前页内容。
- **替代方案：** 用覆盖式 drawer 或在窄宽度隐藏宿主。前者已真实遮挡主任务，后者会让 canonical Story 无法完成。
- **已有证据：** 独立 Extension review 在 900×900 复现 Side Panel 覆盖与裁切；Chrome 复跑还确认 `Show excerpt` 折叠态仍显示原文，以及 Article B 下错误出现 Article A Comment。
- **开放问题：** 这只是 Storybook 对多表面的响应式表达；真实 Chrome Side Panel 的宽度与宿主网页重排由浏览器负责，不在 mock 中伪造浏览器能力。

### DR-020 — LOGUE.ai 产品定位验证门

- **优先级：** 产品基础 / P0
- **状态：** 收窄后的定位与首个用户已确认；详细 V2 产品定义已重写并获 mock 授权；不定义生产 MVP
- **研究前定位：** LOGUE.ai 是以 Voice 为第一交互方式、以 Log/Source 为个人信息底座、由 AI/Skills 完成处理、自动组织、分析和生成的个人工作系统。
- **研究结论：** Voice / Log / AI 应保留为产品原则，但不能承担市场定位。任意输入框听写、选区命令、自定义 prompt、自动组织和基于个人内容生成已分别被 Wispr Flow、Superwhisper、Willow、Voicenotes、Mem、Tana、Readwise、Notion 等覆盖。
- **确认定位：** 面向跨网页研究和写作的个人知识工作者；首个闭环为“当前网页/精确选区的语音或文字判断 → 带来源的 Log → 显式或自动 Project classification → 在当前输入位置基于 Sources 生成并插入”。短句为“说一次，记住来源，用回当前工作”。
- **用户可见影响：** 新产品定义建议以 `Projects / Library / Settings` 为 Web App 一级入口；Project 是意图与 Context 边界，Library 负责所有永久私存内容的浏览与管理，Global Find 打开 Library 结果；Skills 作为上下文动作和配置。该 IA 等待用户确认，不构成 UI 或实现冻结。
- **主要风险：** 若 round trip 不能明显优于 `Wispr + Readwise + ChatGPT` 的手工组合，产品仍会被理解为功能更少的 dictation/PKM 工具；来源 lineage 可以累积防御，但只有在当前工作位置真实节省返工时才产生用户价值。
- **证据：** `docs/design/research/logue-ai-competitive-positioning-2026-08-04.md`、`docs/design/reviews/logue-ai-positioning-independent-review-2026-08-04.md`，以及 ChatGPT.com 独立会话 `https://chatgpt.com/c/6a72c769-02d8-83e8-9f9c-9978c94e5a41`。修订稿经 `logue_product_designer` 最终复审为 `PASS — 9.3/10`。
- **用户决定：** 已确认收窄后的 wedge、研究/写作密集的首个用户与 DR-021；明确取消“首轮只证明一个 active Project”的当前范围讨论。详细对象、Context、Voice、Library、Document 与 local-first 合同属于本次设计建议，仍等待用户审阅；不实施。

### DR-022 — V1 与 V2 的文档和产品边界

- **优先级：** 产品基础 / P0
- **状态：** 用户已确认；持续执行
- **决定：** 已发布的现有产品统一称为 V1。当前讨论的是 V2 整体产品重设计；V1 的代码、界面、规格、数据、QA 和 Release 仅作历史证据，不限制 V2。
- **文档规则：** `docs/design/logue-ai-product-positioning-2026-08-04.md` 是 V2 唯一权威整体设计稿；用户后续想法直接合并到该文件。竞品研究和 review 仅作支持证据。旧的 GOAL、产品规格、交互、设计系统和专题设计已明确标记为 V1 历史文档。
- **用户可见影响：** 不再需要在多份互相冲突的设计稿中判断哪份最新；V2 会作为一套整体产品持续重写，而不是在 V1 上追加 feature。
- **实施边界：** 当前不定义 MVP、排期或 Release 范围，也不开始代码实现；只有用户明确宣布进入实现阶段后再制定交付计划。

### DR-023 — 个人 Source 向团队 Context 的显式发布边界

- **优先级：** 产品基础 / P0
- **状态：** 用户已确认长期扩展模型；保持个人-first 定位，当前不实施
- **决定：** 不采用 `Private Source → Personal Knowledge → Share Candidate → Project Knowledge → Team Knowledge` 五层对象。V2 使用 `Source + Knowledge + Scope + Publication`：Source 是来自 Web/You/AI 的可追溯记录或证据；Knowledge 只能由用户明确采纳或确认值得持续依赖的判断、决定、结论或方法形成；Personal/Project/Workspace 是 Scope；Publication 把一个明确 Knowledge revision 及允许公开的证据显式发布给目标 Project/Workspace。
- **用户可见影响：** 当前个人 Capture、Voice Write、Comment、私人 Log 和 Project Context 流程不增加步骤。未来团队能力只增加 `Share to project`：用户预览正文与证据、删改或脱敏后发布独立 Project 快照；私人原件不改变权限。删除私人原件不会自动撤回已发布快照，撤回必须单独执行 `Withdraw`。
- **信任边界：** 自动分类只改变个人 Context membership，不改变共享范围。AI 可生成仅作者可见的建议，不得自动发布；`Share Candidate` 不建立 Inbox、一级导航或长期对象。团队不得看到未共享内容、被忽略的建议、个人捕获量或个人贡献排名。
- **生命周期：** Knowledge 使用 revision 与 supersedes 表达更新；Publication 固定明确 revision，并只需要 `active / withdrawn`。删除私人 Source、从 Project 移除和撤回 Publication 是不同动作；撤回后停止未来检索和 AI 使用，历史只保留必要 tombstone/provenance。是否需要 freshness、冲突、负责人和团队 endorsement 属于待验证治理，不进入当前状态机。
- **替代方案：** 五层晋升链会混淆内容类型、成熟度和可见范围；同一对象多 scope 会让私人修改静默改变团队内容；只做企业搜索则进入 Microsoft、Glean、Atlassian、Slack、Google 和 Onyx 的强势区域。显式 Publication 在低摩擦个人体验与未来团队治理之间提供最小边界。
- **已有证据：** 三个独立 Agent、三个 ChatGPT.com 深度研究会话与 Claude Fable 5 Max 的结论均认为团队方向只能作为受控扩展；Glean、Microsoft Work IQ、Notion、ChatGPT/Claude Projects、Granola、Dovetail 和 Slite 已覆盖个人/项目记忆、企业搜索、共享空间或知识验证，LOGUE.ai 更可信的空位是正式文档产生之前的“判断 + 证据 + lineage + 显式发布”。
- **主要风险：** 私人工作被理解成员工监控；分类与共享混淆；私人来源通过 AI 派生结论穿透权限；分享建议形成新的维护 Inbox；团队实际只需要搜索已有文档而不需要原子 Knowledge。
- **开放问题：** Knowledge 何时成为个人 V2 的显式对象；团队 endorsement、负责人和 freshness 治理何时出现；团队内容主要留在 LOGUE.ai 还是写回现有工具；雇主 Workspace 与真正私人空间的所有权边界；开源范围、许可证和托管模式。
- **实施边界：** 现在只更新产品设计语义，明确延后 Team 导航、自动发布、复杂权限、审批、企业连接器和治理后台；不构成实现授权。

### DR-021 — Voice Write 与持久 Project Context 的边界

- **优先级：** 产品基础 / P0
- **状态：** 用户已确认设计边界；当前不实施
- **决定：** 所有完成或明确 Stop/Save 的 Voice Write、Capture、Comment 和其他用户输入都形成 Source，并永久保存到私人 Library，直到用户明确删除。永久保存不等于进入 Project Context；Recording 中 Cancel 仍是明确放弃未完成输入。
- **Project Context 路径：** 用户可以显式选择一个或多个 Projects。只有 Page/Selection Capture、Web Clip 和完成 Save 的 Page/Selection Comment，在用户已显式授权 tab active Project 时可以默认加入；Text Note 与其他 Saved content 可显式加入或仅 Suggest。Voice Write 即使使用 Project Transcription Profile 也只能 Suggest，不能自动加入。Voice Command、Ask/Draft prompt 等 Activity 永不自动进入，只有用户 Pin/Save 后才有资格。高相关但没有显式授权的 Source 只建议；无关、低价值或重复内容保持 Saved-only，重复项关联已有 Source 而不放大 Context 权重。
- **信任边界：** 用户显式加入、排除和纠正永久优先于自动分类，后台不得覆盖。Project Context 是供 Project AI 使用的受控计算结果，而不是另一份存储副本。
- **用户可见影响：** Voice Write 主流程仍保持零额外选择和先保存后插入；用户之后可以找回任何输入。系统通过 Source subtype 资格、显式 tab 授权和 Project classification 防止永久 Library 的噪音直接污染 Project 产出。
- **替代方案：** 普通 Voice Write 仅短期/本地保留。该方案已被用户明确否定，不得作为默认行为。

## V1 运行历史（不是 V2 产品权威）

DR-001 至 DR-018 记录已发布 V1 的真实运行问题、安装与 QA。它们仍可约束 V1 修复和数据安全，但不得决定 V2 的 IA、对象名称、Voice 状态或产品表面；发生冲突时以 DR-020 至 DR-036 和 V2 唯一产品定义为准。

### DR-001 — 扩展麦克风授权范围

- **优先级：** P0
- **状态：** 实现中；需要真实 Chrome 验证
- **决策：** 原生 Chrome Side Panel 的录音权限属于 Logue 扩展 origin，而不属于当前网页。首次录音由前台的 Logue 扩展页面请求一次浏览器麦克风授权，之后扩展可在任意网页上下文中录音；不为每个网页分别申请权限。
- **为什么重要：** 网页本身即使已经能录音，Logue 扩展仍可能没有麦克风权限。
- **用户可见代价：** 首次使用会短暂显示一次正常的 Chrome 授权页。这是一次浏览器授权，不是额外的 Logue 确认，且不得阻碍之后的录音。
- **证据：** 在真实 ChatGPT Chrome 标签中复现：Side Panel 的 `getUserMedia` 返回 `NotAllowedError: Permission dismissed`，而扩展麦克风权限仍为 `prompt`。2026-08-04 的临时候选扩展选择 Chrome 的“访问此网站时允许”后，录音控件进入 `Cancel` / `Stop`；这里的“网站”是 Logue 扩展 origin，授权覆盖其在任意网页中的录音，不授予网页额外主机或数据权限。
- **下一步证据：** 在真实 Chrome 页面首次允许 Logue 扩展麦克风权限后，开始录音并取消，确认零写入；再在真实 Google Docs 编辑器重复。

### DR-002 — Google Docs 输入录音

- **优先级：** P0
- **状态：** 未完成
- **决策边界：** Google Docs 通过嵌套编辑器 frame 编辑。该 frame 与 content script 不能可靠继承麦克风授权，因此扩展录音必须独立于网页，不能假定页面输入框或 iframe 可用。
- **用户可见要求：** 在真实 Google Docs 编辑器打开 Logue 必须显示可用的 `Record`。编辑器内紧凑语音动作也必须可发现，且不能因 Docs frame 变化而静默失败。
- **证据：** 真实 Docs 调查显示其文字事件 iframe 是当时录音 origin；直接从页面/frame 采集麦克风是脆弱路径。fixture 页面成功明确不能算完成。2026-08-03，真实 Docs 的行内控件复现卡在 “Starting microphone”；初版 background/offscreen 路由没有修复，过期的顶层 frame 代理状态会显示 Cancel/Starting 而编辑器 frame 仍空闲。刷新 unpacked 扩展与 Docs 后，直接 frame 控件仍停在 Start，既无录音状态也无局部错误。随后向刚定位的 `about:blank` frame 直接发消息被 Chrome 拒绝，控件现显示可操作的局部错误 `Could not reach the active Google Docs editor.`，而不是隐藏失败。2026-08-03 每次重新加载 unpacked 扩展和已登录 Docs 页面后，background frame 路由、DOM mutation 桥接、父/子 `postMessage`、带 `match_origin_as_fallback` 的子 frame Chrome `runtime.Port` 都未能到达编辑器。这仍是活动 P0 故障，不能视为已修复；同一 Docs 标签的原生 Side Panel 能录音，也不能证明要求的行内动作有效。
- **下一步证据：** 授予扩展权限后，在真实 Docs 编辑器录音并取消且不编辑文档；然后验证行内动作出现且开始/取消可用。

### DR-003 — 真实 Docs 转写证据

- **优先级：** P0
- **状态：** 已部分验证；真实人声的单次保存与插入仍未证明
- **决策：** 不为静音录音加入 fallback 或页面变更 guard。用户必须能开始、取消、停止并立即重试；无语音结果是局部错误，不能把录音器锁死。
- **证据：** 2026-08-03，重新加载当前 unpacked 扩展和已登录 Docs 编辑器后，canvas 启动器从 `Start` 变为 `Cancel` + `Stop and insert`，停止后进入 `Transcribing and inserting`。已安装的 unpacked 目录最初仍引用过期的 v0.2.8 资源，因此在相同 Chrome 扩展身份下原子切换到当前 v0.2.10 资源并刷新 Docs 后重试。自动化没有采集到人声，Gemini 未返回文字；产品现显示 `Couldn't transcribe. Recording saved.`，且 `Start` 可立即再次使用。这证明当前真实 Docs 路由和录音生命周期，但不证明口述内容保存与一次插入。随后，在真实 Docs 编辑器获得焦点时验证：`Tab` 聚焦 `Start voice input`，`Enter` 开始，`Esc` 回到 `Document content` 且没有写入。2026-08-04，`v0.2.13` 在真实 Mac Chrome 从 Side Panel 录制并 Stop 非人声环境音到临时 Ubuntu HTTPS 服务；仅发布的 manifest 含同一次 capture 的 `.webm` 与 context 文件校验和，证明原始音频会先落盘。该验证没有读取或发布音频内容。
- **开放限制：** 自动化环境不能提供可信的人声麦克风样本；没有人声就声称完整 Docs 插入，会构成虚假证据。
- **替代验证：** 在空数据临时服务中，允许使用当前 Mac 的真实麦克风采集非人声环境音并 Stop，以验证原始音频先于转写错误被保存。临时 Linux QA 仅发布音频文件名和校验的 manifest，绝不上传音频本体。该冒烟不验证转写或 Docs 插入，也绝不替代真实人声验收。
- **下一步证据：** 在真实 Docs 编辑器口述短句；确认仅保存一次、仅插入一次，且不触发 Docs 命令。

### DR-004 — 当前构建的 Chrome QA 资源

- **优先级：** P1
- **状态：** 直到下一个经验证 Release 前有效
- **决策：** 真实当前代码 QA 保持既有 unpacked Extension 的稳定根目录和 Chrome 身份，但 manifest 指向复制的 `releases/workspace-current` 构建。旧 v0.2.8 资源保留在相邻路径，便于回滚。
- **为什么重要：** manifest 已指向旧版本资源时，Reload unpacked Extension 不会加载工作区文件；未切换时，真实浏览器测试可能误测陈旧 Release。
- **用户可见影响：** 既有 Chrome 存储和权限保持不变。这是本地 QA 构建，不是 Release；下一个已验证 Release 必须经正常安装器替换。

### DR-005 — 此处未配置目标 Linux 验收环境

- **优先级：** P0
- **状态：** 被目标环境访问条件阻塞
- **决策边界：** Python 安装器和 LAN/域名流程已有隔离环境证据，但此工作区没有所需目标 Linux 主机、其 systemd user 环境、防火墙分配域名及 Mac Chrome 端点。本地 SSH 配置仅有 GitHub。
- **为什么重要：** 临时 Ubuntu 运行不能证明目标机启动、动态域名连通或重启恢复；将其视为已完成 LAN 安装会掩盖实际交付风险。
- **下一步证据：** 在目标 Linux 运行当前安装器，选择默认 `0.0.0.0` 监听；从 Mac Extension 连接其分配域名；然后分别重启服务和 Chrome，并重复保存/读取。

### DR-006 — 在剩余 P0 现场验收前发布补丁

- **优先级：** P0 交付
- **状态：** `v0.2.13` 已由用户明确要求发布；真实环境验收仍未完成
- **决策：** 用户明确要求先发布，因此已发布 `v0.2.11`、`v0.2.12` 与当前 `main` 的麦克风补丁 `v0.2.13`。这些 Release 不宣称目标 Linux 动态域名路径、真实人声保存或 Docs 插入已经通过。
- **为什么重要：** 安装器的 `latest` 会在两项现场证据缺失时前进；升级用户获得当前修复，但远程 Linux 和 Docs 人声路径仍必须视为未验证。
- **替代方案：** 等待两项 P0 环境检查通过后再发布。这样 Release 门槛更严格，但与用户“先发布”的明确指令冲突。
- **证据：** `v0.2.12` 的官方 Extension 产物已在真实 Chrome 成功打开；`v0.2.13` 候选已通过自动化检查、安装器首装/覆盖回归，并在真实 Chrome 通过授权后由 Record 进入 `Cancel` / `Stop`，取消后回到 Record。自动化不能提供可信人声，因此没有声称已完成保存或插入。未完成任务仍将两项现场证据列为 `READY_FOR_REAL_ENV`。
- **用户决定：** 用户于 2026-08-04 在本任务中先后明确要求“先创建新 Release”及“update release”。

### DR-008 — Side Panel 麦克风授权窗口没有请求权限

- **优先级：** P0
- **状态：** 已修正；真实人声保存仍待验证
- **决策：** 以显式 `mode=permission` 查询参数打开扩展自有的麦克风授权窗口，使其调用 `getUserMedia`、将结果回传 Side Panel 后关闭。
- **用户可见影响：** Chrome 若抑制原生 Side Panel 授权提示，按 Record 会停在开始态，无法采集声音。
- **证据：** Side Panel 原先打开 `microphone.html?token=…`，而该页面只在 `mode=permission` 时请求麦克风；行内录音器已传入该参数，是应遵循的正确路径。修正候选在真实 Chrome 授权后从 Record 进入 `Cancel` / `Stop`，取消后返回 Record，未显示错误文档。
- **替代方案：** 将该页面的任意 URL 都当作授权请求。这会破坏其独立的 offscreen recorder 模式，用模糊分支掩盖精确调用错误。
- **下一步证据：** 在 Release 安装的扩展中，用一句真实人声 Stop，确认仅保存一条带原始音频的 Material。

### DR-010 — 版本化 Extension 安装破坏麦克风授权页

- **优先级：** P0
- **状态：** 已修正；真实人声保存仍待验证
- **决策：** `microphone.html` 相对正在运行的 Side Panel 或 MV3 worker 资源解析，不通过根路径 `chrome.runtime.getURL` 解析。
- **用户可见影响：** Record 会打开 Chrome `ERR_FILE_NOT_FOUND`，导致 Side Panel 与行内语音在版本化安装升级后都无法请求麦克风权限。
- **证据：** 真实候选 Side Panel 原先请求 `chrome-extension://<id>/microphone.html?mode=permission&token=…`；其 manifest 和资源目录只存在 `releases/<version>/microphone.html`。修正候选从版本化 `releases/v0.2.12-audiofix2-30941/sidepanel.html` 成功请求授权并显示 `Cancel` / `Stop`；取消后回到 Record。
- **替代方案：** 每次安装复制根目录 `microphone.html`。这会重建刚从 Side Panel 移除的双代资源分裂。
- **下一步证据：** 在 Release 安装的扩展中，用一句真实人声 Stop，确认仅保存一条带原始音频的 Material。

### DR-009 — 每次 Release 前的风险驱动 CUJ 门槛

- **优先级：** P0 交付
- **状态：** 已执行基础门槛；真实人声子项待外部环境
- **决策：** 创建 Release tag 前，必须通过自动化检查、产物安装，以及按改动文件选择的最小真实 Chrome 关键用户旅程。音频、插入、Docs、连接和安装器改动各有命名的必跑旅程；无关 UI 改动不会触发重新录音。
- **用户可见影响：** 新 Release 不再把构建成功或 Side Panel 能打开单独当成“捕捉可用”的证据。
- **替代方案：** 每个补丁跑全部历史场景。这样更慢，却不会给未改动路径带来更强证据；未完成的现场验收任务仍独立存在，不能被静默豁免。
- **证据：** `v0.2.12` 通过了 Side Panel 资源路径，却没有通过真实 Side Panel 麦克风启动，因而发现遗漏的 `mode=permission` 查询参数。
- **本次证据与例外：** `v0.2.13` 候选已通过 A1、A2、A3，以及 C1 的授权→录音→取消；C1 的“真实人声 Stop 后保存一条 Material”仍缺真实人声。用户明确要求发布，例外已记录于 DR-006；该项仍是后续 Release 前的必跑项。

### DR-011 — iPhone 与移动端不在当前支持范围

- **优先级：** 产品范围
- **状态：** 已按用户决定生效
- **决策：** Logue 当前只交付桌面 Web 与 Mac Chrome Extension；不实现或验收 iPhone、移动触控、旋转或移动端专项布局。
- **用户可见影响：** 移动设备可以保留现有响应式访问，但不构成支持承诺，也不会阻塞桌面功能、Release 或终审。
- **替代方案：** 继续将 iPhone 作为延期 P3。它会持续占用验收清单与注意力，且与用户最新决定冲突。
- **证据：** 用户于 2026-08-04 明确表示“不需要 iPhone 支持”。
- **下一步证据：** 已从权威目标与未完成清单移除移动真机工作；后续仅在用户重新要求时恢复。

### DR-012 — 用可控临时环境补强 Linux 远程连接证据

- **优先级：** P0
- **状态：** 已完成替代验证；不能替代目标主机验收
- **决策：** 在目标 Linux 未接入时，使用 GitHub Ubuntu runner、当前 Release 和 Cloudflare 临时 HTTPS 域名，从当前 Mac Chrome 执行真实远程连接、保存、读回与 Reload。临时环境只使用空 QA 数据。
- **用户可见影响：** 这能在不等待人工操作的情况下验证 Linux→动态域名→Mac Chrome 的实际连接路径；但不证明目标主机的 systemd user service、防火墙域名或服务重启恢复。
- **替代方案：** 只等待目标 Linux。这样保留最严格的证据，但在外部环境缺失时无法自主推进。
- **证据：** 仓库已有 `remote-linux-smoke.yml`，会构建 Python-only Release、在 Ubuntu 安装服务并启动临时 Cloudflare 域名；当前 Mac Chrome 与 Extension 可由 Computer Use 操作。2026-08-04 首次运行已通过 Linux 安装与本机健康检查，但 Cloudflare 刚输出域名时 DNS/连接尚未就绪。工作流现改为最多等待 60 秒的远程健康检查，不将刚产生的 URL 当作已可达。第二次运行的当前 `v0.2.13` 域名已由 Mac Chrome 授权并连接；向空服务保存 `Remote Linux QA 2026-08-04` 后，Side Panel 页面 Reload、Extension Reload 和远程 Web Stream 都读到同一条资料。测试后已恢复 `http://127.0.0.1:8787`，并主动关闭临时公共域名。
- **下一步证据：** 保留 F1 为未完成，直到目标 Linux 的 systemd、受控防火墙域名、Chrome 完整重启与 Linux 服务重启恢复都通过。

### DR-013 — 切换服务器后清除过期的局部错误

- **优先级：** P1
- **状态：** 已实现；等待带真实转写结果的目标失效→切换服务复验
- **决策：** 用户明确成功连接新的 Logue 服务后，如没有待插入、可复制的文本，Side Panel 清除旧的局部错误并恢复正常录音入口；有待插入文本时保留该错误和恢复动作。
- **用户可见影响：** 旧的目标编辑器错误会在已恢复服务后继续显示，造成“仍无法录音”的误导；清除它不能丢失尚待用户处理的文本。
- **证据：** 2026-08-04 的真实 Mac Chrome 临时远程录音验证中，服务地址已切回可用本机端点，Side Panel 仍显示旧的 `The original editor is no longer available` 和 Retry。当前候选的 Extension 单测与类型检查通过，并已在同一 Chrome 打开干净的 Side Panel；没有可用的人声转写结果，不能伪称已完成该错误状态的端到端复验。
- **替代方案：** 永远保留所有错误。它保守但会把已经失效的错误带入下一次正常录音，且没有对应的待恢复内容。
- **用户决定：** 不需要；这是已复现、可逆的局部错误呈现修正。

### DR-014 — 语义检索调用与本地直接命中

- **优先级：** P1
- **状态：** 已实现；真实资料语义检索已验证，真实文档库为空
- **决策：** 服务配置 Gemini 时，资料与文档搜索将把最多 72 条近期候选的必要文本、查询词和来源/项目元数据发送给同一 Gemini 服务，取得最多 50 条相关结果及短理由；本地直接匹配只接受完整的规范化查询短语出现在字段中，始终排在语义结果之前。语义调用最多等待 12 秒；模型未配置、超时或本次调用失败时，返回现有本地结果，不让搜索不可用。
- **用户可见影响：** 用户可用自然语言找到相关资料，既有结果副行显示简短理由；直接输入的词不会被模型结果挤掉。中文长句不再因一个共享双字词元被随机当作正文命中；它会显示有根据的语义理由，或在模型不可用时安静地没有结果。每次停顿后的搜索可能有模型延迟和额外 Gemini 用量，但不会长期阻塞；默认界面不新增开关、说明或噪声。
- **证据：** 原先 Python `/v1/material-search`、`/v1/document-search` 固定为 `strategy: local`；当前实现以受限候选、允许 ID 校验、理由长度限制及直接命中优先完成相同用户能力，Web 类型和副行已支持 `strategy: semantic` / `related`。2026-08-04，真实本机服务的两条既有 Redfin 资料以 `homes for sale` 查询均返回相关结果和理由；浏览器 Reload 后再次查询仍正常。独立产品审查复现 `测试一下看看能不能输入` 仅因共享双字词元而把 `试一下` 当作正文命中，故收紧为完整查询短语；修正后的同一真实 API 返回 `strategy: semantic`、`related` 和 `Contains matching test phrasing '试一下'.`。当前真实文档数为 0，因此未把文档语义路径伪称为真实资料验收。
- **替代方案：** 继续仅本地精确搜索，或为每次搜索增加设置/确认。前者不能满足已确定的语义检索目标；后者把常用检索变成额外步骤。模型失败回到本地不是兼容层，而是防止已完成的正常检索被外部调用阻断。
- **开放问题：** 72 条近期候选不能保证覆盖大资料库；以真实查询集验证召回与成本后，再决定是否需要索引，而不预先引入 embedding、队列或第二套存储。
- **下一步证据：** 在真实文档存在时执行非直接自然语言查询，确认文档排序和理由；模型失败的本地回退已有隔离 API 回归覆盖。

### DR-015 — 将候选功能收敛为三个闭环、四个价值步骤

- **优先级：** 产品方向
- **状态：** 已完成产品/UX 设计与三位 designer 独立 review；规范已同步，尚未按完整工作流验收
- **V2 边界：** 已被 DR-022、DR-035 与 DR-036 取代；`Stream / Projects / Documents / Skills / Settings` 只描述 V1，不得用于 V2 mock。
- **决策：** 截图中的候选不各自建立入口或一级页面。四个价值步骤为“捕获 → 组织 → 找回 → 产出”，收敛成三个闭环：`Capture anywhere → safe save → quiet organization → On this page`、`Find / Ask → verify sources → draft → edit`、`Select → Skill → replace → Undo`。`Universal Capture` 与 LAN 连接是捕获可靠性门槛；`Ask my work` 是 Stream/Documents 的自然语言搜索能力；不新增 Inbox；当前页面记忆只在 Extension 的 `On this page` 中渐进显示。一级导航保持 `Stream / Projects / Documents / Skills / Settings`。
- **用户可见影响：** 用户不需要学习 Chat 首页、Ask 页面、Inbox、Daily 或 Agents 等新心智模型；同一份资料可以从捕获一路被找回、纠正组织、加入文档或通过 Skill 复用。正常后台成功仍保持安静。
- **明确推迟：** Daily resurfacing 与可配置 Agents。前者尚无证据证明通知或每日列表比按任务找回更有价值；后者只有 Prompt 能力时必须继续叫 `Skills`，直到真实存在触发器、工具、权限与运行记录。
- **替代方案：** 为每项候选新增独立页面、聊天入口或待办箱。它更容易展示功能数量，但会复制搜索、资料、生成与审阅状态，违背当前内容优先和最小导航原则。
- **已有证据：** 当前 `main` 已具备语义资料/文档搜索、后台组织与 `Needs review`、Document/Extension Selection Skills、带引用的文档生成和编辑、Sources 面板，以及 Extension 的 `On this page`。三位独立 reviewer 均确认不新增 Ask/Inbox/Daily/Agents 页面、保持五项 IA 与正常成功静默的方向；也共同发现 runtime 版本证据、异步取消、来源生命周期、LAN 完成门槛、焦点/Undo/响应式和旧规范冲突必须在实施前解决。真实 Logue 与 Notion 截图显示这些能力应复用现有列表、编辑器、原位 launcher/menu 与 Chrome Side Panel，而不是建立新的视觉语言。
- **开放问题：** 2026-08-04 当前真实库只有两条无可判断语义的录音测试，均保持 `Unfiled` / `Needs review`；没有可安全迁移的历史分类资料。在增加更主动的记忆呈现前，必须先以有意义的真实资料验证组织建议是否足够准确、审阅是否足够轻量。
- **需要用户决策：** 无阻塞决定；这是本次产品设计的推荐边界，用户可在进入实现前改变优先级。

### DR-016 — Selection Skill 的 Esc 取消

- **优先级：** P1
- **状态：** 稳定安装的 Esc 路径已在真实 Chrome 通过；目标/SPA 漂移仍待验收
- **决策：** 当选区 Skill 菜单打开或 Gemini 正在返回时，`Esc` 立即清除当前选区调用快照；请求可以完成，但不得改写宿主输入或重新打开菜单。
- **用户可见影响：** 此前在真实 Chrome 的 Google 输入框中，点击 `Draft reply` 后立即按 `Esc` 仍会被迟到结果替换选中内容。该输入没有提交，但违背了用户的取消意图。
- **替代方案：** 在结果返回时再询问是否采用，或取消服务器请求。前者为正常流程增加第二次确认；后者无法可靠中断已经发出的 Gemini 请求，且不能单独保证迟到结果不写回。
- **证据：** 2026-08-04，稳定安装的真实 Mac Chrome 独立 Google 输入框中，选择 `Please turn this into a clear meeting follow-up.` → `Draft reply` → 立即 `Esc`；等待 8 秒后输入仍为原文、Skill 菜单没有重开，Google 未提交搜索。对应 run 已完成但 `adopted_output` 为 null，证明迟到结果未写回。
- **下一步证据：** 在同一稳定安装真实覆盖选区/目标切换与 SPA 路由后的迟到结果。

### DR-017 — 将当前 HEAD 原子安装到 Mac 的稳定 Extension 目录

- **优先级：** P1
- **状态：** 已安装并由真实 Chrome 加载；其余稳定性回归待验收
- **决策：** 使用现有 Extension 安装器的版本化 assets 与最终 manifest 原子切换方式，将当前 `main` 的本地构建装入 `/Users/yadong/.local/share/logue/extension`；随后只在 Chrome Reload 这一已加载的稳定目录。
- **用户可见影响：** 稳定根 manifest 现指向 `releases/v0.2.13-permissionfix.1-67141/`，当前 Chrome 已实际加载其显式麦克风授权路径。切换不替换 Chrome storage、稳定目录或现有服务数据；仅加载的 Extension 代码更新。
- **替代方案：** 继续用临时 unpacked 目录，或等待最终公开 Release。前者不能证明用户实际加载路径；后者会让已复现的 P1 可靠性修正一直无法在真实 Chrome 回归。
- **已有证据：** 根 manifest 的 background/content/sidepanel 都指向上述版本化路径，且全部运行时文件与本地 `dist/release/logue-python.zip` 哈希一致；2026-08-04 当前 Chrome 的独立 Google 测试页点击 launcher 后，Chrome 显示 Logue 的麦克风权限提示，授权后界面进入 `Cancel` / `Stop`，证明稳定加载路径已生效。
- **下一步证据：** 在同一稳定安装真实验证 Esc、选区/目标切换与 SPA 路由的迟到结果不写回；失败才修改代码。

### DR-018 — 扩展一次授权的麦克风入口

- **优先级：** P1
- **状态：** 真实 Chrome 首次授权/取消已通过；真实人声保存仍待验证
- **V2 边界：** 一次授权的浏览器事实可复用；`Stop and insert` 只描述 V1，已被 V2 的 `Stop → save audio → transcribe → candidate → explicit Insert` 取代。
- **决策：** 首次录音由扩展自己的授权小窗口提供明确的 `Allow microphone` 按钮；用户点击后才调用 `getUserMedia`。授权归属 Logue Extension，不归属当前网页，因此一次授权适用于扩展支持的所有网页。
- **用户可见影响：** 首次使用多一次清晰、一次性的授权点击；之后网页录音不再逐站点请求权限。正常录音、保存、插入路径不增加检查或步骤。
- **已有证据：** 旧稳定安装在真实 Google 页面点击录音后会停在 `Requesting access…`，实现没有可见用户手势。当前稳定安装在新的独立 Google 页面点击 `Start voice input` 后，Chrome 显示 Logue 的麦克风权限提示；选择允许后 launcher 进入 `Cancel` / `Stop and insert`，Cancel 回到 `Start voice input` 且焦点回到网页 Search。真实 Logue Stream 页面还验证 `Cmd+Shift+L` 将焦点交给 Side Panel 的非编辑容器，`R` 在无网页输入目标时进入 `Cancel` / `Stop`，`Esc` 回到 Record。服务 `/v1/items` 每次前后都为同两条既有资料，确认取消零写入。
- **替代方案：** 改用每个网页的麦克风权限，或继续自动请求。前者会产生逐站点权限摩擦并受页面策略影响；后者已在真实稳定安装中失败。
- **下一步证据：** 当前稳定安装中，用真实人声 Stop 后恰好保存一条带原始音频的 Material，并按 C2/C4 验证插入路径。

### DR-024 — V2 mock 采用跨端工作闭环，不把永久记录作为用户入口

> **DR-024 至 DR-034 已统一被 DR-035 暂停。** 下方内容只保留为历史探索，不代表已确认产品合同；其中的 Work 命名、IA、Stop/Insert、面板尺寸、Settings 与 PASS 状态均不得用于后续 UI，除非新版产品定义重新给出依据。

- **优先级：** 产品设计 / P0
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** V2 mock 必须同时呈现 Chrome Extension 与 Web App。Extension 承担“任意输入框 Voice Write、网页/选区留下文字或语音判断、原地使用 Actions”的现场交互；Web App 承担“持续推进一件工作、查看相关证据与自己的判断、基于这些内容继续写作或提问”的长期交互。两端由同一条“当前工作”连续起来，不能做成彼此独立的产品截图。
- **用户可见影响：** 产品名为 `Logue`，官网为 `logue.ai`；它是 local-first 产品。产品不再把 `Log`、`Material`、`Stream` 或技术性的永久存储作为默认入口或导航名称。保存、分类和来源链只在需要核验时才出现。
- **交互边界：** 主 mock 必须可完成 `网页选区 → 文字/语音留下判断 → 保留来源并加入当前工作 → 打开 Web App → 使用该判断及来源继续起草 → 在任意输入框 Voice Write / 原地采用`。语音录制、转写、自动归类和正常保存保持安静；不自动提交宿主页面、不自动共享、不把私人记录自动变为团队内容。
- **本次设计选择：** 不再制作总览拼贴屏。每个 Story 只呈现一个真实产品表面，并从同一份 fixture 构建；`CrossSurfaceWorkLoop` 在一个连续场景内共享同一个 Work、选区、Thought、Evidence 和 Draft，从捕获走到回插。独立 Story 保持可复现的固定初始态，不让先前操作污染关键界面。Web 使用 `Current work / Find / Settings`，永久保存是内部承诺而非导航对象。视觉只采用 Notion 的阅读内容轴和 ChatGPT 的单一主输入节奏；Evidence drawer 默认关闭。
- **本地产品边界：** 当前不设计用户帐户、登录、profile、套餐、`Personal` 标识、Workspace switcher 或成员列表。导航只呈现当前真实 Work、Find 与 Settings；未实现多 Work 数据时不摆放点击后仍打开同一内容的假 Work 行，也不得用新建动作清除已保存的私人输入。
- **替代方案：** 仅制作浏览器侧栏会把 LOGUE.ai 误呈现为 annotation extension；仅制作 Web App 会把它误呈现为又一个 AI workspace。保留 `Log` 作为一级入口则与用户明确提出的“技术化、非产品心智”冲突。
- **已有证据：** 用户在本轮明确要求“Extension 和 Web App 都需要”；竞品研究显示单一 Voice、阅读标注或知识工作区都不足以差异化，价值必须来自现场捕获到原位复用的跨端闭环。视觉目标为 2026-08-05 的浏览器内陪伴方向。
- **开放问题：** 各表面的真实完成态和视觉密度必须在 Storybook 浏览器验证后，由 ChatGPT、Claude 网页版、Claude Code 与独立设计审查交叉复核；不得将被否决 mock 的任何布局或文案作为后续实现约束。

### DR-025 — Voice 停止即保留；派生产出不冒充用户原话

- **优先级：** V2 mock / P0
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** Voice Write 与语音 Comment 在停止时立即保留私人的原话与转换版本；插入当前页面、加入 Work、接受分类均是后续显式动作。Web 原文、用户判断和 Action/Draft 等 AI 派生产出在 mock 中始终保留各自的 `Web / You / AI` 来源标识；引用与回插读取实际所属 Work，而不是一个固定示例名称。
- **用户可见影响：** 用户停止录音后即使不继续保存 Comment，仍可在 Find 找回原话及转换版本；目标丢失时可复制或找回，正常页面不会自动提交。采用 AI Action 生成的文字不会被误称为用户自己的判断。
- **替代方案：** 把录音仅保留在未保存 textarea 中，或为了简化展示把所有内容归为 `You`。前者会丢失用户输入，后者会污染 Project Context 的证据可信度。
- **已有证据：** V2 规范要求 Voice 停止后先永久保存、原始版本不被转换覆盖；独立 runtime 审查实证当前 Action → Thought → Evidence 的来源标识错误，且跨 Work 回插错误使用固定 `Mobile research` 名称。
- **开放问题：** 真实录音/模型版本还需决定 dictation 与 command 的独立快捷键；本 mock 先验证保存、来源链、显式采用和键盘恢复语义。

### DR-026 — V2 mock 必须可操作地覆盖 Project 分类与语音驱动的 Work 交互

- **优先级：** V2 mock / P0
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** 不把“自动分类”或“可用语音与 Project 交互”留为设置文案。一个保存的 Source 必须能在 mock 中显式加入多个 Work、保持 Log-only、接受或拒绝低置信度建议，并展示自动加入与重复关联这两种不同结果；Work 的 Ask/Draft 输入必须同时可用键盘或语音提出请求。高级 Skills 至少分别覆盖 transcription、transformation、page/selection、organization 与 generation。
- **用户可见影响：** 用户能区分“永久保存”“进入哪个 Work”“只是建议”“重复关联”四件不同的事，也能在当前 Work 通过语音形成请求，而无需回到一个独立聊天产品。
- **替代方案：** 只保留单 Work 保存、预置的 Suggest 状态，或把其余分类/语音交互写在说明中。它们无法证明 V2 的完整能力，且会使后续视觉 review 审查一个不完整产品。
- **已有证据：** V2 规范第 10 节已将多 Project、自动分类四种结果、Project 内 voice/text Find/Ask/Draft、可定制五类 Skills 定为能力基线；用户最新明确要求先完整功能、再 Journey、UX 和 UI。
- **开放问题：** 真实分类置信度、重复检测和语音命令模型不在 mock 阶段决定；mock 只定义用户可见的结果、纠正和恢复行为。

### DR-027 — 来源核验只显示已发生的派生结果，并保持可用键盘退出

- **优先级：** V2 mock / UX
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** Evidence 默认只呈现已保存的网页、Comment、原始语音与转写；只有用户在当前 Work 真实生成 Draft 后，才显示派生产出和编辑版。每个 Source 保留可见捕获时间。新 Work 与 Advanced Skills 的弹窗必须在打开时落到实际输入控件，并支持 `Esc` 关闭。
- **用户可见影响：** 用户不会把尚未发生的 AI 结果误认为事实或证据；也能用键盘在轻量配置与新建 Work 流程中稳定开始和退出。
- **替代方案：** 用预置 Draft 填充 Evidence 或只依赖鼠标关闭弹窗。前者破坏来源可信度，后者让高频桌面流程不完整。
- **已有证据：** 独立 V2 复审已复现“生成前 Evidence 预先显示 AI Draft”；修正已在浏览器验证。其同轮审查还发现 Advanced Skills dialog 的焦点留在背景触发器，且无可验证的 `Esc` 路径。
- **开放问题：** 完整 focus trap 留待真实复杂弹窗出现后再抽象；本 mock 先提供当前流程需要的可达初始焦点与键盘退出。

### DR-028 — Evidence 是可调整的阅读面板，不挤压或伪装成独立页面

- **优先级：** V2 mock / UX
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** 桌面 Work 的 Evidence inspector 打开后使用既有共享 PanelResizer，默认 480px、可在 320–640px 调整、双击恢复默认值；窄宽度沿用现有覆盖式 drawer，避免内容轴被挤压到不可读。
- **用户可见影响：** 用户能在核验长原文/语音转写时给来源足够宽度，也能优先保持 Work 的阅读与起草空间；不需要跳到一个独立来源页。
- **替代方案：** 固定 480px 或新增 Evidence 页面。前者违背桌面侧栏的既有可调规则，后者切断 “Draft ↔ citation ↔ evidence” 的连续阅读。
- **已有证据：** 当前 V2 capture、Work 和 Evidence 的浏览器审计确认来源链正确，但 Evidence 面板无可见 resizer；项目已有经过测试的共享 PanelResizer，并规定桌面侧栏需遵守可调尺寸规则。
- **开放问题：** 最佳默认宽度与上下限在真实多语言、长 URL/转写文本中再校准；mock 先给出当前证据阅读可用的 320–640px 范围。

### DR-029 — 私有性、回插范围和目标丢失必须在关键时刻说清楚

- **优先级：** V2 mock / P1
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** 每个进入 Work 的用户 Source 与 Evidence inspector 都以低干扰的 `Private · on this device` 明示其本地私有边界；Draft 回插完成后，原输入框旁必须显示该次插入来自哪个 Work，且 `Undo` 只撤销那一次插入。目标输入框消失时不得说“原始输入不存在”，而明确说明“目标页面已变化，内容已私密保存”。
- **用户可见影响：** 用户在最容易误解的三个时刻——决定把判断纳入 Work、将生成内容放回原页面、网页目标失效——仍能分清数据是否保留、刚发生了什么，以及 Undo 的作用范围。
- **替代方案：** 仅在设置页声明 local-first，或把插入结果标成富文本内联高亮。前者无法在高风险操作时建立信任；后者不适用于任意原生 textarea/contenteditable，反而会暗示不可保证的宿主能力。
- **已有证据：** Claude Fable 5 Max 对五张关键 mock 截图的独立审查没有发现 P0，但将这三项列为 P1：目标丢失文案歧义、插入范围无从辨认、local-first 私有边界不连续可见。
- **开放问题：** 真实 extension 对不同宿主编辑器能否精确标记插入 range，要在实际集成阶段按宿主能力决定；mock 先承诺可验证的来源和 Undo 范围，不承诺跨站富文本装饰。

### DR-030 — Evidence 只放来源；派生内容进入可读的转换历史

- **优先级：** V2 mock / P1
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** Evidence inspector 保持以原网页、用户 Comment、原始录音与转写为核心的 `Sources`；AI Draft、用户编辑版等派生产出移入按因果顺序呈现的 `Transformation history`。录音不再用一段文本冒充“Original voice”，而显示可操作的录音项、时长、原话转写和清理后的版本。Capture 在保存前以可展开、非阻塞的差异说明展示“轻度清理、原文保留”。
- **用户可见影响：** 用户可以迅速判断什么是外部/个人证据、什么是 AI 或自己后续加工的结果，并在保存前检查语音清理有没有改变含义，而无需多一次确认。
- **替代方案：** 把所有内容继续放在 Evidence 下，或为了简洁隐藏原始录音和转换。前者将证据与结论混淆；后者违背用户对永久 Source 和可控 transformation 的核心要求。
- **已有证据：** ChatGPT 对五张关键 mock 截图的独立审查列为 P1：Evidence 与 lineage 混层、语音原件用文本假称、保存前清理不可核验；Claude 同时指出 Skills 的实际适用范围与保存语义不够可预测。
- **开放问题：** 真正的音频播放、模型版本与可对照的字符级 diff 留待实现阶段；mock 先定义其用户可见状态、因果顺序和不改变原文的承诺。

### DR-031 — Skills 必须按触发点解释，保存与恢复默认值都可见

- **优先级：** V2 mock / P1
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** 五类 Skills 各自明确只在其触发点运行：语音停止后、用户显式 Action、页面/选区 Action、Work 分类建议、Work Ask/Draft。它们不在同一次 Draft 中隐式叠加；配置页提供 `Save defaults` 和 `Reset defaults`。
- **用户可见影响：** 用户能预测哪条设置会影响哪次动作，知道保存默认值会发生什么，并能恢复到安全起点。
- **替代方案：** 保留只有五个文本框和 `Done` 的通用配置。它虽然更短，但把 V2 最重要的“用户可定制 transformation”变成不可解释的全局魔法。
- **已有证据：** ChatGPT 将适用范围、优先级和 `Done` 的语义列为 P1；Claude 将 `Reset to default` 与 `Save defaults` 列为 P2，和该问题一致。
- **开放问题：** 同一类 Skill 的多版本、优先级以及项目局部覆盖还不属于本 mock 的范围；当前只避免五个类别互相重叠。

### DR-032 — Inline Voice Write 在停止时只保存，绝不隐式写入宿主输入框

- **优先级：** V2 mock / P0
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** Inline Voice Write 的 `Stop` 只创建永久私有的原始录音、转写和采用版，留在“已保存、待采用”状态；只有后续显式 `Insert` 才写入原宿主字段，`Undo` 只移除那一次写入。用户可在该状态把语音记录加入当前 Work，或不归入任何 Work；两种情况都可从 Find 找回。若目标字段消失，恢复界面只针对一条实际已保存的语音记录。
- **用户可见影响：** 用户停止说话后不再担心文字已经悄悄写进邮件、聊天或文档；他们能先审查、归入 Work 或直接离开，仍保有原音、转换版和日后找回入口。
- **替代方案：** 使用 `Stop and insert` 的单一按钮，或仅把停止结果临时留在输入框。前者违反“显式采用、绝不自动写入”的核心承诺；后者在目标丢失或用户转场时丢失永久 Source。
- **已有证据：** Goal Governor 的独立 checkpoint 已实测 Capture → Work → Draft → Insert/Undo 闭环，但发现 Inline Voice Write 仍在停止时立即插入，且默认 Find 抽屉写为 `Not added to a Work`，无法证明保存后可选归入 Work 的第三条合同旅程。
- **开放问题：** 真实宿主输入框的精确插入和失效侦测由 extension 运行时决定；mock 先定义不可变的保存顺序、用户可见状态和恢复动作。

### DR-033 — V2 本地设置与原始录音必须可核验，而不引入帐户模型

- **优先级：** V2 mock / P1
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** Settings 保留为本机偏好，不出现帐户、成员或云端 workspace；除 Voice & Actions 外，提供 Privacy & Storage、Extension & Voice、Export & Backup 三条可操作的本地路径。所有 Voice Source 的 Evidence 使用同一录音行，显示播放/暂停、时长、捕获时间和宿主页面链接，再展示转写与采用版。
- **用户可见影响：** 用户可以核验原话来自何时、何页，并管理这台设备上的隐私、扩展和可移出的副本，而不会被误导为需要登录或已上传到云端。
- **替代方案：** 把本地操作藏在空泛的“Voice & Actions”页，或只以“Original recording kept”文字表示原音。前者遗漏关键本地控制面；后者无法验证语音 Source 的可信度。
- **已有证据：** 最终独立产品设计复审复现两项 P1：Settings 只有 Voice & Actions，且 Voice Write → Stop → Add to Work → View saved 无法核验录音时长、时间和来源页。
- **开放问题：** 真实导出格式、备份目标和语音服务供应商在实现阶段由本机运行时决定；mock 只定义可发现、可触发的本地操作与不使用帐户的边界。

### DR-034 — 本地 Settings 的每个动作必须有可完成终态

- **优先级：** V2 mock / P1
- **状态：** 已在 Storybook 连续验证；待用户确认后提交
- **决定：** Settings 的 storage、extension、backup、export 不以 toast 或静态状态冒充完成；每个入口打开同一轻量本地操作面板，用户可完成一个明确动作并看到终态。Export 先选择范围与是否保留原录音，再准备副本并触发下载；其余动作分别以“已打开本机资料夹 / 已打开浏览器扩展 / 已创建本机备份”收束。
- **用户可见影响：** 用户不会点击后停在“ready to choose”之类没有下一步的页面；本地能力仍不需要帐户、云端或虚构 workspace。
- **替代方案：** 继续只显示状态文案，或为四项操作各做独立设置页面。前者是死路；后者对低频本地操作过重，并破坏 Settings 的安静阅读轴。
- **已有证据：** 冻结后的独立产品设计复审复现 `Settings → Export & Backup → Prepare export` 仅改变提示文本，没有选择、下载或终态，判为 P1。
- **开放问题：** 真实 Finder、浏览器扩展页、压缩包格式与下载写入在实现阶段连接本机系统；mock 先固定用户可见的范围选择、确认与完成语义。

### DR-039 — 关键用户旅程使用独立的引导式 Demo，而不进入产品界面

- **优先级：** V2 mock / P0
- **状态：** 已确认设计合同；实现与真实浏览器验收进行中
- **决定：** Storybook 为每条重要 CUJ 提供独立 Guided Demo。引导层只存在于 Demo：用柔和脉冲热点标出真实可操作控件，并在旁边用两句以内说明“现在做什么”和“完成后发生什么”。用户必须操作真实控件且达到对应持久终态后才前进；不提供虚构的 Next、替代按钮或成功状态。引导显示进度，支持 Back、Restart 和 Skip；Back/Restart 必须同时恢复共享 domain state 与该表面的局部 UI checkpoint。
- **用户可见影响：** 新用户或评审者可直接完成一条真实旅程，而不用猜 Story 中下一步点哪里；退出引导后产品界面不残留教程 chrome。Canonical round trip 与 J2–J9、恢复矩阵分别演示，避免一条过长的 mega-tour。
- **替代方案：** 在每屏常驻解释文字、只监听 click 自动前进、或录制视频。常驻说明会污染产品信息层级；click 不能证明操作成功；视频不能验证真实控件和状态连续性。
- **已有证据：** 用户明确要求所有重要 CUJ 都有 Demo，并在任意 UI 状态显示可执行操作的动态屏上指示和就近说明。2026-08-05 的独立 `logue_product_designer` 预审给出 GO，但限定为 demo-only overlay，并要求真实语义完成条件、checkpoint 恢复、reduced-motion 与目标缺失时的本地错误。
- **开放问题：** 先用 canonical journey 验证共享 checkpoint 与语义推进合同；通过后复用到其余 CUJ。视觉只修正明显遮挡、不可读和焦点问题，不为教程层做低价值像素精修。

### DR-040 — 高频默认路径隐藏持久化步骤，只在高级路径披露控制

- **优先级：** V2 产品 / P0
- **状态：** Selection Voice Comment 原子旅程已完成；两轮独立审查无 P0/P1
- **决定：** Logue 的高频动作必须围绕用户意图，而不是 Source、Run、membership 或 linking 等内部对象设计。默认路径只询问完成意图所必需的决定；已授权、可撤销且低风险的保存、转写、关联与分类在后台安静完成。复杂配置、文本输入、标签、多 Project、分类理由、版本与 lineage 进入已打开的 Side Panel 或 Web App 渐进披露。
- **首个强制应用：** 用户选择网页文字后直接出现轻量 Mic。点击开始录音，录音态只显示 `Accept ↵` 与 `Cancel Esc`；Accept 同时停止、永久保存原音/转写、创建 Web + You Comment bundle，并按当前 tab 已授权的 active Project 规则关联。Cancel 放弃未完成录音。无 active Project 时保持 Saved only，再在 Side Panel 非阻塞建议归类。
- **用户可见影响：** 选区语音 Comment 从 `Add comment → Voice → Stop → Link comment` 四次点击压缩为 `Mic → Accept` 两次点击；用户不需要先理解 Comment bundle 或 Project membership。打开 Side Panel 后仍能改文字、加 tag、换/加多个 Project、查看分类原因与原始版本。
- **替代方案：** 保留显式 Stop 与 Link 以逐步展示数据安全，或默认打开完整 Comment composer。两者都把系统工作转嫁给高频用户，并让核心价值低于普通语音批注工具。
- **已有证据：** 2026-08-05 用户首次试用 Canonical Guided Demo 时直接指出四步路径过重，并明确给出两次点击与快捷键模型。重构后真实 Chrome 已分别走通 active Project、No Project、Accept/Enter、Cancel/Esc 和跨表面 Project 重开；完整性审查 PASS，最终 `logue_product_designer` 为 GO/PASS 9.2/10，无 P0/P1。
- **实施合同：** 状态机固定为 `Selection ready → Mic → Recording → Accept/Enter → Atomic commit → Quiet success`。Accept 必须幂等地创建或复用 Web Source、创建带 audio/raw/normalized/candidate revisions 的 You Comment Source、建立 `comments-on`，并只在 tab 已授权 Project 时将二者加入该 Project；无 Project 时 bundle 保持 Saved only。Cancel/Esc 不得创建 Source、Run 或 membership。默认路径不得出现 Stop、transcript review 或 Link；高级编辑留在 Side Panel/Web App。
- **开放问题：** 全部 J1–J9 仍需按相同标准逐条审计；本批只关闭 Selection Voice Comment，不混入 Project Customize、Voice Write、Ask/Draft、Guided Demo 或视觉边角。

### DR-041 — Skills 采用两种来源、两层绑定和一次点击执行

- **优先级：** V2 产品 / P0
- **状态：** 共享 resolver/executor 与五类运行已完成并通过两轮独立审查；无 P0/P1
- **决定：** Skills 只有 Built-in 与 My Skill 两种来源；Global 和 Project-specific 是绑定/覆盖层，不复制为新的对象类型。运行时按 `explicit > Project binding/override > Global binding/default > system default` 解析唯一 revision。选区菜单直接显示 pinned / recent 的具体 Skill，点击一次立即运行；`More Skills…` 选择后也立即运行，不再出现第二次 `Run Skill`。结果只显示场景动作，例如 `Replace`、`Copy`、`Insert`、`Accept` 与 `Cancel`。通用 `Save` 禁止使用；只有物化永久 AI Source 时显示 `Keep in Logue`，写入 Document 时显示 `Save as document`。Mock 的结果必须由解析出的 revision instruction 与结构化策略驱动，不能再按 Skill ID 硬编码；同一个 executor 连接 Selection、Voice、Organization 与 Ask/Draft。binding 只能选择兼容当前触发点的 Skill；Skill 被归档或隐藏时立即移除引用它的 Global/Project binding，界面明确显示实际 fallback，而不是保留悬空 Override。
- **用户可见影响：** 用户无需理解 Skill 层级就能一击完成高频转换；需要时仍可在 Settings 创建、编辑、复制、归档 My Skills，在 Global 设置默认/置顶，在 Project 继承、覆盖或 Reset，并从 Run details 核验实际 revision。
- **替代方案：** 把 built-in / global / custom / Project-specific 做成四份重复 Skill，或先点 `Run Skill` 再选再运行。前者会产生不清楚的所有权和同步语义；后者把配置模型暴露给高频动作。
- **已有证据：** 三路独立完整性审查曾发现原 mock 没有 Skill domain、revision、Global/Project binding 或真实管理，Selection `Run Skill` 实际硬编码 Explain，`Save` 与 Settings `Edit` 为静态控件。随后已用统一、revision-aware executor 连接 Selection、Voice、Organization、Ask/Draft，并验证配置会改变输出、运行记录精确 revision、失效 binding 自动清理、局部错误保留当前工作。2026-08-05 两轮 fresh post-gate 均为 GO/PASS 9.1/10，无 P0/P1。
- **开放问题：** Project-local Customize 仍是后续独立旅程，不影响本条共享执行合同已关闭。

### DR-042 — Command 一次提交直接产生可恢复的 sourced Draft

- **优先级：** V2 产品 / P0
- **状态：** 已关闭；J1 canonical 达到 WORKING
- **决定：** Command Launcher 从明确入口直接进入 `Listening`，同时显示 Project 与真实输入目标；保留一个可编辑 live transcript 和一个具体主动作。`Enter` 结束录音并一次提交、`Shift+Enter` 换行、`Esc` 丢弃未提交录音并恢复目标焦点。提交后解析、选择 Generation Skill、冻结同 Project `added` 的全部 Web/You Source revisions、生成 Candidate 都属于同一个幂等事务，不再显示 `Parse command`、解析摘要或 `Generate draft`。成功后直接关闭 launcher，并在同 tab Side Panel 打开带引用的可编辑 Draft。引用必须指向本次 Run 冻结的 revision；正常解析、运行、保存成功保持安静。
- **持久与恢复边界：** Voice Submit 创建含音频/转写的永久 Activity Source、Activity 与 Run；prompt 不自动进入 Project Context。无可用 Project Sources 或模型未 Ready 时保留 failed Run 和 Activity，不创建 Candidate，launcher 留在原位显示局部错误；Retry 创建新 Run 并重新核验 provider、冻结 Context 与 revision，不能把仍失败的请求伪造成 Candidate。Insert/Copy 才物化带 runId 的 adopted AI Source；Insert 必须幂等且 Undo 只恢复宿主目标，同时在 Candidate 保留 target 与 undone lineage。target 在生成后丢失时禁止 Insert，Candidate 保留并提供真实 Copy 与 Open in Logue；Copy 失败不得显示假成功。
- **用户可见影响：** 用户从 Command 到带来源 Draft 只需一次提交；仍能核验来源、编辑、Insert、Undo，并在目标页面变化时恢复结果，而不需要理解解析器、Run 或模型阶段。
- **替代方案：** 保留 `Parse → Generate` 两次确认，或生成后自动写入宿主。前者把系统内部阶段转嫁给高频用户；后者违反显式采用、不得自动提交和可恢复原则。
- **已有证据：** Goal Supervisor 将 J1 的 `Parse command → Generate draft` 判为最高 ROI 缺口。2026-08-05 fresh `logue_product_designer` 预审 BLOCK 5.5/10；独立完整性 gate 随后发现 Retry 假成功、Context 越界、Text-only Command、焦点与静态 lineage 五个 P1，均已修复。真实 Chrome 已复跑双 Comment bundles、Listening → 一次 Enter、冻结 citation、编辑/Insert/Undo、target lost、无 Context Retry、Esc 焦点恢复与 Web Project lineage；22 个测试文件 139 项、typecheck 与 build 通过。fresh post-gate 为 GO/PASS 9.1/10，无 P0/P1。
- **开放问题：** `copy-candidate` 尚未与 Insert 共用 frozen-lineage preflight；当前 mock 没有删除 revision 的入口，canonical 引用可信，因此 fresh post-gate 将其评为不阻断的 P2。后续在加入 revision 删除/失配状态时抽取共享 evidence validator。真实异步 Running 取消、clarification 与 parse error 仍属于独立错误矩阵；本批只关闭 canonical 正常路径、无 Context 失败、target-lost 恢复和 adopted lineage，不混入 Voice Write、Project Customize、Guided Demo、视觉优化或 J7–J9。

### DR-044 — Library 分离永久内容与运行活动，但共享来源证据

- **优先级：** V2 产品 / P0
- **状态：** 真实 Web App 实现中；完整功能完成后统一验证
- **决定：** Library 的一级视图固定为 `Saved content` 与 `All activity`。前者展示永久 Web/You/AI Source 和 Comment bundle；后者展示 Voice Command、Skill Run、失败/完成状态、adopted output 与本次 Run 冻结的 Source snapshots。Run prompt 与失败 Candidate 不自动进入 Project Context，但始终可从 Activity 恢复和核验。
- **用户可见影响：** 用户不会把一次命令误认为长期知识，也不会因为结果尚未采用就失去原始活动；打开 Run 可看到当时真正使用的来源，而不是后来变化的 Project 当前内容。
- **替代方案：** 将 Source、Comment、Command、Run 和 Candidate 平铺在同一列表，或只保留成功生成结果。前者破坏对象理解，后者丢失失败恢复与证据链。
- **已有证据：** V2 产品合同明确区分永久 Library、Project Context 和 Activity/Run；真实 Host 已保存 frozen source snapshots。
- **开放问题：** Retry、删除未采用 Run 与跨表面恢复在后续完整性批次连接；本批先建立真实对象分区与证据阅读路径。

### DR-045 — Global defaults 与 Project overrides 解析同一个 Skill 对象

- **优先级：** V2 产品 / P0
- **状态：** 真实运行时实现中；完整功能完成后统一验证
- **决定：** Built-in 与 My Skill 是唯一 Skill 对象来源；Global default 和 Project override 只保存 Skill ID。运行时按 `explicit choice → Project override → Global default → Built-in fallback` 解析。Project 可分别覆盖 Transcription、Organization、Command、Ask 和 Draft；未覆盖的类别安静继承 Global。
- **用户可见影响：** 用户只维护一份 Skill，却能为特定 Project 调整术语、转写和输出方式；Extension 与 Web 使用同一解析规则，不出现两套相互矛盾的默认值。
- **替代方案：** 为每个 Project 复制完整 Skill，或让 Project 设置只显示但不影响运行。前者制造版本漂移，后者是假设置。
- **已有证据：** V2 Skill 合同与用户完整性反馈均要求 Built-in/My Skill、Global binding 和 Project override 同时存在且一次点击运行。
- **开放问题：** Selection 菜单的 pinned/recent 排序在 Extension 完整性批次连接；本批先闭合真实 binding 解析。

### DR-046 — Delete all local data 必须先生成机器内可恢复备份

- **优先级：** V2 产品 / P0 数据安全
- **状态：** 已完成并通过真实运行时 narrow gate；无 P0/P1
- **决定：** Settings 提供真实 `Back up now`、Export、Restore 与 `Delete all local data`。删除要求用户输入 `DELETE`，Host 在清空 Sources、audio、Projects、Documents、Runs、Settings 和 My Skills 前先在数据目录旁生成完整备份；Built-in Skills 随空工作区重新初始化。
- **用户可见影响：** single-owner 用户无需账号即可管理本机数据；误操作仍有明确备份路径可恢复，而 UI 不把下载导出冒充完整机器备份。
- **替代方案：** 只依赖浏览器 confirm，或直接清空而不备份。两者都不足以保护当前唯一受支持安装的数据。
- **已有证据：** Goal 明确要求 Export/Backup/Delete，项目规则要求安装、迁移和删除保护当前机器数据。
- **开放问题：** Finder Reveal 属于 OS 集成批次；不阻塞真实备份与删除合同。

### DR-047 — Project Context 的用户排除永久覆盖自动分类

- **优先级：** V2 产品 / P0
- **状态：** 已完成并通过真实运行时验证；无 P0/P1
- **决定：** Source 除 `projects` 外持久保存 `excluded_projects` 与不阻止重新分类的 `saved_only_projects`。Suggested 可 Add 或 Exclude；In Context 可 Remove（进入 Saved only）或 Exclude；Excluded 只能 Undo exclusion（进入 Saved only），不能用 Add 冒充撤销。Host 对同一 Project 强制 `projects`、`excluded_projects`、`saved_only_projects` 三者互斥，且 Comment bundle 的 Web Source 与所有 You Comments 共享一次 membership 决定。后台 Organization Skill 永远不得重新加入 excluded Project；低置信度建议继续留在 Review，不自动进入 Context。
- **用户可见影响：** 用户能区分普通移出与永久排除，纠正一次后结果稳定；一条网页选区及其 Comments 始终作为一个概念管理，不会拆成重复行。Saved content 仍永久保留，所有 membership 动作只影响特定 Project Context。
- **替代方案：** 只从 `projects` 数组删除，或把排除存在前端状态。两者都会在重新分类或重启后丢失用户意图。
- **已有证据：** Goal 明确规定用户显式加入、排除和纠正永久优先，且永久 Library 与 Project Context 必须分离。2026-08-05 使用当前 `.logue-data` 的真实 Comment bundle 完成 Suggested → Add → Remove → Exclude → Undo exclusion；Web/You 全程保持单行，Library 原件未删除。页面重新读取与 Host 重启后状态保留；重新运行 Organization 后 `excluded_projects=["Logue"]` 且 `projects` 未重新出现 Logue；直接提交三个重叠数组时 Host 仍只保留 `saved_only_projects`。fresh read-only post-gate 两次均为 GO，无 P0/P1。
- **开放问题：** Topic merge/convert 是更高层组织能力；不阻塞 Source membership 的真实纠正合同。

### DR-048 — Document revision 保存冻结正文与 Source IDs，恢复只创建新 revision

- **优先级：** V2 产品 / P0
- **状态：** 已完成并通过真实运行时验证
- **决定：** 当前 Document 文件保存最新 revision；每次更新前，Host 将上一版正文、标题、Project 与 `source_ids` 写入不可变历史快照。Revision history 同时返回历史与当前版。用户查看旧版时只读；Restore 会基于旧版内容创建新的最新 revision，不改写或删除历史。
- **用户可见影响：** 用户能回看生成或编辑时实际引用的 Sources，并安全恢复旧版；引用不会悄悄指向 Project 当前内容。
- **替代方案：** 只显示递增 revision 数字，或直接覆盖回旧版。前者没有可核验证据，后者破坏 lineage。
- **已有证据：** 2026-08-05 在真实 URL `http://127.0.0.1:5173/?view=projects&project=Logue`、真实 storage root `/Users/yadong/dev2/logue/.logue-data` 和既有 Document `Logue 核心产品闭环`（`doc_99b3c08877042230`）验证。revision 5 冻结 Web Source `mat_9c52bea682fa1b53`，revision 6 冻结 You Comment `mat_c789cfef42443105`；页面重新读取和 Host 重启后正文与 exact IDs 不变。Restore 将原始 revision 4 创建为 current revision 7，旧 6/5/4 均保留。Inspector 正确区分 `Cited item · Web source / You comment`，console error/warning 均为空；fresh read-only gate 为 GO，无 P0/P1。修改前完整备份保留在 `/Users/yadong/dev2/logue-data-backups/document-revision-real-env-1785985431`；关键界面证据为 `docs/qa/document-revisions/real-env-2026-08-05.png`。
- **开放问题：** AI Source 的独立 revision UI 在 Library lineage 批次连接；Document revision 合同先独立闭合。

### DR-049 — Transcription Profile 是可继承、可临时覆盖且可核验的完整语音合同

- **优先级：** V2 产品 / P0
- **状态：** 实现中；runtime/provenance、配置、渐进 picker、Re-transcribe 与纠正记忆范围均需闭合后再验证
- **决定：** `Default voice profile` 包含 Global Transcription Skill、Personal context/vocabulary、primary language 与 mixed languages。每个 Project 的 Transcription Profile 有 `Inherited / Customized / Disabled` 三态；Customized 可设置语言、people/company/product/place、acronym/preferred spelling、custom instructions 与 Project Skill override。Topic Vocabulary 是用户确认的独立词汇集合，只向本次转写提供词汇，不携带 Topic Sources、也不授予 Project Context。录音前轻量展示当前解析后的 Profile，并通过渐进 picker 允许临时关闭 Project Profile、选择一次性语言或一个 Topic Vocabulary；日常录音不弹完整设置。Inline Voice Write 在录音开始时冻结同-tab Active Project，Host 解析并冻结实际 Skill/Profile/Topic lineage；Active Project 只产生 provenance 与 Suggested membership，不自动进入 Project Context。每个含原始录音的 Source 使用独立 `transcript-revisions` 不可变快照；新转写只推进 `transcript_revision`、`transcript` 与 `applied_context`，用户编辑后的 `content` 以及 `projects / excluded_projects / saved_only_projects / tags / organization` 均不改变。
- **用户可见影响：** 用户在高频路径中始终知道 Logue 当前会怎样理解语音，又不需要每次配置；需要时可在录音前局部覆盖。切换 Profile/Topic 后可从同一原始音频生成新的 transcript revision，旧 transcript、raw/original audio 与每版实际 lineage 永久保留，Source membership 不变。术语纠正可选择 `Only this time / Remember for Topic / Project / Global`；同一术语可在不同 Project 使用不同 preferred spelling，无 Project 时不得读取其他 Project 的词汇。
- **替代方案：** 仅根据 Active Project 静默套用现有 glossary/Skill，或新建完全自由组合的通用 Profile 对象。前者无法覆盖 J2/J4 的临时选择、Re-transcribe 和纠正范围，也缺少可解释 lineage；后者会在高频录音前引入不必要的对象管理。当前采用 Default + Project 三态 + 独立 Topic Vocabulary + one-shot override 的受限模型。
- **已有证据：** 现有 Selection Comment 与 Side Panel 已部分应用 Personal + Project context/glossary；fresh pre-gate 确认 Inline Voice Write 未读取 Active Project。权威 V2 §9、J2、J4 与最新完整性审查进一步确认：只做自动解析会遗漏 picker、语言、独立 Topic、Re-transcribe 和纠正记忆范围，不能作为完整交付。当前真实 `.logue-data` 已显式迁移到 Default/Project Profile schema；迁移前 settings/projects 备份在 `/Users/yadong/dev2/logue-data-backups/voice-profile-schema-2026-08-05`。真实 Host 已返回 `Logue · Customized`、合并后的 Personal/Project vocabulary、language、Skill 与 Project context。独立 Topic runtime gate 进一步确认：临时关闭 Logue Project Profile 后，结果只含 Default vocabulary + 选中的 `Northstar` Topic，Project 专属 `Context/Glossary` 未泄漏；一次性 English 与 frozen Skill revision/instructions 同时解析，临时 Topic 已删除。Re-transcribe schema 更新前的真实数据备份在 `/Users/yadong/dev2/logue-data-backups/transcript-revisions-2026-08-05`；63 个现有 Voice Material 已一次性建立 r1。真实 Host `http://127.0.0.1:8787` 使用 storage root `/Users/yadong/dev2/logue/.logue-data`，测试 Material `mat_06a1cfa8eb48d70d` 已从同一 `cap_98ee230a51c4592e` 生成 English r2，冻结 `Logue · Customized / Accurate transcription r2`，而最终 content、Project membership、排除/保存规则、标签、organization 与原始 audio 全部不变。纠正记忆范围仍在实现中。
- **开放问题：** 无产品范围开放项；实现可拆成原子批次，但 1–7 全部属于本次 V2 完整交付。
