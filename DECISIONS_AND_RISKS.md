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

### DR-020 — LOGUE.ai 产品定位验证门

- **优先级：** 产品基础 / P0
- **状态：** 用户已确认收窄后的定位与首个用户；当前继续 V2 整体设计迭代，不定义 MVP、不开始实现
- **研究前定位：** LOGUE.ai 是以 Voice 为第一交互方式、以 Log/Source 为个人信息底座、由 AI/Skills 完成处理、自动组织、分析和生成的个人工作系统。
- **研究结论：** Voice / Log / AI 应保留为产品原则，但不能承担市场定位。任意输入框听写、选区命令、自定义 prompt、自动组织和基于个人内容生成已分别被 Wispr Flow、Superwhisper、Willow、Voicenotes、Mem、Tana、Readwise、Notion 等覆盖。
- **确认定位：** 面向跨网页研究和写作的个人知识工作者；首个闭环为“当前网页/精确选区的语音或文字判断 → 带来源的 Log → 显式或自动 Project classification → 在当前输入位置基于 Sources 生成并插入”。短句为“说一次，记住来源，用回当前工作”。
- **用户可见影响：** 当前 IA 方向建议 `Log / Projects / Settings`；Skills 作为上下文动作和高级配置；Topic、Source、Page、Run 不各自建立一级入口。这些仍可随用户后续想法继续迭代，不构成 MVP 或实现冻结。
- **主要风险：** 若 round trip 不能明显优于 `Wispr + Readwise + ChatGPT` 的手工组合，产品仍会被理解为功能更少的 dictation/PKM 工具；来源 lineage 可以累积防御，但只有在当前工作位置真实节省返工时才产生用户价值。
- **证据：** `docs/design/research/logue-ai-competitive-positioning-2026-08-04.md`、`docs/design/reviews/logue-ai-positioning-independent-review-2026-08-04.md`，以及 ChatGPT.com 独立会话 `https://chatgpt.com/c/6a72c769-02d8-83e8-9f9c-9978c94e5a41`。修订稿经 `logue_product_designer` 最终复审为 `PASS — 9.3/10`。
- **用户决定：** 已确认收窄后的 wedge、研究/写作密集的首个用户与 DR-021；明确取消“首轮只证明一个 active Project”的当前范围讨论。现在只保存并迭代 V2 整体设计，等待更多想法，不实施。

### DR-022 — V1 与 V2 的文档和产品边界

- **优先级：** 产品基础 / P0
- **状态：** 用户已确认；持续执行
- **决定：** 已发布的现有产品统一称为 V1。当前讨论的是 V2 整体产品重设计；V1 的代码、界面、规格、数据、QA 和 Release 仅作历史证据，不限制 V2。
- **文档规则：** `docs/design/logue-ai-product-positioning-2026-08-04.md` 是 V2 唯一权威整体设计稿；用户后续想法直接合并到该文件。竞品研究和 review 仅作支持证据。旧的 GOAL、产品规格、交互、设计系统和专题设计已明确标记为 V1 历史文档。
- **用户可见影响：** 不再需要在多份互相冲突的设计稿中判断哪份最新；V2 会作为一套整体产品持续重写，而不是在 V1 上追加 feature。
- **实施边界：** 当前不定义 MVP、排期或 Release 范围，也不开始代码实现；只有用户明确宣布进入实现阶段后再制定交付计划。

### DR-023 — 个人 Source 向团队 Knowledge 沉淀的候选方向

- **优先级：** 产品基础 / P0
- **状态：** 评估中；尚未替换当前已确认定位
- **候选决定：** LOGUE.ai 可能从个人 Log / Project Memory 扩展为 AI-native work 的 knowledge maturation layer：`Private Source → Personal Knowledge → Share Candidate → Project Knowledge → Team Knowledge`。
- **用户可见影响：** 用户的现场输入先服务本人；适合共享的内容经过整理、核验和权限选择后，才成为项目或团队可复用的 Human/AI Context。
- **关键纠正：** 原始输入是第一方工作记录和 Evidence，不天然是 Truth。团队可依赖的 Knowledge 需要来源、作者、状态、适用范围、更新时间和修订关系。
- **替代方案：** 继续只做个人研究/写作闭环；或转为连接既有 SaaS 的企业搜索。前者边界清晰但团队复利较弱，后者会直接进入 Microsoft、Glean、Atlassian、Slack 和 Onyx 的强势区域。
- **已有证据：** 大平台已经覆盖权限感知的组织内容搜索；Khoj、AFFiNE、Outline、Mem0、screenpipe 等覆盖个人 AI、知识库、AI Memory 或原始活动捕获。尚未发现主要产品把个人工作现场的 Source 通过受控晋升链变为团队 Knowledge 作为核心产品模型。
- **主要风险：** 私人工作被团队监控、AI 错误共享、知识过期或冲突、个人没有足够直接收益、以及过早扩张成完整企业权限和协作平台。
- **开放问题：** 首个协作用户、共享是否始终人工确认、Team Knowledge 的 owner/治理、私有来源与共享结论的权限关系、产品做完整协作层还是开放 knowledge layer、开源目标与许可证。
- **实施边界：** 当前只记录和分析，不进入实现。

### DR-021 — Voice Write 与持久 Project Memory 的边界

- **优先级：** 产品基础 / P0
- **状态：** 用户已确认设计边界；当前不实施
- **决定：** 所有 Voice Write、Capture、Comment 和其他用户输入都形成 Source，并永久保存到私人 Log，直到用户明确删除。永久保存不等于进入 Project Memory。
- **Project Memory 路径：** 用户可以显式选择一个或多个 Projects；系统也可以自动分类。高相关、重要且构成新信息或关键补充的 Source 可自动加入；低置信度只建议；无关、低价值或重复内容保持 Log-only，重复项关联已有 Source 而不放大 Context 权重。
- **信任边界：** 用户显式加入、排除和纠正永久优先于自动分类，后台不得覆盖。Project Memory 是供 Project AI 使用的受控 Context，而不是另一份存储副本。
- **用户可见影响：** Voice Write 主流程仍保持零额外选择和先保存后插入；用户之后可以找回任何输入。系统通过 Project classification 防止永久 Log 的噪音直接污染 Project 产出。
- **替代方案：** 普通 Voice Write 仅短期/本地保留。该方案已被用户明确否定，不得作为默认行为。

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
- **决策：** 首次录音由扩展自己的授权小窗口提供明确的 `Allow microphone` 按钮；用户点击后才调用 `getUserMedia`。授权归属 Logue Extension，不归属当前网页，因此一次授权适用于扩展支持的所有网页。
- **用户可见影响：** 首次使用多一次清晰、一次性的授权点击；之后网页录音不再逐站点请求权限。正常录音、保存、插入路径不增加检查或步骤。
- **已有证据：** 旧稳定安装在真实 Google 页面点击录音后会停在 `Requesting access…`，实现没有可见用户手势。当前稳定安装在新的独立 Google 页面点击 `Start voice input` 后，Chrome 显示 Logue 的麦克风权限提示；选择允许后 launcher 进入 `Cancel` / `Stop and insert`，Cancel 回到 `Start voice input` 且焦点回到网页 Search。真实 Logue Stream 页面还验证 `Cmd+Shift+L` 将焦点交给 Side Panel 的非编辑容器，`R` 在无网页输入目标时进入 `Cancel` / `Stop`，`Esc` 回到 Record。服务 `/v1/items` 每次前后都为同两条既有资料，确认取消零写入。
- **替代方案：** 改用每个网页的麦克风权限，或继续自动请求。前者会产生逐站点权限摩擦并受页面策略影响；后者已在真实稳定安装中失败。
- **下一步证据：** 当前稳定安装中，用真实人声 Stop 后恰好保存一条带原始音频的 Material，并按 C2/C4 验证插入路径。
