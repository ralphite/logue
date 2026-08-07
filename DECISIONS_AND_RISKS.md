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

### DR-053 — 生产 UI 直接生产化 V2 mock，不再把 V2 能力接入 V1 界面

- **优先级：** V2 产品 / P0
- **状态：** 生产挂载已替换为 V2-only；全部功能完成后统一验证
- **决定：** `apps/web/src/v2-mock/` 与 `stories/v2/` 中已审查的 Extension、Side Panel、Web App 结构、对象语言、阅读轴、层级与交互是生产 UI 的直接来源。现有生产 `NavRail`、旧 `App` 页面编排、旧 `SidePanelView`、旧组织入口、旧卡片/列表语言和其局部 CSS 不再作为 V2 容器，也不得通过换色或包裹继续保留。生产实现将真实 Host/API 与本机状态接到 V2 组件合同；当前 Goal 已确认的 `Projects / Library / Documents / Skills / Settings` 使用 V2 Shell 呈现。Web 左侧栏以 2026-08-05 当前真实 chatgpt.com 的约 260px 安静导航为直接层级基准：顶部产品与 Search/折叠动作、一级任务入口、低噪音选中态、底部本机入口；Logue 不复制 ChatGPT 的 Chat/Work 对象，也不引入账号。V1 仅允许保留不可见且符合 V2 的工程原语，例如 recorder/permission bridge、resizer、稳定 request ID、本地持久化、citation/undo transaction 与 installer rollback。
- **用户可见影响：** 用户只会看到一套 V2 产品，不再在不同页面或表面遭遇 V1/V2 两套导航、密度、术语和操作顺序；离线 pending、Profile、Context、Skills 等新能力必须在 V2 的渐进界面中表达，而不是继续堆入旧 Side Panel。
- **替代方案：** 在旧生产组件中逐项补 V2 功能，或先用 V2 Shell 包住旧页面。两者都会保留用户已拒绝的 IA 和交互，并造成长期双设计系统，因此拒绝。
- **已有证据：** 用户在 2026-08-05 直接指出当前实现仍在使用 V1 design/features，并要求删除 V1、构建 V2；随后明确指定 Web 左侧栏采用 chatgpt.com 设计。当前登录 Chrome 的真实 ChatGPT 首页已只读捕获，确认 260px 左栏、44px 顶部产品轴、36px 安静行级导航、单一浅灰选中态与底部账户槽；Logue 只复用信息层级和密度，不复用账号或产品对象。代码现状也显示真实 Web 仍从旧 `App.tsx` 编排 `NavRail/ProjectPage/GenerationWorkspace`，真实 Extension Side Panel 仍从旧 `sidePanelView.tsx` 扩展新功能，而 V2 mock 已有独立 `LogueWebApp/ProjectShell/SidePanel/ExtensionSurface` 与共享 V2 tokens。
- **开放问题：** 无需用户再次选择视觉方向；功能未完整前不做全面视觉 QA。旧文件中仍有未挂载的工程逻辑，后续按功能迁入 V2 后删除，不能重新进入 mounted tree。

### DR-054 — Ask / Draft 先产生可编辑 Candidate，只有明确采用才物化长期结果

- **优先级：** V2 产品 / P0
- **状态：** 实现中；全部功能完成且 UX 通过审查后统一验证
- **决定：** Project Ask / Draft 统一创建冻结实际 Source snapshots 的 Run 和可编辑 Candidate；Host 不再因 Skill 的 output 类型而在运行成功时自动创建 Document 或 AI Source。用户明确 `Copy`、`Save as document`、`Keep in Logue` 或真实 `Insert` 后才记录 adopted output，并在需要长期对象时物化对应 Document / AI Source。Project composer 必须允许用户查看实际 Context、Pin 关键 Source、排除不相关 Source，再运行；未采用 Candidate 只保留在 Activity，不进入 Project Context。Voice Write 永不参与后台自动加入；非用户 AI output 也不进行自动分类，避免 Context 自我污染。
- **用户可见影响：** 生成不会悄悄制造文档或污染 Project；用户能在采用前核验并调整来源，采用后的 Document、Copy 或 Insert 又能返回本次冻结的 Web / You / AI 具体来源。
- **替代方案：** 保留 `output=document` 即自动创建 Document，或把 Project 全部 Sources 无选择地塞进每次 Run。前者制造未采用内容，后者降低相关性并让引用选择不可解释。
- **已有证据：** 权威 V2 §10.10 与 J6 明确要求 Candidate、实际 Sources、Pin/Exclude、编辑、采用与 citation 回跳；fresh Goal Supervisor 也把 `Project Context → Ask/Draft → adopted result` 判为当前最高 ROI。当前 Host 会对 document/material output 自动物化，真实 V2 Project Route 也没有本次 Context review，因此合同尚未闭合。
- **开放问题：** 当前先连接 Project Web 的完整闭环与共享 Host 语义；外部 target 的 Extension Insert/Undo 复用同一 Run/adoption 合同，在后续 J6 跨表面批次闭合。

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
- **状态：** Saved content content-first 已完成并通过真实运行时验证；All activity 随完整产品统一验收
- **决定：** Library 的一级视图固定为 `Saved content` 与 `All activity`。前者展示永久 Web/You/AI Source 和 Comment bundle；后者展示 Voice Command、Skill Run、失败/完成状态、adopted output 与本次 Run 冻结的 Source snapshots。Run prompt 与失败 Candidate 不自动进入 Project Context，但始终可从 Activity 恢复和核验。Saved content 不使用 `Content / Project / Source / Date` 固定列的数据表；采用 content-first list，以内容/摘要为主阅读轴，Project、来源、状态、时间作为弱化的行内 metadata，可按时间或来源分组，点击进入可调整的详情面板。
- **用户可见影响：** 用户不会把一次命令误认为长期知识，也不会因为结果尚未采用就失去原始活动；打开 Run 可看到当时真正使用的来源，而不是后来变化的 Project 当前内容。
- **替代方案：** 将 Source、Comment、Command、Run 和 Candidate 平铺在同一列表，或只保留成功生成结果。前者破坏对象理解，后者丢失失败恢复与证据链。
- **已有证据：** V2 产品合同明确区分永久 Library、Project Context 和 Activity/Run；真实 Host 已保存 frozen source snapshots。2026-08-05 在 `http://127.0.0.1:5173/?view=stream`、Host `127.0.0.1:8787` 与 storage root `/Users/yadong/dev2/logue/.logue-data` 上完成窄门：现有 Comment bundle 与普通 Saved content 均按时间分组为单一 content-first 条目；搜索可找到两类内容，点击打开共享的可调宽详情；页面 reload 与显式使用同一 storage root 的 Host restart 后内容和详情路径保持可用，页面无相关 console error。fresh read-only `logue_product_designer` 与当前 Notion 同视口对照后给出 PASS 9.1/10，无 P0/P1。
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
- **状态：** 已实现；全产品功能完成后统一做跨表面 QA
- **决定：** `Default voice profile` 包含 Global Transcription Skill、Personal context/vocabulary、primary language 与 mixed languages。每个 Project 的 Transcription Profile 有 `Inherited / Customized / Disabled` 三态；Customized 只保存相对 Global 的 override/delta，可设置语言、people/company/product/place、acronym/preferred spelling、custom instructions 与 Project Skill override；Remember for Project 只追加/替换这一条 preferred spelling，不复制当时完整 Global Profile，因此 Global 其他字段的后续更新仍会继承。Topic Vocabulary 是用户确认的独立词汇集合，只向本次转写提供词汇，不携带 Topic Sources、也不授予 Project Context。录音前轻量展示当前解析后的 Profile，并通过渐进 picker 允许显式选择另一个 Project Profile、Disabled/Default、一次性语言或一个 Topic Vocabulary；日常录音不弹完整设置。Inline Voice Write 在录音开始时冻结同-tab Active Project，Host 解析并冻结实际 Skill/Profile/Topic lineage；Active Project 只产生 provenance 与 Suggested membership，不自动进入 Project Context。每个含原始录音的 Source 使用独立 `transcript-revisions` 不可变快照；新转写只推进 `transcript_revision`、`transcript` 与 `applied_context`，用户编辑后的 `content` 以及 `projects / excluded_projects / saved_only_projects / tags / organization` 均不改变。Extension Voice Write Candidate、Side Panel、Google Docs 与 Web history/recovery 必须复用同一 Host 合同；Candidate 可直接从同一原音输入术语纠正、选择四级记忆范围并生成新 revision，不要求先打开 Web App。
- **用户可见影响：** 用户在高频路径中始终知道 Logue 当前会怎样理解语音，又不需要每次配置；需要时可在录音前局部覆盖。切换 Profile/Topic 后可从同一原始音频生成新的 transcript revision，旧 transcript、raw/original audio 与每版实际 lineage 永久保留，Source membership 不变。术语纠正可选择 `Only this time / Remember for Topic / Project / Global`；同一术语可在不同 Project 使用不同 preferred spelling，无 Project 时不得读取其他 Project 的词汇。
- **替代方案：** 仅根据 Active Project 静默套用现有 glossary/Skill，或新建完全自由组合的通用 Profile 对象。前者无法覆盖 J2/J4 的临时选择、Re-transcribe 和纠正范围，也缺少可解释 lineage；后者会在高频录音前引入不必要的对象管理。当前采用 Default + Project 三态 + 独立 Topic Vocabulary + one-shot override 的受限模型。
- **已有证据：** 现有 Selection Comment 与 Side Panel 已部分应用 Personal + Project context/glossary；fresh pre-gate 确认 Inline Voice Write 未读取 Active Project。权威 V2 §9、J2、J4 与最新完整性审查进一步确认：只做自动解析会遗漏 picker、语言、独立 Topic、Re-transcribe 和纠正记忆范围，不能作为完整交付。当前真实 `.logue-data` 已显式迁移到 Default/Project Profile schema；迁移前 settings/projects 备份在 `/Users/yadong/dev2/logue-data-backups/voice-profile-schema-2026-08-05`。真实 Host 已返回 `Logue · Customized`、合并后的 Personal/Project vocabulary、language、Skill 与 Project context。独立 Topic runtime gate 进一步确认：临时关闭 Logue Project Profile 后，结果只含 Default vocabulary + 选中的 `Northstar` Topic，Project 专属 `Context/Glossary` 未泄漏；一次性 English 与 frozen Skill revision/instructions 同时解析，临时 Topic 已删除。Re-transcribe schema 更新前的真实数据备份在 `/Users/yadong/dev2/logue-data-backups/transcript-revisions-2026-08-05`；63 个现有 Voice Material 已一次性建立 r1。真实 Host `http://127.0.0.1:8787` 使用 storage root `/Users/yadong/dev2/logue/.logue-data`，测试 Material `mat_06a1cfa8eb48d70d` 已从同一 `cap_98ee230a51c4592e` 生成 English r2，冻结 `Logue · Customized / Accurate transcription r2`，而最终 content、Project membership、排除/保存规则、标签、organization 与原始 audio 全部不变。2026-08-05 当前真实安装 Extension 进一步完成同一原音的 `Only this time / Topic / Project A / Project B / Global` 四级纠正；Default 与 Disabled 均未读取 Project 词汇，Project delta 在 Global language 更新后继续继承，Candidate 可直接 Insert/Undo，Host restart 后十个 transcript revisions 仍共享同一 capture，原始 audio hash 与 Source membership 未改变。审计副本在 `/Users/yadong/dev2/logue-data-backups/dr049-voice-candidate-2026-08-05`；QA Source、Topic 和临时 corrections 已从用户 Library 清理。
- **开放问题：** 不再扩展本条测试；Google Docs、Side Panel 与完整错误矩阵随全产品功能完成后的统一 QA 复核。

### DR-050 — 生成结果只有在用户采用后才成为 Document，并保留本次冻结来源

- **优先级：** V2 产品 / P0
- **状态：** 实现中；全部功能完成并通过 UX 验收后统一验证
- **决定：** Ask/Draft Run 默认保留为可编辑 Candidate。用户可直接 Copy，或选择 `Save as document`；保存通过一个可重试的 Host adoption 动作完成，以 Run ID 派生稳定 Document ID，避免“Document 已创建但 Run 未关联”的半成功。Document 使用用户编辑后的正文，把可编辑的行内 `source_ids` 与不可被普通编辑悄悄删除的 `context_source_ids` 分开：前者只跟随仍存在的 citation，后者冻结该 Run 实际使用的全部 Sources，并随每个 Document revision 保存。Document ID 与 adopted output 一起回写 Run；Run 和 Document 均可直接返回对应 Library Source。Skill 的 output 类型只决定推荐采用动作，不再在运行成功时自动物化长期对象。
- **用户可见影响：** 用户不需要先理解 Run 才能把结果继续写成文档；以后打开 Activity、Document 或 citation 都能核验当时真实使用的资料，Project 后续变化不会改写历史。
- **替代方案：** 每次生成都自动创建 Document，或只允许 Copy。前者制造大量未采用内容，后者切断 Draft → Document → frozen citation 的核心闭环。
- **已有证据：** Host 已保存 Run 的 frozen Source snapshots，Document 已支持 frozen `source_ids` 与 revision；当前通用 Run UI 只有 Copy，非 Document Skill 无法物化为可继续编辑的真实 Document。
- **开放问题：** 本批只闭合真实保存与来源回跳；完整 Activity/Run、错误恢复和视觉审查按用户要求推迟到所有功能实现后。

### DR-051 — Provider readiness 只阻断 Voice/AI 动作，不阻断本地数据产品

- **优先级：** V2 产品 / P0
- **状态：** 实现中；全部功能完成并通过 UX 验收后统一验证
- **决定：** `local-first` 只描述 Logue Host、私人数据、原音、Source 和控制权的归属，不代表在用户设备下载或运行 AI 模型。Logue 不提供 Local Model、模型下载、模型进程或本地 runtime 管理。Host 只保存用户选择的远程 provider 连接；当前 UI 提供 Gemini 与远程 OpenAI-compatible endpoint，用户填写 endpoint/model/API key，先 Test，再保存。密钥只写入当前 Logue 数据目录的受限文件，不进入 Export、浏览器存储、Project 或 Source。Provider 未 Ready 时仍可进入五个 V2 一级入口，浏览和管理本地 Projects、Library、Documents、Skills 与数据控制；只有 Ask、Draft、Skills 执行和语音转写显示局部恢复并引导到 Settings → Models。
- **用户可见影响：** 新安装或 provider 故障不会锁住用户自己的本地资料；需要 Voice/AI 时才连接已有模型服务，不会看到下载模型、硬件要求或本地模型状态。
- **替代方案：** 继续要求用户手动设置进程环境变量，或把模型配置做成云账号。前者不是完整产品 Journey，后者违反 local-first、single-owner、无账号边界。
- **已有证据：** 用户明确指出 Logue 是 local product、没有账号、本地数据浏览不能依赖模型连接；V2 的 Model-not-ready 合同要求局部可恢复状态，而不是全屏阻断。Settings 已提供 Test/Save。
- **开放问题：** 后续 provider 扩展必须由真实产品需求驱动；安装器明确不承担模型下载或模型进程管理。

### DR-052 — Stop 后先在 Extension 本地持久化原音，成功进入 Host Library 后才清除

- **优先级：** V2 产品 / P0
- **状态：** 实现中；全部功能完成并通过 UX 验收后统一验证
- **决定：** 所有 Extension Voice Write、Voice Comment 与 Side Panel 录音在 Stop 后、转写前，先以稳定 request ID 将原始音频写入 `chrome.storage.local` 的持久待处理队列；Extension 请求 `unlimitedStorage`，避免正常长录音被默认配额截断。队列同时冻结页面来源、转写 Profile lineage 与最终保存动作；转写成功后立即保存 capture/result，Host Library 幂等保存成功后才删除本地副本。Host 不可用、页面关闭或目标丢失时保留原音和已完成阶段，用户可从 Side Panel 重试；缺失页面计划的孤立录音按原来源恢复为 Saved-only voice note。Cancel 在 recorder Stop 前清理，不写入队列。
- **用户可见影响：** 用户停止录音后即使 Host 离线、页面刷新或浏览器回收 content script，语音也不会消失；恢复连接后可继续转写并永久进入私人 Library，且不会因为重试生成重复 Source。Voice Write 的 Active Project 仍只形成 Suggested membership，不自动进入 Context。
- **替代方案：** 仅在页面 React state 保存 Blob、只保留 Side Panel 的 `lastBlob`，或直接依赖 Host `/v1/transcribe` 的 capture。前两者会随页面、Panel 或浏览器生命周期丢失；后者无法覆盖 Host 在 Stop 时已经离线的情况。IndexedDB 可保存二进制但会引入另一套生命周期与访问层；当前 Extension 已使用 Chrome storage，因此采用每条录音独立 key 的最小直接实现。
- **已有证据：** 当前 Inline/Selection 的原音只存在于 recorder event，Side Panel 只保留内存 `lastBlobRef`；Host 离线、页面关闭或 MV3 回收都会使尚未保存的输入不可恢复，违反“所有用户语音输入永久保存”的产品合同。
- **开放问题：** 队列容量管理、批量操作与详细诊断属于完整功能后的运行时 QA；当前只展示需要用户行动的 pending 状态，不把正常成功和后台组织噪音带入主流程。

### DR-053 — Global Find 是 Library 的搜索状态，Library 同时承担完整内容管理

- **优先级：** V2 产品 / P0
- **状态：** 实现中；所有功能完成后统一做 UX 与运行时验收
- **决定：** 左侧 Search 直接打开 Library 的搜索状态，不新增聊天页或独立技术搜索页。搜索同时使用 Host 的 Source 与 Document 检索，Comment bundle 始终只显示一个结果，并展示匹配原因；结果可以打开原始证据、加入 Project 或用于 Document。Library 的普通浏览继续是 content-first list，并补齐按来源/Project/状态筛选、批量 membership、局部导出与依赖感知删除。`All activity` 打开真实 Activity/Run，可恢复未采用 Candidate、Retry 失败 Run 或在无 adopted dependency 时删除。
- **用户可见影响：** 用户从任何页面一键找回原话、网页证据或 Document，不需要理解 Source/Run 内部模型；搜索与管理使用同一详情和永久数据语义。
- **替代方案：** 保留仅做前端 substring 的搜索框，或新增独立 Find 页面。前者不能解释语义匹配，后者会重复 Library 的打开、归类和删除能力。
- **已有证据：** 权威 V2 J8 与 §11.2 明确规定 Global Find 打开 Library 结果，且 Library 必须支持 filter、批量 Project membership、export、delete 与 Activity 管理。
- **开放问题：** 排序质量与视觉密度在功能齐全后统一审查；当前先连接所有真实终态。

### DR-054 — 依赖感知删除只移除目标内容，并保留必要 lineage

- **优先级：** V2 产品 / P0 数据安全
- **状态：** Source bundle / Project / Document / Document revision / Run / workspace 统一 preview-fingerprint-terminal state 已静态集成；所有功能完成后统一验收
- **决定：** 删除 Project 前显示受影响的 Source、Document 与 Run 数量。确认后删除该 Project 的 goal、Transcription Profile、Skill overrides 与分类边界；Sources 永久留在私人 Library 并移除该 Project 的 included/excluded/saved-only 状态，Documents 变为 No Project，历史 Run 保留原 Project 名作为 provenance。删除 Source 则采用另一条依赖预览：无依赖时物理删除，有冻结 citation/derived/Run 依赖时清除内容与音频并留下最小 tombstone。删除历史 Document revision 前同样预览精确依赖；没有 Pin revision Source 时物理删除该历史文件，有 Pin 时清除正文与 frozen Sources、只保留 Document ID + revision 的最小 marker。当前 revision 永不可走此入口，当前版与其他 frozen revision 均不改写；Pin revision Source 自身冻结正文并记录精确 Document ID + revision。
- **用户可见影响：** 用户不会因删除一个工作目标而意外丢掉原始输入，也能真正删除敏感 Source 内容而不破坏历史引用。
- **替代方案：** 级联删除全部 Project 内容，或禁止删除任何仍被引用的 Source。前者违背永久私人 Library，后者让数据删除不可完成。
- **已有证据：** V2 J9 要求删除前展示依赖；Source、Project Context、Document revision 与 Run lineage 是不同生命周期。
- **开放问题：** 全面恢复与边界数据组合在功能完成后统一运行时验证。

### DR-055 — 原始转写与 Transcription Skill 结果必须分别永久保存

- **优先级：** V2 产品 / P0 数据完整性
- **状态：** 实现中；所有功能完成后统一验收
- **决定：** 每次语音处理先生成不可编辑的 `raw transcript`，再把该文本交给本次冻结 revision 的 Transcription Skill、Project/Topic Vocabulary 与用户指令生成 `transformed transcript`。Source 的可编辑 `content`、处理结果 `transcript` 和原始识别 `raw_transcript` 分开保存；每次 Re-transcribe revision 同时冻结两者、原始 audio/capture 与实际 Profile/Skill lineage。Voice Write、Voice Comment、Voice Command、Side Panel 和离线 pending retry 使用同一合同。
- **用户可见影响：** 用户可随时核验“模型听到了什么”和“Skill 如何整理”，修改最终文字不会覆盖原始证据；自定义精简、整合或格式化 Skill 不再破坏 source of truth。
- **替代方案：** 继续把 Skill 直接混入音频转写 prompt，只保存一个结果。这样无法区分识别错误与转换错误，也不能从原始输入恢复。
- **已有证据：** fresh Goal Governor 对当前 V2 worktree 的独立审查确认，全栈只有单一 `transcript`，自定义 Transcription Skill 会覆盖不可恢复的原始转写；这直接违反用户对所有原始语音输入永久保存的要求。
- **开放问题：** 现有历史录音没有可重建的 raw transcript 时保持明确缺失，不用当前结果伪造原始证据。

### DR-056 — Local product 使用 Host-owned Extension 配对，不引入用户账号

- **优先级：** V2 产品 / P0 权限边界
- **状态：** 实现中；全部功能完成后统一验收
- **决定：** 同机 Chrome Extension 首次访问本机 Host 时自动获得 device credential；通过 LAN 连接另一台设备时，用户必须先在该 Host 的 Web App 生成 10 分钟有效的一次性 pairing code。Host 只保存 token hash；Extension 在本机 Chrome storage 保存 credential 并对后续请求签名。Settings 展示、重命名和撤销已配对 Extension，不创建 Logue 用户、团队或云账号。
- **用户可见影响：** 单机默认路径保持零配置；需要跨设备时有明确、可撤销的授权，而不是开放 LAN API 或虚构账号体系。
- **替代方案：** 所有本地/LAN 请求无鉴权，或为 local-first 产品引入登录账号。前者暴露私人资料，后者违背当前 single-owner、无账号定位。
- **已有证据：** 用户明确指出本地产品当前没有用户账号，并要求识别不合理的用户管理；V2 同时要求可用 LAN/远程连接。
- **开放问题：** TLS/反向代理属于用户主动暴露 Host 后的部署配置，不进入默认本机路径。

### DR-057 — AI Source 的每次编辑与恢复都创建不可变 revision

- **优先级：** V2 产品 / P0 来源可信度
- **状态：** 实现中；全部功能完成后统一验收
- **决定：** 只有已物化的 AI Source（`derived` 且 actor 不是用户）使用独立 Source revision。每次正文编辑前冻结上一版正文、parent Source IDs、来源标签和 revision；Restore 基于旧版创建更高的新 revision，不覆盖历史。普通 Web/You Source 继续使用各自的原始证据与 transcript revision，不混用 AI revision 模型。
- **用户可见影响：** 用户可编辑、回看和恢复 AI 生成资料，同时精确知道每版基于哪些原始 Sources；恢复不会伪造历史或改变 Project membership。
- **替代方案：** 直接覆盖 AI Source，或把所有 Source 都套入同一 revision 机制。前者破坏生成证据，后者把 Comment、Web capture 和 audio 的不同生命周期混为一谈。
- **已有证据：** V2 产品合同明确要求 AI Source/Document revision 与 frozen citation；Document revision 已独立实现，Library 仍缺 AI Source 的同等结果。
- **开放问题：** revision diff 视觉比较属于功能完整后的 UX 审查，不阻塞查看与恢复。

### DR-058 — V2 功能实现必须以已确认产品合同为范围来源

- **优先级：** V2 产品 / P0
- **状态：** 对齐中；功能完整后统一验证
- **决定：** 新功能不得仅因为技术上可实现、旧代码存在或 `local-first` 等术语可被扩张解释就进入产品。实现前必须能映射到已确认 V2 产品定义或用户最新明确纠正；发生冲突时以用户最新纠正为准并直接重写产品定义的相关章节，避免文档和 UI 同时保留两套含义。本次明确删除所有 Local Model / Download Model / local runtime 产品能力；模型未 Ready 仍是必要状态，但只表示远程 provider 尚未连接或连接失败。
- **用户可见影响：** Setup、Settings、错误状态和安装流程只呈现 Logue 实际支持的能力，不会把基础设施选项冒充产品功能，也不会因实现期追求“完整”而继续扩张范围。
- **替代方案：** 保留本地模型为 Advanced 选项，或只隐藏 UI 而保留产品合同。两者都会继续制造错误范围和后续实现负担。
- **已有证据：** 用户明确指出 Logue 不使用本地模型，并要求实现严格遵循已有产品设计；当前 Setup、Settings、mock 与 DR-051 已错误加入本地模型路径。
- **开放问题：** 无；远程 provider 的具体支持列表在现有模型连接合同内演进。

### DR-059 — Side Panel 高级语音 Comment 先保存为 Unlinked You Comment

- **优先级：** V2 产品 / P0 数据完整性
- **状态：** 实现中；全部功能完成后统一验收
- **决定：** Side Panel 的 Page/Selection Voice Comment 在 Stop 后先永久保存原音、raw/transformed transcript 与一个无 parent 的 You Comment，不立刻伪造已完成 bundle。Candidate 允许编辑；`Finish comment` 原子创建或复用 Web Source，并把同一 You Comment 链接为 Comment bundle、应用当前 Project/tags。`Delete comment` 删除该未链接 Comment 及其无共享依赖的原音。Inline 选区的两步高频路径继续一次 Accept 原子完成，不增加此高级确认步骤。
- **用户可见影响：** 高级路径中即使用户离开或连接中断，录音也不会丢；界面明确区分“已保存但尚未链接”与完成 Comment，不再把 `Insert` 错当成页面批注终态。
- **替代方案：** Stop 时直接创建 bundle，或重新创建第二条 annotation 后删除临时 Source。前者无法提供明确 Finish/Delete，后者会复制 capture 与 lineage。
- **已有证据：** 权威 V2 §8.4 / J3 与用户对渐进披露的明确要求；当前 Side Panel 已提前链接 Comment，却错误展示 Voice Write 的 Insert/Undo。
- **开放问题：** 无；同一 Host link endpoint 同时覆盖 Page 与 Selection，UI 只显示产品语言。

### DR-060 — Project rename 保留边界身份，Archive 不改变 Context

- **优先级：** V2 产品 / P0 数据一致性
- **状态：** 实现中；全部功能完成后统一验收
- **决定：** Project 使用稳定 `id`，rename 原子更新当前 Source membership、Document Project 与 Run Project 引用，不创建第二个同名/旧名 Project；frozen Source snapshots 与历史 revision 正文不改写。Archive 只隐藏日常 Project 选择并保留 Context、Documents、Runs、Profile 与 Skill overrides；Restore 恢复可见。Delete 继续使用 DR-054 的独立边界删除合同。
- **用户可见影响：** 用户可以修改 Project 名称而不丢失资料或产生幽灵 Project，也可收起已结束工作而无需删除私人知识。
- **替代方案：** rename 只改 Project 文件，或 Archive 同时移出所有 Sources。前者会由旧 membership 自动再造重复 Project，后者混淆收起与删除。
- **已有证据：** V2 §10 要求 rename、active/inactive、archive；当前 Host 只改 Project 文件中的名称，已有 Source/Document/Run 仍引用旧名。
- **开放问题：** 无；历史 Run 可继续展示当时 Source snapshots，Project selector 使用当前名称。

### DR-061 — Page/Site Project 关联是 Host-owned 显式规则

- **优先级：** V2 产品 / P0 可预测性
- **状态：** 实现中；全部功能完成后统一验收
- **决定：** `Remember for this page` 与 `Remember for this site` 保存为 Host-owned 规则，引用稳定 Project ID。匹配优先级为 page 高于 site；同 tab 已显式选择 Project 或 No project 时优先于规则，同 tab 导航继续保持。规则只为没有 tab 决定的新页面提供 Active Project，可在 Side Panel 当前页面查看和删除；Archived/Deleted Project 的规则不再应用。
- **用户可见影响：** 用户可以让特定文档或站点自动使用正确 Project，同时始终知道规则从哪里来，也能用 No project 覆盖，不会出现全局“最近 Project”泄漏。
- **替代方案：** 存在 Extension local storage 或静默使用最近 Project。前者违反 Host 权威并难以备份，后者违反 Active Project 可预测性。
- **已有证据：** V2 §8.5 明确要求 tab-scoped Active Project 以及可见、可删除的 page/site 关联规则。
- **开放问题：** 无；一次性多 Project 只影响当次动作，不写规则。

### DR-062 — Page anchor 保留证据快照，重锚只更新定位层

- **优先级：** V2 产品 / Source 可核验性
- **状态：** 三路 fresh gate PASS；静态 production 链已集成，最终 runtime 留到 Phase 5
- **决定：** Selection Source 的 `content` 与初始 `source.selection` 是永久证据快照，Host 拒绝通用 PATCH 改写它们，也拒绝改写已链接 Comment 的 parent identity。独立 anchor 层保存当前 quote、前后文、Anchored / Page changed / Re-anchored / Snapshot only、revision 与历史；每次 mutation 必须携带 expected revision，stale 写入失败，重复 resolve 幂等，只有用户 Re-anchor 冻结旧 anchor 并递增 revision。页面匹配只更新定位状态，不改证据正文；用户选择新文本 Re-anchor 时更新同一 Web Source 的 anchor revision，Comment bundle 的 parent ID 不变。
- **用户可见影响：** 返回原网页时能定位当前证据；网页改变时仍能核验原快照，并可重新选择位置或明确只保留 Snapshot。
- **替代方案：** Re-anchor 直接覆盖 Source 正文，或创建第二个 Web Source。前者破坏 citation 证据，后者拆散 Comment bundle identity。
- **已有证据：** V2 §10.3、§12.4 要求页面变化时保留快照，并支持 `Anchored → Page changed → Re-anchored / Snapshot only`。
- **开放问题：** 无；自动精确匹配只恢复 Anchored，只有用户确认新选区才标 Re-anchored。

### DR-063 — Web Document 通过 Extension-owned 临时 Target Session 发送到外部输入框

- **优先级：** V2 产品 / P0 跨表面采用合同
- **状态：** 三路 fresh gate PASS；静态 production 链已集成，最终 runtime 留到 Phase 5
- **决定：** 可写 Target Session、DOM reference 与 Undo transaction 只存在于实际目标 frame 的 content-script 内存，包含一次性 opaque session ID、document epoch、target identity 与 last-focused time；不写 Chrome storage、Host 或 Project Context。MV3 worker 每次 List/Insert/Undo 都重新向仍存活的 content scripts 查询，不从持久状态恢复 target。Web App 只通过本机 bridge 获取可展示 descriptor（tab/page、domain、field label）与 opaque ID；bridge 每次要求 `event.source === window` 且页面 origin 精确等于 Extension 当前配置的 Logue Host origin，tab/frame/URL 只取 Extension sender 与 Chrome 元数据，不信任 Web payload。Document 默认只显示 Copy；`Choose input…` 渐进打开仍有效 target，用户明确选择后才显示 `Send to …`。发送时 Extension 复验同一 document epoch/session、tab、frame、URL、DOM identity、connected/writable 与不过期状态后 Insert，永不 Submit，并返回单次 Undo token；Undo 仅在内容仍等于该次写入结果时成功，不能覆盖后续用户编辑。未安装 Extension、没有 target 或用户未选择时只提供 Copy；session 失效或 Insert 失败时保留 Document，清除旧选择，并提供 Copy + `Choose another input…`。
- **用户可见影响：** 用户可从 Web Document 辨认并明确选择此前聚焦的真实输入框，发送后能局部 Undo；页面切换、target 替换或失效后不会显示或执行虚假 Insert，并可直接改选另一个输入框。
- **替代方案：** 由 Host 保存/轮询 target 与插入任务，或让 Web 自动选择最近 target。Host 无法验证 DOM 实体且会制造陈旧持久状态；自动选择违反 V2 §8.6 的显式选择要求。
- **已有证据：** V2 §8.6、§10.11、§12.5 与 §14 明确要求 Web 仅对用户选择的有效 Extension target 提供 Send/Insert，无 target 只 Copy，Insert 不 Submit，Undo 局部，失败后可重新选择目标。
- **开放问题：** 无；这是 local single-owner 的短生命周期浏览器控制面，不新增用户账号、云同步或 Host 数据对象。

### DR-064 — 分类纠正保存为 Source-linked Classification memory，而不是隐藏的全局规则

- **优先级：** V2 产品 / P0 可预测性
- **状态：** 修订合同三路 fresh gate PASS；bundle 更新、Forget 与 Delete 失败路径原子性已静态接通，最终 runtime 留到 Phase 5
- **决定：** 用户 Add、Remove、Exclude 或 Undo exclusion 后，当前 Source membership 继续按 DR-047 立即生效；同时把最终结果作为该 Source 上可见的 `Classification memory`。Memory 按 Project 明确记录 `Added / Saved only / Excluded`，并保留原建议、内容摘要与时间；tags 只作为解释该示例的上下文，不作为自动打 tag 的规则。它只是后续 Organization Skill 的高优先级相似示例，本身不授予 auto-include：没有 tab-scoped active Project 或用户另外授权的 auto-include rule 时，后续 Source 最多进入 Suggested。Comment bundle 的 Web/You members 共享一个 bundle root 和一条 memory，Host 向模型传递前按 root 去重。
- **用户可见影响：** Project settings 的 `Classification memory` 显示这次纠正涉及的全部 Projects 与各自终态。删除动作命名为 `Forget learning example`，跨 Project 时先列出完整影响范围，并紧邻说明：`Stops using this example for future suggestions. This Source stays Added, Saved only, or Excluded; its Projects and exclusions do not change.` Forget 只清除 bundle 全部 members 的学习子状态，不调用通用 membership 更新、不触发重新组织，也不改变永久 exclusion。删除 Source/Comment bundle 时 memory 随 Source 删除，不留下内容摘要。
- **替代方案：** 新建独立全局 rules 数据模型；或继续把最近 20 条 `user_correction` 隐藏地塞入模型 prompt。独立规则需要额外定义匹配条件且容易制造错误自动化；隐藏反馈已存在但不可解释、不可删除，正是当前缺口。
- **已有证据：** V2 §9/§10 要求自动分类可纠正且用户纠正永久优先；当前 Host 已把 Source 的 `organization.user_correction` 作为模型 examples，但生产 UI 无法查看或删除，Comment bundle 还可能重复提供同一纠正。
- **实施合同：** `organization.user_correction` 是持久子状态，普通重新组织与 `complete_organization` 不得覆盖；只有明确 Forget 或 Source 删除可清除。Host 在锁内按 bundle root 清除全部 member 的 memory，并保持 `projects / saved_only_projects / excluded_projects` 原值与互斥。`saved_only_projects` 仍允许未来在用户授权的 auto-include rule 下重新归类，只有 `excluded_projects` 永久阻止同一 Source 重新加入，继续服从 DR-047。
- **已有 gate 结论：** 首轮 scope/product/engineering 均 REPLAN：补全 per-Project Saved only 终态与 auto-include 边界；明确 tags 不自动学习；跨 Project Forget 展示完整影响；Host 保持 correction 子状态、bundle 原子清除且不触碰 membership。上述要求已并入本修订。
- **fresh gate 结论：** scope、product/UX、engineering/runtime 三路均 PASS，无 P0/P1。确认 per-Project outcomes、auto-include 授权边界、跨 Project Forget 说明、bundle 去重与 Host membership 不变量完整。
- **开放问题：** 无；当前仅实现 Source-linked learning example，不扩展自动规则类型。

### DR-065 — 最近工作位置是本机浏览器状态，不是 Source 或 Project Context

- **优先级：** V2 产品 / P1 工作连续性
- **状态：** 静态 production 链已集成；最终跨会话运行时验证留到 Phase 5
- **决定：** Web App 在当前浏览器保存最近 Project、Project 子视图、Ask/Compare/Draft 模式、最近 Document，以及每个 Document 的 caret/scroll。该状态只用于恢复单 owner 的界面位置，不进入 Source、Project Context、Run、导出或备份，也不参与分类和模型 Context。
- **用户可见影响：** 用户离开再回来时直接回到最近工作位置；清除浏览器站点数据只重置界面位置，不删除 Host 中的任何永久资料。
- **替代方案：** 把短生命周期 UI 位置写入 Host settings。这样会把设备/浏览器特定的 caret 与 scroll 混入可备份知识数据，并让另一浏览器继承不合适的位置。
- **已有证据：** V2-PROJ-03 与 V2-DOC-02 要求恢复最近工作和编辑位置；当前产品是 local-first、single-owner，但 Host 仍只拥有永久产品对象。
- **开放问题：** 无；多设备同步不在当前无账号产品范围。

### DR-066 — Export 的 All saved data、Library 与 Project 是三种明确数据边界

- **优先级：** V2 产品 / P0 数据可携带性
- **状态：** 修订合同已通过 scope / product / engineering 三路 fresh gate；Host/API/V2 Settings/Project 静态 production 链已集成，最终 runtime 留到 Phase 5
- **决定：** `Backup` 是 Host 管理、可由 Logue Restore 的原样运行快照；`Export` 是用户下载的逻辑可携带 JSON 包，不包含 paired clients 等 Host-bound 运行状态，也不承诺可 Restore。Export 有三个显式 scope：
  - `All saved data`：跨当前 Host 的全部 Saved content、Documents、Projects、非敏感 Settings、Skills、Topic Vocabularies、Topics 及 adopted lineage；
  - `Library`：全部永久 Saved Sources 与 Source/item/transcript revisions；不包含 Documents、Projects、Settings、Skills、Topic Vocabularies 或 Topics；
  - `Project`：用稳定 Project ID 选择一个 Project；selection builder 在同一 Host lock 内把 ID 解析成当前名称，并在 manifest 冻结 ID + name，只包含该 Project 对象、当前 Context Sources 及 revisions、该 Project Documents 及 revisions，以及这些已采用对象所必需的 lineage，不做全库 Project-ID migration。
  三种 scope 默认只含 Saved content 与 adopted lineage。用户语言的 `Include activity history and unused AI drafts` 明确加入 scope 内的永久 Activity Sources 与未采用 Runs：Library/All 覆盖相应全量 Activity；Project 只覆盖同一锁内解析后 `run.project` 等于所选 Project 当前名称的 Activity/Run，不能因为 Run 引用了一个共享 Source 就扩权。默认 adopted lineage 从已纳入的 AI Sources/Documents 对应 Run 开始，只递归纳入其 retry/continue ancestors 与各自 Activity Source；关闭该选项时，与采用结果无关的 Activity/Run 不导出。Run 的 frozen Source snapshots 已自包含；它们不能反向授权导出当前 Source、其 revisions 或其他 Project。
  Export 使用 per-scope 对象/字段白名单而不是直接序列化 Store。Project scope 中共享 Source 只保留内容、证据字段、所选 Project membership 与本次 adopted lineage；`projects / saved_only_projects / excluded_projects`、Classification memory、suggestions、audio context、transcript `applied_context` 和 frozen `sources[].projects` 都过滤到所选 Project，且移除 personal/global instructions、vocabulary 与其他 Project 名称。Run 可保留精确 frozen evidence content、Skill ID/name/revision、用户 instruction 与 output 来核验采用结果，但移除全局 Skill instructions 和其他 Project 关系。直接或传递引用只有目标也在包内时保留；scope 外引用改为无内容的最小 lineage tombstone（ID、对象类型、`outside export scope`），不能留下悬空 ID 或借 tombstone 泄漏名称/内容。Library 保留所选 Source 自身的完整证据/转写 lineage；All saved data 额外保留非敏感 workspace 配置。三种 Export 都排除 provider API keys、provider credential file、pairing tokens/client records 与其他 Host secrets。
  `Include original audio` 默认开启，只控制已选 Source/Activity 的 audio binary 与必要 sidecar；关闭后包仍保留文字与 lineage，但不是无损资料包，更不是 Backup。Backup 保留当前 Host 运行快照，可能包含 provider 凭据与 pairing state，只保存在本机并可 Restore；Export 不可 Restore，UI 必须明确提示这一安全边界。
  Preview 与 Download 复用同一套锁内 selection builder：Preview 返回 scope、所有对象类型的 count、options、敏感数据排除提示、`Original audio: Included/Excluded`、预计包大小与内容 fingerprint。Fingerprint 只覆盖当前 scope/options 实际选中的安全投影，不受 scope 外后台变化影响。Download 必须提交该 fingerprint；若选中投影已变化，Host 返回更新后的 Preview，UI 就地替换范围摘要并让用户一次点击继续，不能下载与用户刚确认范围不同的包。
- **用户可见影响：** 用户能区分 Host Backup、跨工作区 Saved data 下载、私人 Library 包与单个 Project 交付包；下载前能看见 Sources、Activity、Documents、Projects、Runs、Settings、Skills、Topic Vocabularies、Topics 与 recordings 的真实数量，且明确知道 Activity、audio 与凭据是否包含。
- **替代方案：** 继续用空 Project 参数同时代表 All data 与 Library，或让 Library 导出包含所有 Settings/Skills。前者范围含糊，后者会把系统配置和知识资料混在一起。
- **已有证据：** 权威 V2 J9 与 V2-SET-07 明确要求 Export Project / Library / all local data、include audio 与执行前 preview；Backup/Restore 已是独立完整恢复路径。
- **首轮 gate 结论：** scope 与 product 均指出 Library/Project 不能无条件排除或纳入 Activity/Runs，必须闭合 V2-SET-08；product 还要求 Preview 显示配置类对象并区分 Export/Backup；engineering 指出无 audio 的 Export 不可声称完整 Restore、跨 Project Run 会泄漏关系、对象闭包与 Preview/Download 一致性未定义。上述要求已并入本修订。
- **第二轮 gate 结论：** scope PASS；product 要求避免 `All local data`/audio 默认值误导、改用用户语言并明确凭据边界；engineering 要求稳定 Project ID 在当前 name-backed schema 中可解析、定义安全投影与直接/传递 lineage 闭包。上述要求已并入本修订。
- **第三轮 gate 结论：** scope/engineering PASS；product 要求固定 audio 默认值、显示 Included/Excluded 与预计大小，并把 fingerprint 限定到实际导出投影且提供低摩擦的失效恢复。上述要求已并入本修订。
- **最终 fresh gate：** scope、product/UX、engineering/runtime 三路均 PASS，无 P0/P1。
- **开放问题：** 无；V2-SET-07 与 V2-SET-08 在同一实现批次闭合，不能再把 Activity 选项推迟为未来项。

### DR-067 — Topic 关系与建议只提供发现，用户确认后才改变 Context 或 Vocabulary

- **优先级：** V2 产品 / PKM 完整性
- **状态：** Host/API/Web 静态 production 链已集成；所有功能完成后统一验收
- **决定：** Topic 对 Comment bundle 只使用一个 root Source；显示 exact duplicate-linked 与需要用户复核的 conflict / supplement 关系。Project suggestion 只列出尚未加入且未被 Exclude 的 Sources，用户点击明确的 Add 后才以 bundle 为单位进入该 Project Context，跨 Source 写入失败整体回滚。Vocabulary suggestion 只来自同 Topic 多个 Sources 的重复确认 tag/术语；用户必须选择 `This Topic / Project / Global` 后才写入对应的独立 Topic Vocabulary、Project delta 或 Global profile。Topic 本身不携带 Sources 给转写模型，不自动建 Project，也不自动写 Vocabulary。
- **用户可见影响：** 用户能看出同一主题内哪些资料重复、可能冲突或互补，并在一个地方决定是否把资料加入 Project、把词记到哪个作用域；仅浏览 Topic 不会改变任何 Context 或转写结果。
- **替代方案：** 打开 Topic 就自动加入最可能的 Project，或把重复术语同时复制到 Topic/Project/Global。两者都会把发现层变成隐式权限与跨 Project 污染源。
- **已有证据：** 权威 V2 §6.5、§9.3/9.7、§10.8 明确规定 Topic 是动态发现层，负责关系、Project 与 Vocabulary 建议，但所有 Context/Vocabulary 影响必须由用户确认。
- **开放问题：** conflict/supplement 的排序质量在 Phase 3 UX review 统一评估；Phase 1 只闭合完整对象、动作与不可越权边界。

### DR-068 — logue.ai 是产品入口，不是账号或云工作区

- **优先级：** V2 产品 / 安装与公开边界
- **状态：** production Web route 与真实 release/docs 链已静态集成；部署与安装验收留到 Phase 5
- **决定：** 同一 production Web bundle 在 `logue.ai` / `www.logue.ai` 显示公开 Landing，本机 Host 继续直接进入 V2 Projects；本地可用 `?view=landing` 复现公开入口。Download 指向当前 GitHub Release 的真实 universal artifact，Install guide 提供当前 checksum installer 与 Extension-only installer，Docs/Privacy/License 都是 Landing 内可直接打开的明确 section。公开页面不引入账号、Logue cloud sync、团队 SaaS 或本地 AI 模型；远程 AI 明确由用户配置的本地 Host 直接调用。用户尚未决定开源模式，因此 License 只诚实显示“尚未选择”，本批不擅自授予或承诺开源许可证。
- **用户可见影响：** 访问 logue.ai 的新用户能理解 Logue 的 local-first 定位并拿到真实安装路径；访问本机 Host 的已有用户不会先经过营销页，也不会看到虚构的登录或云套餐。
- **替代方案：** 把 Landing 只留在 Storybook，或让本机 Host 每次先显示官网。前者没有真实产品入口，后者会阻断高频本地工作流。
- **已有证据：** 用户明确产品名为 Logue、官网为 logue.ai、产品 local-first / single-owner / 无账号，且开源方向尚未决定；V2-OPS-07 要求真实下载、安装、隐私与许可证入口。
- **开放问题：** 最终域名部署、release asset 与 installer 安装验收属于 Phase 5，不在功能构建阶段运行。

### DR-069 — Backup / Restore 使用 Host 管理的完整快照

- **优先级：** V2 产品 / P0 数据可恢复性
- **状态：** 最终 scope / product / engineering 三路 fresh gate 均 PASS；Host/API/Web production chain 已静态集成，真实数据 Restore 与 Host 迁移验收留到 Phase 5
- **决定：** `Back up now` 由 Logue Host 在 data root 同级目录创建完整 snapshot，包含恢复 Host 工作区所需的 Sources、audio、Documents、Projects、Runs、Skills、Settings、Host 持久化 provider credential 与当时的 paired Extension state。Host 为 snapshot 写入当前唯一 schema marker，并只向客户端暴露 opaque `snapshot_id` 与可读 metadata；Settings → Backup 以内容列表显示当前 Host 可恢复的 snapshots，不暴露或接收任意文件系统路径。

  为闭合 V2 §10.14 的 Host 迁移，用户可以从 snapshot 下载由 Logue 生成的完整 `.logue-backup` 包，并在另一台 Logue Host 上传迁入。迁入先写 staging；Host 只允许当前 schema 白名单下的相对路径与普通文件，拒绝绝对路径、`..`、symlink、设备/管道等非普通文件，并核对 JSON filename 与对象 ID、marker、必需目录和 JSON 可读性，之后才登记为新的 Host-managed snapshot，绝不直接覆盖 live data。逻辑知识 `Export` 继续是按范围生成、排除 Host secrets、不可 Restore 的投影，但仍可能包含私人内容与默认开启的原始录音；它不是自动脱敏或天然适合分享的文件。完整 Backup 包可能包含录音、Host 持久化凭据和 pairing state，下载前必须明确提示它是敏感文件。环境变量等 data root 外部 credential 不进入 Backup，Restore 后保持当前 Host 环境值。

  用户选择一个已列出的 snapshot 后，确认界面必须显示 snapshot 时间与来源 Host，并明确说明：Restore 会整体替换 live workspace 和 Host 持久化 provider credential / pairing state；当前状态会先自动备份；data root 外的环境凭据保持不变。确认后，Host 先把待恢复内容复制到 staging 并完整校验，再进入独占 workspace barrier。这个 barrier / generation 同样覆盖 `Back up now`、所有 live-root 读写、已在途请求和后台组织线程的最终写入；旧 generation 在恢复后不得落盘。在同一 barrier 内创建 Restore 前 backup，并以可回滚 swap 替换 data root，失败时恢复原 live root 且不暴露半恢复状态。成功后清理易失 request/cancellation state，并从已恢复数据重新加载 provider/runtime state。恢复结果精确回到 snapshot 的 Host 持久化 credential 与 pairing state，不与当前 clients 合并。

  Host 只解析由当前 Logue 生成的 opaque ID：从 `store.root.parent` 推导直接子目录，拒绝 symlink、非目录和越界目标。删除当前没有 producer 的 `schema_version: 2` JSON file upload Restore，不保留历史 schema migration、旧格式解析、任意路径 Restore、云备份或两个 Host 的自动同步/冲突合并。
- **用户可见影响：** 用户能完成 `Back up now → 选择历史快照 → Restore`，也能用 Logue 生成的完整 Backup 包迁移到另一台 Host；Restore 前的当前状态自动保留。界面明确区分可恢复且敏感的 Backup，与按范围导出、排除 Host secrets、不可恢复但仍可能含私人内容/录音的 Export，不再提供永远拿不到兼容文件的虚假上传路径。
- **替代方案：** 只允许当前 Host 的同级 snapshot（无法满足已确认的 Host 迁移）；让 Restore 接受任意本机路径（扩大路径欺骗和文件系统权限）；把逻辑 Export 直接当 Backup（遗漏 audio、credentials、pairing 与完整运行状态，无法真实恢复）。
- **已有证据：** 当前 `POST /v1/backup` 只创建 Host directory snapshot；UI Restore 却要求用户上传 `schema_version: 2` JSON，而产品没有任何 producer 能生成该格式。V2 Export 明确 `restorable: false` 且排除 credentials，所以当前 Restore 是不可完成的虚假路径。首轮 scope gate 指出“仅当前 Host snapshot”会违反 V2 §10.14 的 Backup/Restore 迁移承诺；engineering gate 要求 opaque ID、marker/schema 校验、staging + workspace barrier/generation + 可回滚 swap，以及准确区分 Host 持久化 credential 与环境变量。第二轮 product gate 纠正了 Export 的敏感性表述并补齐 Restore 后果确认；engineering gate 进一步要求 barrier 覆盖所有 live-root 读写与异步最终写入，并对白名单 archive members 做路径、文件类型和 filename/object ID 校验。
- **开放问题：** 无；本合同只支持当前 schema 的 Logue Backup 包，不承诺旧版包兼容。Phase 5 必须用当前数据验证 snapshot、下载/迁入、reload/restart 与失败回滚后再称为运行可用。

### DR-070 — Release 使用单一可核验版本合同且永不接管数据根目录

- **优先级：** V2 产品 / 安装升级与发布
- **状态：** 第五轮 scope / product / engineering PASS；V2-OPS-05/06 已实现并通过阻塞性静态检查，真实安装/升级/rollback 验收留到 Phase 5
- **决定：** 根 package、Web、Extension package、shared UI 与 Chrome manifest `version` 使用同一个 `X.Y.Z` 产品版本。正式 release tag 必须以 `vX.Y.Z` 为基础且与该版本一致；Host `VERSION` 保留完整 tag（允许同一基础版本的 prerelease suffix），Chrome manifest 的数字 `version` 保留基础版本，并用 `version_name` 保存同一完整 release identity。release 构建在打包前验证全部 workspace 版本并写入/核对产物中的 `VERSION`、Extension `version` 与 `version_name`；installer 在停止或切换现有服务前再次验证三者一致，版本不一致时零写入失败。

  Full installer 只管理 `${install_root}/releases`、`current`、稳定 Extension assets、CLI 与启动配置；`LOGUE_DATA_DIR` 及其同级 Host-managed snapshots 永远不进入 release staging、切换、清理或 rollback target。在下载、mkdir、停止服务或任何写入前，installer 用规范化真实路径 fail-closed 检查 data root、现有 snapshots 与所有 managed/staging/rollback targets 是否相互包含或重叠；冲突时保持现状并要求用户选择独立 data root。Linux 新默认 data root 改为 `${XDG_DATA_HOME:-$HOME/.local/share}/logue-data`，不再嵌套于默认 install root `${HOME}/.local/share/logue`。

  唯一例外是本机现存旧受管 Linux 默认目录 `${XDG_DATA_HOME:-$HOME/.local/share}/logue/data` 的一次性显式迁移。installer 必须先只读解析现有 systemd unit 的 `LOGUE_DATA_DIR`；只有它精确指向按当前 XDG 环境解析出的旧默认目录、用户确认迁移、目标不存在且旧目录与其全部同级 Host snapshots 都可识别时，才允许进入专用迁移。停服前的副本只能用于加速，不能作为一致性证据；installer 必须停止旧服务并确认进程退出，再以冻结源重新同步 live data 与完整 sibling snapshot 清单，并校验 workspace marker/schema、每个 snapshot marker/schema 和复制清单后，才把 data、snapshots 与 systemd 配置一起切到新目录。启动/health 任一步失败都恢复旧版本、旧 unit、旧数据路径、原 service active/enabled 状态与旧服务，绝不启动空 workspace。成功后旧 live data 移到新 data root 的同级 migration backup，旧 snapshots 保留为新目录可发现的同级 snapshots；不能明确证明旧安装与全量数据时，installer 零写入失败并给出手动指定 `LOGUE_DATA_DIR` 的恢复方式。该一次性路径只服务当前受支持安装，Phase 5 在本机完成真实迁移后删除迁移代码。除这一个精确旧默认形态外，所有 data/managed path 重叠一律拒绝。程序/Extension/CLI/启动配置任一步失败时恢复上一完整版本与服务；data root 和 snapshots 保持原位。

  Split deployment 不能用两个独立的 `latest` 解析。Linux full installer 完成 Host vX 后必须打印绑定完整 release identity vX 的 Mac Extension 安装命令；独立 Extension installer 接受并下载该明确版本，且验证 `VERSION`、manifest `version` / `version_name` 后才切换磁盘 assets。官网/README 的首次安装可以从 `latest` 解析一次，但 Host 安装结果和后续跨机器 Extension 步骤必须固定在同一 release；只允许 Chrome Reload 前暂时继续运行旧版 Extension。

  独立 Extension installer 继续只在稳定 Extension 目录内追加版本化 assets 并最后原子切 manifest，不触碰 Host 数据。Chrome 首次安装与升级必须明确区分：首次安装报告“Extension vX ready to load”，要求用户在 `chrome://extensions` 选择 `Load unpacked`，加载前 Chrome 没有运行 Logue；已有 Extension 的升级才报告“Extension vX update ready”，要求 `Reload`，Reload 前 Chrome 继续运行旧版/未知版。所有 full macOS installer、独立 Extension installer、README 和官网安装说明都必须准确区分对应状态，不得把磁盘 manifest 已切换表述为浏览器已经更新；首次 Load 或升级 Reload 后，Chrome 才运行 manifest 中完整 `version_name` 对应的 release。
- **用户可见影响：** 用户从官网拿到的 Host、Web 与 Extension assets 来自同一可核验 release；损坏、混版或危险路径 artifact 会在升级前被拒绝。重复运行 installer 只替换程序，失败自动回到上一版，当前 Library、Documents、设置、录音和可恢复 snapshots 不被升级或回滚覆盖。旧 Linux 安装不会静默出现空 workspace。首次安装会清楚显示“Host/Web 已运行、Extension ready to load、Load unpacked 后 Chrome 才开始运行”；升级则显示“Host/Web 已运行、Extension update ready、Reload 后 Chrome 才更新”。
- **替代方案：** 允许 tag、package、Host 与 Extension 各自漂移（无法判断实际运行版本）；把 data root 放进 release 目录一起 rollback（会让程序回滚意外回滚或删除用户资料）；每个平台发布不同包（增加混版和验收面）。
- **已有证据：** 当前 installer 已使用版本化 release 目录、原子 `current`/manifest 切换和失败 rollback；release 包也已包含 Host/Web/Extension，但 `build-release.sh` 仍接受与 workspace/manifest 无关的任意版本参数，installer 只验证 `VERSION` 格式，不验证它与 Extension manifest 一致。首轮 product gate 指出 Chrome 必须 Reload 才实际运行新 Extension，prerelease 需要完整可核验 identity；engineering/product 同时指出可配置 data root 与 managed paths 重叠时现有脚本会破坏“永不接管数据”的承诺。第二轮 product gate 进一步发现 split deployment 两端各取 `latest` 会安装不同 release，并且直接改变 Linux 默认路径会让旧资料看似消失；第三轮 engineering gate 指出停服前复制缺少一致性冻结点，并要求区分首次 `Load unpacked` 与升级 `Reload`。因此合同加入绑定版本命令、停服冻结后的最终同步/清单校验、原 service 状态恢复，以及各安装表面的准确 Chrome 状态。installer fixtures 与 remote smoke 将改为从当前 workspace version 派生同基础版本的 prerelease identity，避免绕过正式版本检查。V2-OPS-05/06 要求把这些原语收敛为单一 V2 artifact/version chain。
- **开放问题：** 无；正式 artifact 的安装、升级和 rollback 运行验收留到 Phase 5，本批只闭合 production 构建/installer 合同与阻塞性静态检查。

### DR-071 — Continue 与 Retry 使用 Run 冻结证据，而不是当前 Library

- **优先级：** V2 Project / frozen lineage
- **状态：** production Web/Host 合同已集成；Web typecheck、Python compile 与单一 frozen-context 窄回归通过，真实本机 History 旅程留到 Phase 5
- **决定：** Continue 直接使用被选择历史 Draft Run 中冻结的 Source snapshots、Project overview、Personal context、Skill revision/instructions 与旧 output；只把本次 instruction 和新的永久 Activity 作为增量。即使某个原始 Source 后来已从当前 Library 删除，Web 也不得用当前 materials 列表过滤其 frozen Source ID，Host 必须继续使用 Run snapshot。Retry 完整复用原 Run 的 model context。持久 `model_context` 的 instruction、selection、target、page、Project、Personal、Skill 与 Sources 必须逐字段等于实际 provider 调用输入。
- **用户可见影响：** 用户可从 History 继续旧 Draft，不会因当前 Library 已删除 Source 而看到提交按钮静默失效；后续 Project、Settings 或 Skill 编辑也不会篡改历史 Run 的生成基础。
- **替代方案：** Continue 重新从当前 Project/Library 检索（会丢失或改变历史证据）；只冻结 Source 正文但继续读取当前 Project/Personal/Skill（持久证据与真实 provider 输入不一致）。
- **已有证据：** Goal Supervisor 检查发现 `V2ProjectRoute` 会把 continuation Source IDs 再按当前 `materials` 过滤，Host 也会为 Continue/Retry 重新读取当前 Project overview、Personal settings 与 Skill。Store 已能从历史 Run snapshots 构造 Sources，因此本批只移除 Web 当前 Library 依赖，并让 Handler 的 model/provider 输入共同复用 frozen context。
- **开放问题：** 旧 Python routes/callers/docs、旧 Web surface 与无 production 入口的 Go Host 清理已冻结并保存在独立 WIP，不进入本批；它们必须拆成后续独立批次。

### DR-072 — 删除绕过 Run / Candidate / adoption 的旧 Python API

- **优先级：** V2 Host / 单一生成合同
- **状态：** scope / product / engineering fresh gate 已 PASS；Python Host/Web callers 与最后一条通用 PATCH 绕行已移除并通过 production consumer 静态核对、Python compile 与 diff check
- **决定：** 删除 Python Host 的 `/v1/docs/generate`、`/v1/project-overview-drafts/*`、`/v1/project-bundles/*`、`/v1/external-agent/import`，以及对应 Web API wrapper、未挂载调用入口、Developer API 文案和陈旧 API 文档。通用 Run PATCH 只保留 `pinned` 等非 lineage metadata，明确拒绝直接写 `adopted_output`、`document_id` 或 `material_id`。Project Ask/Draft 继续使用 Activity → Skill Run → Candidate → 显式 adoption；Project 导出使用 scope-safe Export；当前 V2 不提供 External Agent import。不得保留 alias 或改名后的重复语义。
- **用户可见影响：** 当前挂载 V2 流程不变；未挂载旧 workspace 不再保留可绕过 Run lineage、直接创建 Document/AI Source 或暴露原始 Project bundle 的入口。
- **替代方案：** 保留兼容 alias（违反当前 route/schema 唯一权威）；把旧路径改成 `/v2/*`（仍保留重复对象语义）；在未定义权限/provenance/adoption 前继续公开 external import（扩大未确认范围）。
- **已有证据：** production 挂载链是 `main → App → RealLogueV2App → V2 routes`；`V2ProjectRoute` 已使用 canonical Run/adoption。三路 gate 已确认四条旧 route 只有未挂载 caller/技术按钮，删除不缩减确认 V2 能力。Phase 2 后续静态核对发现通用 `PATCH /v1/skill-runs/:id` 仍能直接重连任意现有 Document/Source，绕过稳定 adoption event；production 唯一 PATCH consumer 只发送 `pinned`，因此可直接收紧而不影响用户流程。Go Host 与 audio fixtures 不进入本批，按 Goal Supervisor 要求保持独立。
- **开放问题：** 无；本批只处理 Python routes、Web callers 与对应文档，Go Host 删除另做下一原子批次。

### DR-073 — Python Host 是唯一 production Host；移除语义冲突的 Go Host

- **优先级：** V2 Host / 单一 runtime
- **状态：** scope / product / engineering fresh gate 已 PASS；Go Host 已移除、fixtures 已迁出，Web typecheck 与 diff check 通过
- **决定：** dev、release artifact、installer、CLI 与 managed service 继续只使用 `python_server/logue_server.py`。删除没有 production build/install/release 入口、且 Skill Run 会隐式物化 Document/Material、缺少 canonical adoption 的 Go `server/`，不维护第二套语义不同的 Host。删除前把仍被 Storybook 与 `scripts/e2e-audio.sh` 使用的三份音频 fixture 迁到中立 `fixtures/audio/` 并更新引用。
- **用户可见影响：** 产品只剩一套可发布、可安装、可核验的 Host 行为；删除 Go 源码不改变当前 Mac/LAN Host、Web、Extension 或本机数据。
- **替代方案：** 把 Go Host 追平完整 V2（维护无 production consumer 的第二实现）；只删四条旧 Go routes（仍保留同路径、不同 Skill Run/adoption 语义的可运行 API）。
- **已有证据：** release 只打包 `python_server/`、Web 与 Extension，`npm run dev:api` 和 installer 只启动 Python Host；repo-wide 调用检查没有 Go build/run 入口。三路 gate 均确认删除不缩减 V2 scope，engineering gate 唯一前置条件是先迁出中立 audio fixtures。
- **开放问题：** 无；旧 Web surface 的更大范围删除仍保存在 frozen stash，不进入本批。

### DR-074 — Classification outcomes 保持单一数组 schema

- **优先级：** V2 数据完整性 / Phase 2 P1
- **状态：** 已修复；静态合同已统一，Python compile 与 diff check 通过，真实数据删除/导出留到 Phase 5
- **决定：** `organization.user_correction.outcomes` 在写入、Project 删除与 Project-scope Export 全部保持 `{ project, state }[]`；删除只过滤目标 Project，导出只投影目标 Project，不再把数组解释为字典。
- **用户可见影响：** 删除一个 Project 不会清掉其他 Project 的分类纠正，Project Export 也会保留本 Project 的 Added / Excluded / Saved-only 记忆。
- **替代方案：** 把 producer 与所有 Web consumer 改为字典；会扩大当前唯一 schema 且增加无价值迁移。
- **已有证据：** Phase 2 两路独立静态审查均确认 producer/Web 使用数组，而 delete/export 使用字典，造成静默丢失或残留。
- **开放问题：** Project rename 的原子事务与 membership origin 属于同一 feature ID 的独立后续缺口。

### DR-075 — Comment bundle 删除只把外部引用视为 lineage 依赖

- **优先级：** V2 Library / Phase 2 P1
- **状态：** 已修复；Python compile 与 diff check 通过，真实 bundle 删除留到 Phase 5
- **决定：** 统一删除 preview 只为 AI Source 读取 AI revision；删除完整 Comment bundle 时，bundle 内的 Web→You 链接不算外部 derived dependency。Host 在同一可回滚删除事务中按 preview 的完整 target set 忽略内部依赖，只有 Document、Run、历史 citation 或 bundle 外 derived Source 才保留 tombstone。
- **用户可见影响：** 普通 Web/You/Voice Source 可以正常进入删除确认；无外部引用的 Comment bundle 会完整删除，有真实引用时才准确保留 lineage。
- **替代方案：** 为 Comment bundle 增加第二套删除 endpoint；会重复 fingerprint、rollback 与 terminal result 合同。
- **已有证据：** Phase 2 runtime 审查确认普通 Source 因 AI-only revision API 返回 400，execute 又把同 bundle Comment 重新算成 root 的依赖，导致返回 deleted 但残留 tombstone。
- **开放问题：** 无；workspace fresh backup 是 V2-SET-09 的下一独立缺口。

### DR-076 — Fresh workspace 的默认 Settings 在 backup staging 中物化

- **优先级：** V2 Backup / Phase 2 P1
- **状态：** 已修复；Python compile 与 diff check 通过，真实 snapshot/restore 留到 Phase 5
- **决定：** 当 live data root 尚无 `settings.json` 时，Backup 只在新 snapshot 内写入 `Store.settings()` 的规范默认值，再执行当前 schema 校验；不为了备份修改 live workspace。
- **用户可见影响：** 新安装尚未保存任何 Settings 时也能 Back up、Restore 前自动备份和安全删除 workspace。
- **替代方案：** 放宽 snapshot validator 允许缺失 settings；会产生无法精确恢复的非规范 backup。
- **已有证据：** Phase 2 runtime 审查确认 fresh Host 只返回虚拟默认 settings，而 snapshot validator 强制文件存在，导致所有 backup consumer 必然失败。
- **开放问题：** 无。

### DR-077 — Project rename 在单一可回滚 root transaction 中完成

- **优先级：** V2 Project / Phase 2 P1
- **状态：** 已修复；Python compile 与 diff check 通过，真实 rename/restart 留到 Phase 5
- **决定：** rename 在写入前为当前 data root 建立同文件系统 hard-link snapshot；Project、Sources、Documents、Runs、classification outcomes 与 `membership_origins` 全部写完才提交。任一写入失败时在 Store lock 内恢复完整 snapshot，不暴露新旧名称混合状态。
- **用户可见影响：** Project 改名后 Auto-added / Added reason 仍保留；磁盘错误也不会留下重复或幽灵 Project 引用。
- **替代方案：** 只保存逐文件旧值再回写；回滚本身失败时仍可能产生混合状态，且会遗漏新增 root 文件。
- **已有证据：** Phase 2 runtime 审查确认当前实现先覆盖 Project，再逐文件更新且没有 rollback，同时完全遗漏 `membership_origins` 的 key rename。
- **开放问题：** 无。

### DR-078 — Extension Retry 复用 Host 已保存的 failed Run

- **优先级：** V2 Lineage / Phase 2 P1
- **状态：** 已实现并通过 scope / product / engineering 三路 final 静态 gate；真实 provider failure 留到 Phase 5
- **决定：** Side Panel 保存 `ExtensionApiError.run`。Voice/Text Command 与 Page/Selection Action 的 Retry 直接以该 Run ID 调用 `retry_run_id`，由 Host 复用 frozen Skill、Sources、model context 与原 `activity_source_id`；不得重新保存 Activity、Source 或 Comment。
- **用户可见影响：** Provider 失败后点击 Retry 不会在 Library 留下重复输入，也不会丢失“这次 Run 使用了什么”的证据链。
- **替代方案：** 仅保存表单参数并重新创建 Run；会生成新的 Activity/Source，且可能读取已变化的 Project Context。
- **已有证据：** Phase 2 spec 审查确认 Host 已随 502 返回 failed Run，但 Side Panel catch 丢弃它，Retry 又从 `saveMaterial` 开始创建全新 lineage。多轮 gate 继续发现 URL/文本相同也不足以证明原输入目标仍在；当前 content script 为真实 DOM target 分配稳定 session ID，并在 focus/input/selection/route 变化时刷新 generate state。失败时冻结完整 `targetKey`，Retry、Surface 与点击前实时检查均比较 tab、URL、selection、target text 与 target session；失配时只保留 Candidate，不显示虚假 Insert。final gate 进一步修正页面导航/reload 的 target-changed refresh，以及旧 Candidate warning 隐藏 failed Run Retry 的状态优先级；三路复审均无剩余 P0/P1。
- **开放问题：** 无。

### DR-079 — Adoption 是追加事件，不是 Run 上可覆盖的单一终态

- **优先级：** V2 Lineage / Phase 2 P1
- **状态：** 已实现并通过 scope / product / engineering 三路 final 静态 gate；真实跨表面旅程留到 Phase 5
- **决定：** Copy、Insert、Replace、Keep 与 Document 每次采用都追加稳定 ID 的 adoption event；Run 与物化的 AI Source 或 Document 共享事件，Undo 只标记指定 Insert/Replace event。保留产品已定义的顺序动作：用户可以先 Insert/Copy，之后再 Save as Document；两种结果都存在，但不再互相覆盖 lineage。Voice adopted revision 同时记录 Copy/Insert action。
- **用户可见影响：** History 与 Inspector 能核验每次采用、目标、内容版本和 Undo；同一 Candidate 后续写入 Document 不会让先前 Insert/Copy 看似消失。
- **替代方案：** 强制 Run 只能有一个 AI Source 或 Document 终态；与权威 V2 明确允许“Insert 后可选 Save as Document”冲突。
- **已有证据：** Phase 2 审查确认 Run 的单一 `adoption` 字段会被后一次动作覆盖；权威 V2 canonical journey 与 §10.12 明确要求 adopted revision 和顺序 adoption。多轮 gate 发现并修正：Document 新 ID 的提前返回、network helper 内部生成 ID、编辑 Candidate 后误复用旧 ID、refresh 失败前过早清 ID、Selection Replace 重试重建当前页面 target，以及 History 仍隐藏事件。当前 pending ID 同时绑定内容与原 target，整个动作含 refresh 成功后才清除；同 ID 改内容由 Host 明确冲突；Run Inspector 显示摘要化 adoption history，Project History 显示 Copy → Document 等事件序列，所有 Source 统一使用 `adoption_revisions`。Document Action 冻结正文、标题、Project、revision 与 selection range；Replace/Insert 的本地 Undo 先完成用户动作，再以同 ID 幂等补写原 adoption 与 Undo；pending 期间冻结 Candidate 并只保留 Retry save。Run Inspector 不再用旧 Candidate 静默覆盖已有 Document。final 三路复审均无剩余 P0/P1。
- **开放问题：** 无。

### DR-080 — 首次 Setup 只占默认入口，不阻断本地内容

- **优先级：** V2 Setup / Phase 2 P1
- **状态：** 已实现；Web typecheck 与 diff check 通过，真实首次启动留到 Phase 5
- **决定：** Host 尚未配置远程 provider 且 URL 没有显式 `view` 时显示 V2 Setup；用户可以 Connect/Test/Save，也可以直接进入 local Library。任何显式 Projects/Library/Documents/Skills/Settings route 都继续打开本地产品，AI/Voice 动作在使用点恢复。
- **用户可见影响：** 新用户会看到明确的首次连接流程，但不需要账号，也不会因暂未配置 provider 而无法查看自己的本机资料。
- **替代方案：** 未 Ready 时始终强制 Setup；违反本地内容不被 provider 状态阻断的既定合同。
- **已有证据：** Phase 2 spec 审查确认 `V2SetupRoute` 完全未被 production import，root 无论 `ai_configured` 都直接进入 Projects。
- **开放问题：** 无。

### DR-081 — Projects Composer 只显示真实 production actions

- **优先级：** V2 Projects / Phase 2 P1
- **状态：** 已实现；Web typecheck 与 diff check 通过，真实 click 旅程留到 Phase 5
- **决定：** Ask/Compare/Draft composer 提升为 production-owned 组件；Run 是明确的 form submit，Enter 与按钮共用同一 handler。删除没有任何 handler 的内嵌 Mic；Web textarea 仍可由已确认的 Extension Voice Write 操作，不保留第二套虚假 Web recorder。
- **用户可见影响：** 点击 Run 与按 Enter 都真实启动当前模式；界面不再展示点击后无结果的 Voice 控件。
- **替代方案：** 为 Web 临时再造一套 microphone recorder；会重复 Extension 的 capture、pending queue、Profile 与 lineage 合同。
- **已有证据：** Goal Supervisor 与 Phase 2 leakage 审查确认 production V2 route 直接 import mock composer，Run 按钮默认 `type=button`，Mic 没有 handler。
- **开放问题：** 无。

### DR-082 — Compare 使用独立 Activity subtype

- **优先级：** V2 Project History / Phase 2 P2
- **状态：** 已实现并通过 scope / product / engineering 三路 final 静态 gate；真实 History 旅程留到 Phase 5
- **决定：** Activity schema 增加 `compare`，Project composer 按实际 mode 原样持久化；不再把 Compare 降级为 Ask。
- **用户可见影响：** All activity 与 Project History 能准确区分问题、比较和起草，后续恢复/审计不会误解这次 Run 的意图。
- **替代方案：** 继续从 title 或 selection prompt 猜测 Compare；会让数据语义依赖 UI 文案。
- **已有证据：** Phase 2 runtime 审查确认 producer 固定把非 Draft 写为 Ask，Host union 也不接受 Compare。首轮 scope gate 发现 inventory 更新意外删掉 frozen `model_context`/provider 输入一致与不覆盖旧 Candidate 两项合同，product/UX gate 发现 Project History 与 All activity 没有使用 Compare 产品标签；两处均已修正。final scope / product / engineering 静态复审均 PASS，无剩余 P0/P1。
- **开放问题：** 无。

### DR-083 — 先批量恢复 Web App 可用性，再恢复 Phase 2 lineage 工作

- **优先级：** Web App P0 / 用户当前最高优先级
- **状态：** 已解决并通过当前 Host 重启后的窄范围真实运行时复核
- **决定：** 保持 DR-078/079/082 与 OPS-03 的具名 stash 不动。本批不重做 IA、不增加功能，只按共享根因一次修复：Voice & Skills / Settings Voice 崩溃与 app-level error boundary、Recent work → Document 导航、统一 summary/plain-text 展示、编辑器连续内容、长内容摘要与展开、Library/Documents loading/empty 三态、共享内容轴与渐进操作、Skills 布局、Host 状态优先级。审计截图保持独立，不混入产品代码提交。
- **现有设计模式：** 继续使用统一 V2 shell、共享 page/editor/reading axis、Master–Detail、resizer、按钮和渐进 disclosure；不恢复被否决的 V1 表面。
- **拟议 UI：** 列表与活动只显示无标签源码的内容摘要和弱化 metadata；长内容 clamp 后由明确入口展开；加载中与真实空状态分离；Context 次要动作收敛到同一渐进菜单。
- **用户可见影响：** 关键页面不再整页白屏；文档可以从 Project 正确打开；内容可连续阅读，页面不再先误报为空或显示 HTML 源码，主要操作保持安静且可发现。
- **风险状态：** 必须保留 Document rich-text 编辑语义、真实 Document ID、现有本机数据和未提交 WIP；本批只改变渲染、导航和状态表达，不迁移或重写数据。
- **替代方案：** 逐屏像素补丁会继续复制根因；恢复 lineage stash 会把无关 50+ 文件重新混入并扩大风险，因此拒绝。
- **已有证据：** `.artifacts/web-ui-audit-2026-08-06/` 的真实截图、Voice 页 `undefined.join` 崩溃、Recent work 点击后 URL 未变化，以及 ChatGPT.com 独立盲审结论。修复后在 `http://localhost:5173`、真实 Host `http://127.0.0.1:8787` 与 storage root `/Users/yadong/dev2/logue/.logue-data` 复核：Project / Settings Voice 均可打开；Recent work 进入带真实 `doc` ID 的 Documents；Context / Library 无 HTML 标签源码；History 有可访问的展开；Document 连续呈现；Skills metadata 不拆行；Host 不再同时显示 Ready / not found。Fresh designer post-gate 的唯一 P1 为 Projects 首次误显空态；补上共享 Loading 后，真实首帧显示 `Loading Projects…` 且不显示 `Create a Project`，数据完成后显示现有 Logue Project，最终 post-gate PASS（9.1/10，无剩余 P0/P1）。随后按独立 Goal Supervisor 的 REPLAN 显式重启真实 Host；首次直接从仓库根运行暴露 `python_server` 的 cwd-relative 默认值会误指 `/Users/yadong/dev2/.logue-data`，未继续使用该空 workspace，并将 `npm run dev:api` 修为默认显式传入仓库 `.logue-data`、同时保留调用者的 `LOGUE_DATA_DIR` 覆盖。使用当前 `.logue-data` 重启后再次复核：Projects 首载不误显空态；两处 Voice 无崩溃；Recent work 打开真实 Document；Workspace、Document 与 Library 无标签源码或大块假空白；Project export 显示 `26 Sources · 0 Activity · 5 Documents · 2 Runs` 且按钮可用；Project / Host 无 `not found` 或冲突状态；浏览器 console 无相关 error/warn。Web typecheck 与 diff check 通过；按用户要求未运行全面测试或扩展视觉 QA。
- **开放问题：** 无；若真实 producer 不能证明 Topics/Privacy 有数据，不造假内容。

### DR-084 — Voice Command 由页面内 Command Launcher 拥有入口

- **优先级：** V2 Extension / Phase 2 P1
- **状态：** 已完成 CODED/INTEGRATED 与静态 final gate；真实浏览器旅程留到后续统一 UX/QA 阶段
- **决定：** 按权威 V2 §10.2 修正 `V2-CMD-01/02` 的假完成：独立快捷键与 Voice Write 旁的 Command 动作先打开靠近当前输入目标的页面内 Launcher，明确显示 Selection/Page、Project 与输出目标。简单请求一次 Enter 直接执行；文字命令只在字段有效并提交后先创建 Activity，再创建 Run；语音在 Stop 后立即永久保存 raw audio/transcript Activity，但字段缺失或冲突时不创建 Run，也不把用户送进 Side Panel 才报错。执行后复用现有 Host Skill Run、frozen Sources 与 Side Panel Candidate/adoption consumer；Voice 与文字命令共享同一执行合同。
- **用户可见影响：** 用户在当前编辑位置就能说出或输入命令、确认作用范围并一次执行；长结果和引用仍进入同 tab Side Panel，原输入 target session 保持可 Insert/Undo。
- **替代方案：** 继续让快捷键直接打开 Side Panel 并自动录音；这隐藏作用范围，并把缺少 Project 的 clarification 延迟到 Activity 已保存之后。另造第二套 generation/adoption API 会分裂 lineage，因此拒绝。
- **已有证据：** Production Extension 已由页面内 Launcher 统一普通网页与 Google Docs 的 Voice/Text Command；Scope/Project/target clarification、永久 Activity、幂等 evidence/Run、局部 Candidate、Project Side Panel handoff、Insert/Replace/Copy/Undo、parse/provider typed error、pending recovery 与 request-level Cancel 均闭合到真实 producer/consumer。Extension typecheck、Python syntax 与 diff check 通过；fresh scope/product/engineering final gates 全部 PASS，未运行本阶段禁止的浏览器 QA。
- **开放问题：** 无；不改变 Project、Source、Run、provider 或 adoption 对象模型。

### DR-085 — Page Text Comment 与 Selection Comment 使用同一 Web+You bundle 合同

- **优先级：** V2 Capture / Phase 2 P1
- **状态：** 已修复并通过 Extension typecheck 与 diff check；真实运行旅程留到统一 QA 阶段
- **决定：** Side Panel 的 Page Text Comment 不再保存为孤立的 text material；Save 与 Selection Text Comment 一样，原子创建 Web Source 与以 `parent_ids` 连接的 You Comment，并共享本次 Project/tags 决定。页面正文作为 Web snapshot；页面无法提供正文时才以标题作为最小可恢复 snapshot。
- **用户可见影响：** 用户针对整页写下的文字 Comment 会在 Library、Project Context 与 Side Panel 中保持一个可理解的 Web+You bundle，后续能回到原页面证据，而不是出现无法区分来源的独立笔记。
- **替代方案：** 保留单一 text material 并只嵌入 `source` metadata；这无法满足权威 V2 对两个 Sources、comments-on lineage 与 bundle 删除语义的明确合同。
- **已有证据：** `V2-CAP-03` 与权威 V2 §10.3 要求 Page/Selection Text Comment 建立 Web+You bundle；production `saveContent` 仅在存在 selection 时调用原子 bundle API，Page 路径仍调用 `saveMaterial` 创建孤立条目。
- **开放问题：** Advanced Voice Comment 的 Stop-first 持久化另属 `V2-CAP-05`，不混入本批。

### DR-086 — Advanced Voice Comment 的 Stop 是永久 You Comment 边界

- **优先级：** V2 Capture / Phase 2 P0
- **状态：** 已修复并通过 Extension typecheck、Python compile 与 diff check；真实 provider failure/restart 留到统一 QA 阶段
- **决定：** Stop 后先由 Host 以同一 request identity 原子保存原音、冻结转写 context 与 Unlinked You Comment，再启动 provider 转写。首次转写写回同一 Comment identity；失败时现有 pending queue 只重试该 material，不创建第二个 Source。Finish linking 继续复用该 Comment，并保持已有 page/selection source、Project suggestion、tags 与 lineage 合同。
- **用户可见影响：** 用户停止录音后，即使 provider 离线或转写失败，Comment 及原音也已经永久进入 Logue；稍后 Retry、Finish linking 或 Delete 操作的是同一条 Comment。
- **替代方案：** 只保存 Extension pending queue，等转写成功再创建 Source；这不是可在 Library/Project 中管理的永久 Source，并直接违反权威 V2 的 Stop 边界。先调用旧 `/transcribe` 再补 Source也会让 provider 成为持久化前置条件。
- **已有证据：** production `transcribeAndSave` 先写 Chrome queue，但直到 `transcribeAudio` 成功后才调用 `saveMaterial`；失败分支没有 Host material ID。Host 已具备原音、冻结 context、transcript revision 与同 identity link/delete 原语，可直接复用。
- **开放问题：** 无；默认 Selection Voice Comment 的 Accept/Cancel 原子合同不在本批改变。

### DR-087 — Web Settings 通过受信任 Extension bridge 管理 pending captures

- **优先级：** V2 Settings / Failure recovery P1
- **状态：** pending capture producer→consumer 已 CODED/INTEGRATED，并通过 Extension/Web typecheck 与 diff check；真实断线恢复验证留统一 QA 阶段。`V2-SET-04` 的 storage usage 余项由 DR-088 闭合。
- **决定：** pending capture 继续由产生它的 Extension storage 持有，不复制到 Host 第二份队列。当前已配对 Host 的 Web Settings 复用现有同源、Host-bound Web↔Extension bridge，提供 List / Retry / Export audio / Delete；Stop-first Voice Comment 的 Delete 同时删除其 Host material 与 Extension queue，普通离线录音只删除本地 pending record。
- **用户可见影响：** 用户能在 Settings 找到浏览器里等待恢复的录音，直接重试、导出原音或删除，不必先知道应打开哪个 tab 的 Side Panel；删除不会留下隐藏的 pending Comment 或孤立队列。
- **替代方案：** 把 Extension pending queue 镜像进 Host；会产生两个 owner 和断线冲突，违反 Host/Extension 数据边界。只在 Side Panel 展示则继续违背权威 V2 §10.14 与 `V2-SET-04`。
- **已有证据：** production 只有 Side Panel 调用 `getPendingVoices/retry/export/delete`，Web Settings 没有任何 pending consumer；现有 target/shortcut bridge 已验证 configured Host origin、配对身份与 request-response 隔离，可最小扩展而不新增通信通道。
- **开放问题：** 无；不在本批执行断网/重启/浏览器 QA。

### DR-088 — Settings storage usage 使用当前 Host 数据根目录的真实文件字节数

- **优先级：** V2 Settings P1 / `V2-SET-04`
- **状态：** 已 CODED/INTEGRATED；Python compile、Web typecheck 与 diff check 通过，真实运行验收留 Phase 5。
- **决定：** `/v1/status` 由 Host 统计当前 `storage_root` 内全部普通文件的实际字节数，跳过链接；Web Settings 直接显示该值。口径包含当前 Sources、音频、Documents、revisions 与根配置，不包含数据根目录外的备份副本。
- **用户可见影响：** 用户能看到这台 Mac 上当前 Logue 数据实际占用，而不是静态、估算或导出预览值。
- **替代方案：** Web 根据已加载对象估算会漏掉音频、revision 与配置；统计父目录会把独立备份和临时文件混进当前 workspace。
- **已有证据：** 当前 `/v1/status` 已返回权威 `storage_root`，但没有 usage producer；Settings 因此无法实现权威 V2 §10.14 的 storage usage 合同。
- **开放问题：** 无；不在本批执行性能采样、浏览器或重启 QA。

### DR-089 — Topic vocabulary suggestion 采用单一 Host root transaction

- **优先级：** V2 Topics P1 / `V2-TOP-02`
- **状态：** 已 CODED/INTEGRATED；Python compile 与 diff check 通过，真实运行故障注入留 Phase 5。
- **决定：** 用户把 Topic 建议 Remember 到 Topic / Project / Global 时，目标 vocabulary/profile 写入与 Topic suggestion resolved 标记共用现有 Host root transaction；任一步失败恢复同一事务前快照。
- **用户可见影响：** Remember 要么完整生效并消失于待确认建议，要么完全不改变 Topic、Project 或 Global 设置，不会出现术语已写入但建议仍待处理的半完成状态。
- **替代方案：** 分别保存目标和 Topic 会留下跨对象部分成功；前端失败后反向补偿无法覆盖断进程和 Host 写入错误。
- **已有证据：** production Web 已调用 `/v1/topics/:id/remember-vocabulary`；Host 当前先写目标对象、最后写 Topic，没有 rollback，而 inventory 明确要求失败原子回滚。
- **开放问题：** 无；本批不改变 suggestion 生成、目标选择或 UI。

### DR-090 — Topic merge、split、convert 共用 Host root transaction

- **优先级：** V2 Topics P1 / `V2-TOP-03`
- **状态：** 已 CODED/INTEGRATED；三条路径的窄范围故障注入、Python compile 与 diff check 通过，真实运行验收留 Phase 5。
- **决定：** merge、split、convert-to-Project 在完成输入验证后、第一次持久写入前创建同一现有 Host root transaction snapshot；新旧 Topic、Project 与涉及的 Source membership 全部写入共同提交或共同回滚。
- **用户可见影响：** Topic 结构操作失败时保持操作前状态，不会丢失旧 Topic、留下半个 split、空 Project 或只有部分 Sources 加入 Project。
- **替代方案：** 按对象局部补偿难以覆盖 unlink、bundle membership 和进程中断之间的失败；前端重试也无法判断哪些对象已写入。
- **已有证据：** production Host 当前 merge 先建后删、split 先改后建、convert 依次创建 Project/更新 Sources/隐藏 Topic，三条路径均无统一 rollback。
- **开放问题：** 无；本批不改变 Topic 操作语义或 UI。

### DR-091 — Topic convert-to-Project 的同名 Project collision

- **优先级：** V2 Topics / Project identity P1
- **状态：** 冻结，等待用户决定；scope REPLAN、product/UX REPLAN、engineering PASS（均推荐 A，但前两路确认权威稿不足以授权默认 UX）
- **用户可见影响：** 当前 convert 使用已存在的 Project 名称时仍创建第二个稳定 ID；但 Sources、Documents、Runs 仍以名称关联，`projects()` 又以名称折叠对象，可能让其中一个 Project 隐藏并造成 Profile、Skills 和 Context 身份不确定。
- **权威证据：** V2 §10.8 只确认 Topic 可 convert to Project，没有定义 collision；`V2-PROJ-01` 与 DR-060 确认 Project 使用稳定 ID，rename 不得创建第二个同名 Project；Topics 已有独立的 existing Project suggestion/Add Sources 流程。
- **方案 A — 阻止：** convert 前发现同名 active 或 archived Project 即原子失败，保留 Topic；用户可换名，或通过已有 Related Projects 流程明确加入现有 Project。最小化隐式数据改变。
- **方案 B — 复用：** 将 convert 解释为把 Topic Sources 加入同名 Project并隐藏 Topic；减少一步，但把“创建 Project”静默改成“修改现有 Project”，且可能绕过 suggestion/exclusion 语义。
- **方案 C — 合并：** 合并同名 Project 对象、Profile、Skills、Documents、Runs 与 membership；会新增未确认的 Project merge 产品能力和高风险数据规则。
- **已有工程证据：** `convert_topic_to_project()` 调用 `save_project("", ...)`；create 路径只在 rename 时检查 collision，随后写出第二个 Project 文件，而读取层按名称字典覆盖。
- **三路 gate 结论：** scope 与 product/UX 均排除 B/C、推荐 A，但认为 §10.8 未定义 collision，Project identity/default recovery 属用户决策；engineering 认为 A 是唯一安全且不扩范围的实现，并要求 active/archived 均在共享 create 边界、snapshot 前返回 conflict。因三路对“能否无需用户确认实施”不一致，本项不写代码。
- **开放问题：** 用户确认 A 后再定义精确 inline recovery；此前保留现状并转下一 inventory family。

### DR-092 — Extension 在确认 Host 可达后按创建时间 replay pending captures

- **优先级：** V2 Host/Extension failure recovery P1 / `V2-OPS-01`
- **状态：** 已 CODED/INTEGRATED；Extension typecheck 与 diff check 通过，真实断网/重启时序留 Phase 5。
- **决定：** pending queue 继续只由 Extension 持有；MV3 worker 启动以及任一 surface 成功确认当前 Host 后，Extension 用单一 in-flight replay 按 `createdAt` 从旧到新调用现有幂等 Retry。单条失败保留原记录并继续后项，不新增 alarm 权限、后台轮询或第二份 Host queue。
- **用户可见影响：** Host 恢复后，等待中的录音无需逐条手动 Retry；失败录音仍留在现有 Settings/Side Panel 恢复入口，不阻塞其他较新的录音。
- **替代方案：** 只保留手动 Retry 不满足 V2 §10.15 的重连上传；新增周期 alarm 会增加权限和持续轮询，而当前 surface/worker 唤醒已经提供低成本的可达确认点。
- **已有证据：** queue 已持久化并具备幂等 `retryPendingVoice()`，但调用方只有单条 Web/Side Panel action；`listPendingVoices()` 还按最新优先排序，没有 reconnect replay producer。
- **开放问题：** 无；真实断网/重启时序留 Phase 5，本批不进入浏览器 QA。

### DR-093 — Adoption identity 由调用边界创建并由 Host 强制校验

- **优先级：** V2 API / lineage P1 / `V2-OPS-02`
- **状态：** 已 CODED/INTEGRATED；Python compile、production consumer 静态合同与 diff check 通过，真实重试/Undo 验收留 Phase 5。
- **决定：** Run、Document 与 Voice adoption 都必须携带调用边界生成的稳定 `adoption_id`；Host 不再为缺失 ID 静默生成新事件，也不允许缺 ID 的 Undo 猜测最近一次 adoption。
- **用户可见影响：** 网络失败后的重试只会补写原动作，Undo 精确指向用户刚执行的 Insert/Replace，不会意外创建重复 AI Source/Document revision 或撤销另一动作。
- **替代方案：** Host 自动补 ID 无法让客户端重试复用同一 identity；缺 ID 时撤销最近一次会在 Copy → Insert → Document 等顺序采用后产生歧义。
- **已有证据：** Web 与 Extension production API 已把 `adoptionId` 设为必填，并在 Copy/Insert/Replace/Keep/Document 动作边界生成、失败重试时复用；但 Host 的 Run 与 Document adoption 仍接受空值并自动生成 ID，Run Undo 还会在空值时选择最近一次事件。Voice adoption 已采用严格校验，本批统一三条合同。
- **开放问题：** 无；不改变 adoption 对象模型、可见动作或 IA。

### DR-094 — Comment 只使用独立 You Source，不保留内嵌 annotation schema

- **优先级：** V2 API / Comment bundle P1 / `V2-OPS-04`
- **状态：** scope / product / engineering 三路 fresh 静态 gate 均 PASS；CODED/INTEGRATED 并完成当前真实数据的一次性离线迁移；Production V2 Web 已收敛为唯一 `view=library` 路由，浏览器旅程按当前阶段顺序留到后续统一 QA。
- **决定：** 删除通用 Material 的 `annotation` 存储字段及 producer/consumer；Selection/Page Comment API 使用 `comment` 输入并返回独立 `comment` Source，Web/Extension 只从 Web+You bundle 读取 Comment。当前 `.logue-data` 唯一一条内嵌 annotation 在外部备份后一次性转换为同时间、Project、tags、source metadata 且以 `parent_ids` 指向原 Web Source 的 You Comment；转换后删除迁移代码，不保留双格式读取。
- **用户可见影响：** 这条现有 Comment 继续作为同一 Web evidence 的 Comment 出现在 Library/Project；以后不会出现一部分 Comment 藏在 Web Source 字段、另一部分是独立 You Source，导致 bundle、删除、分类或 lineage 行为不一致。
- **替代方案：** 永久保留 `annotation` fallback 会违反当前 schema 唯一权威并让 bundle 操作遗漏旧 Comment；只停止新写但继续双读仍是永久兼容层；丢弃现有 annotation 会删除用户内容。
- **已有证据：** production `create_item`、Extension `saveMaterial`、Web/Extension material types、Library/Search 仍读取可选 `annotation`；真实 `.logue-data/items/mat_7e5ec5101de8a0ff.json` 仍以内嵌字段保存一条 Comment。当前 Selection/Page Comment 主路径已经由 `/v1/selections` 原子创建 Web Source + derived user Source，因此可收敛到现有 V2 对象，不新增 feature 或 IA。
- **三路 gate：** scope PASS：这是对既定 Web+You Comment topology 与 `V2-OPS-04` 的 schema 收敛，不增删功能或 IA；product PASS：必须保留原 Web Source 为 bundle root，并维持单 bundle 计数/搜索、Project membership 与删除语义；engineering PASS：Host/API/types/search/backup schema 必须同批改为 `comment`，停服后在 data root 外全量备份并以可回滚的一次性事务转换真实记录，迁移后不得残留 annotation 双读。
- **迁移与静态证据：** 真实 Host 当时未运行；完整 `.logue-data` 的 410 个文件已物理备份到 `/Users/yadong/dev2/logue-data-backups/dr094-comment-schema-2026-08-07`，`diff -qr` 与原记录 SHA-256 一致。一次性 staging + 原子目录切换保留原 Web Source `mat_7e5ec5101de8a0ff`，新增 You Comment `mat_e99f18aac0098f47`，内容、时间、Project、tags 与 source metadata 相等，唯一 `parent_ids` 指向原 Source；9 个 live Comments 与数据根内 1 个历史副本的幂等 suffix 同批从 `:annotation` 一次性改为 `:comment`。102 个 items / 非空 request IDs 唯一，items 与 revisions 的 annotation 字段、整个当前数据根的旧 suffix 计数均为 0。窄范围只读验证确认 bundle 恰好两成员、删除预览为 2 Sources / 0 外部 derived、Agent Harness Export 同时包含两者且 parent 不悬空、Export schema 为 2。Python compile、Web/Extension typecheck、installer syntax 与 diff check 通过；未按当前阶段禁止项运行 Browser/CU 或视觉 QA。
- **路由收敛证据：** Production V2 入口只将 `view=library` 解析为 Library，主导航和 Global Find 也只写出 `view=library`；production V2 imports 中无 `view=stream` caller。Web typecheck 与 diff check 通过；未运行 Browser/CU、UX/UI 或全面 QA。
- **开放问题：** DR-091 仍独立冻结，等待用户确认方案 A。

### DR-095 — Provider Ready 必须同时验证生成与语音转写

- **优先级：** V2 首次设置 / readiness P1 / `V2-SET-01`、`V2-SET-02`
- **状态：** 已 CODED/INTEGRATED；只完成 production producer-consumer 静态闭环，真实 provider 调用留 Phase 5。
- **决定：** `/v1/ai-connection/test` 与保存连接前的 Host check 必须分别向配置的 generation model 和 transcription endpoint 发送最小真实请求；只有两者都成功才返回 Ready。语音 probe 使用进程内生成的短 WAV，不读取或发送用户录音，也不持久化 probe 或响应。
- **用户可见影响：** Setup / Settings 不再因为 generation model 单独可用就错误显示 “Voice and AI ready”；错误停留在当前连接表单，用户可修正 transcription model、endpoint 或凭据后重试。
- **替代方案：** 只检查 generation 保留当前虚假 Ready；等第一次真实录音才发现失败会直接破坏 J1；保存一份用户录音作为 probe 会扩大隐私与数据生命周期，不需要。
- **已有证据：** V2 §10.15 与 J1 要求 Host 同时显示 Voice ready / AI ready；production Web 的 Check/Save 均调用 Host `Gemini.test()`，但该方法只执行 `generate()`，完全不触达 `transcription_model` 或 `/audio/transcriptions`，随后 UI 同时宣告 Voice 与 AI Ready。
- **静态证据：** Web Setup 与 Settings 的 Test/Save 继续消费同一 Host check；Host 现在先验证 generation，再用进程内生成的 16 kHz WAV 验证 Gemini audio input 或 OpenAI-compatible `/audio/transcriptions`。probe WAV header/length postcondition、Python compile 与 diff check 通过；probe 与响应均不写入 data root。未运行真实 provider、Browser/CU、UX/UI 或全面 QA。
- **开放问题：** 无；不改变 provider 范围、IA、凭据边界或用户数据。

### DR-096 — Provider health 分离配置存在与运行时 Ready

- **优先级：** V2 readiness / failure recovery P1 / `V2-SET-02`
- **状态：** 第一轮 product/UX REPLAN 已收紧；第二轮 scope / product / engineering 三路 fresh 静态 gate 均 PASS；已 CODED/INTEGRATED，真实 provider/restart/跨表面恢复留 Phase 5，不运行 Browser/CU。
- **决定：** Host 分别维护 generation 与 transcription 的最近已验证 health；配置存在只表示 `configured`，两路都成功才表示 `overall_ready`。真实 provider transport/auth/endpoint/model/timeout/无有效响应失败只把对应能力标为 `needs_attention`，后续同能力成功可恢复；intent parse、取消、输入校验和任务内容错误不得污染 health。保存连接时持久化与 config fingerprint 绑定的已验证状态，失败状态也随当前 provider 持久化；未保存 Candidate Test 完全隔离，Save 只有双检查成功后才原子替换配置与 health。health 写入绑定 active provider identity 与 workspace generation，旧 in-flight 请求不得污染 Save/Delete/Restore 后的新状态。
- **消费合同：** `/v1/status` 使用单一 canonical schema 返回 `provider_configured`、`generation_ready`、`voice_ready`、派生 `overall_ready`、`provider_needs_attention` 与白名单化可行动摘要，不保留 `ai_configured` 双真相。Setup 只用 overall 汇总；Projects/Documents/Ask/Draft/Compare/Skills 只消费 generation；Voice 只消费 transcription。Provider failure 绝不成为全局 Host error，不阻断五个 Web 入口、本地保存/评论/编辑/搜索/导出/pending 管理，也不阻止 failed Run、保存录音与 Test connection 的 Retry。Extension 不把 health 映射为会隐藏 composer 的全局 `model` error，只在即将使用失败能力的局部状态显示 Retry 与 Settings → Models；Host offline 继续是独立 service 状态。
- **用户可见影响：** 凭据过期、endpoint/model 失效或真实 provider 请求失败后，对应 AI 或 Voice 从 Ready 变为 Needs attention；另一项健康能力和所有本地工作继续可用。Settings 分开显示 Connection required / Check connection / Needs attention / Ready；失败发生表面保留 Candidate、录音、Run 与 lineage，并提供 Retry 和 Settings → Models。修复连接或同能力后续真实调用成功后只恢复该能力。
- **替代方案：** 继续使用 `configured` 会保留虚假 Ready；每次 status 都主动联网会拖慢所有本地页面并在离线时制造噪音；单一 overall flag 无法避免 generation 成功错误清除 transcription failure。
- **已有证据：** DR-095 已让显式 Test/Save 同时验证两路，但 production `/v1/status` 仍直接返回 `Gemini.configured`；该属性只检查 key/base URL/model 字段存在。Web 把它作为 Projects/Documents `aiReady`，Settings 又直接用 `AIConnection.configured` 显示 Ready；Side Panel 只把 Host 可达当连接成功，不消费 provider health。
- **第一轮 gate：** scope PASS，确认这是 V2 §10.15/§14 与既有分项 mock 状态的收敛；engineering PASS，要求 candidate 隔离、分项持久化、provider/workspace epoch、并发 sibling 不丢失和安全摘要；product/UX REPLAN，指出 overall 下游门控与 Side Panel 全局 model error 会误伤本地 Comment/保存。上述 P0/P1 已全部写入本版合同。
- **第二轮 gate：** scope PASS、product/UX PASS（无 P0/P1）、engineering PASS；共同要求移除 production `ai_configured` 双真相、Candidate 零持久化、分项合并、stale completion 丢弃、capability-specific consumers 与不阻断本地工作。
- **安全边界：** status 只返回 capability、allowlist code、限长通用原因与恢复动作；不得保存或返回 API key、原始 provider response、prompt、Context、Source/audio 内容或含凭据 URL。
- **实现与静态证据：** Host 已删除 `/v1/status.ai_configured`，以 `provider_configured`、generation/voice/overall ready、needs-attention 和分项 allowlist error 为单一 schema；health 与 config fingerprint 一起持久化，active provider identity + workspace generation 丢弃 Save/Delete/Restore 后的 stale completion，并在 health lock 内合并 sibling。Candidate Test 无 health callback、零持久化，Save 双 probe 成功后才原子写入并切换 provider。Handler 在 generation、transcription 与 semantic provider I/O 期间释放 workspace lock，返回后校验 epoch；后台 organization 只在 generation ready 时运行。Web Setup 使用 overall，Projects/Documents 使用 generation，Settings 分开显示 Connection required / Check connection / Needs attention / Ready。Extension validator 使用 canonical schema，Host 可达时仍加载本地 context；generation notice 与实际 transcription/model failure 保留 composer、录音、Run、pending 和 Retry，并提供 Models 入口。Python compile、Web/Extension typecheck、production `ai_configured` 残留与 diff check 通过；未执行真实 provider、Browser/CU、UX/UI 或全面 QA。
- **开放问题：** 无；真实 provider failure/recovery、Host restart 与跨表面状态验收留到 Phase 5。

### DR-097 — 新建 Document 的 Adoption Undo 使用可恢复 tombstone

- **优先级：** V2 Selection/Page Candidate P1 / `V2-CAP-08`、`V2-SKILL-08`
- **状态：** scope / product / engineering 三路 fresh final gate 均 PASS；CODED/INTEGRATED，真实浏览器旅程留统一 QA 阶段
- **用户最新决定：** Selection/Page Candidate 新建 Document 成功后必须保留 Candidate 与即时 Undo；复用原 canonical adoption ID、exact frozen Sources 与 lineage。Undo 不得只覆盖更新旧 Document，也不得引入不可恢复的永久删除。
- **拟议决定：** canonical Document adoption 的 `document` 事件保存新 Document identity 与冻结 revision；同 adoption ID 的 `undo` 在同一 Host root transaction 内先把完整 revision 1（title/content/project、exact `source_ids/sources/context_source_ids/context_sources`）归档为不可变 recovery revision，再把当前 Document 写为 revision 2 tombstone，最后把 Run/Document adoption event 标记 undone。tombstone 只保留 identity、adoption/target lineage、`recovery_revision` 与必要时间，不物理删除。活动 `documents()` 在 Host canonical list 层统一排除 tombstone，Project recent work 等 consumers 不得各自补过滤。普通 PATCH/replace 拒绝 tombstone。重复 Undo 幂等返回同一 tombstone，不追加 revision/event。
- **冲突与恢复：** 首次 Undo 必须携带原 `expected_revision`，且严格等于 adoption event 的 `document_revision`；Document 已被编辑即返回 Conflict，不撤销用户后续工作。网络或未知提交结果保留原 Undo 与同一 ID 重试；revision Conflict 是终态：保留 Candidate 和已编辑 Document，清除注定失败的 Undo 状态，局部显示 `This Document changed, so it wasn’t undone.`，并恢复 Save as document 菜单供用户重新选择 New/Existing Document。Undo 成功后也清除 typed adoption，下一次 Save 必须使用新 adoption ID；更新旧 Document 时使用其最新 revision。当前用户恢复入口是保留的 Candidate：Undo 后可再次 Save as document，并生成新的活动 Document；不在本批新增 Trash/Archive/Restore IA。不可变 recovery revision 与 tombstone pointer 保留未来/运维恢复能力，不能从当前 Library Sources 重建。
- **跨表面 consumer：** 普通页面、Google Docs proxy 与复用同一 Selection/Page Candidate 的 Side Panel 都保存 `{id, documentId, documentRevision, action}`。新建和更新成功均保留 Candidate；新建显示 `Undo Save as document`，更新显示 `Undo Document update`。新建 Undo 成功从本地活动 Documents 移除 tombstone并保留 Candidate；更新 Undo 继续以恢复 revision 替换活动 Document。网络或未知提交结果保留原动作并以相同 ID 重试；revision Conflict 按上段清除 Undo 状态。
- **用户可见影响：** 新建 Document 后 Candidate 原位提供 Undo；Undo 后该 Document 不再出现在活动 Documents/Project recent work，但 lineage 可审计，且不会丢失用于恢复的 frozen Sources。
- **替代方案：** 物理删除会破坏 lineage 与恢复；仅在前端隐藏会留下仍活动的 Document；把新建 Undo 解释为“恢复旧 revision”没有旧对象可恢复；因此均拒绝。
- **已有证据：** 当前 `adopt_run_as_document()` 仅允许 `replace` adoption 执行 Undo；Selection/Page 新建成功后立即关闭 Candidate。Host 已对 Source Keep Undo 使用 tombstone + 最小 lineage，对 Document 删除也已有 tombstone/revision 原语，但权威 V2 未明确新建 Document Undo 的精确删除/归档语义。
- **首轮 gate：** scope PASS、product/UX PASS；共同确认 tombstone 是既有 adoption/lineage 的安全收敛，不新增 IA，Undo 后 Candidate 是当前恢复入口。engineering REPLAN 指出 canonical list 未过滤 tombstone、现有 restore 不会清 tombstone、consumer 缺 action discriminator 与新建 Undo 状态；上述 P1 已全部写入本版合同。
- **final gate 进展：** scope PASS；product/UX REPLAN 指出 revision Conflict 后继续显示同一 Undo 会形成永久死动作。现已明确区分可重试 transport failure 与不可重试 revision Conflict，并在 Conflict 后恢复 Save 菜单，不新增 UI/IA。
- **final gate：** 收紧后的 scope PASS、engineering PASS；product/UX 在消除 Conflict 重试矛盾后 PASS。三路均无剩余 P0/P1，允许按上述单一合同实现。
- **实现与静态证据：** Host 以单一 root transaction 归档完整 recovery revision、写入活动列表不可见的 tombstone并标记原 adoption undone；同 ID 重试不改文件，revision 已变化返回 409 且数据 byte-for-byte 不变，重新保存使用新 ID/新 Document并继承 frozen Sources。Extension API 区分 active Document/tombstone并传播 HTTP status；普通页面、Google Docs proxy 与 Side Panel 均保存 typed adoption、保留 Candidate并按 action 显示/执行 Undo。Web Project Draft、Library Recover Candidate 与 Document Action Replace 均复用同一 typed adoption/Undo failure outcome；Web 与 Extension 的终态 4xx 都清除失效 Undo并恢复正常操作，409 显示 changed，只有网络/503 保留同一 adoption ID且明确显示 Retry。Google Docs proxy 复用普通页面状态。两条窄 Host 合同测试、Google Docs bridge 与 Web/Extension adoption state 测试、Python compile、Web/Extension typecheck 与 diff check 通过；未运行 Browser/CU。
- **开放问题：** 无；真实浏览器旅程留到统一 QA 阶段。

### DR-098 — My Skill 使用可恢复归档，不永久删除

- **优先级：** Skills lifecycle P1 / `V2-SKILL-02`、`V2-SKILL-03`
- **状态：** 收紧后的 scope / product / engineering 三路 final gate 均 PASS；CODED/INTEGRATED，真实浏览器旅程留统一 QA 阶段
- **权威依据：** V2 §10.12 明确 My Skill 可以编辑、复制、归档和恢复；历史 Run 必须继续指向执行时的旧 revision。Settings → Skills 也明确要求完整管理入口支持归档与恢复。
- **当前冲突：** production Web 把 My Skill 的生命周期动作显示为 `Delete`；Host `DELETE /v1/skills/:id` 物理删除当前 Skill 与全部 revision，并清除 Global/Project bindings。归档后无法恢复，历史配置也不可审计。
- **拟议决定：** `DELETE /v1/skills/:id` 收敛为原子 Archive：保留当前 Skill、全部 revisions 与历史 Run lineage，写入 `archived_at`，从所有 active Skill lists、runtime resolver、recent 与 Global default / pinned action / Project override bindings 中移除。`POST /v1/skills/:id/unarchive` 原子移除 `archived_at`，把 Skill 规范化为 active、可选、可编辑对象，但不恢复任何 default、Project、pinned 或 recent 状态，避免覆盖用户归档后做出的新选择；`enabled` 只作为内部 active 兼容字段，不形成用户可见的第三种生命周期。Web My Skills 默认只列 active，并提供始终可发现的 `Archived (N)` 渐进入口；归档详情只读，只保留 Restore。恢复后回到 active，并明确提示 defaults 与 Project overrides 未改变。
- **用户可见影响：** `Delete` 改为 `Archive`；未被引用的 Skill 保持一键归档。若 Skill 当前被 Global default、pinned action 或 Project override 引用，归档前显示简短确认与影响摘要（受影响的 Global 选择与 Project 数量），明确这些位置将回退且 Restore 不会自动重绑。归档后 Skill 不再出现在运行时和绑定选择器，但仍可在 My Skills 的 `Archived (N)` 找回；恢复不会改写当前 defaults、pinned actions 或 Project overrides。
- **替代方案：** 永久删除违反权威 V2 且丢 revision；仅把 `enabled=false` 当归档无法区分临时停用与生命周期状态，也不能保证 resolver/bindings 清理；恢复时自动重绑可能覆盖用户后续选择，因此拒绝。
- **数据与失败边界：** archive、bindings 清理与 Skill 写入必须共享 Host root transaction；任一步失败完整回滚。当前 schema 只增加 `archived_at`，不保存或恢复归档前 enabled/pinned/binding 状态，不保留旧删除兼容路径或双语义。归档/恢复不改历史 Run 的 frozen Skill revision。
- **首轮 gate：** scope 与 product/UX 均 REPLAN，指出 pinned action 是 Global binding，不能同时承诺清除 binding 与 Restore 自动恢复；`enabled` 也不能扩张为用户可见的独立生命周期。product/UX 还要求已绑定 Skill 在归档前说明回退影响，以及为归档项提供安静但可发现的入口。上述 P1 已全部写入收紧合同。
- **final gate：** 收紧后的 scope、product/UX、engineering 均 PASS，无剩余 P0/P1。工程 gate 明确 Archive 规范化为 `enabled=false/pinned=false`，Restore 规范化为 `enabled=true/pinned=false`，不保存 prior state；Host 必须提供当前 binding impact 并在执行时重新读取后原子清理。历史 Run 的 Retry/Continue 继续使用 frozen Skill revision，因为 V2 §7.6、§10.12 与库存均要求可重现，且这不等于重新解析 active archived Skill；新动作 resolver 必须排除 archived Skill。
- **实现与静态证据：** Host active list 默认排除 archived，并为 Web 管理入口提供显式 include-archived 与 archive-impact；Archive 在 root transaction 中保留 Skill/revisions/Run、清五类 Global defaults、pinned 与所有 Project bindings，失败回滚，Restore 只恢复 active 对象。新 explicit Run、transcription 与 background organization resolver 排除 archived，历史 Retry/Continue 继续消费 frozen revision；portable all-export、Backup 与 workspace deletion preview 仍包含 archived Skill。Web My Skills 默认 active，通过 `Archived (N)` 打开只读详情与 Restore；有 binding 影响时先显示摘要和不重绑说明，旧 Enabled/Delete UI 已移除。窄 Host 测试覆盖故障注入回滚、active/all API、lineage 保留、新 Run 拒绝、frozen Retry、Restore 不重绑；Python compile、Web typecheck、production retired-delete residue 与 diff check 通过。未运行 Browser/CU、UX/UI 或全面 QA。
- **开放问题：** 无；实施后只报告 CODED/INTEGRATED，真实浏览器旅程留统一 QA 阶段。

### DR-099 — CUJ Recovery：Extension 安装产物、页面重载恢复与 Host client 授权

- **优先级：** 用户最高 P0 / Extension、Side Panel、Host、Web canonical CUJ。
- **状态：** 已完成当前真实安装纵向恢复并通过窄范围运行时验证。
- **问题与决定：** 当前 Chrome 实际加载稳定安装目录中的旧 release，而开发构建未进入该目录；Extension reload 又让已开页面保留失效 launcher。安装仍保持稳定根目录与同一 Extension ID，当前构建写入新的 versioned release 后原子切换 manifest；worker 启动时只在 content script 无响应时重注入顶层页面，受限子 frame 不再阻断整页恢复。同一 Host 的配对请求使用 single-flight 与最新 credential，避免并发 401 相互覆盖。
- **Host 根因：** client 使用合法 `chrome-<uuid>` identity，但授权、更新与撤销错误复用只接受产品对象前缀的通用 `ID_RE`，导致配对创建成功后永远无法读取。client 改用独立且与 pairing producer 一致的 `CLIENT_ID_RE`。
- **用户可见影响：** 已安装 Extension 可打开并连接当前 Host；Voice Write 能进入录音；Voice Command 能生成真实 Candidate、Insert 到真实 textarea 并 Undo；Keep in Logue 后结果立即出现在当前 Host Web Library。Extension reload 后旧顶层页面无需手动刷新即可重新获得当前 launcher。
- **真实证据：** 当前数据根 `/Users/yadong/dev2/logue/.logue-data` 与远程 Gemini provider ready；真实 Chrome 中生成并插入 `Logue voice input must transcribe...`，textarea 从 `Existing start:` 变为含 Candidate，Undo 后恢复原值；Keep in Logue 显示即时 Undo，`http://127.0.0.1:8787/?view=library` 首条显示同一 AI Saved Source。临时 diagnostic client 与 pairing code 已删除。
- **Voice Write 真实闭环证据：** 使用同一已安装 release、隔离临时 Chromium profile 与公开真人录音，通过真实 Host 和当前数据根完成录音 → 转写 → Library 持久化 → Insert → Undo。录音 `cap_090c8e2f17188115.webm` 为 186,599 bytes；永久 Source `mat_02ba7e62dcced73b`、revision 1 与 Candidate 均保留 `raw_transcript` 和实际 transcript `She had your dark suit in greasy wash water all year.`，来源为测试页。Library 在 Insert 前已显示该 Source；目标 textarea 从 `Existing start: ` 变为含完整 transcript，Undo 后逐字恢复。测试前已复制完整 425 文件数据快照；结束后只删除本批 Source、audio/context、transcript revision、临时 client，并恢复本批更新的 provider health 与原 client last-seen，`diff -qr` 证明当前数据根与测试前 byte-for-byte 一致。Chrome headless 不加载 Extension service worker，因此改用离屏隔离 Chromium；没有读取或修改用户 Chrome profile。
- **剩余风险：** 其余已确认 CUJ 仍需按用户优先级逐个真实恢复；本批不恢复被冻结的 Skill/model/config WIP，也不扩大全面 QA。

### DR-100 — CUJ Recovery：真实 Saved result 打开正确 Document 并返回来源列表

- **优先级：** 用户当前唯一 P0 / Web Recent work、Library、Documents 导航闭环。
- **状态：** 已通过当前真实 Host、当前 `.logue-data` 与生产 Web 的窄范围运行时验证。
- **根因与决定：** 已构建 Web 仍写出旧 `document` query，Source 详情也没有消费现有 `source.document_id`，导致 Recent work 被默认首篇 Document 掩盖错误、Library 永远无法进入关联 Document。所有入口统一写出权威 `doc`；先 push `view=documents` 的目标历史项，再只在目标项 replace Document/Project query，从而保留干净且精确的来源列表历史。Library 仅在真实 `document_id` 匹配当前 Document 时显示 `Open Document`，不猜测或新建对象。
- **用户可见影响：** Project Recent work 和 Library 已保存 AI Source 都能打开对应的既有 Document；浏览器返回后分别回到原 Project Workspace 与 Library 列表，不会携带目标 Document query 污染来源页。
- **真实证据：** Host 使用 `/Users/yadong/dev2/logue/.logue-data` 重启后，Projects `Logue` → `AI Document Logue 核心产品闭环` 打开 `doc_99b3c08877042230`（revision 7），Back 精确返回 `?view=projects&project=Logue`；Library `Logue Dev Notes · revision 103` → `Open Document` 打开 `doc_b3a53ec0adaa22c9`，Back 精确返回 `?view=library`。两条原列表记录仍存在，控制台 error 为 0。Library 点击前后用户内容目录聚合 SHA-256 均为 `0915997a36b8b2fcabefe93da8388466f8c5c2ec6365a798be3f2e74fe68d6a5`，items 110、docs 13 不变；未创建测试数据。
- **剩余风险：** 现有 `GET topics()` 会刷新自动 Topic 的 `updated_at`，因此全 data root 指纹会变化；它没有新增或修改本批 Source/Document，且不阻断导航，留在后续对应 CUJ 单独处理。其他坏 CUJ 继续按用户优先级逐条恢复；本批不触碰 provider/model/config、新 feature、UI polish、审计资产或冻结 stash。

### DR-101 — Voice Write 可用性：Host 持久运行与已有页面自动恢复

- **优先级：** 用户当前唯一 P0 / Voice Write anywhere 的 Host 可用性。
- **状态：** 已恢复当前真实安装的 Voice Write P0。Host 持久运行与同页显式恢复已通过真实 Notion 验证；不把缺少永久 all-sites 权限时的无手势自动重注入计为已证明能力。DR-099 中过宽的“无需任何动作自动恢复”声明由本条更正。
- **用户最新反馈：** “why server is not running? why i cannot use it in notion? first feature to voice input anywhere should work.”
- **当前事实：** `127.0.0.1:8787` 只由 Codex 启动的 repo Python 进程提供；本机没有 `~/.local/share/logue/current`、CLI 或 `~/Library/LaunchAgents/com.ralphite.logue.plist`。Installer 即使选择 autostart，也先用 `nohup` 启动 Host、只写 plist，不在当前登录 session bootstrap；plist 也没有 `KeepAlive`。当前真实 Notion 页面能显示 `Start voice input`，但 Extension 更新/重载后的旧 host 点击不触发任何 phase 变化。静态根因已确认：installer 把 active assets 放在 `releases/<release-id>/`，manifest 也指向 versioned worker/content script；但 recovery worker 固定执行根目录 `content.js`，该文件在真实安装中不存在，所以 ping 失败后的自动重注入被 catch 后静默失败。
- **拟议决定：** macOS `LOGUE_AUTO_START=yes` 安装必须由当前 GUI session 的 LaunchAgent 直接启动并持有 Host，plist 使用 `RunAtLoad` + `KeepAlive`；installer 原子写入 plist 后执行 bootout（仅同一受管 label）→ bootstrap → kickstart，并以安装版本与指定 data root 的 `/v1/status` 验证成功。不得同时保留第二个 `nohup` Host。Extension 保留现有 ping → 重注入合同，但 recovery asset path 必须从当前 manifest `background.service_worker` 的 versioned directory 派生，而不是硬编码根目录；当前 content script 启动时先移除旧 `#logue-extension-host`，因此重注入后同一 tab 只保留一个当前 handler。若浏览器策略拒绝注入，Side Panel 必须显示局部、可执行的 `Reload this page`，而不是留下可点击但无响应的按钮。不增加 speculative generation protocol。
- **用户可见影响：** 安装完成即能在 Notion 等任意输入框使用 Voice Write；Codex/Terminal 退出或 Host 意外退出后由 launchd 恢复，Extension 更新/重载后已有页面也不会留下僵尸按钮。当前 `.logue-data` 与远程 provider 配置保持原位。
- **替代方案：** 继续用 Codex terminal 不是产品交付；只写 plist 等下次登录不能修复当前 session；仅 `RunAtLoad` 不会在异常退出后恢复；永久把 Host 指向 repo 工作树会让安装依赖开发目录，因此拒绝。
- **安全边界：** 只管理 `com.ralphite.logue` 与 installer 自己的 current release；安装/rollback 必须保留当前 data root、extension stable root 与旧版本恢复；不得把 API key 写入 plist 或日志。自动恢复只允许当前 manifest 已授权的 http(s) 顶层页面，不读取页面内容、不创建 Source、不改变输入值；已有有效 recording/candidate 状态不得被重复注入覆盖。
- **工程 gate 收紧：** installer 判定成功不能只看端口 status；必须同时证明 `launchctl print gui/$UID/com.ralphite.logue` 为 running、PID 存活且命令属于当前 install root，并用 macOS `lsof` 证明该同一 PID 实际持有目标 TCP listen port，再核对 version 与 storage root，防止旧 repo Host 占端口冒充成功；不为此扩张 public status schema。切换前冻结旧 plist、job loaded/running/PID；rollback 必须 bootout 新 job、恢复旧 current/plist，并按原 loaded/running 状态恢复与验证，任何 bootout/bootstrap 失败不能静默。Extension recovery 按 tab single-flight；注入后再次 ping 成功才算恢复，失败状态必须传播。只有 ping 明确失败才替换旧 host，仍能响应的 recording/candidate 不得注入；Side Panel 的 fallback 必须是对应 tab 的真实 reload 动作。
- **真实运行证据（2026-08-07）：** 当前安装为 `v0.2.13-p0.4`，`launchctl` PID `16865` 与 `lsof` 的 `*:8787` listener 为同一进程，status 精确返回当前版本、`/Users/yadong/dev2/logue/.logue-data`、`voice_ready=true`；前一安装中主动终止 LaunchAgent PID `12081` 后，launchd 自动以 PID `12279` 恢复同一版本、数据根与 Voice readiness。Extension installer 现在用结构化 JSON 生成 versioned manifest，当前 worker/content 分别为 `releases/v0.2.13-p0.4-16642/background.js` 与同目录 `content.js`。Chrome reload 后旧 Notion content script 的真实错误为 `Extension context invalidated`；后台 probe 改为经当前 service worker 的 nonce round-trip并带 400ms timeout。由于当前权限合同不永久授予所有站点的无手势 scripting 权限，本批不擅自扩权；在未刷新原 Notion 文档的情况下，用户点击现有工具栏 `Open Logue`，Side Panel 立即真实打开并显示 `On this page` / `Ask or draft`，同时单一 `#logue-extension-host` 被替换。聚焦同一 Notion 文本后，真实 Voice Write 从 `Start voice input` 进入 `Recording` 并显示 `Accept / Cancel`。本次以 `Cancel` 结束，用户内容目录聚合 SHA-256 在前后均为 `13357cfd985b2d1bc82f8f4751b3bbd0afca72ec724043de68790a8089497430`，未产生 Source、audio 或 transcript。
- **剩余边界：** 若要做到 Extension reload 后对所有已开站点完全无手势自动恢复，需要把 all-sites 从 optional/activeTab 改为永久 host permission；这属于权限扩张，必须按重要决定门槛由用户明确批准。本批选择不扩权，并以一键 `Open Logue` 作为当前可执行恢复路径。

### DR-102 — Library rich-text Source 使用统一可读展示边界

- **优先级：** 用户当前唯一 P0 / Library 已保存结果可读性与 Document 返回闭环。
- **状态：** 已通过当前真实 Host、当前 `.logue-data`、Host 重启和数据指纹验证。
- **问题与决定：** Library 列表已使用 `contentSummary()` 将保存的 rich-text Source 转为可读摘要，但详情 Inspector 仍直接渲染原始 `displayedContent`，导致 `mat_792fba6631c4d02e` 在列表显示 `Features Bugs Refactors`，打开后却显示 `<p>`、`<br>` 标签源码。详情只在展示边界复用同一 `contentSummary()`；底层 Source、revision、编辑 textarea 与 Document rich-text 语义保持原值，不迁移或改写用户数据。
- **用户可见影响：** 同一已保存 Source 在 Library 列表和详情中保持一致可读；`Open Document` 与浏览器 Back 继续使用现有 canonical navigation。
- **替代方案：** 在 Host/API 提前剥离 HTML 会破坏可编辑 rich-text 和 revision 原值；修改当前 Source 数据会违反本批零用户数据变更要求；因此均拒绝。
- **已有证据：** 当前生产 Web 对目标列表已显示 `Features Bugs Refactors`，详情 Inspector 同时稳定显示原始 `<p># Features</p>...`；根因是详情非 Comment 分支直接输出 `displayedContent`，而同组件其余 Source/revision 摘要均使用 `contentSummary()`。
- **真实运行证据（2026-08-07）：** 当前安装升级到 `v0.2.13-p0.5` 后，真实 Web 的目标 `mat_792fba6631c4d02e` 在 Library 列表与详情均显示 `Features Bugs Refactors`，详情文本不含 `<p>` / `<br>`；`Open Document` 打开 `doc_b3a53ec0adaa22c9`，浏览器 Back 精确回到原 `?view=library&q=Logue+Dev+Notes+%C2%B7+revision+103` 列表。终止 LaunchAgent PID `20699` 后 launchd 以 PID `21046` 恢复，且该 PID 持有 `*:8787`；重载后目标列表/详情仍可读，控制台 error 为 0。用户内容目录聚合 SHA-256 前后均为 `13357cfd985b2d1bc82f8f4751b3bbd0afca72ec724043de68790a8089497430`，目标 JSON SHA-256 前后均为 `db940329538965fcb0711249978e97dba47965a775c7cdc44399d059d5f5ad1d`；未创建或修改 Source、Document、audio、transcript revision。
- **开放问题：** 无；本批不涉及模型、Provider、配置、新功能或视觉优化。

### DR-103 — 共享 UI/IA 可用性基线修复

- **优先级：** 用户当前 P0 / Web Shell、Global Find、Document editor、Extension Side Panel。
- **状态：** CODED/INTEGRATED；Web 与 Extension typecheck 通过，代表性 Document/Shell 与 Global Find 截图 post-gate PASS；未运行全面交互 QA。
- **用户最新决定：** UI 必须从一开始就清晰可用；“不优化/不测试”不等于可以交付破损 UI。侧栏必须有 Logue 标识、折叠/展开和 resizer；Search 必须直接执行全局语义搜索，不能跳到另一个搜索；Document 必须可靠编辑并使用连续可读的工作区；Side Panel 的 Host 和已有条目应能在新标签打开。
- **实施边界：** 保持五个一级入口 Projects / Library / Documents / Skills / Settings，不改变 V2 IA 或数据对象。复用已验证的不可见 Logo/resizer 原语；Global Find 在当前 Shell 内搜索 Sources、Documents 与 Projects；Library 使用 canonical `view=library&source=<id>` 深链；Document 继续 autosave，但用串行 revision 合同避免保存时覆盖后续输入，并把低频删除等动作渐进披露。
- **替代方案：** 逐页局部补丁会继续产生互相冲突的视觉语言；Search 跳转 Library 会制造第二个搜索入口；固定侧栏和暴露全部编辑器操作都已由截图证明不可接受，因此拒绝。
- **风险与恢复：** 不迁移或改写用户内容；导航宽度与折叠仅保存在浏览器偏好。实现后只做最低静态检查和一次截图复核，明显 P0/P1 继续按共享根因修复。
