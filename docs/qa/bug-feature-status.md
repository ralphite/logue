# Logue bug 与 feature 状态

更新时间：2026-08-02 15:18（America/Los_Angeles）

这是用户历史 bug / feature request 的唯一滚动清单。`PASS` 表示实现和与风险相称的真实运行证据都存在；`PARTIAL` 表示核心已实现，但仍缺指定环境的最后闭环；`OPEN` 表示尚未交付。测试、提交、文档和截图本身不把状态升级为 `PASS`。

## Bugs

| ID | 用户报告 / 要求 | 状态 | 当前结论与证据 |
|---|---|---|---|
| B01 | 不得出现“接受后再确认插入”的第二次确认 | PASS | Extension 是“停止并插入 / 取消”单次决策；停止后自动转写、保存、插入，不再进入前置审阅。真实 Chrome 闭环见 `acceptance-status.md` 场景 1–3。 |
| B02 | 左栏搜索和按钮结构不稳定、导航随长列表滚走 | PASS | 一级栏无搜索；一级导航固定，内容区独立滚动；Generate 只保留稳定的 Documents / Agents 行。 |
| B03 | Extension 面板点击跳位、首次点击无效 | PASS | 当前生产 Extension 的 input、textarea、ChatGPT 富文本、选区批注均已完成首次点击到结果的真实链路；目标替换后也只需一次“重新插入”。 |
| B04 | 麦克风启动中 Esc 无法取消、无可见取消、迟到回调回写 | PASS | 真实 Chrome 已验证启动阶段 Esc 立即关闭且无迟到录音；录音态保留可见取消动作。 |
| B05 | Extension 启动器不在 Tab 顺序、无 focus 状态或快捷键提示 | PASS | Tab 可聚焦语音入口，存在 focus ring 与 `⌘⇧L` 提示；录音期 Enter 停止并插入，Esc 取消，且不抢占普通文本输入。 |
| B06 | 自动 Tag / 项目关联机械且不相关 | PARTIAL | 当前新资料由可定制 Automatic organization Agent 做内容分类；高置信安静写入，低置信只给建议并显示理由、置信度和人工复核；无可靠匹配时允许空关联。最新真实语音已生成英文理由，但真实库仍有 14 条旧低置信资料保留历史中文模型理由，尚未安全回填。 |
| B07 | 资料详情存在巨大空白、内部滚动条和底部内容不可达 | PASS | 详情改为单一滚动容器；桌面与 320px 均可滚到风险提示、记录链、组织、批注和删除。证据：`/tmp/logue-material-detail-320-current.png`、`/tmp/logue-material-detail-320-end-current.png`。 |
| B08 | 音频播放前时长显示 0:00 | PASS | `RecordingAudioPlayer` 在 metadata 可用后显示真实 duration；真实资料在播放前显示 `0:03`。 |
| B09 | 资料详情与生成/文档面板缺少 resizer，右侧不能占满剩余空间 | PASS | 一级导航、Generate 导航、资料详情、文档列表/来源等竖向边界共用可访问 resizer；右侧最大值按实时剩余空间计算，不再被固定上限截断。 |
| B10 | Stream header 与列表，以及其他页面 header / 正文不在同一垂直轴 | PASS | Stream 使用 1080px 高密度列；Documents、Project、Settings、Generate、Agent editor 使用统一 820px 阅读/编辑列和同一响应式 padding。 |
| B11 | 左栏/Generate 栏之间缺少边界 | PASS | 展开态使用统一低对比度边界或可拖拽分隔；折叠 rail 保持边界。 |
| B12 | Documents / Agents selected 背景范围不一致 | PASS | 两行共用相同 44px row skeleton，selected 背景覆盖整行并包含右侧 plus；fresh-context 审查已在真实 Chrome 重新确认两种选中态。 |
| B13 | 正常状态显示 `Local service running`、`Saved`、`Saving` 等噪音 | PASS | 正常连接和成功自动保存完全静默；只在 disconnected 或 save failed 时出现信息。真实 Settings / Projects / Agent 页面无正常状态文案。 |
| B14 | Copy 文案重复上下文、过于啰嗦 | PASS | 可见动作统一为 `Copy`；完整对象只保留在 `aria-label`，成功后仅短暂显示 `Copied`。 |
| B15 | 左栏折叠/展开时图标水平跳动 | PASS | 品牌和所有一级图标共用固定 44px slot 与相同左 padding；真实展开/折叠截图已比较。 |
| B16 | 折叠栏没有 ChatGPT 级 tooltip | PASS | 使用可访问 Tooltip 组件，hover / focus 均可发现，260ms 延迟；真实 Chrome 已显示 `Stream` tooltip。 |
| B17 | 独立右侧 collapse 按钮多余 | PASS | 删除独立按钮；鼠标进入整个栏时，左上品牌图标原位切换为 expand / collapse，键盘仍可操作。 |
| B18 | 320px 详情批注区遮挡风险正文、Projects 最后一行被底栏遮挡 | PASS | 详情正文和操作在同一可滚动安全区；Projects 底部预留完整空间。证据：`/tmp/logue-projects-320-bottom.png`、`/tmp/logue-material-detail-320-end-current.png`。 |
| B19 | 平板关闭/完整页热区不足 44px、主导航无文字 | PASS | 768px 保留一级文字，详情与新建资料关闭/完整页命中区至少 44×44px；已有真实平板证据。 |
| B20 | 320px Generate 的 `Documents` 被截断 | PASS | 移动 Generate 行保留完整 Documents / Agents 文案和独立 44px plus，移除不必要的前置图标。证据：`/tmp/logue-generate-320-fixed.png`。 |
| B21 | Web UI / Web code 混用中文 | PARTIAL | 当前 `apps/web/src` 产品文案、无障碍文案和测试命名无中文；用户自有资料、项目名和自建 Agent 原样保留。系统 Agent、固定 fallback 和新分类理由为英文；14 条历史模型分类理由仍为中文派生数据，尚未安全回填。 |

## Features 与交付要求

| ID | Feature / 目标 | 状态 | 当前结论与未关闭项 |
|---|---|---|---|
| F01 | Notion 式资料流、文档列表和文档编辑 | PASS | 生成长内容进入持续可编辑文档；文档列表、编辑器、来源引用和自动保存共享安静工作区。 |
| F02 | 产品一级名称用 Stream / Projects / Generate / Settings，不用 View / Inbox / 成果 | PASS | 当前 Web 一级导航与 URL 兼容层分离，UI 只显示英文产品名。 |
| F03 | Generate 只保留 Documents / Agents；行尾 plus 分别新建 | PASS | 无 `New`、无顶部重复 plus；点击行只更新列表，点击行尾 plus 才创建。 |
| F04 | 极简网页语音输入：聚焦才显示、一键开始、停止并插入、取消、快捷键 | PASS | input、textarea、ChatGPT contenteditable 已在真实 Chrome + Go + Gemini 完成；永不自动提交宿主表单。 |
| F05 | 自动项目/Tag 整理，低置信可审阅，任何 item 可事后编辑 | PASS | Agent 分类、建议/确认、内容/项目/Tag 编辑和不可覆盖人工判断均已真实验证。 |
| F06 | 多个可定制 Agent，用于转写、整理、短回复、QA、文档 | PASS | 系统与自建 Agent 可编辑/复制/设默认；Web 已产生可追溯的 Text、Material、QA、Document run。 |
| F07 | Extension 中基于资料生成回复并插入、不自动发送 | PASS | 真实 ChatGPT.com 已完成独立 Agent 生成与插入；提交计数为 0。 |
| F08 | Logue Web App 自己也能使用 Extension | PASS | 当前 unpacked Extension 重载后，Logue Task 输入框只出现 1 个语音和 1 个 Agent 入口；已完成真实录音 → Enter 停止 → Gemini → 保存 → 插入。资料只新增 1 条、request id 唯一、文字只插入 1 次、Agent run 不变且无自动提交。详见 `logue-in-logue-extension-2026-08-02.md`。 |
| F09 | 所有关键竖向 panel 可拖拽并保持同一风格 | PASS | 至少一级导航、Generate、资料详情、文档列表和来源面板使用同一 `PanelResizer` 体系；键盘与 pointer 均支持。 |
| F10 | 手机完整可用并可从同一局域网访问 | PARTIAL | Web/API 已监听局域网；320/390/768 已覆盖 Stream、Projects、Generate、详情和底栏。仍缺一台物理 iPhone 的触控、旋转、刷新和文档编辑闭环。 |
| F11 | React + TypeScript + Tailwind + Storybook；Go；Gemini 终端环境变量 | PASS | 架构与构建已落地；Gemini Key 只由 Go 进程读取，不进入 Web、Extension、资料、日志或 Release。 |
| F12 | GitHub 旧仓库彻底替换、永远 main、小提交后立即 push | PASS | `ralphite/logue` 已由当前项目替换；当前分支与 upstream 均为 `main`；本轮逻辑批次均提交后立即推送。 |
| F13 | 一行 curl 安装、覆盖升级保留数据、询问开机启动、安装后自动启动 | PASS | 公共 `v0.1.1` 的 install.sh、双架构包和 checksums 已完成隔离 HOME 全新安装与重复覆盖实测；数据、Key 与 LaunchAgent 约束通过。 |
| F14 | 最新主线也必须进入 Release | OPEN | 当前 `main` 已明显领先 `v0.1.1`；安装流程本身通过，但本轮最新 UI/Extension 修复尚未发布。应在当前审查批次稳定后发布下一版本并重跑覆盖升级。 |
| F15 | ChatGPT.com / Notion / 竞品级独立产品设计审查 | PARTIAL | 先前真实截图已完成 ChatGPT.com 严格审查并关闭当时 P1；本轮又完成 fresh-context 盲审和修复。最新 Documents/Agents 与移动截图仍需纳入下一次 ChatGPT.com 对照复审。 |
| F16 | 提供真实截图 | PASS | 当前桌面和 320px 关键截图已保存于 `/tmp/logue-*.png`；Extension 真实运行截图仍保留。 |
| F17 | 每小时自动重启当前 goal 并继续最高 ROI 工作 | PASS | `logue` automation 持续唤醒本任务；只有 fresh-context 与直接证据共同支持时才能结束。 |

## 当前未关闭队列

1. **P1（外部设备）**：物理 iPhone 访问局域网入口，完成触控、旋转、刷新、Stream / Projects / Generate / 文档编辑。
2. **P1（发布）**：当前主线稳定后发布下一版本，并用同一条 curl 命令从 `v0.1.1` 覆盖升级，确认数据和启动项保持。
3. **P2（数据兼容）**：安全处理真实库中 14 条历史中文模型分类理由；不得改资料正文、人工项目/Tag 或自建 Agent。
4. **P2**：将本轮最新桌面/移动/Extension 截图重新交给 ChatGPT.com，与 Notion 和直接竞品做一次最终对照审查。
