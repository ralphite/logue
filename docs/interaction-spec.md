# Logue 核心交互规格（clean-slate）

本文件只定义共享交互合同。一级 IA 与 feature scope 以 `docs/product-spec.md` 和 `docs/design/capture-to-reuse-product-design-2026-08-04.md` 为准。

## 可取消 mutation / generation 合同

Capture、Draft、Selection Skill 和写回共用：

| 状态 | 可见动作 | 规则 |
| --- | --- | --- |
| `idle` | 当前主动作 | 焦点留在任务入口 |
| `pending` | `Cancel` | 阻止重复提交；取消使 request token 失效 |
| `recoverable_error` | `Retry` + `Cancel/Copy`（按场景） | 旧请求不得覆盖新状态；错误用 alert |
| `cancelled` | 返回原任务 | 迟到结果不得保存、写回或重开 UI |
| `applied` | 继续；安全时 `Undo` | 成功静默；history 重试不得再次应用 |

- Menu 打开聚焦首个可用项；方向键/Home/End 导航，Enter 执行，Esc 关闭。
- Dialog/Drawer 关闭后焦点返回原触发器；内容区只有一个滚动归属。
- loading 使用 polite status，不抢焦点；最终失败使用 alert。
- 颜色不能单独表达状态；所有图标按钮有 accessible name 与 focus-visible。

Search 不使用这张表的可见 Cancel。它采用 latest-query-wins：新 query、Clear 或关闭即使旧请求失效，旧结果不得覆盖新 query。

## 语音输入

默认流程：`Focus editor → Record → Stop and insert / Cancel`。

- 麦克风只在真实可编辑目标聚焦时出现。
- Side Panel 有效输入目标使用 `Stop and insert`；页面批注使用 `Stop and save`。
- 仅在 recording 且非 IME composition/key repeat 时消费 `keydown`：`Enter` 停止，`Esc` 取消；不得传播给宿主或触发默认 submit。
- `Cancel` 在 starting、recording、transcribing、saving 和插入完成前始终可用；每个副作用前再次校验 request token。
- Source commit 前取消不创建 Source；commit 后、插入前取消保留 Source、取消插入，显示 `Saved to Library.` 与 `Insert again / Copy`。
- 保存 Source 完成前不得写入宿主；插入不按 Enter，不提交表单。
- 目标失效时 Source 仍保留，提供 `Insert again / Copy`。
- 成功保持安静；连续点击由提交锁和稳定 request ID 保证幂等。

## 网页选区

- 右键 `Save to Logue` 立即保存完整选区。
- 成功静默；不自动打开 Side Panel 或要求选择 Project。
- 保存失败时在原选区附近显示 `Couldn't save to Logue.` 与 `Retry / Change server… / Dismiss`；保留同一 selection snapshot 与 request ID，不自动打开 Side Panel。
- Source detail 的 `Correct transcript` 最多维护一个 active correction；`Add note` 可追加多个文字/语音 annotation。Search/Draft 优先 active correction，原文始终可展开核验。Source picker 在有 Notes 时提供折叠 `Include notes`；展开后逐条 checkbox、默认全不选，Run 记录 annotation IDs。
- 预览可截断，实际保存不可截断；重试不得重复创建。

## Side Panel

- 默认只承担 capture 和局部恢复，不复制 Web App 导航。
- `On this page` 仅显示与当前规范化完整页面 URL 精确相同的 Sources，按 captured time 倒序、最多 5 条；规范化保留 path 和非追踪 query，移除 fragment、`utm_*`、`fbclid`、`gclid` 并统一 scheme/host/default port，不按 origin 混合。无法可靠取得 page URL 时不显示；不做语义扩展或显示 Pages。点击在新标签打开 Web detail。
- `Write with sources` 渐进披露并复用统一 Source picker；至少一条 Source 后才显示 Run。Compose 只有 instruction、选定 Sources、默认 Skill。
- 生成期间保留 instruction/Sources，提供 `Cancel`；失败原地 `Retry`。
- 结果态：`Insert` 主动作、`Copy` 次动作、`Back`；Sources 在编辑框外展开，插入/复制默认只输出正文，不输出内部 citation token，也不自动发送。
- 目标失效时禁用 Insert，显示 `The original editor is no longer available.` 与 `Copy`。Insert 后焦点回宿主插入末尾；Copy 用 polite `Copied`；Back 保留 instruction、Sources 和结果。
- Adopt 后成功安静；Side Panel 按规范化完整页面 URL 提供折叠 `Sources used`，从 adopted Run 还原 Source 映射。规范化保留 path 与非追踪 query，移除 fragment、`utm_*`、`fbclid`、`gclid` 并统一 scheme/host/default port，不按 origin 混合不同页面。
- Chrome 控制 Side Panel 的打开、关闭和宽度；产品不绘制伪关闭按钮。

## Library 与 Search

- Library 默认 `All`，另有 `Sources / Pages`；初始不自动打开第一条详情。
- 点击 Source 打开 detail drawer；点击 Page 进入编辑器。
- Search 打开后焦点进入搜索框，同时查询 Sources、Pages、Projects。
- 结果使用单一全局排序：全部精确命中先于语义结果；类型由 icon/metadata 表达，不按类型分组。
- Search 使用 latest-query-wins，不显示额外 Cancel。`No results` 保留 query；失败显示 `Couldn't search. Retry.`，焦点留在输入框。
- 返回结果列表时恢复 query、filter、scroll，并把焦点还给原 row。
- `Clear search` 后焦点回搜索框。
- Source 结果提供 `Open source / New page from source`；后者首次激活后锁定 row action，使用稳定 request ID，成功只创建并导航一次。失败保留 Search 状态，在原 row 显示 `Couldn't create page. Retry.`，Retry 复用 request ID；该快速 mutation 不显示 Cancel。创建后关联 Source、聚焦正文且不改变 Project。向已有 Page 添加来源只通过 Page 内 `Add sources`。Search 不生成聊天答案。
- Search 快捷键用平台无关 `Mod+…` 表述并经真实宿主验证；不得在 input/textarea/contenteditable、IME 或 editor selection 中接管。

## Projects

- Project brief 与 confirmed terms 就地编辑、静默 autosave。
- Sources/Pages 只能由用户明确 `Add` 或 `Remove`。
- 不存在自动归档、Tags、Needs review 或后台覆盖 Project context。
- Page 最多属于一个 Project。Project 页面中的 `New page` 自动关联当前 Project；Source 可由用户明确关联多个 Projects；`Add sources` 使用统一 Source picker。

## Page

- `New page` 立即创建空白 Page，标题 `Untitled`，焦点进入正文。
- `Add sources` 打开统一 picker；Project 内创建默认当前 Project，其他入口默认 `All sources`。空状态无动作，只显示 `No sources yet. Save something with the extension, then return.`，保留 Close/Esc；不假设 Web 能打开 Extension。
- 未选择 Source 时隐藏 `Draft with sources`；生成期间保留 instruction/Sources，并提供 `Cancel`。
- `Draft with sources` 使用行内 compose：instruction、Sources、产品内置且可编辑的默认 `Draft` Skill；`Change skill…` 位于 overflow。
- Run 启动时保存稳定 insertion anchor；结果只插入该 anchor，不覆盖现有正文。Anchor 失效时保留结果，显示 `Insertion point changed.` 与 `Insert at cursor / Copy / Close`。完成后焦点位于插入内容末尾，并提供一次 Undo。
- autosave 成功静默；失败在编辑位置显示 `Retry` 并保留本地草稿。
- citation 点击后打开 Sources panel、滚动、高亮并聚焦对应来源。
- Sources panel 桌面可调整宽度；窄屏覆盖显示，不能隐藏功能。
- 未被引用的 Source 可直接 `Remove from page`；存在 citations 时使用 `Exclude from future drafts`，只更新 drafting context，不删除 citation。被排除项保留在 Sources panel，显示 `Not used for new drafts / Include in drafts`；Header 数量统计全部关联 Sources，drafting 数量只在 Compose 表达。Citation 只随正文编辑删除。

## Selection Skills

- 只在同一稳定可编辑目标、非空选区、非 IME、非 repeat 时显示。
- pending 显示 `Cancel`；Esc 与 Cancel 等价并使迟到结果失效。点击外部关闭菜单也恢复原选区。
- 替换前再次校验目标与选区快照；失效则不写回。
- 结果返回时目标/快照失效则保留结果，显示 `Selection changed.` 与 `Copy / Close`。
- Page 替换进入同一编辑 history；网页只在目标仍存在且替换后文字未变化时显示 Undo。
- Apply 后焦点位于替换范围末尾；Undo 恢复原文字和原选区。
- 多行结果保留真实换行；绝不自动提交宿主表单。
- 默认快捷键必须经过真实 Notion/宿主验证后再定稿。

## Settings 与 Skills

- Settings 分为 `Skills / Model & privacy / Export & backup`。Server URL 只在 Extension 的断连恢复/Advanced 中配置，Web 不复制该字段。
- Skill 支持 create、duplicate、rename、enable/disable、edit instruction。
- 每次编辑形成 revision；Run 使用 canonical context fields：Skill revision、Source IDs、annotation IDs、Project context、instruction、output、adopted target。
- Prompt-only 配置不称为 Agent；无真实需求前不展示模型矩阵、工具权限或模板市场。

## 删除

- Source/Page/Project 的 overflow 提供明确 `Delete…`。
- Page 删除不删除 Sources；Project 删除只解除 Sources 关联并把 Pages 变为无 Project。
- Source 被引用时，确认层显示受影响 Page/citation 数量；确认后删除 Source、音频和对应 citations。

## 键盘与可访问性

- `Esc` 的优先级：取消当前 pending task → 关闭局部 menu/dialog/drawer → 返回原触发器。
- Dialog/覆盖 Drawer 打开时聚焦标题或首个可用控件，Tab/Shift+Tab 留在浮层内，背景 inert；Esc 第一次取消 pending，第二次关闭并恢复触发器。
- 窄屏主导航使用原生 menu/drawer；同一时刻只允许一个覆盖层。Library detail 与 Page Sources 复用 full-width drawer，不产生横向滚动。
- Icon button 点击区域至少 32px；文字保持共享正式字号，不用浏览器缩放解决密度。
- resizer 支持方向键、Shift 加速、Home/End 和清晰 focus-visible。
- 支持 `prefers-reduced-motion`；波形在降低动态效果时停止动画但保留录音文字/时长。
