# Logue bug 与 feature 状态

更新时间：2026-08-03 02:18（America/Los_Angeles）

这是用户历史 bug / feature request 的唯一滚动清单。`PASS` 表示实现和与风险相称的真实运行证据都存在；`PARTIAL` 表示核心已实现，但仍缺指定环境的最后闭环；`OPEN` 表示尚未交付；`NOT_APPLICABLE` 表示请求指向浏览器拥有且扩展无法控制的原生 UI。测试、提交、文档和截图本身不把状态升级为 `PASS`。

## Bugs

| ID | 用户报告 / 要求 | 状态 | 当前结论与证据 |
|---|---|---|---|
| B01 | 不得出现“接受后再确认插入”的第二次确认 | PASS | 当前原生 Side Panel 已在真实 Chrome 完成“一击开始 → Enter 停止 → Gemini 转写 → 保存 → 单次插入”；成功后安静回到 Record，没有前置审阅或第二次确认。 |
| B02 | 左栏搜索和按钮结构不稳定、导航随长列表滚走 | PASS | 一级栏无搜索；一级导航固定，内容区独立滚动；Generate 只保留稳定的 Documents / Skills 行。 |
| B03 | Extension 面板点击跳位、首次点击无效 | PARTIAL | fixture textarea 首击已通过；标准 input 与当前原生 Side Panel 的真实 ChatGPT 富文本仍须复验，不能由 fixture 推导为完整 PASS。 |
| B04 | 麦克风启动中 Esc 无法取消、无可见取消、迟到回调回写 | PASS | 真实 Chrome 已验证 Esc 立即取消且资料数不变；录音中关闭原生 Side Panel 也会立即停止麦克风。tab/session 防护忽略迟到结果。 |
| B05 | Extension 启动器不在 Tab 顺序、无 focus 状态或快捷键提示 | PASS | Tab 可聚焦语音入口，存在 focus ring 与 `⌘⇧L` 提示；录音期 Enter 停止并插入，Esc 取消，且不抢占普通文本输入。 |
| B06 | 自动 Tag / 项目关联机械且不相关 | PARTIAL | 当前新资料由可定制 Automatic organization Skill 做内容分类；高置信安静写入，低置信只给建议并显示理由、置信度和人工复核；无可靠匹配时允许空关联。现有用户资料的历史分类理由不改写。 |
| B07 | 资料详情存在巨大空白、内部滚动条和底部内容不可达 | PASS | 详情改为单一滚动容器；桌面与 320px 均可滚到风险提示、记录链、组织、批注和删除。证据：`/tmp/logue-material-detail-320-current.png`、`/tmp/logue-material-detail-320-end-current.png`。 |
| B08 | 音频播放前时长显示 0:00 | PASS | `RecordingAudioPlayer` 在 metadata 可用后显示真实 duration；真实资料在播放前显示 `0:03`。 |
| B09 | 资料详情与生成/文档面板缺少 resizer，右侧不能占满剩余空间 | PASS | 一级导航、Generate 导航、资料详情、文档列表/来源等竖向边界共用可访问 resizer；右侧最大值按实时剩余空间计算，不再被固定上限截断。 |
| B10 | Stream header 与列表，以及其他页面 header / 正文不在同一垂直轴 | PASS | Stream 使用共享高密度列；Documents、Projects、Settings、Generate、Skill editor 使用共享阅读/编辑轴和同一响应式 padding。 |
| B11 | 左栏/Generate 栏之间缺少边界 | PASS | 展开态使用统一低对比度边界或可拖拽分隔；折叠 rail 保持边界。 |
| B12 | Documents / Agents selected 背景范围不一致 | PASS | 两行共用相同 44px row skeleton，selected 背景覆盖整行并包含右侧 plus；fresh-context 审查已在真实 Chrome 重新确认两种选中态。 |
| B13 | 正常状态显示 `Local service running`、`Saved`、`Saving` 等噪音 | PASS | 正常连接和成功自动保存完全静默；只在 disconnected 或 save failed 时出现信息。真实 Settings / Projects / Skill 页面无正常状态文案。 |
| B14 | Copy 文案重复上下文、过于啰嗦 | PASS | 可见动作统一为 `Copy`；完整对象只保留在 `aria-label`，成功后仅短暂显示 `Copied`。 |
| B15 | 左栏折叠/展开时图标水平跳动 | PASS | 品牌和所有一级图标共用固定 44px slot 与相同左 padding；真实展开/折叠截图已比较。 |
| B16 | 折叠栏没有 ChatGPT 级 tooltip | PASS | 使用可访问 Tooltip 组件，hover / focus 均可发现，260ms 延迟；真实 Chrome 已显示 `Stream` tooltip。 |
| B17 | 独立右侧 collapse 按钮多余 | PASS | 展开栏仅在整个侧栏 hover/focus-within 时，于栏右侧显示收起控件；折叠栏保持固定品牌与图标锚点，并可键盘展开。 |
| B18 | 320px 详情批注区遮挡风险正文、Projects 最后一行被底栏遮挡 | PASS | 详情正文和操作在同一可滚动安全区；Projects 底部预留完整空间。证据：`/tmp/logue-projects-320-bottom.png`、`/tmp/logue-material-detail-320-end-current.png`。 |
| B19 | 平板关闭/完整页热区不足 44px、主导航无文字 | PASS | 768px 保留一级文字，详情与新建资料关闭/完整页命中区至少 44×44px；已有真实平板证据。 |
| B20 | 320px Generate 的 `Documents` 被截断 | PASS | 移动 Generate 行保留完整 Documents / Agents 文案和独立 44px plus，移除不必要的前置图标。证据：`/tmp/logue-generate-320-fixed.png`。 |
| B21 | Web UI / Web code 混用中文 | PARTIAL | 当前 `apps/web/src` 产品文案、无障碍文案和测试命名无中文；用户自有资料、项目名和自建 Skill 原样保留。系统 Skill、固定文案和新分类理由为英文；用户既有派生内容不作静默改写。 |
| B22 | 公开安装默认把无认证 API 暴露到局域网 | PASS | `v0.2.1` 安装器默认只监听 `127.0.0.1`；真实公开升级后 `lsof` 确认为 `127.0.0.1:18831`，不是 wildcard。显式 LAN 能力仍保留，但安全配对前不作为默认公开入口。 |
| B23 | Extension 覆盖升级存在稳定目录短暂消失 | PASS | 安装器先完整写入版本化 Extension 资产，最后只原子替换 manifest；旧 manifest 与旧资产在切换前后都保持可读。跨版本和同版本重复安装回归均通过。 |
| B24 | 自定义安装端口的发布版 Web 错连固定 `8787` | PASS | 真实 `v0.2.0` 在 `18831` 复现断线；`v0.2.1` 改为只有 Vite `5173` 才连接 `8787`，任何 Go 托管端口均使用同源 API。公开升级后真实浏览器成功加载资料、文档和来源，控制台无 warn/error。 |
| B25 | 输入框旁语音与生成两个入口长期并列，主操作不够极简 | PASS | 当前构建在真实 ChatGPT contenteditable 中只显示一个语音入口；生成不与主入口并列。录音时原位变为 Cancel 与 Stop and insert。 |
| B26 | 录音中关闭原生 Side Panel 后麦克风继续运行 | PASS | 初次真实回归复现后已改为 content-script 生命周期 Port，并保留 background close/tab-switch 与页面卸载三层停轨；复测关闭后 Chrome 麦克风指示立即消失，未保存资料。 |
| B27 | `Cmd+Shift+L` 应打开/关闭 Logue Side Panel | PASS | 2026-08-03 已在真实 macOS Chrome 以物理 `⌘⇧L` 打开并再次关闭原生 Side Panel；打开后焦点进入 Side Panel document。 |
| B28 | Chrome 原生 Side Panel 顶栏不应显示 unpin | NOT_APPLICABLE | unpin 与 close 均由 Chrome 浏览器原生顶栏拥有，Extension API 无法删除或隐藏；Logue 内容内部没有重复 header、pin 或侧位设置。 |

## Features 与交付要求

| ID | Feature / 目标 | 状态 | 当前结论与未关闭项 |
|---|---|---|---|
| F01 | Notion 式资料流、文档列表和文档编辑 | PASS | 生成长内容进入持续可编辑文档；文档列表、编辑器、来源引用和自动保存共享安静工作区。 |
| F02 | 产品一级名称用 Stream / Projects / Generate / Settings，不用 View / Inbox / 成果 | PASS | 可见一级 UI、稳定路由和代码模型只使用当前英文产品名；旧 `views` / `agents` 导航与模型别名已删除。 |
| F03 | Generate 只保留 Documents / Skills；行尾 plus 分别新建 | PASS | 无 `New`、无顶部重复 plus；点击行只更新列表，点击行尾 plus 才创建。 |
| F04 | 极简网页语音输入：聚焦才显示、一键开始、停止并插入、取消、快捷键 | PARTIAL | 2026-08-03 已在真实 ChatGPT contenteditable 与 Logue textarea 完成非空录音 → Gemini → 保存 → 单次插入，且未发送；标准 input、目标丢失、断线与重试幂等尚未以当前原位架构完整闭环。 |
| F05 | 自动项目/Tag 整理，低置信可审阅，任何 item 可事后编辑 | PARTIAL | 分类、建议/确认、内容/项目/Tag 编辑和人工判断保护已有真实证据；真实库仍有 14 条旧低置信中文理由，需安全一次性整理后才能关闭。 |
| F06 | 多个可定制 Skills，用于转写、整理、短回复、QA、文档 | PARTIAL | 现有对象可编辑/复制/设默认并能产生可追溯 Skill run；Web 选区变换已实现。仍需在已安装扩展的真实权限环境完成网页选区 Skill 流程验证。 |
| F07 | Extension 中基于资料生成回复并插入、不自动发送 | PASS | 2026-08-03 在真实 ChatGPT 通过原生 Side Panel 生成 `Logue capture is ready.`，点击 Insert 后仅写入 ChatGPT 草稿，Send 未被点击；测试草稿已清除。 |
| F08 | Logue Web App 自己也能使用 Extension | PASS | 2026-08-03 在真实 `127.0.0.1:5173/?view=generate` 验证自动聚焦后出现单一语音入口；非空语音经 Gemini 转写后只写入 Task，未自动生成。运行时截图见 `docs/design/references/runtime/extension-inline-voice-logue-web-success-20260803.png`。 |
| F09 | 所有关键竖向 panel 可拖拽并保持同一风格 | PASS | 至少一级导航、Generate、资料详情、文档列表和来源面板使用同一 `PanelResizer` 体系；键盘与 pointer 均支持。 |
| F10 | 手机完整可用并可从同一局域网访问 | PARTIAL | Web/API 支持显式局域网监听，320/390/768 已覆盖 Stream、Projects、Generate、详情和底栏；公开安装为保护资料默认只监听本机。仍缺安全配对入口和一台物理 iPhone 的触控、旋转、刷新与文档编辑闭环。 |
| F11 | React + TypeScript + Tailwind + Storybook；Go；Gemini 终端环境变量 | PASS | 架构与构建已落地；Gemini Key 只由 Go 进程读取，不进入 Web、Extension、资料、日志或 Release。 |
| F12 | GitHub 旧仓库彻底替换、永远 main、小提交后立即 push | PASS | `ralphite/logue` 已由当前项目替换；当前分支与 upstream 均为 `main`；本轮逻辑批次均提交后立即推送。 |
| F13 | 一行 curl 安装、覆盖升级保留数据、询问开机启动、安装后自动启动 | PARTIAL | 发布版安装/回滚证据存在，但当前 installer 仍有中文用户可见输出，且最新 main 尚未重新完成真实安装/覆盖升级。 |
| F14 | 最新主线也必须进入 Release | OPEN | 当前 `main` / `origin/main` 为 `f374308`，公开 `v0.2.3` 是旧祖先；必须在所有核心闭环后发布和真实验证。 |
| F15 | ChatGPT.com / Notion / 竞品级独立产品设计审查 | PARTIAL | 原生 Side Panel 与渐进式启动器完成可复用产品设计代理审查并达到 9.1/10 PASS；全产品最新 Web、移动和 Extension 截图仍需一次统一 Notion/ChatGPT 对照终审。 |
| F16 | 提供真实截图 | PASS | 可复用、无敏感信息的当前截图保存在 `docs/design/references/runtime/`；例如生成页 input-first 与扩展 Side Panel 页面资料流。 |
| F17 | 每小时自动重启当前 goal 并继续最高 ROI 工作 | PASS | `logue` automation 持续唤醒本任务；只有 fresh-context 与直接证据共同支持时才能结束。 |
| F18 | Notion 式 Selection Skills：Document 与网页编辑目标原位变换 | PARTIAL | 已真实观察 Notion 配置与选区 `Skills` 菜单；Logue Document 已在真实运行验证轻量入口、菜单、Esc/↓ 键盘操作和不越过 Sources 的定位，运行会持久化 Skill revision、选区、目标、输出与采用结果，并在来源登记失败时保留可重试动作。Extension 的 textarea/contenteditable 新入口已实现、构建和单测通过，但已安装 Chrome 扩展尚未允许重载，故不能关闭实机闭环。 |
| F19 | 所有搜索入口的语义检索、排序、解释和本地降级 | PASS | 2026-08-03 已在真实 Chrome 验证 Stream、Generate 的 Documents 列表、Document Sources（All materials）与 Generate source picker：自然语言查询按语义相关性排序并展示简短英文理由。Documents 主列表补上此前缺失的生产搜索入口，搜索期间使用共享、局部的 `Finding related…` 状态，避免空白或错误的无结果结论。独立无 Gemini 运行时副本验证 Material / Document API 返回 `strategy=local` 且仅有可解释的直接匹配。 |
| F20 | Storybook 生产组件 inventory 与所有有意义状态 | PARTIAL | `Native Side Panel` 直接复用生产 `SidePanelView`，已覆盖 Current Page、Selection、Starting、Recording、Transcribing、Target Lost、Service Unavailable、Generate、Empty；`Pages/App Compositions` 直接运行生产 `App`，覆盖 Stream、Material Detail、Projects、Documents、Skills、Settings。侧栏以全高无浮层视口呈现；真实 DOM 键盘回归覆盖 R、Enter、Esc 与编辑文本不抢键。仍缺完整 production component→Story→state inventory，以及各页面 empty/loading/local-error/review 等有意义状态。 |
| F21 | 清除 legacy 代码、旧路由/数据/测试/未挂载 demo | PASS | 真实 `.logue-data` 已完整备份、一次性转换为 `skills/` 与 `skill-runs/`、在 live API 与隔离导出恢复中验证后删除转换工具；旧 `/v1/agents` 返回 404。旧 demo seed、路由/字段 alias、启动修复与旧 Chrome 降级分支均已删除。 |

## 当前未关闭队列

1. **P0（Selection Skills Extension 实机闭环）**：在可重载的已安装 Chrome 扩展中，验证 textarea 与 contenteditable 选区入口、菜单、Esc、漂移拒绝和不自动提交；当前构建/单测不替代这一项。
2. **已关闭（legacy 清理）**：旧 Prompt-only Agent schema、旧路由/未挂载 demo 与兼容分支已在一次性备份、转换、真实验证后删除。
3. **P1（当前 Extension 核心缺口）**：完成标准 input、选区文字/语音批注、无输入框页面录音、页面历史刷新、目标丢失/断线/重试幂等与焦点防护的真实闭环。
4. **P1（Storybook 与英文文案）**：改为生产组件 inventory、全状态覆盖，并清除 Installer/fixture/系统 copy 中的中文。
5. **P1（全产品终审）**：用当前主要 Web/Extension 截图与项目内 Notion/ChatGPT 参照完成两名 fresh-context 独立审查，直接修复无歧义高影响问题。
6. **P1（发布）**：仅在以上核心闭环完成后，发布当前最新 `main` 并完成真实覆盖升级。
7. **P3（移动端，用户明确后置）**：安全 LAN 配对入口与物理 iPhone 的触控、旋转、刷新、Stream / Projects / Generate / 文档编辑闭环。
