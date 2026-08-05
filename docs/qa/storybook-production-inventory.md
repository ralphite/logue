# Storybook production inventory

状态：当前实现的组件 → Story → 可见状态映射。Storybook 只复用生产组件；fixture 仅提供 API 响应，不替代真实 Chrome 验收。

## 页面与工作区

| 生产组件 | Story | 可直接查看的状态 |
|---|---|---|
| `App` / Stream | `Pages/App Compositions` | `Stream`、`StreamEmpty`、`StreamLoading`、`StreamServiceError`、`MaterialDetail`、`MaterialNeedsReview` |
| `ProjectPage` | `Pages/App Compositions` | `Projects`、`ProjectDetail`、`ProjectsEmpty`、`ProjectsLoading`、`ProjectsServiceError` |
| `DocumentWorkspace` | `Pages/App Compositions` | `Documents`、`DocumentsEmpty`、`DocumentsLoading`、`DocumentsServiceError` |
| `GenerationWorkspace` | `Pages/App Compositions` | `Skills`、`SkillsEmpty`、`SkillsLoading`、`SkillsServiceError` |
| `SettingsPage` | `Pages/App Compositions` | `Settings`、`SettingsLoading`、`SettingsServiceError` |
| `MaterialDetail` | `Pages/App Compositions` | `MaterialDetail`、`MaterialNeedsReview` |
| `NewMaterialDialog` | `Components/Materials/New Material Dialog` | `WithProjects`、`WithoutProjects` |

## 可复用组件

| 生产组件 | Story | 可直接查看的状态 |
|---|---|---|
| `NavRail` | `Features/Navigation/Primary Navigation` | 默认、收起并显示 tooltip、服务断开 |
| `InlineVoiceControls` | `Features/Extension/Inline Voice Controls` | Interactive、StartingMicrophone、Recording、Processing、TargetLost |
| Native `SidePanelView` | `Features/Extension/Native Side Panel` | CurrentPage、SelectionWithHistory、StartingMicrophone、Recording、Transcribing、TargetLost、ServiceUnavailable、ServerSettings/Connecting/permission/error、GenerateDraft、GeneratedReply、Empty |
| `MaterialGroupPicker` / `MaterialGroupAddList` | `Components/Materials/Material Group Picker` | GroupedAndSelected、SearchReasons、Empty、AddList |
| `SearchPending` | `Components/Feedback/Search Pending` | Materials、Documents |
| `RecordingAudioPlayer` | `Components/Media/Recording Audio Player` | MetadataProbe、UnavailableDuration |
| `PanelResizer` | `Components/Layout/Panel Resizer` | 默认、WiderPanel、LeftEdge |
| `PageHeader` / `ContextHeader` / `PaneHeader` | 各自 `Components/Headers/*` | 默认、主操作、局部错误、长标题与截断 |
| `Button` / `IconButton` | `Components/Actions/*` | primary/secondary/ghost/danger、disabled、loading、keyboard focus、long label |
| `OverlayMenu` | `Components/Overlay Menu` | 默认、下边界碰撞、起始对齐 |
| `Tooltip` | `Components/Feedback/Tooltip` | 默认、快捷键、disabled、长内容 |
| `SelectionSkillMenu` | `Components/Selection Skill Menu` | 菜单、keyboard focus、无可用 Skill、长名称 |
| shared layout tokens | `Foundations/Design Tokens` | page/editor/reading axes、type、spacing、surface tokens |

## 构建验收

- 2026-08-04：`npm run build-storybook -w @logue/web -- --output-dir /tmp/logue-storybook-qa` 成功。
- 发布前仍须在真实 Chrome 抽查页面组合与 Extension；这份 inventory 不可替代 P0 的 Linux/LAN 和 Google Docs 人声验收。
