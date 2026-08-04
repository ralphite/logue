# Logue 权威产品目标与完成契约

状态：**进行中，远未达到完成标准。**

本文件是 Logue 当前 `/goal` 的权威目标。它完整吸收本任务中用户已经提出的产品要求、纠正、Bug、Feature、设计原则、工程规则、发布要求和验收方式。实现、测试、Storybook、截图、审查、提交或 Release 只能作为证据，不能代替真实用户结果。

当本文件与旧规格、旧代码、旧数据、旧测试、旧截图或模型生成的方案冲突时，以用户最新明确纠正和本文件为准。

## 1. 最终结果

把 Logue 做成一个真正高完成度、单用户优先的输入、资料沉淀与生成工具：

- 用户在当前网页中即可用极简语音完成输入、保存选区、添加批注和基于资料生成回复；
- 所有主动保存的内容都形成可编辑、可追溯、可复用的资料，并保留原始音频、来源、父子关系、项目和分类依据；
- Web App 以 Notion 式安静、清晰、内容优先的方式组织 Stream、Projects、Documents、Skills 和 Settings；
- Documents 提供 Notion 式列表、编辑、自动保存、引用和 Sources 体验；
- 当前可复用 Prompt 能力以 `Skills` 呈现，可创建、编辑和在 Web/Extension 中使用；只有未来真正具备 trigger、tools、permissions 和 runs 的自主对象才称为 `Agents`；
- Extension 使用 Chrome 原生 Side Panel，并与网页输入目标、选区、当前页面和本机资料形成可靠闭环；
- Logue Web/API 可运行在局域网内的 Linux 主机上；MacBook Chrome Extension 与 Web App 可通过防火墙分配、可能变化但用户已知的域名可靠访问该服务，而不要求 MacBook 本机启动服务；
- 产品达到 app.notion.com 与 chatgpt.com 同等级别的内在一致性、简洁性、可读性和交互完成度，同时保留跨网页输入、原始音频、来源链、项目记忆和受控写回等差异化价值。

最终判断不是“功能数量够多”或“代码能运行”，而是真实任务是否极其好用、稳定、安静，继续修改的边际用户收益是否已经很低。

## 2. 当前事实与兼容边界

- 当前只有一个用户，不需要多租户或历史版本兼容；同一个 Python 3.13 API/Web/数据服务必须可运行在 macOS 或 Linux，且支持 Linux 主机运行服务、MacBook Chrome 作为客户端的分离部署。目标机不能依赖本项目构建的原生二进制或 Node.js；当前真实数据所在的服务主机必须受保护，隔离安装验收机器可视为无既有数据。
- 当前 schema、routes、产品名称、默认值、Citation 格式、标题格式和文件格式是唯一真相。
- 除非用户明确要求兼容，禁止保留或新增 legacy migration、旧字段/旧路由 alias、旧文案 fallback、双格式 parser、旧 seed、兼容 fixture、兼容测试或废弃代码分支。
- 若当前真实数据必须更新，只允许：完整备份 → 一次性转换 → 真实读取/写入验证 → 删除转换代码。不得把一次性转换永久留在启动路径。
- 当前用户真实资料、音频、项目、Tag、Skills、Documents 和设置必须保留；旧 demo、错误 seed、废弃系统文案和已废弃格式不构成兼容契约。
- 当前工作区必须支持可验证的完整导出与恢复；恢复前创建完整备份，恢复后验证 Materials、Audio、Projects、Tags、Skills、Documents、Sources 和 Settings，而不是只验证文件存在。
- 当前 Citation 唯一格式为 `[Source n]`；空文档标题唯一格式为 `Untitled`。不得继续解析或显示旧 `[来源 n]`、`无标题` 等系统兼容格式。
- Installer 的程序覆盖、当前数据保护和失败回滚是运行安全要求，不授权继续支持旧 schema 或旧产品行为。

### 2.1 Prototype delivery and complexity discipline

- 当前阶段优先让用户的正常、高频主流程直接、稳定地工作。少而可用的原型优于被推测性防护阻断的复杂系统。
- 不得因为“可能发生”的异常就新增 guard、lifecycle 检查、状态分支、验证、fallback、retry、兼容层或边界处理。额外复杂度必须由真实可复现的用户问题或明确要求证明，并且收益必须高于对主流程的阻碍。
- 每个附加条件都必须能说明它防止的具体用户可见故障、归属和在阻塞正常使用时的移除路径；不确定的后台状态不得变成禁止主操作的硬阻断。
- 先从真实运行时的具体故障定位，再决定是否泛化。核心功能尚未完整时，不得把时间花在预先解决假想的生命周期、兼容、迁移、权限或并发情形。
- 只有在完整主流程已经可用、用户明确要求，或真实证据表明需要保护数据、隐私或已完成主操作时，才进行额外 hardening。

## 3. 产品模型与用户可见命名

### 3.1 一级信息架构

Web App 一级导航只使用以下五个等权入口：

- `Stream`
- `Projects`
- `Documents`
- `Skills`
- `Settings`

不得保留 `Generate` 聚合入口，也不得把 `View`、`Context`、`Inbox`、“成果”或其他实现术语作为一级产品功能名。生成是 Documents、Skills 与 Extension 中的动作能力，不是一级目的地。

### 3.2 核心对象

- **Material**：用户主动保存的 voice、selection、text、page note、annotation 和 derived 内容；默认永久保存，只有用户明确删除才移除。
- **Project**：不是普通 Tag。包含可编辑背景、确认术语、关联资料、Documents 和生成结果；一条 Material 可以属于多个 Projects。
- **Document**：一种可持续编辑的生成结果；不是生成能力的唯一结果。
- **Skill**：当前可创建、编辑、复制、选择的可复用指令/Prompt。可用于转写、整理、短回复、QA、Document 等任务。
- **Agent**：只保留给未来具有自主 trigger、tools、permissions、runs 和可审计行为的对象；不能把当前只有 Prompt 编辑的能力错误包装成 Agent。
- **Source**：原始页面、选区、音频、Material 版本或其他生成输入；任何派生结果都必须可追溯到具体 Source 版本。

### 3.3 生成能力的结果形态

生成能力可以产生：

- 可直接插入的短回复或消息；
- QA；
- 派生 Material；
- 可持续编辑的 Document。

“生成”不等于“文档”，也不得要求所有结果进入 Document。

## 4. Chrome Extension 完整产品契约

### 4.1 原生 Side Panel 架构

- 使用 Chrome 原生 Side Panel，不再维护网页内浮层作为当前产品路径或 legacy 兼容路径。
- Browser toolbar icon 与 `Cmd+Shift+L`（macOS）/`Ctrl+Shift+L`（Windows）使用同一 toggle：关闭时打开，打开时再次触发必须关闭。
- MV3 service worker 空闲或重启后，首次 toggle 仍必须正确；不能只依赖易丢失的内存状态。
- Side Panel 位于左侧或右侧完全尊重 Chrome 用户设置；Logue 不显示或保存侧位设置。
- Chrome 原生 pin/unpin/close 顶栏不由 Extension 控制。Logue 不制造重复的 pin、unpin、位置或关闭控件，也不把无法控制的 Chrome 原生 unpin 当作产品 Bug。
- Side Panel 是全高、安静、可阅读的工作面，不得原样移植旧 320px 浮层、重阴影或 9–11px 小字体。
- 关闭 Side Panel、关闭/切换 tab、页面卸载或导航时必须停止麦克风，取消未采用录音，并防止迟到的权限/录音回调重新写入已关闭状态。
- 同一 tab 内由 content script、SPA 或 Chrome URL 规范化引起的无害上下文刷新绝不能被误判为页面离开：录音控制、计时和 `Cancel` / `Stop` 状态必须持续可用。真正的 document 卸载、tab 切换或明确流程切换才停止未采用录音。

### 4.2 打开方式与上下文

- 保留选区右键 `Save to Logue` 的直接保存能力。
- 提供第二个右键动作，在 Logue Side Panel 中查看当前选区；选区、来源 URL、页面标题和 tab 上下文必须可靠传递。
- 有选区时：选区是主内容，展示完整原文与来源；可录音形成批注，保存为“原文 + 独立批注”，原文不可被覆盖。
- 无选区时：展示当前页面来源/上下文；用户可直接录音，转写后保存为页面关联 Material，不能假定存在可写入网页的输入框。
- 有当前网页输入目标时：可录音并在保存成功后插入该目标；目标消失时已保存内容不能丢失，应允许重新插入或 Copy。
- Logue Web App 自己的真实 input、textarea 和 editor 也必须允许 Extension 使用；只能对明确的 Extension UI 子树做 opt-out，不能整站禁用。
- Side Panel 由工具栏、快捷键或菜单打开后，必须将焦点可靠交给 Side Panel document 的非编辑区域，使 `R` 可立即使用；不得抢占 textarea、input、select 或 contenteditable 的编辑焦点。
- 无选区的当前页面 Side Panel 必须在输入/录音区域下方显示关联该页面的已保存 Material；按创建时间由新到旧排序，新增、保存或插入后无需重开即可立即出现在顶部。

### 4.3 极简语音输入

- 默认语音输入不能比直接键盘输入或 ChatGPT 原生语音更复杂。
- 当某个真实网页输入目标聚焦时，只显示一个安静的语音 launcher；Generate 只能通过渐进式 disclosure 出现，不能长期与主麦克风并列制造选择负担。
- 输入目标旁的 launcher 只负责本地语音输入：点击一次即在原位开始录音，自动采用当前输入、页面与项目上下文；不得打开或 toggle Side Panel。工具栏、菜单和 `Cmd/Ctrl+Shift+L` 才负责 Side Panel。
- 录音中 launcher 原位替换为紧凑、可访问的 `Cancel` 与 `Stop and insert` icon controls（VibeDoc 为交互参照）；`Esc` 取消，`Enter` 停止并自动转写、保存、插入。不得新增审阅态、额外 Accept 步骤或第二次确认。
- 首次点击不得因布局跳位、焦点变化或命中区改变而失效。
- 录音态只有两个用户决策：`Stop and insert` 与 `Cancel`。
- `Stop and insert` 自动完成转写、保存、插入；不得出现转写审阅、项目、Tag、Reference、归档设置、接受后第二次确认或自动发送。
- 项目、Tag 与自动整理在默认录音/页面批注路径中必须后台静默处理；不得显示 `Organize`、`Automatic` 或其他解释性配置。低置信度才用简短、局部、可编辑的 review 暴露必要信息。
- `Cancel` 在权限等待、starting、recording、transcribing、saving 及完成插入前都必须立即退出，不保存、不插入；不得因此引入转写审阅或“未采用结果”界面；界面必须有可见取消动作。
- 必须先成功保存最终文字、原始音频、机器转写、来源和关系，再插入宿主目标。
- 永不按 Enter、永不点击发送、永不自动 submit 宿主表单。
- 保存/插入失败必须局部显示可恢复动作；重试不得重复保存或重复插入。
- 插入完成或取消后恢复宿主输入目标焦点，不重置宿主编辑状态。

### 4.4 Side Panel 快捷键与无障碍

只有 Side Panel document 有焦点，且目标不是 input/textarea/select/contenteditable、`!event.isComposing`、无修饰键、`!event.repeat` 时才接管：

- `R`：开始或重新录音；
- `Enter`：停止并转写；有网页输入目标时保存后插入；
- `Esc`：取消未采用录音；只有非录音局部态才执行返回/关闭。

所有按钮必须具备正确的 `aria-label`、`aria-keyshortcuts`、title、可见 focus 状态和足够命中区。不得抢占用户正在编辑的文字、IME 或宿主快捷键。

每一个可见 Button、Icon button、Segmented control、菜单项和快捷键都必须有真实作用；不得留下点击无反应的装饰控件。

### 4.5 Extension Generate

- Side Panel 可选择 Skill，基于当前项目/资料/页面生成短回复、消息、QA 或 Document 草稿。
- 在网页聊天输入目标中，生成结果可插入但绝不自动发送。
- 语音输入仍是默认主流程；Generate 不能增加语音输入的步骤。

### 4.6 Selection Skills：网页与文档的就地改写

- 用户可在 Logue 中创建、编辑、复制和配置用于文本变换的 Skills，例如翻译、缩写、改写或校对；Skill 的定义与选择体验以真实 Notion Skills 为主要交互参照，而不是另造一套 Agent 表单。
- 在 Logue Document 的可编辑正文中选择一段文字时，必须出现安静、可键盘操作的 Notion 式上下文菜单/输入入口；用户可直接选择已配置的 Skill，对当前选择执行变换并将结果更新到该选择位置。
- 在任意支持编辑的网页目标（至少 textarea 与 contenteditable）中选择文字时，Extension 必须提供同一套渐进式 Skill 入口；静态网页原文不假装可直接改写，改写结果应进入当前可写目标或 Side Panel 的受控路径。
- 选择范围、原文、所用 Skill、生成结果与写回必须保留来源关系，不能静默覆盖无关内容；宿主表单绝不自动提交。
- 多行选择经 Skill 变换后必须按结果中的真实换行写回；textarea、contenteditable 与 Logue Document 都不能把多行结果压平成单行。
- 选区菜单只能在当前仍存在、仍可写且与最初快照一致的选择上显示。取消选择、目标失焦、页面导航或选择漂移后必须立即关闭；任何迟到的选择事件或异步结果都不得让菜单重新出现或写回旧目标。
- 具体的菜单触发、快捷键、结果呈现与替换确认语义，必须先以真实 Notion 当前行为为依据；不得根据记忆猜测或以重型弹窗/常驻工具栏取代选区附近的轻量入口。

### 4.7 Linux / LAN 服务连接

- Python 3.13 API 与生产 Web App 必须可在 Linux 主机上作为同源服务运行；Release 必须包含已构建的 Web 与 Extension，目标机不得需要 Go、Node.js、npm、pip 或本项目构建的原生二进制。交互式安装时明确让用户选择监听 `0.0.0.0` 或 `127.0.0.1`，默认选择 `0.0.0.0`；同时必须明确提示 Logue 当前没有公网认证，只应由防火墙限制在可信局域网/VPN 或置于受控反向代理之后。
- MacBook Chrome Extension 默认连接 `http://127.0.0.1:8787`，同时提供极简的 `Server settings…` 入口，可连接用户已知的任意 `http(s)` origin（含端口）。防火墙重新分配域名后，用户只需替换一次地址即可恢复全部流程。
- 当用户已经在 Mac Chrome 打开 Linux 主机同源托管的 Logue Web App，而 Extension 当前 Server 不可达时，Extension 必须只依据 Logue 产品 marker 将该页面 origin 作为候选，并提供一次点击、显示精确 host 的连接动作；普通网页不得出现这一授权入口，候选仍须通过精确 origin 权限和 `/v1/status` 兼容性验证后才保存。
- 远程 Server URL 只存于该 Chrome 安装的 `chrome.storage.local`；只接受规范化的 `http(s)` origin，拒绝凭据、query、fragment 和非 Web scheme。不得保存 Gemini Key，也不得把远程地址复制进每条资料。
- 用户点击 `Connect` 时只申请该具体 origin 的 Chrome 可选权限；拒绝权限、DNS/超时/拒绝连接、TLS 错误、错误服务或 API 版本不兼容时，不覆盖上一个可用配置，也不丢失当前草稿、选区或已完成录音。
- 保存新地址前必须通过 `/v1/status` 验证确实是兼容的 Logue 服务；成功后安静关闭设置并重新加载当前页面上下文、页面资料、Skills 和设置。正常连接不显示 `Connected`；断开时只显示局部 `Retry` 与 `Change server`。
- 所有 Extension API 路径，包括页面历史、右键保存、选区 Skill、录音、生成、采用与取消，都必须由 background 统一使用当前 Server URL；禁止任何 content script、Side Panel 或 helper 绕过配置直连 localhost。
- Extension、Chrome/MV3 worker 和浏览器重启后必须恢复已选 Server URL；地址变更后下一次请求立即使用新地址，不依赖 service worker 内存缓存。
- Linux 服务安装器不能假装能跨机器静默安装 MacBook Chrome Extension。Release 必须另提供平台无关、带校验和、可覆盖的 Extension 客户端资产/安装命令；首次只需在 MacBook 的 `chrome://extensions` 以 `Load unpacked` 选择稳定目录，后续升级复用同一路径和现有 `chrome.storage`，只需 Reload，不得要求在 MacBook 启动本地服务。
- Google Docs 是 Extension 的必验宿主：真实 `docs.google.com` 文档编辑器获得焦点时，语音 launcher 必须显示在可见编辑画布内而不是浏览器/Docs 工具栏；点击后能录音，`Enter` 停止并插入，`Esc` 取消，且不触发文档提交或其它宿主动作。

## 5. 资料、项目、自动整理与来源

- Stream 保存全部主动内容，并稳定区分 voice、selection、text、page note、annotation 和 derived。
- 原始录音、机器转写、最终采用文字分别保存；原始录音始终可播放核对。
- 音频播放器在首次播放前也必须显示真实时长，不能先显示 `0:00`。
- 任何 Material 的内容、Projects 和 Tags 都可事后修改。
- 系统在后台使用可配置 Skill 或非用户可见的系统分类器依据内容自动归 Project 和 Tag，不能机械匹配；当前 Prompt-only 的用户能力不得在 UI 或验收中称为 Agent。
- 高置信度分类安静完成；低置信度才以轻量、局部的方式提示 review。
- 低置信度结果必须显示可理解的分类理由与置信度；没有可靠匹配时宁可不关联，不能强行分类。
- 用户确认或修改后的分类不能被后续后台运行静默覆盖。
- 原文与 Annotation 是独立 Material，使用父子关系追溯；Skill 或系统自动化结果不能覆盖原始资料。
- 任一已保存 Material 都可在事后追加文字或语音 Annotation / instruction；每次追加形成独立、可编辑的子 Material，保留原始资料、既有批注和人工分类，不覆盖原文。
- 只有用户采用、明确固定或可靠重复出现的表达才能形成强记忆，避免错误自我强化。
- 默认最多使用一个参考 Project；多项目归属不能自动混入多个 Project Context。
- 外部 Agent 只能读取只读 Project package；写回只允许追加带 source、actor、idempotency key 的派生 Material 或 Document。

## 6. Web App 页面与关键交互

### 6.1 App Shell 与主侧栏

- 主导航在长列表滚动时始终可见、可操作；主内容自己滚动，不能要求用户回到顶部切换页面。
- 左侧栏可折叠；展开/折叠只改变容器宽度和文字可见性，品牌与一级图标的水平锚点不得移动或跳动。
- 折叠态所有一级按钮有高质量、可访问、延迟合理的 Tooltip；hover 和 keyboard focus 都能发现。
- 采用最新的 Notion 交互：展开栏的收起控件位于栏右侧，并只在整个侧栏 hover/focus-within 时出现；不再使用把 Logue 品牌图标替换成难看的 collapse icon 的旧方案。
- 折叠态展开方式必须清晰、可键盘操作，并保持图标位置稳定。
- 一级侧栏不放搜索框；搜索放在真正需要搜索的具体工作区中。
- 正常 `Local service running`、connected 等状态不显示；仅断线或需要用户操作时显示局部错误。

### 6.2 Stream

- 使用共享 page header 和高密度内容轴；header、搜索/过滤、列表列头与内容必须有清晰、统一的垂直对齐。
- Header 只保留页面名和当前高价值主动作，例如 `Add material`；不得加重复解释性 subtitle。
- Stream 搜索及所有其他检索入口都必须使用同一套语义检索能力：用户直接用自然语言查找，不需要选择或理解 Agent。当前 Prompt-only Skill 不得被包装成可见的搜索 Agent。
- 结果必须按相关性排序，并在文本未直接命中时以简短、可理解的依据区分“相关”结果；不得把仅命中隐藏来源、项目、Tag 或模糊字段的资料伪装成正文命中。
- 语义检索不可用时必须安静退回可解释的本地文本匹配；不可用、低置信度或无结果时不得混入看似随机的资料。
- 搜索、过滤、分组和详情选择不应重建整个 App Shell 或造成明显闪动。
- Material detail 使用单一可靠滚动容器；风险/确认提示、记录链、分类、Annotation 和删除必须可达，不得被固定操作区遮挡。
- Detail panel 边界使用共享 resizer；默认打开足够宽，并可扩展到全部剩余可用空间。

### 6.3 Projects

- Projects 列表和详情复用同一 header、page axis、按钮、row、empty/loading/error 模式。
- 不显示 `workspace` 等用户无需解释的辅助文案；必要说明进入 Tooltip 或明确的 advanced disclosure。
- Project detail 可编辑背景、确认术语、关联 Materials、Documents 和生成结果；正常 autosave 保持安静。

### 6.4 Documents / Skills

- `Documents` 与 `Skills` 是独立一级工作区，不再嵌套在 `Generate` 下；主侧栏最终稳定为五个入口。
- Documents 打开稳定的 Document 列表与编辑器；Skills 打开稳定的 Skill 列表与编辑器。二者复用同一 list/editor shell、header、row、selection、loading/error 和 resizer primitives，但不显示重复的内部顶级切换器。
- 新建动作属于各自工作区的局部 header：Documents 新建 Document，Skills 新建 Skill；删除顶层 `New`、通用 `+`、重复主动作和旧 `Agents` 产品名。
- 在不同一级工作区间切换或选择不同 Document/Skill 时，列表不得整体重建、回到顶部、丢失滚动位置或明显闪动。
- Document editor、Sources panel 和列表使用共享 resizer；Sources 默认足够宽，不得在大片空白旁保持狭窄，并可占用 100% 剩余空间。
- Document 可新建、生成、编辑、自动保存、删除、继续生成和插入 Citation。
- Document 正文必须支持 Markdown 输入与粘贴，并提供 Notion 式的标题、列表、引用、代码块和常用行内格式快捷编辑；`Command/Ctrl+Z` 与 `Shift+Command/Ctrl+Z` 必须稳定，正常自动保存保持安静，不得因格式化破坏 Citation、Sources 或 Selection Skill 写回。
- Citation 正文 `[Source n]` 与 Sources 编号一一对应；点击定位、高亮、增删与删除后重编号必须稳定。
- Skill 可创建、编辑、复制、选择用途和输出形态；保存失败局部可恢复，正常保存不显示 `Saved`。
- Document 选区可直接调用 Skill 完成翻译、缩写等就地变换；选区菜单和结果替换复用 Extension 同一 Skill/来源模型，并遵循真实 Notion 已观察到的轻量交互。

### 6.5 Settings

- 使用与 Project/Document/Skill editor 同一套 page/editor/reading axes、header、form field、button 和状态模式。
- 删除冗长、重复、解释显而易见功能的 helper copy；必要解释使用 Tooltip 或 progressive disclosure。
- 不显示正常保存、连接或运行状态；只显示局部、可行动错误。
- 正式 UI 文本无需浏览器缩放即可舒适阅读；极简不能通过缩小字体实现。

## 7. 全局设计与 UX 质量门槛

### 7.1 极简

- 每个可见文字、图标、Divider、Card、状态和动作都必须能解释它对当前任务的价值。
- 正常、成功、已连接、运行中、已自动保存等无需行动的状态默认不占界面。
- 文案使用上下文中足够清晰的最短动作，例如 `Copy`；不得写 `Copy this source text` 等重复对象名。
- 删除头像、在线状态、泛统计、泛建议、装饰卡片、红点式整理压力、重复标题和无价值说明。
- 极简意味着删除噪音，不是缩小字号、压缩命中区或隐藏关键能力。

### 7.2 一致性

- 内在一致性是最低标准：相同语义必须使用同一生产组件和同一状态模型，不能只让截图看起来相似。
- 同级 selected、hover、focus、pressed、disabled 只能改变预定义状态属性；背景范围、圆角、对齐、Icon slot 和命中区不得因实现分支变化。
- 所有页面复用共享 PageHeader/ContextHeader/PaneHeader、Button/IconButton、Tooltip、SelectableRow、FormField、PanelShell/PanelResizer、Dialog/Drawer、LocalError/Empty/Loading 等模式。
- 禁止每个页面复制局部 header、button、row、panel、tooltip 或 status CSS 配方。
- 采用共享 page/editor/reading/dense-list/panel axes；宽度由任务密度决定，不允许相邻功能任意发明 760/820/860px 等无理由差异。
- Header 与其正文必须共轴；不同页面切换时标题、正文、操作和侧栏不应横向漂移。
- 至少三个真实竖向边界使用同一低干扰 resizer；支持 pointer、keyboard、合理 min/default/max、复位和持久化。
- 右侧 panel 默认足够宽；最大宽度始终使用当前工作区全部剩余空间，不能被固定 `max-width` 截断。

### 7.3 状态、可访问性与性能感觉

- 所有交互具备完整且一致的 default、hover、focus-visible、pressed、selected、disabled、loading、empty、error、offline、retry、overflow 和 long-content 处理。
- 触控/鼠标命中区、键盘导航、Focus order、ARIA 名称和快捷键语义必须正确。
- 选择 Material、Project、Document 或 Skill 时不得无谓重建无关列表/导航；保持 scroll、selection 和编辑上下文稳定。
- Loading 不能造成布局跳动；错误必须局部、简短、可行动；成功通常保持安静。

## 8. Notion / ChatGPT 真实参照与设计审查

- 必须实际使用 `app.notion.com` 和 `chatgpt.com`，不能靠记忆或猜测其设计。
- 对照应覆盖：信息架构、层级、密度、内容轴、Sidebar、Header、Document list/editor、Sources、Tooltip、Panel、状态、键盘、噪音和任务流；不能只比较颜色。
- 需要采集 Logue 全部主要页面与关键状态截图，并与真实 Notion/ChatGPT 同类截图成对审查。
- 除 app.notion.com 与 chatgpt.com 外，审查必须比较当前直接或相邻竞品的核心输入、资料整理与生成流程；结论关注任务流和差异化能力，不能只比较视觉。
- 全产品终审必须将所有主要 Logue 页面及关键状态截图交给 ChatGPT.com 审阅，并保留可复用、无敏感信息的项目内对照证据。
- 可复用的 Notion/ChatGPT 截图、观察笔记和对照结果保存在项目内的非临时设计研究目录；不得只放 `/tmp`。敏感登录信息不得进入仓库，截图是否 commit 由隐私审查决定。
- 每次大型用户可见 Feature 或 UI/UX 改动前后，必须启动或复用只读 `logue_product_designer`，检查真实 runtime 与项目内 Notion 参照；一致性、简洁性或可用性不达标时阻止该批次完成。
- 最终审查使用 fresh-context、高推理强度的独立 Agent；实现者自评不能替代独立审查。
- 全产品终审至少由两名 fresh-context、只读独立审查者完成；实现者、同一上下文或同一审查者的重复结论不能替代独立视角。
- 对明显且无歧义的问题直接修复；确实存在产品取舍且无法从用户要求判断时，才列为待用户 review。
- 维护项目内的 `product spec`、`interaction spec` 和 `design system`，忠实细化本目标；初始 Mock、Storybook 或后续截图不能反向覆盖用户目标。

## 9. Storybook 与共享组件系统

Storybook 是明确交付物，但仍只是产品质量的支持证据。真实 Web/Extension runtime 仍是最终来源。

项目内的 product spec、interaction spec、design system 与初始 mock 是可复用设计资产；它们必须支持真实任务验证，但不能反向替代用户结果或固定未经验证的 UI 方案。

### 9.1 可用性

- `http://127.0.0.1:6006/` 根地址必须直接显示可见、可用的 Storybook；不得出现空白、只有 shell 或必须手工拼 `?path=` 才能使用。
- 稳定 Story URL 必须可直接打开并显示真实内容；dev server、static build 和浏览器 smoke test 都要验证。
- Storybook UI、Story 名称、fixture、系统 copy、a11y copy 和测试描述使用英文；用户真实多语言内容只在专门的内容压力 Story 中保留。

### 9.2 信息架构

Storybook 至少包含：

1. **Foundations**：color、typography、spacing、radius、shadow、icons、layout axes、motion/focus；
2. **Base Components**：Button/IconButton、Tooltip、Input/Textarea/Select、Tag/Chip、Tabs/Segmented control、Page/Context/Pane Header、SelectableRow、PanelShell/PanelResizer、Dialog/Drawer、LocalError、Empty、Loading、Audio Player、Citation/Source、Confidence/Review；
3. **Feature Components**：App Sidebar、Documents/Skills navigation、Stream rows/groups/filters、Project list/detail sections、Document list/editor/Sources、Skill list/editor、Material detail/record chain/organization/annotation、Extension launcher、Native Side Panel capture/generate、Settings sections；
4. **Page Compositions**：主要页面的真实生产组合，用于检查 content axis、panel width、header alignment、overflow 和跨页面一致性。

### 9.3 状态完整性

- 每个生产组件必须列出所有对它有意义的状态，而不是只放一个 `Overview`。
- 按组件适用性覆盖：default、hover、focus-visible、pressed、selected、disabled、loading/starting/processing、empty、success（通常安静）、error、offline/disconnected、retry、permission denied、low confidence/review、cancelled、long content、overflow、narrow/wide、keyboard interaction。
- Extension 至少覆盖：launcher hidden/visible/focus/hover、side panel current page/selection/editor、idle/starting/recording/transcribing/saving/inserting/success/error/cancelled/target lost/disconnected/generate。
- Material detail 至少覆盖 voice/selection/text/derived、audio metadata ready、low-confidence organization、confirmed organization、annotation empty/filled、long source、local error。
- Document 至少覆盖 list loading/empty/error/selected、editor autosave quiet/save error、Sources empty/search/selected/citation mismatch、panel narrow/default/max、delete/retry。
- Skill 至少覆盖 list loading/empty/error/selected、new/edit/copy/save error、different output shapes and product surfaces。

### 9.4 Story 真实性与维护规则

- Story 直接渲染生产组件与生产 tokens；禁止复制一套仅供 Storybook 使用的 demo markup 或平行 CSS。
- 每新增或修改一个可复用用户可见组件，同一原子批次必须更新其 Story 和相关有意义状态。
- 建立生产组件 → Story → 状态的可审计 inventory；完成前不得有未解释缺口。
- Story 的交互与 a11y 可以自动测试，但 build/test 通过不能证明真实产品达到目标。

## 10. 工程质量规则

- Web App：React + TypeScript + Tailwind CSS；服务与数据层：Python 3.13 标准库；组件系统：Storybook；AI：Gemini。
- Gemini API Key 只从 Python 服务进程的环境变量读取，不得进入 Web、Extension storage、数据文件、日志、GitHub 或 Release。
- 转写模型、默认处理 Skill 与上下文上限必须可由 Python 服务进程环境变量配置；配置与日志不得泄露 Gemini Key 或用户资料。
- 默认 Prompt、Skills、分类理由、demo 和系统生成文案使用英文；不得把用户自己的中文资料或多语言转写误删、误翻译。
- 前端遵守单一职责、清晰状态所有权、共享 primitives、稳定 key、最小重渲染边界和可测试交互；不得用复制粘贴页面结构修 Bug。
- 列表选择应更新必要区域而非重挂整个列表；保持 scroll 和 local UI state。
- 用户当前数据、其他任务未提交改动和真实密钥必须保护；不得覆盖或回退他人修改。
- 永远使用 `main`；除非用户明确改变规则，不创建或使用 dev branch。
- 每个已验证的产品批次使用小而原子的 commit，并立即 push `origin/main`；不把无关 UI、backend、release、docs 和 QA 混在一个大 commit。

## 11. GitHub、Release 与一行安装

- `https://github.com/ralphite/logue` 的旧实现完全废弃；当前 Logue 是唯一代码来源，旧实现、旧分支和旧 Release 不构成兼容来源。
- 仓库和 Release 绝不能包含真实数据、音频、Gemini Key、浏览器状态、临时 QA 隐私或本机绝对路径秘密。
- GitHub Release 提供稳定的一行 `curl ... | shell` 安装入口；用户无需 clone、构建或手工复制。
- 同一命令支持全新安装和覆盖升级：识别并停止当前服务，完整预检候选资产，原子替换程序/Web/Extension/CLI，绝不覆盖当前用户数据。
- 安装结束自动启动服务并等待健康检查；失败时恢复此前可运行版本和服务，不留下半安装状态。
- 安装过程明确询问是否开机自动启动；无交互环境支持显式配置且不阻塞。
- Release 包含版本、Python 3.13 运行要求、校验和和可复现构建证据。
- Release 只提供一个平台无关的 Python 服务包；一行安装器在 macOS 与 Linux 上都用 `python3.13` 安装/覆盖 API 与预构建 Web App、保留数据并立即启动，可选择配置 macOS LaunchAgent 或 Linux systemd 用户级开机启动以及显式监听地址。Extension 作为独立 Chrome 资产连接该服务。
- 对分离部署，README 与 Installer 输出必须明确区分 Linux 服务命令和 MacBook Extension 客户端命令；Chrome 安全模型不允许静默安装未上架扩展，因此必须提供准确的一次性 `Developer mode` → `Load unpacked` 步骤，不能声称全自动安装。
- README、Installer 输出、Release notes 和所有用户可见安装页面使用英文。
- 当前 `main` 的最新已验证版本必须进入最新 Release；旧 Release 通过不能替代当前主线发布。Release 只能在本目标内所有当前桌面功能、设计终审、Storybook 状态覆盖、真实验收与数据整理均完成后进行，不能为了发布而跳过未完成需求。

## 12. 当前优先级

当前优先顺序以用户最新纠正为准：

1. **当前 P0：完成 Python 3.13-only macOS/Linux Release + MacBook Chrome/Web 通过可变局域网域名连接的真实闭环**。目标机无 Go、无 Node、不能依赖本项目原生二进制；安装器下载并解压平台无关包，用 `python3.13` 启动包含预构建 Web 的服务，保留当前数据，并覆盖 macOS/Linux 安装启动、动态 origin 权限与断线恢复；
2. 修复真实桌面 Web 与 Chrome Extension 的其余 P0/P1 核心流程；
3. 完成一致、共享、极简的 Web 组件系统与真实页面；
4. 让 Storybook 完整覆盖生产组件和所有有意义状态；
5. 清除 legacy 代码/格式并安全一次性更新当前真实数据；
6. 完成全产品 Notion/ChatGPT 对照与独立终审；
7. 在以上全部完成后，发布当前最新 `main` 并真实覆盖升级。

**桌面 Linux → MacBook 的 LAN/远程服务连接是当前最高优先级，不再延期。Mobile 与物理手机仍延期。** 现有响应式体验不应被故意破坏，但当前不投入移动端专项优化。

## 13. 真实验收场景

以下场景必须在当前真实环境中成立；Mock、Storybook 或新建临时空数据环境不能替代当前用户数据验证：

1. Toolbar 与物理 `Cmd+Shift+L`/`Ctrl+Shift+L` 均可打开和关闭原生 Side Panel；MV3 idle 后首次 toggle 仍正确。
2. 标准 input/textarea 聚焦后，一次点击 launcher 开始；`Enter` 停止、转写、保存并只插入一次；宿主表单不提交。
3. ChatGPT contenteditable 完成同样流程，不自动发送；取消、断线、目标丢失和重试都不产生重复数据。
4. starting/permission waiting 时点击 Cancel 或 `Esc` 立即退出；迟到回调不恢复录音；关闭 Side Panel 后麦克风立即停止。
5. 选区右键直接保存；另一个右键动作在 Side Panel 查看；分别完成无批注、文字批注和语音批注。
6. 无选区打开 Side Panel，基于当前页面录音并保存页面关联 Material，不依赖网页输入框。
7. 在 Logue Web App 自己的真实输入/编辑目标使用 Extension 录音与 Generate 插入。
8. 自动整理对多条真实内容给出合理 Project/Tags；高置信安静完成，低置信显示理由/置信度并可修改，人工确认不被覆盖。
9. 创建、编辑和复制多个 Skills，分别用于转写、整理、短回复、QA 和 Document；Web 与 Extension 结果可追溯。
10. Documents 列表切换不重建或丢滚动；Markdown 输入/粘贴、Undo/Redo 与编辑自动保存稳定安静；失败局部可重试；Citation 和 Sources 定位/增删稳定。
11. Sources 与 Material detail panel 默认宽度合理，可通过共享 resizer 扩至全部剩余空间；关键内容无双滚动、遮挡或不可达。
12. 原始音频在播放前显示时长，播放、转写、最终采用文字和来源链一致。
13. 断开 Python 服务只显示局部可恢复错误；恢复后重试不重复保存/插入。
14. 刷新、服务重启和浏览器重启后，当前真实 Materials、Audio、Projects、Tags、Skills、Documents、Sources、Settings 仍在。
15. Gemini Key 只在 Python 服务进程环境；真实中英文、中英混合、长句和项目术语转写达到 `../prototypes/vibedoc` 同源质量门槛。
16. Storybook 根 URL 和稳定 deep links 在真实浏览器显示内容；production component inventory 与所有有意义状态无未解释缺口。
17. 用项目内保存的真实 Notion/ChatGPT 对照截图审查 Logue 全部主要页面；无未解决 P0/P1 一致性、简洁性、宽度、层级和交互问题。
18. 一行 curl 在隔离环境全新安装后自动启动并健康；无需源码或构建工具。
19. 同一命令覆盖当前安装，安全停止/替换/启动；当前数据完整不变；开机启动接受/拒绝均正确；失败可恢复。
20. 一次性数据转换前后均有备份和真实读取验证；转换完成后代码库不保留 legacy parser/migration/fallback/test。
21. Linux 主机显式监听私网地址或由受控反向代理提供用户已知域名；MacBook 可直接打开同源 Web App，并在 Extension 中连接该地址，完成 status、当前页面历史、右键选区保存、语音保存和 Generate/Skill API 流程。
22. 防火墙分配的新域名替换旧域名后，`Connect` 只请求新 origin 权限并通过 Logue/API 版本验证；失败或取消保留旧配置，成功后无需重装 Extension 即恢复流程；Chrome 与 MV3 worker 重启后配置仍有效。
23. Linux 一行安装在无既有数据机器上自动启动并通过健康检查；重复覆盖安装不会删除数据，并正确处理 systemd 用户级开机启动的接受、拒绝和非交互选择。
24. MacBook 不安装或启动服务，只运行独立 Extension 客户端安装命令并从稳定目录 `Load unpacked`；覆盖升级后 Server URL、草稿和其它 Chrome storage 不变，点击 Reload 即使用新版本并继续连接 Linux 服务。
25. 在真实 Google Docs 文档编辑区内看到 launcher，完成点击录音、`Enter` 停止并插入、`Esc` 取消的闭环；隐藏事件 iframe 只承担输入桥接，不能把 launcher 错误夹到 Docs 顶部工具栏。

## 14. 明确禁止与已否定方案

- 禁止“接受转写后再确认一次才能插入”及任何第二次确认。
- 禁止在语音主流程中要求选择 Project、Tag、Reference、归档或先审阅转写。
- 禁止自动按 Enter、自动发送或自动提交宿主页面。
- 禁止旧网页浮层和原生 Side Panel 两套长期并存。
- 禁止把当前 Prompt-only 能力在 UI 中称为 Agents。
- 禁止保留一级 `Generate`，也禁止 Documents/Skills 中存在 `New`、顶部通用 `+` 与局部新建动作的重复入口。
- 禁止显示正常 `running`、`connected`、`Saved`、`Saving` 等噪音。
- 禁止使用过小字体、过窄 panel、无理由的不同内容宽度和不一致 selected 背景来假装极简。
- 禁止把 reusable Notion/ChatGPT screenshots 只放临时目录。
- 禁止在 Extension 中散落固定 localhost URL、让页面代码成为任意 URL fetch 代理，或为方便而申请常驻 `<all_urls>` host permission。
- 禁止 legacy code/data compatibility，除非用户以后明确提出。
- 禁止用文档、测试、截图、Storybook、Build、Commit、Agent 数量或工具调用数量冒充产品完成度。

## 15. 完成判定与持续治理

只有同时满足以下条件才允许完成当前 `/goal`：

- 本文件覆盖用户全部明确要求和最新纠正，不存在模型自行生成的错误约束；
- 上述桌面 Web、Extension、Skills、Documents、Sources、数据和发布真实场景全部通过；
- 当前真实数据已验证，且不存在需要继续支持的 legacy parser/migration/fallback；
- Storybook 生产组件/状态 inventory 无未解释缺口，但不以 Storybook 代替真实 runtime；
- 真实 Notion/ChatGPT 对照与 fresh-context 独立审查没有未解决 P0/P1；
- 最新 `main` 已通过 Release 安装/覆盖升级验证；
- 继续修改的预期用户价值已明显低于风险与成本。

持续执行规则：

- 当前原生 `/goal` 未达标前不得自动暂停或提前宣布完成。
- 当前 `logue` 小时级 automation 每小时唤醒本任务，重新读取本文件、真实 runtime、最新独立审查和状态 tracker；未完成时自动继续最高 ROI 工作。
- 每次 checkpoint 先用 fresh-context、只读 `goal_supervisor` 对照本文件、真实 runtime、当前数据和最新独立审查，给出 `CONTINUE` 或 `REPLAN`。
- 审查后继续唯一最高 ROI 的产品实现；审查本身不算产品进展。
- 维护 `docs/qa/open-tasks.md` 作为唯一日常进度文件，只记录未完全满足的 Bug、Feature 和审查发现；真实用户流程完成后立即删除对应行，不再汇报已完成项。`docs/qa/bug-feature-status.md` 仅保留历史证据。
- 任一后续用户纠正与本文件冲突时，先更新本文件和 `docs/user-requirements.md`，再继续实现。

## 16. 需求事实来源顺序

1. 用户最新明确纠正；
2. 当前 Codex task 中全部用户消息；
3. 原始 ChatGPT session：`https://chatgpt.com/g/g-p-6a6e3ab1be3c81918740f240d4d0b21a/c/6a6e3b36-42f8-83e8-a8cb-1e792754f2da`；
4. `docs/user-requirements.md` 中已核实记录；
5. 产品规格、交互规格、设计系统和实现判断。

任何模型、旧代码、旧测试、旧数据或旧审查生成的流程和名词都低于用户明确要求，不能反向改写目标。
