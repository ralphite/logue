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
