# N9 · 三路 UI/UX review 的汇总,和重做方案

93 个 story 全部截图后,三路独立审:
**A** = Claude 子代理逐张精读(对比度、尺寸用 PIL 在原图上量过);
**B** = ChatGPT(拿到两个关键屏的结构清单,像素盲);
**C** = 我自己对照 theme.css / design.md 的走查。
截图在会话 scratchpad `storyshots/`,不进仓库。

## 已在本轮修掉的

| # | 问题(出处) | 修法 |
|---|---|---|
| 1 | Stream 详情头部只写 "voice" —— 类型站在身份的位置(A11/B1/C) | 标题 = 内容第一句;kind · 时间 · 域名成为头部的一行灰字;Close 有名字 |
| 2 | 转写正文和所有标签一样 13px,整页无处落眼(A4/B5/C) | 正文 15px/relaxed/max-w-prose;"Transcript" 标题移到正文**之前**,动作挂在标题上 |
| 3 | "Hear it again" 读作播放,实际是再问一次模型(B5) | 改 "Transcribe again" + title 说明 |
| 4 | rail 五行同灰截断句,无任何第二事实(A/B3/C) | 每行加 `timeAgo` 作为 detail |
| 5 | "1 to look at \| Groups" 站在列表名字的位置(B2/C) | 列表署名 "Sources";徽章改 "Needs a look · N" |
| 6 | disabled primary 白字压浅紫 **1.93:1**(A2,实测) | disabled 一律中性:surface-muted + muted 字 |
| 7 | AI 出品用 amber 装饰,与真警告同色(A1,design.md 自己禁止) | 新 token `--color-ai`(中性 ink-soft);amber 只留给要人处理的事 |
| 8 | `--color-line-strong` 1.41:1,控件边界看不出是控件(A3) | 新 token `--color-control-line #c3c4bf`(3.05:1)给所有可交互边界 |
| 9 | 面板 Record 是 45px 的幽灵按钮,最重要的动作最不显眼(A8) | 36px primary 填充 |
| 10 | Dictation 空态一句装饰文案,640px 里什么都不教(A/B10/C) | 写清楚结果和快捷键:录了去哪、Enter/Esc 干什么 |
| 11 | This page 空态只有 "0" 和 850px 空白(A7) | 一句话 + 指向已有的 "Save this page" |
| 12 | 面板头部 "Open Logue web app" 吃掉标题的宽度(C/B) | 改 "Open Logue",页面标题拿回空间 |
| 13 | 归属 chip 实心 accent 长得像主按钮,accent 语义过载(A6/B7) | 选中改勾 + 中性底;accent 只留 primary 按钮和 citation |

## 值得做、这轮没做的(N9b)—— 2026-08-13 已做掉六条

| # | 项 | 状态 |
|---|---|---|
| ① | Documents 正文渲染 Markdown + citation chip(A-2) | **done**:编辑器换成 Markdown 所见即所得(F2),`[Source n]` 现在是可点的 chip,点开就是那条 Source |
| ② | Notice / EmptyState 统一组件(A8) | **done**:新 `Notice`(danger/warning/quiet 三态)+ `Empty` 统一四处空态;两处手写的十六进制颜色改用 `ErrorBubble` |
| ④ | ⌘K 选中行 1.15:1 + 无键盘提示(A17) | **done**:选中行改成和全站列表一致的 accent-soft + 左侧 accent 边;底部加 `↑↓ 移动 · ↵ 打开 · esc 关闭` |
| ⑤ | 波形疏密不随时长变化(A14) | **done**:条数按时长对数映射(16–64),一句话和十分钟不再长得一样 |
| ⑥ | Delete 与 Cancel 等重(A10) | **done**:`danger` 变实心填充,和 `primary` 同重量 |
| ⑦ | Settings 长解释违反规则 4(A13) | **done**:四段收成一句 |
| ⑧ | 快捷键不用 kbd(A20) | **done**:新 `Keys` 组件(键帽样式),快捷键面板和面板提示都用它 |
| ③ | 注入浮动条压住正在写的字段(A7) | **待办**:要改 position.ts 锚定策略,**必须在你登录着的 Notion / Google Docs 上复验**,和 S3g 一起做 |
| — | mode/scope 混在一排 tab(B9) | 就是 N1b,等你在 panel-ia.md 里拍 A/B |
| — | 浮层 ✓ 位置三处不一致(A9) | **等你裁决**:与 X29「勾落在麦克风原位」的既有决定冲突 |

## 三件被点名"不要改坏"的(A)

1. 溯源结构(What this came from / 带引用的 Sources)是核心资产;
2. "失败不丢数据 + 给回去的路"(kept recording / Try now / Export);
3. 28px 控件阶梯的克制密度 —— One-Line-Prompt 和 Voice Options 是模板。

---

# 2026-08-19 · 两个外部模型看同一批截图

上一轮(N9)里 ChatGPT 是**像素盲**的 —— 只拿到结构清单。这次两边都看到了真截图:
运行中的产品截了 8 张(Activities / Projects / Documents / Skills / Settings /
侧栏有内容 / 侧栏空态 / 页面上的选中浮层),分别喂给 chatgpt.com 和
gemini.google.com,在他自己登录的 Chrome 里。截图不进仓库。

**每一条都在跑着的产品上量过再决定** —— 两个模型都说错过东西。

## 已修

| # | 问题(谁提的) | 量到的事实 | 改法 |
|---|---|---|---|
| 1 | 小字灰得读不出来(两边都提) | `--color-muted #92928d` 在白底上 **3.13:1**,`--color-faint` **2.53:1**;五条路由上 25 处不达标 | muted → `#6b6c66`(白底 5.30、选中行紫底 4.63),faint → `#83847d` 且只给图标/占位/Markdown 标记;`--color-muted-strong` 退役,7 处并入 `ink-soft`。复量:25 → 0 |
| 2 | 注入的浮条压住正在写的输入框(ChatGPT;也是 N9b ③ 的待办) | chatgpt.com 上量到浮条盖住输入框最后 6px,并横在发送那一排上 | `besideCaret` 多收一个「要躲开的盒子」:一屏能看全的输入框(≤120px 高)就整个躲到它外面;`fieldBox()` 往上走最多 10 层找**真正画出来的那个框**(Gemini 在中间塞了 5 层同尺寸的空壳)。页面级编辑器(Notion/Docs/本产品)行为不变 |
| 3 | 选中浮层上「Accurate tr...」被截断(ChatGPT) | 标签上限 80px,名字 118px | 上限放到 160px;复量 `scrollWidth > clientWidth` 的标签数 = 0 |
| 4 | Settings 里删除 × 被推到最右(Gemini) | × 距离文字末尾 **484px** | 去掉 `ml-auto`,× 紧跟文字 |
| 5 | 侧栏选中项的图标不跟着变深(Gemini) | 选中行文字 `#242423`,图标仍是 `#6f6f6a` —— 和未选中一样 | 图标不再自带颜色,跟行走 |
| 6 | 文档树只靠 16px 缩进表达层级(两边都提) | 折叠箭头 `opacity-0`,只在 hover 出现 | 有子页的行常显箭头(faint),hover 变深 |
| 7 | 面板里 Copy 被挤到单独一行(ChatGPT / Gemini) | 400px 下 Skill 按钮换行,`ml-auto` 把 Copy 带下去 | Skill 列表和 Copy 拆成兄弟节点,Copy 永远留在第一行 |
| 8 | Projects 头部的 Delete 和正事一样重(ChatGPT) | — | 收进 `⋯`,与文档树里的删除同一套 |

## 查过之后驳回的

| 说法 | 量到的 |
|---|---|
| Skills 的指令框没有边框,看不出能编辑(Gemini,列为 blocking) | 有 1px `rgb(195,196,191)` 边框 |
| Projects 的 Run 看起来是禁用的(Gemini,blocking) | 它**就是**禁用的 —— 提问框是空的。禁用态本来就该长这样(N9 第 6 条) |
| 选中浮层「飘在窗口顶部,和文字没关系」(Gemini,blocking) | 量下来在选区正上方 10px、水平居中。那张截图里被选中的是文档标题,而窗口失焦时选中高亮不渲染 |
| 「Mardown Edit」拼错(Gemini) | 那是他自己文档的标题,不是产品文案 |
| 空态该加一个按钮(Gemini) | 代码里写着为什么没有:同一个动作的书签控件就在下面 40px 处 |
| Settings 标签和输入框离太远(Gemini) | 就是 design.md 规则 8 的两列栅格 |
| 每行都重复同一个麦克风图标(Gemini) | 那是来源色,不是装饰 |
| 列表预览文字过早换行留出空白(Gemini) | 是截断加省略号,不是换行 |

## 还没做,等他拍板

ChatGPT 那半篇是**产品模型层面的批评**,不是 UI 修补,所以一条都没动:
事件与实体混在一起(Activities 既是流水账又是资料库)、`[Source 1]` 读起来
像没解析的模板、三栏布局套在五种任务上、保存语义每屏一套、Skill 不按输入类型
过滤、"local-first" 只露出 127.0.0.1 而没有一句"什么留在本机"。
另外它说侧栏那个紫色麦克风品牌标看着像录音键,而真正的录音键是旁边那个灰的 ——
这条是真的,但换的是标识,不是布局。


---

# 2026-08-19 · 文档列表和编辑器对齐 notion.com

> *"do not stop until doc list and markdown viewer/editor matches notion.com"*

不是照着印象改的。在他自己登录的 Chrome 里打开 app.notion.com,**把数字量出来**
(窗口 1733px,默认页宽,深色主题 —— 只取几何和字号),再逐条对齐。
`scripts/qa/notion-shape.mjs` 现在把这些数字钉死,14 条全过。

| | Notion 量到的 | 我们改前 | 现在 |
|---|---|---|---|
| 行高 / 间距 | 30px / 31px | 36px / 36px | 30 / 31 |
| 行圆角、边距 | 6px,左右各 8px 留白 | 0,整行贴边 | 6,8px 留白 |
| 行之间 | **没有分隔线** | 每行一条 `border-b` | 没有 |
| 图标 | 12px,距行首 13px | 24px 带底色的 chip | 12px,13px |
| 名字 | 距行首 38px,14px/21px/500 | 49px,12px/18px/600 | 38px,14/21/500 |
| 子页缩进 | 每层 8px | 16px | 8px |
| 折叠箭头 | **占图标那个位置**,悬停时替换它 | 单独一列,常显 | 占同一格,悬停替换 |
| 选中行 | 中性底色 | accent 底 + 左侧 3px accent 条 | 中性底 |
| 正文栏 | 720px,居中 | 704px,被大纲栏挤到偏左 | 720,居中 |
| 正文 | 16px/24px | 15px/24.75px | 16/24 |
| 页标题 | 40px/48px/700 | 24px(就是个 H1) | 40/48/700,取**第一行有字的那行** |
| H1 / H2 / H3 | 30/39、24/31.2、20/26,均 600 | 22.5、18、15.75,650 | 一致 |
| 段落节奏 | 一段到下一段 40px | 49.5px(空行按正文行高算) | 40px —— **空行画成 16px 的间隙** |
| 列表项 | 26px,marker 悬在 9px 的边距里 | 24px,marker 就是那个 `-` | 26px,画成 `•` `◦` `▪` |

**几个决定**

- **空行是间隙,不是一行。** Markdown 的段落之间是一个真实的空行;按 24px 正文
  行高画,一段到一段就是 48,而 Notion 是 40。空行画成 16px,算出来正好 40 ——
  标题上方的留白也随之减去这 16(24 / 20 / 16),净出来就是 Notion 的 40 / 36 / 32。
- **标题取第一行有字的那行**,不是第 1 行:模型写的文档常以空行开头,按行号取
  会把名字给了上面那片空白(真实文档 `doc_45e2…` 就是这样)。
- **画出来的项目符号仍然是文本。** `-` 在光标离开时画成 `•`,光标进入这一行就
  变回 `-` —— 和 `#`、和任务框同一条规则。`scripts/qa/editor-typing.mjs` 验的
  就是这件事,并且它把自己敲进去的字**通过 Host 还原**(第一版用退格还原,输给了
  编辑器的自动保存,把一个感叹号留在了他的文档里)。
- **大纲改成浮在右边距上**,不再占一列 —— 否则正文栏被挤得不居中(实测偏 117px)。
  窗口窄到放不下就让位给文字。Sources 仍然占一列:引用是页面内容的一部分。
- **只有 Documents 变。** Activities / Projects / Skills 的行还是原来的
  `RowShell`;树的形状是 `tree` 这一档,不是全站改版。

**一条和 8 月 19 日早些时候的评审冲突,按这次的指令改了**:那轮把折叠箭头改成
常显(两个评审都说层级只靠 16px 缩进看不出来)。Notion 的做法是悬停时用箭头
**替换**图标,层级只靠 8px 缩进 —— 这次照 Notion 做。缩进从 16 变 8,层级更依赖
悬停,这是"对齐 Notion"的代价,写在这里等他复看。
