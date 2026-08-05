# Logue：从捕获到复用的产品设计

日期：2026-08-04
状态：产品与 UX 设计；尚未代表实现完成
范围：桌面 Web App + Mac Chrome Extension

## 0. 规范优先级与证据口径

本设计按当前 `GOAL.md`、真实 runtime、当前 schema/routes 和用户最新要求编写。它取代旧规范中关于一级导航、`Generate`、LAN/跨机器访问、正常成功状态、字体下限和 panel 宽度的冲突条款。本工作批次同时同步 `docs/product-spec.md`、`docs/interaction-spec.md` 与 `docs/design-system.md`；后续不得继续按相反的旧条款实现。

文档中的“已有基础”必须区分三件事：

- **Code exists**：当前 `main` 中存在实现路径。
- **Runtime verified**：当前实际安装/运行版本已完成真实用户旅程。
- **Open evidence**：仍缺的真实环境、版本身份或数据证据。

旧截图、fixture、单元测试或不同版本的 Extension 只能证明局部能力，不能代替当前 runtime 验收。

## 1. 最终产品判断

截图中的十项候选不是十个独立功能。Logue 应把它们收敛成三条闭环，并贯穿四个价值步骤：

`随手捕获 → 自动组织 → 找回证据 → 基于来源产出`

三条闭环是：

1. `Capture anywhere → safe save → quiet organization → On this page`
2. `Find / Ask → verify sources → draft → edit`
3. `Select → Skill → replace → Undo`

用户只需要理解四个一级对象：Material、Project、Document、Skill。一级导航继续使用：

`Stream / Projects / Documents / Skills / Settings`

不新增 `Ask`、`Inbox`、`Daily` 或 `Agents` 页面。这样既保持 Logue 的内容优先结构，也复用当前已存在的列表、详情、编辑器、Sources 面板和 Extension 浮层。

## 2. 候选功能的处理结论

| 候选 | Code exists | Runtime verified / open evidence | 产品决定 | 优先级 |
| --- | --- | --- | --- | --- |
| Reliable Universal Capture | 网页 launcher、Side Panel、选区保存、先保存后插入 | 当前 Extension 安装身份和真实人声/Docs 完整插入仍需核对 | 不加入口；先完成真实 Chrome/Docs 可靠性验收 | P0 基础门槛 |
| LAN / remote connection | Server URL、统一 background API、连接恢复、Python release 路径 | 临时远程已部分证明；目标 Linux、同源 Web/API、重启与当前客户端版本仍未完整验收 | 作为捕获基础设施；不做云同步或服务器 Dashboard | P0 基础门槛 |
| Ask my work | Stream/Documents 语义搜索与匹配理由 | 真实 Materials 已有局部证据；真实 Documents 数据不足 | 作为现有 `Search` 的自然语言能力，不做聊天页 | P1 |
| Reliable automatic organization | 后台组织、建议、理由、置信度与 `Needs review` | 需要用当前真实资料验证准确率和一次确认持久化 | 不建 Inbox；补齐低置信度筛选和轻量确认闭环 | P1 |
| Selection Skills | Document 与 Extension 选区 Skill、history 与局部 Undo 路径 | 已复现 `Esc`/迟到结果风险；真实宿主仍需版本一致验收 | 固化为选区附近的一次应用、可取消、可撤销动作 | P1 |
| Source-grounded drafting | Skill run、文档生成、Sources 与引用 | 当前真实 Documents/Skill runs 可能为空，不能仅凭旧截图宣称闭环 | 统一短文本、QA 和长文档的来源合同 | P1 |
| Markdown document editor | 内容编辑、Markdown shortcuts、自动保存与引用 | 需要真实文档验证引用、Undo、失败离开与窄宽度 | 以当前内容编辑器为正式体验，不建 source/preview 双模式 | P1 |
| Page memory side panel | Extension `On this page` | 需要当前安装版本验证 URL 切换和焦点不被抢走 | 只显示当前页面最近相关资料 | P2 |
| Daily resurfacing | 无 | 无已验证的重复用户问题 | 推迟；不发通知、不建每日待办 | P3 / 不做 |
| Configurable Agents | 当前只有 Prompt + output/surface 配置 | 不具备完整 trigger/tools/permissions/runs | 继续叫 `Skills` | P3 / 不做 |

这里的核心不是“做更多”，而是把已经存在的能力接成一条可信的用户路径。

## 3. 产品结构

### 3.1 对象关系

- **Material**：一次语音、文字、选区或派生结果。保留原文、来源、时间、音频和父子关系。
- **Project**：长期工作的边界，包含用户确认的背景、术语、Materials 与 Documents。
- **Document**：可持续编辑的内容成果；引用具体 Materials。
- **Skill**：可编辑的任务指令；决定任务、输出、可用上下文和出现表面。

关系是：

`Extension capture → Material → Project/Tags → Search/Selection → Skill → Document or insert`

不存在独立的 Inbox 对象、Ask conversation、Daily item 或 Agent workspace。

### 3.2 生命周期与未来 Context 资格

| 阶段 | 必须保存 | 可以进入未来 Context 的条件 | 禁止事项 |
| --- | --- | --- | --- |
| Capture | 原始音频/文字、来源、request ID | 尚不可 | 未保存先插入、自动提交 |
| Material | 原文、准备插入的文字、父子/来源关系 | 用户明确采用、固定或在可靠重复表达中确认后 | 把机器猜测当成用户偏好 |
| Project memory | 用户维护 overview、confirmed terms、已确认 Materials | 仅同一明确 Project 的已确认内容 | 自动混合多个 Projects |
| Skill revision/run | Skill revision、instruction、实际 Source IDs、Project context、原始 output | 尚不可 | 运行时偷偷扩大 Context |
| Adopted output | 用户最终采用的 output 与采用表面 | 可作为弱信号；只有用户固定或可靠重复后成为强 Context | 用未采用结果强化下一次生成 |

Project overview 与 confirmed terms 必须可编辑且正常 autosave 静默。Skill 必须支持新建、复制、编辑、启用/停用和设置适用表面；复制后产生新 Skill identity，修改产生新 revision。后续任一 run 都必须能回溯当时的 Skill revision、Source IDs 与 Project context。

### 3.3 表面职责

| 表面 | 只负责什么 | 不负责什么 |
| --- | --- | --- |
| 网页原位 launcher | 在聚焦输入框中录音、停止并插入、取消；选区 Skill | 项目管理、历史浏览、复杂生成配置 |
| Extension Side Panel | 页面资料、文本/语音保存、短文本生成、错误恢复、Server 设置 | 资料库管理、长文档编辑、聊天历史 |
| Stream | 浏览、搜索、筛选、查看来源、修正组织 | 生成聊天、每日待办 |
| Projects | 维护项目背景与术语，查看关联 Materials/Documents | 文件夹层级、自动执行器 |
| Documents | 基于来源生成并持续编辑文档 | 通用数据库或发布系统 |
| Skills | 编辑可复用指令和适用表面 | Agent 权限、工具市场、运行编排 |

### 3.4 External integration（无一级 UI）

- `Project bundle` 是只读、可重新生成的 Project package，包含明确版本的 Materials、Documents、overview 与来源关系。
- 外部工具只允许追加 `derived` Material/Document；必须携带 `actor`、实际 `source_ids` 与稳定 idempotency key。
- 外部写回不能覆盖原始 Material、已确认 Project memory 或用户 Document。
- 外部结果直接进入现有 Stream/Project，不新增 Agent Inbox 或连接管理页。

### 3.5 共享异步交互合同

Voice、Selection Skill、Generate dialog、Search 与 Sources 共用以下规则：

| 状态 | 主动作 | 次动作 | 迟到结果 | 焦点/播报 |
| --- | --- | --- | --- | --- |
| `idle` | 当前任务动作 | 关闭/返回（如需要） | 不适用 | 焦点留在任务入口 |
| `pending` | 通常禁用重复提交 | `Cancel`（只要尚未产生不可撤销结果） | request token 失效后必须丢弃 | loading 用 polite status，不抢焦点 |
| `recoverable_error` | `Retry` | `Cancel` / `Copy`（按结果是否存在） | 旧 request 不得覆盖新状态 | 错误用 alert；焦点留在错误区域首个动作 |
| `cancelled` | 返回原任务 | 无 | 不得保存、写回或重新打开 UI | 焦点恢复触发器/原选区 |
| `applied` | 继续原任务 | 一次 `Undo`（可安全撤销时） | history 重试不得再次应用 | 成功默认安静，Undo 局部出现 |

- Menu 打开聚焦首个可用项；上下键或 Home/End 移动，Enter 执行，Esc 关闭并恢复原触发器/选区。
- Dialog 使用共享 focus trap；关闭后焦点返回触发动作。生成中取消必须保留本次 instruction/Sources，便于再次打开或重试。
- 引用定位后，正文和 Sources panel 都保持目标与 focus-visible 可见。
- 所有状态同时用文字或可读图标表达，颜色不能单独承载意义。
- Drawer/panel 的 Header 固定，内容区有唯一明确滚动归属；关闭后恢复打开它的控件焦点。

## 4. 工作流一：随手捕获

### 4.1 用户结果

用户在当前网页说一次或保存一次选区，内容立即用于当前任务，同时成为可追溯的 Material。项目、Tag、整理和复用都在保存之后发生。

### 4.2 语音输入

默认流程只有：

`聚焦输入框 → Record → Stop and insert / Cancel`

#### 入口

- 只有真实可编辑目标获得焦点时，原位显示一个麦克风图标。
- 不同时显示项目、Skill、设置、历史或“已连接”。
- Side Panel 获得焦点且焦点不在编辑控件内时，`R` 开始录音；原位 launcher 用点击开始。

#### 录音态

- 有有效输入目标时主动作：`Stop and insert`；只有保存页面批注时使用 `Stop and save`。键盘为 `Enter`。
- 次动作：`Cancel`；键盘 `Esc`。
- 显示录音时长；波形只在确实收到音频时出现。
- `Cancel` 丢弃本次未采用录音，不保存 Material，不写入网页。
- `Cancel` 在 `starting / recording / transcribing / saving` 以及插入完成前始终可见并可用。取消立即退出、使 request token 失效、停止麦克风并丢弃未绑定 capture；任何迟到回调不得保存、插入或重新打开 UI。

#### 停止后的事务顺序

1. 停止采集并保留本次音频。
2. 转写。
3. 保存原始音频、机器转写、本次准备插入的文字、来源与 request ID。
4. 保存成功后，写入仍有效的原输入框。
5. 不按 Enter，不提交网页表单。

若无法可靠观察用户后来在宿主编辑器中的修改，不得把“准备插入的文字”命名为最终采用文字；最终采用只记录 Logue 可以明确观察到的 `Insert` / `Adopt` 动作。

成功不显示 Toast 或完成页。用户看到文字已出现在输入框，就已经获得足够反馈。

#### 恢复状态

| 问题 | 局部信息 | 动作 |
| --- | --- | --- |
| 麦克风未授权 | `Microphone access is required.` | `Allow microphone` |
| 转写失败但音频已保存 | `Couldn't transcribe. Recording saved.` | `Retry` / `Cancel` |
| Material 保存失败 | `Couldn't save. Nothing was inserted.` | `Save again` / `Cancel` |
| 原输入框失效，Material 已保存 | `The original editor is no longer available.` | `Insert again`（重新聚焦后）/ `Copy` |
| 服务不可达 | `Can't reach Logue` | `Retry` / `Change server…` |

错误只描述用户目前能做什么，不显示请求 ID、端口、进程或 Gemini 技术细节。

### 4.3 网页选区

保留一个右键入口，不把直接保存强迫成 Side Panel 表单：

- `Save to Logue`：立即保存完整选区，成功保持安静。
- 用户随后主动打开 Side Panel 且原选区仍可识别时，显示已经保存的原文与 `Add note`；不得要求再次保存原文，也不得产生重复 Material。

- 原始选区只读；视觉可截断，保存内容不可截断。
- 原文和批注永远是两个 Materials，批注的 `parent_ids` 指向原文。
- 静态网页不做就地替换，避免改变来源事实。
- 保存成功后面板可关闭；不要求选择项目或 Tag。

### 4.4 任意 Material 的追加批注

Material detail 提供一个渐进式 `Add annotation` 动作，支持文字或语音：

- 文字为空时不显示保存动作；语音使用 `Stop and save` / `Cancel`。
- 每次批注形成独立、可编辑的子 Material，`parent_ids` 指向当前 Material，并继承来源页面关系。
- 批注不得覆盖原 Material；重试使用稳定 request ID，不重复创建。
- 成功后新批注在当前 Material 的 follow-up chain 中出现，默认不显示 Toast。

### 4.5 LAN / remote connection

连接是捕获能力的基础设施，不是日常功能。

- 正常连接时不显示连接徽标、绿色状态或服务器地址。
- 仅在服务不可达时展示 `Can't reach Logue`。
- 只有当前打开的页面是已验证、带 Logue product marker 的 Web App，且它提供经过验证的精确 origin 时，才显示 `Connect to {host}`；否则显示 `Retry`。不得扫描局域网、猜测 host 或自动切换服务器。
- `Change server…` 打开同一面板内的紧凑设置，字段名 `Server URL`，动作 `Connect` / `Cancel`。
- 连接成功后回到原任务；若存在待插入文字，必须保留它。
- Web App 不新增服务器管理页；Settings 只保留当前服务与数据/模型配置。

明确不做：云账号、自动公网 Tunnel、多服务器列表、同步冲突 UI。

#### 非 UI 完成门槛

- 同一个 Python 3.13 服务在 macOS/Linux 提供同源 API + production Web；目标主机不需要 Go、Node.js、npm、pip 或本项目原生二进制。
- Linux 主机可显式监听私网/VPN或位于受控反向代理后；安装时必须提示当前没有公网认证，只能受防火墙/代理保护。
- Mac Chrome 只安装独立、带校验和的 Extension 客户端资产，不要求 Mac 启动本地服务。
- Server URL 只接受规范化 `http(s)` origin，拒绝凭据、query、fragment 与非 Web scheme，并只存于该 Chrome 安装的 `chrome.storage.local`。
- 所有 Extension API 统一由 background 使用当前 Server URL；content script、Side Panel 和 helper 不得绕过配置直连 localhost。
- 动态 origin 权限、当前 Extension 版本身份、Chrome/MV3 worker/服务重启、Web/API 同源访问和断线恢复都必须在目标环境通过。

### 4.6 捕获验收

- 一次 `Stop and insert` 只产生一条 Material、一次网页插入、零次自动提交。
- 保存完成前网页不可出现转写文字。
- Chrome 刷新、Extension Reload 或服务重启后，已保存 Material 和音频仍可读取。
- 目标失效不会造成数据丢失；用户可重新聚焦并插入或复制。
- 真实 ChatGPT、标准 textarea 和 Google Docs 分别完成短句口述验收；fixture 不能替代真实页面。
- 验收记录必须包含当前实际安装的 Extension 版本、资源路径和截图；旧 QA build 或不同 manifest 不能代表当前代码。

## 5. 工作流二：找回证据（Ask my work）

### 5.1 产品形式

`Ask my work` 是能力名称，不是 UI 名称。界面仍然使用：

- Stream：`Search materials`
- Documents：`Search documents`
- Sources 面板：`Search Logue materials`

用户可以输入关键词，也可以直接输入自然语言问题，例如：

`Where did I say the LAN recording failed last week?`

结果仍然是可验证的 Materials/Documents，不生成一个可能掩盖来源的聊天答案。

### 5.2 排序合同

1. 完整直接匹配始终最先。
2. 语义相关结果随后出现。
3. 同等级按相关性，再按最近时间。
4. 模型只能返回提供给它的 Material/Document ID；不能创造结果。
5. 模型不可用时安静回到本地直接搜索。

### 5.3 结果行

Material 行只回答四个问题：

- **是什么**：命中的原文摘录或文档标题。
- **属于哪里**：Project；没有项目时显示 `Unfiled`。
- **来自哪里**：来源域名或产品化本机来源名。
- **什么时候**：短日期。

Document 行复用 Documents 列表合同：title、Project、source count 与低优先级 updated date；不显示不存在的来源域名。

语义结果增加一条最多一行的匹配理由，例如：

`Related: describes the failed LAN recording test.`

直接命中不需要理由。列表不显示相似度百分比、搜索策略、模型名或“AI result”徽标。

### 5.4 交互状态

| 状态 | 设计 |
| --- | --- |
| 输入中 | 短 debounce；保留当前稳定结果，不闪烁空态 |
| 搜索中 | 只在结果区显示安静 loading；输入框始终可编辑；用 polite status 播报 |
| 有结果 | 列表按上述合同排序 |
| 无结果 | `No matching materials`，提供 `Clear search`；不推荐随机资料 |
| 模型失败 | 继续显示本地结果；不显示错误 Toast |
| 全部搜索失败 | 在结果区显示 `Couldn't search` + `Retry`，使用 alert |

点击结果打开现有 Material detail 或 Document editor；其中展示完整原文、来源、时间、项目和派生关系。搜索结果本身不承担详情职责。

打开结果前记录结果行 ID。返回列表时恢复 query、filter、scroll，并把焦点还给原结果行；`Clear search` 后焦点回到搜索框。

### 5.5 找回验收

- 自然语言问题能返回准确原始片段、来源、时间和可解释理由。
- 输入精确短语时，直接命中不会被语义结果挤到后面。
- 语义零结果不会混入“也许相关”的随机内容。
- 点击结果后能打开确切来源；返回列表时保留查询与滚动位置。

## 6. 工作流一的组织阶段：自动组织，而不是 Inbox

### 6.1 用户结果

每条新 Material 先保存成功，再自动建议 Project 与 Tags。高置信度时安静完成；低置信度时只在该 Material 上提示一次轻量确认，不制造必须清空的收件箱。

### 6.2 状态模型

| 状态 | 行为 | 默认 UI |
| --- | --- | --- |
| `pending` | 后台正在组织 | 不显示；短时间后刷新结果 |
| `organized` | 高置信度归入已有 Project/Tags | 安静显示最终 Project/Tags |
| `needs_review` | 无法可靠归类或建议可能冲突 | 列表显示 `Needs review`；详情显示建议 |
| `confirmed` | 用户应用建议、保留现状或手工修改 | 移除 review 状态 |

系统只能在当前已存在的 Project 白名单中建议归属，不得创建新项目或臆造层级。

### 6.3 Stream

筛选保持一行：

`All / Needs review / Unfiled / Filed`

- `Needs review` 仅在真实存在待确认项时出现；没有时隐藏，避免常驻噪声。
- `Unfiled` 是合法状态，不显示警告色，不形成待办。
- 只有 `kind + 完整规范化 content` 明确相同的 Materials 才沿用当前分组；不得新增模糊相似度去重。组内任一项需要确认时，组显示可读的 review 状态。
- 桌面列表直接显示短文本 `Needs review`；空间不足时使用有可读名称的图标与 Tooltip。黄色只能加强状态，不能单独表达含义。
- 不显示待处理数量红点、完成率或“清空 Inbox”。

### 6.4 Material detail

需要确认时，在标题与内容之间出现一块紧凑的局部提示：

- 标题：`Needs review`
- 一句原因和置信度，例如：`This material could belong to Logue or Browser extension. · 65% confidence`
- 建议 Project/Tags chips。
- 主动作：`Apply suggestion`
- 次动作：`Keep current`

项目与 Tag 同时保持可直接编辑；任何手工修改都视为确认并自动保存。

### 6.5 数据规则

- 自动组织不能修改 Material 原文、来源或父子关系。
- 用户已确认的 Project/Tags 不被后续后台任务静默覆盖。
- 低置信度时保留当前归属；建议只作为 metadata。
- 保存失败时回退到原值，并在操作位置显示 `Couldn't update organization`。
- 批量自动重分类、历史重跑和自动项目合并不在本次范围。

### 6.6 组织验收

- 新捕获无需等待组织即可完成插入或保存。
- 高置信度结果不产生额外用户动作。
- 低置信度 Material 可在一次点击或一次手工修改后完成确认。
- 用户选择 `Keep current` 后，服务重启不会再次要求确认同一结果。

## 7. 工作流二与三的产出阶段：基于来源产出 / 选区改写

产出包含四种结果形态，并共享同一生命周期合同：

1. **选区改写**：直接替换当前选区。
2. **短文本起草**：在 Extension 生成、编辑并插入输入框。
3. **QA**：少量问答留在可编辑短文本结果；需要长期保留或多来源结构时进入 Document。
4. **长文档起草**：在 Web App 生成带引用、可持续编辑的 Document。

### 7.1 Selection Skills

#### 触发

- 只有 Document 或真实可编辑网页目标存在非空选区时，选区附近显示安静的 `Skills` 入口。
- 点击后列出当前 surface 可用、已启用、UI output label 为 `Text`（内部值 `insert`）的 Skills；不得新增兼容别名。
- 菜单只显示 Skill 名称；不显示描述卡、模型、Context 数量或运行历史。
- 第一版不承诺全局快捷键；只有在真实宿主验证不与 IME、repeat 或宿主快捷键冲突后，才增加键盘 invocation。

#### 执行

1. 锁定目标、选区文字和范围。
2. 用户选择 Skill。
3. 菜单显示当前 Skill 的局部 loading。
4. 只有目标和原选区仍未变化时才替换。
5. 替换后显示短暂 `Applied` 与 `Undo`。

运行中按 `Esc` 会立即关闭菜单、清除 invocation snapshot 并使 request token 失效；迟到结果不得写回或重新打开菜单。Document 的 Undo 进入同一编辑历史；网页 Undo 只在目标仍存在且替换后文字没有变化时出现，否则隐藏。

结果可以包含多行 Markdown；在 Logue Document 中转为对应标题、列表、引用和行内格式，在普通网页输入框中以纯文本/Markdown 字符插入，不伪造宿主富文本能力。

#### 失败与恢复

| 问题 | 行为 |
| --- | --- |
| 生成失败 | 保留原选区；菜单内显示 `Could not apply this skill` + `Retry` |
| 选区变化 | 不写入；显示 `Select the text again` |
| 网页目标失效 | 不写入；可 `Copy` 结果 |
| 文字已替换、history 保存失败 | 显示 `Applied` + `Save history again`；不得再次替换文字 |

#### 不做

- 不复制 Notion 的完整格式工具条。
- 不对静态网页选区做原位改写。
- 不在每次应用前显示确认对话框。

### 7.2 Extension 短文本起草

#### 入口

- 聚焦输入框时，默认仍只显示麦克风。
- Side Panel 的次级 sparkle 动作打开生成；不与 Record 同等级常驻在网页上。
- 使用用户设置的默认 Extension Skill；默认不显示下拉，overflow 中提供 `Change skill…`，选择后返回 Compose。

#### Compose

- 标题沿用当前网页标题。
- 输入框 placeholder：`What should Logue write?`
- Context 可以使用当前输入框、显式选区、页面标题/URL、单一 Project 和用户明确选择的 Materials。
- 当前实际来源以一行摘要呈现，例如 `Current field · 3 materials`；点击展开实际使用的 Materials，点击 Material 在新标签打开原始 detail。
- 主动作：`Generate`。

#### Result

- 结果在原面板同一编辑框中可直接修改。
- 未使用 Materials 时不显示 Sources。使用 Materials 时显示可展开的来源摘要；基于资料的事实性结论使用与 Document 相同的 `[Source n]` 映射。
- 主动作：`Insert`。
- 次动作：`Copy`；左上使用现有 `Back to page`，不再增加 `Cancel` 或自定义关闭按钮。
- “不会自动发送”只在首次使用说明或 `Insert` Tooltip 中解释，不作为每次结果的常驻文案。

生成结果采用后记录 Skill revision、输入来源和最终采用文字，但不覆盖原 Materials。

### 7.3 Source-grounded document drafting

#### 入口

只保留两个入口，并进入同一个 `Generate from materials` dialog：

- Documents 中直接使用 `Generate from materials`。
- Project 入口只预填同一流程的 Project；Material detail 可用单项 `Add to document` 打开同一 Source picker。

Stream 第一版不增加常驻复选框、多选模式或批量 `Add to document`。其他 Sources 统一在 dialog 内用现有 Material picker 添加。

Dialog 只需要：

1. `What should this document accomplish?`
2. 当前选中的 Sources，可增删。
3. 主动作 `Generate draft`，次动作 `Cancel`。

Project 由入口带入；无需再建立一套“生成项目”。Skill 使用默认 `Draft document`，需要更换时放在 Advanced disclosure。

- 至少选择一条 Source 才可生成；否则局部显示 `Choose at least one source`。
- Dialog 打开聚焦 instruction；关闭后焦点回到原入口。
- `Generating…` 时保留 instruction/Sources 并允许 `Cancel`；取消使 request token 失效，迟到结果不得创建 Document。
- 只有生成成功后才创建 Document；Cancel 或失败不产生空 Document。

#### 生成合同

- 只发送用户当前选定的 Sources、Project overview 和本次 instruction。
- 输出中的事实性关键结论必须带 `[Source n]`。
- `n` 只能引用本次提供的 Sources，顺序与 Sources panel 一致。
- 没有来源支持的内容必须明确写成建议/待确认，不可伪装成来源事实。
- 生成失败时保留 instruction 和 Sources，只显示 `Could not generate the draft` + `Retry`。
- 成功直接进入可编辑 Document；不再显示成功确认页。

### 7.4 Document editor

Document 使用一个内容优先的编辑面，不增加 Markdown source / preview 双模式。

#### 主体

- 页面第一层是可编辑 title。
- Title 下只保留可操作的 Project 与 Sources count；updated time 移入页面 actions/Tooltip，正常保存保持安静。
- 正文支持 H1/H2/H3、段落、无序/有序列表、引用、粗体、斜体、删除线、行内代码、代码块、链接与 `[Source n]`。
- 输入 `#`、`##`、`###`、`-`、`1.`、`>` 或三个反引号后按空格，转换成对应 block。
- 粘贴 Markdown 自动转换；普通文本保持普通文本。
- `Cmd+Z` / `Cmd+Shift+Z` 覆盖正文与引用关系。
- 自动保存保持安静；只有保存失败才在编辑器附近显示 `Couldn't save` + `Retry`。

#### Sources panel

- 默认关闭；点击 `{n} sources` 打开。
- 桌面宽度可调整，遵循共享 responsive min/default/max，并始终给编辑器保留最小阅读宽度。窄屏使用覆盖 drawer/full-width sheet，不隐藏 Sources。
- 上半区 `Citations`：只列正文已经引用的 Sources，编号与 `[Source n]` 一致。
- 下半区 `Materials`：默认只搜当前 Project；用户可切到 `All materials`。
- 每行显示标题、Project/域名/日期和一行摘录。
- `+` 在当前 caret 插入引用；点击 citation 在正文和 panel 两端定位、高亮。
- `Citations` 每行代表一个唯一 Source。正文中的单个引用只能在正文删除。选择 `Remove source` 时，删除该 Source 的全部 `[Source n]`，随后统一重编号，并提供一次 `Undo`；不删除原 Material。
- Header 固定；`Citations` 与 `Materials` 共用一个明确滚动归属。打开时聚焦 heading/search，Esc/关闭后焦点回到 `{n} sources`。
- Resizer 支持方向键、Shift 加速、Home/End 与可见 focus。

#### 离开与保存

- 正常自动保存时，切换页面无需确认。
- 只有最近保存明确失败且本地有未持久化内容时，才阻止离开并提供 `Stay` / `Leave without saving`。
- 浏览器刷新前，同一真实条件才使用原生 leave guard；不因为 `saving` 或不确定后台状态阻止正常导航。

### 7.5 Skill editor

- 主内容轴只放可编辑 Skill title 与 instructions，采用与 Document 相同的页面式自动保存。
- `purpose` 不作为第二个长期可见表单；若保留该字段，只在 Skill 菜单中作为一句可选描述，否则从数据模型删除，不为 schema 增加噪声。
- `Advanced` 只包含 `Use for`、`Available in` 与 `Context`。`Enable/Disable`、`Duplicate`、删除和“设为默认”移到 overflow 或安静页脚。
- 新建产生默认的最小可编辑 Skill；Duplicate 复制当前 revision 为新的 identity。任一 run 固定引用执行时 revision，不因后来编辑而改变。
- 正常保存保持安静；失败在编辑位置显示 `Couldn't save` + `Retry`，不使用常驻 saved 状态。

### 7.6 产出验收

- Selection Skill 只替换仍有效的同一选区，并可撤销。
- Extension 结果可编辑、插入一次、永不发送。
- Document 生成只使用已选 Sources，引用编号可双向定位。
- `Remove source` 后，正文与 Sources panel 编号保持连续一致，并可一次 Undo。
- Skill 结果包含多行 Markdown 时，段落与列表结构不丢失。
- 页面刷新后正文、Sources、Project、Skill run 与最终采用结果保持一致。

## 8. Page memory：只做当前任务的辅助记忆

Extension Side Panel 在没有录音、处理、错误或生成任务时，可以显示：

`On this page`

### 内容

- 最多显示最近 5 个与当前规范化 URL 完全匹配的 Materials。
- 先按同一 source chain 聚合，组按最近时间倒序；组内批注显示在原文之前。
- 不显示卡片阴影、统计或成功状态。
- 点击在新标签打开对应 Material 的 Web detail；保持原网页任务、Side Panel 状态与宿主编辑焦点，不在面板中复制完整管理功能。

### 出现规则

- 当前页确有历史时才出现。
- 录音、处理、错误、Server 设置、Selection save 或 Generate 过程中隐藏。
- 页面 URL 变化后立即重新计算，不把前一页记忆残留在当前页。
- 同一 URL 没有历史时不显示空状态。

这是上下文帮助，不是 Page memory 产品页。若以后需要“相似页面”而非同 URL，必须先用真实数据证明不会混入错误项目。

## 9. Daily resurfacing 与 Agents 的边界

### Daily resurfacing

当前不做。理由：

- Logue 的主要价值发生在用户正处理某个页面、项目或文档时，而不是制造每日阅读任务。
- 在真实资料仍存在无法稳定解释的 `Unfiled` / `Needs review` 时，主动推送会放大低质量组织。
- 没有证据证明每日提醒比 Search、Project 和 `On this page` 更有效。

未来只有在真实使用出现“明明保存过但经常忘记主动搜索”的重复问题后再设计。即使进入设计，也应先从 Project 页的安静 `Recent` 区开始，而不是系统通知。

### Configurable Agents

当前不做。Prompt-only 能力继续叫 `Skills`。只有同时具备以下四项时，才重新评估 Agents：

1. Trigger：何时自动运行。
2. Tools：能读取或执行什么。
3. Permissions：用户授权范围。
4. Runs：可检查结果、失败与撤销。

在此之前增加 Agents 页面只会复制 Skills 并误导用户系统具备尚不存在的自主能力。

## 10. 跨功能视觉与文案契约

- Web App 可见文案、标识符、无障碍标签和测试描述使用英文。
- 页面与编辑器继续复用共享内容轴，不出现新的局部宽度。
- 主区每个状态最多一个实心主动作。
- 正常保存、连接、后台组织和生成历史记录保持安静。
- 紫色只表示文本选择、引用和键盘焦点；导航选中继续使用中性底。黄色只加强 `Needs review`，红色用于录音、错误和删除；正常连接不需要成功色。
- Tooltip 只解释非必要信息；不在主流程中堆 helper paragraphs。
- Extension 内容始终填满 Chrome/用户提供的 Side Panel 宽度；以约 360px 作为设计基线，但不提供自定义位置、宽度或关闭控件。实际窄宽度保持单列、可滚动、无横向溢出。
- Web Sources/Detail panel 复用共享 responsive min/default/max，可扩展至全部剩余空间；窄屏转为覆盖 drawer，不隐藏核心功能。
- 列表、metadata 与动作使用当前共享可读字号；不得恢复 9–11px 的正式 UI 文本。
- 图标按钮至少 32px 命中区，有 `aria-label`、hover、pressed 与 focus-visible。

## 11. 交付顺序

### Slice 0 — 可靠性门槛

- 真实人声：ChatGPT、标准 textarea、Google Docs 的一次保存与一次插入。
- 目标失效后的 Insert again / Copy。
- Python 3.13 同源 Web/API、目标 Linux 受控网络、独立 Extension 客户端资产与精确动态 origin。
- 目标 Linux 的 Server URL、服务重启、Chrome/MV3 重启恢复，以及当前 Extension 版本/资源身份。

在这些证据完成前，不应把新增能力包装成“Universal Capture 已完成”。

### Slice 1 — 找回与组织闭环

- 以真实资料测试自然语言搜索、理由、来源与返回状态。
- 补齐 `Needs review` 筛选和一次确认闭环。
- 清理真实资料中无法解释的长期 `Needs review`。

### Slice 2 — 来源产出闭环

- Selection Skill 的目标稳定、Undo 与 history 恢复。
- Skill 新建/复制/编辑/启停/适用表面与 revision 追溯。
- Extension 短文本生成的来源摘要与 Insert/Copy。
- Document generation、Markdown paste、citation 双向定位和删除重编号。

### Slice 3 — 页面上下文

- `On this page` 的 URL 范围、最多 5 条和页面切换稳定性。
- 仅在真实使用证明需要时，再评估相似页面或 Project 相关资料。

## 12. 质量验证场景

最终不能只验证单屏，应依次完成以下真实用户旅程：

1. 在真实网页聚焦输入框，口述一句话，保存一次并插入一次。
2. 用 `Save to Logue` 直接保存网页选区；随后从 Side Panel 或 Material detail 添加批注，Web Stream 中看到有父子关系的 Materials。
3. 用自然语言找回该选区，看到准确摘录、来源、时间与匹配理由。
4. 让后台自动组织一条高置信度资料；再处理一条 `Needs review` 并确认。
5. 复制并修改一个 Skill，在 Document 中应用，Undo 后恢复原文；该 run 能回到准确 revision 与 Sources。
6. 选择三条 Materials 生成文档，逐一点击 `[Source n]` 定位来源。
7. `Remove source` 删除中间来源的全部引用，确认正文和 Sources panel 自动重新编号并可 Undo。
8. 返回原网页，Side Panel 的 `On this page` 显示刚保存的资料，不混入其他页面。
9. 在 Voice、Selection Skill 和 Generate 的 pending 阶段分别取消，确认迟到结果不会保存、插入或重新打开 UI。
10. 对任意已保存 Material 添加文字/语音批注，重试不产生重复子 Material。

这些步骤全部通过，才说明截图中的功能真正形成了一个产品闭环。

## 13. 成功标准

- **即时完成：** 用户无需切换到 Web App 就能完成网页输入或选区保存。
- **证据可信：** 搜索和生成结果都能回到确切 Material、来源和时间。
- **整理负担低：** 大多数资料无需人工组织；低置信度只需一次局部确认。
- **复用发生：** 已保存 Material 真正参与后续搜索、Selection Skill、短文本或 Document。
- **界面克制：** 为上述能力不新增一级页面、状态中心、Inbox 或通知系统。

北极星仍是：每周成功完成的、复用了既有项目记忆的输入与产出数量，而不是保存数量或功能入口数量。
