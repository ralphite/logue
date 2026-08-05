# Logue 设计系统（clean-slate）

本文件只定义视觉与共享布局。产品 IA 和行为以 `docs/product-spec.md` 与 clean-slate 产品设计为准；当前 UI 不构成保留约束。

## 方向

Logue 使用 Notion 式内容优先界面：安静、直接、可读、低装饰。Minimalism 通过删除内容实现，不通过缩小文字或压窄面板实现。

品牌紫只用于文本选择、citation 和键盘 focus；导航选中使用中性底。正常连接、保存和后台记录不显示成功色。

## Tokens

| Token | 值 | 用途 |
| --- | --- | --- |
| `--canvas` | `#f5f5f2` | 应用背景 |
| `--surface` | `#ffffff` | 编辑器、列表、浮层 |
| `--ink` | `#181916` | 主要文字 |
| `--muted` | `#6d7169` | 有意义的次要信息 |
| `--line` | `#e4e5df` | 分栏与列表分隔 |
| `--accent` | `#5b64f4` | 品牌、focus、citation、selection |
| `--accent-soft` | `#eeeefa` | 引用/焦点辅助背景 |
| `--recording` | `#e44c3f` | 录音中 |
| `--danger` | `#b2483f` | 删除与不可恢复错误 |

- 圆角：行内控件 4–6px，浮层 10–12px；不用大胶囊或卡片墙。
- 间距：4px 基线；常用控件高度 28 / 32 / 36px。
- 字体：系统 UI；正文 15–16px，中文行高 1.6–1.75；正式辅助文字不低于 12px。
- 阴影：只用于网页 launcher/menu、Dialog 和覆盖 drawer。

## 内容层级

- Page/Project title：38px / 700；窄屏 30px。
- 一级页面标题：20px / 600。
- 二级标题：18–20px / 650。
- 正文：15px / 1.75。
- 列表主文字：14–15px；来源、项目、时间：12–14px。

输入控件只继承 `font-family`，不得用 `font` shorthand 意外覆盖字号或字重。

## 导航与表面

- 一级导航只有 `Library / Projects / Settings`；全局 `Search` 固定在侧栏顶部。
- 活动导航项使用浅中性底；不让子级选择复制同一视觉重量。
- Library 统一展示 Source/Page，使用 `All / Sources / Pages` 轻量 segmented filter。
- Page 和 Project 进入内容轴，不新增 Documents 一级列表。
- Skills 使用 Settings 的同一内容轴与 section pattern，不形成独立产品视觉语言。

## 组件

- **Primary action：** 每个区域最多一个实心主动作。
- **Library row：** 类型 icon + title/excerpt + 唯一必要 metadata；不用状态点、标签堆或 hover-only 核心信息。
- **Source detail：** 原始内容优先，随后音频/来源/annotations/actions；隐藏 request ID、内部状态和模型细节。
- **Page editor：** title、Project 与 `{n} sources` 后直接进入正文；autosave 成功不显示。
- **Source row：** title、domain/project/date、匹配摘录；外链与引用动作分离。
- **Settings section：** 标题、紧凑说明、真实控件；只展示高级非敏感模型偏好。Provider credentials 不进入 Web；Extension Server URL 不在 Web Settings 重复出现。
- **Recording：** 只有确实收到音频时显示波形，同时显示时长与停止/取消。
- **Toast：** 仅用于跨页面且当前看不见的结果；显然发生的本地变化不重复通知。
- **Empty state：** 只说明下一步，不放统计、宣传副标题或示例卡。

## 布局轴

- NavRail 使用共享宽度。
- Library/Project 列表与 Page 阅读区使用共享 page axis；列表行和 header 左边缘一致。
- Source detail 与 Sources panel 复用同一响应式 min/default/max 和 resizer pattern。
- 侧面板默认打开到足够完成任务的宽度，可占剩余空间；不得在旁边留下无意义空白。
- 桌面始终保留正文最小阅读宽度；宽度不足时 panel 变为覆盖 drawer/full-width sheet。
- Drawer header 固定，内容区只有一个滚动容器。
- Chrome Extension 填满用户提供的原生 Side Panel；360px 只是设计基线，不承诺默认宽度。

## 状态与可访问性

- hover、selected、focus-visible、disabled、recording、error 使用共享 token 和组件状态。
- 颜色不单独承载含义；录音、错误和 destructive action 同时有文字或 accessible name。
- Icon button 至少 32px；resizer 有键盘操作与清晰焦点。
- 支持 reduced motion；加载不引起布局跳动。
- Search、drawer、menu、dialog 关闭后恢复原触发器焦点。

## 删除规则

以下模式不进入新产品：

- `Stream / Documents / Skills / Generate` 旧导航；
- Material、Tags、Needs review、自动组织状态；
- 正常 `Connected / Saved / Organizing`；
- request ID、端口、分类器、模型品牌等日常技术信息；
- 重复标题、重复来源、重复动作和常驻安全说明；
- 窄 panel + 大片闲置空白；
- 用 10–11px 正式文字换取密度。

## 审查清单

每次用户可见改动检查：内容轴、层级、重复信息、文字大小、CJK 换行、滚动归属、面板宽度、键盘焦点、loading/empty/error/recovery、窄屏、真实点击目标，以及是否还能直接删掉一个无价值元素。
