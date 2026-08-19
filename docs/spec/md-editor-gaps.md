# Markdown 编辑器 · 全部缺失清单(2026-08-14)

他的话:"md edit is far from complete. review code and list all missing features
relatd to it",此前已有 "must use similar design/feature as notion"。

依据:通读 [MarkdownEditor.tsx](../../web/src/app/MarkdownEditor.tsx)(1049 行,
redesign-c `15f2fa5f`)+ 2026-08-14 在他登录的 Notion 里实测过的斜杠菜单全量。
行号会随提交漂移,以内容为准。

## 今天已经有的(基线,别重做)

标记随光标隐藏(标题/粗斜/行内码/引用/链接);引用 chip、可点的任务勾选框、图片
就地渲染;H1–H6 字阶与全套行内样式;引用/代码/表格的块底色;斜杠菜单 10 种块;
选中浮动条(B·I·Code·Link·Rewrite);⌘B/I/E/⇧X/K;⌘F 查找替换;多光标+矩形选
区;URL 粘贴到选区变链接;⌘点击开链接;空行 "Type / for commands" 提示;外部更新
不毁 undo 栈。字数和版本条在 DocumentsRoute 一层,已有。

---

## A · 现有功能里的病(先修,全部 P1)

| # | 病 | 位置 | 说明 |
|---|---|---|---|
| A1 | **Enter 不续列表/引用/表格,Backspace 不删记号** | :809 | `markdownKeymap` 排在 `defaultKeymap` 后面合进同一数组,`insertNewlineContinueMarkup` 和 `deleteMarkupBackward` 永远轮不到。X6 已立案,2026-08-14 真机验证过。修法:单独 `keymap.of(markdownKeymap)` 提到 defaultKeymap 前。 |
| A2 | **列表零排版** | :81 注释、theme | 保留 `-` 是写下的决定(藏掉就没了列表的脸),可以接受;但**嵌套不缩进、折行不悬挂**(长项折行顶到行首)、有序列表记号无弱化样式。要:hanging indent + 层级缩进,Notion 的样子。 |
| A3 | **待办行拖着 `- `** | :264 | 勾选框已经替 TaskMarker 说话了,前面的 ListMark 仍显示。任务行例外:连 `- ` 一起藏。 |
| A4 | **斜杠菜单只在空行行首开** | :714 `/^\/(\w*)$/` | Notion 任意位置输 `/` 都开。至少:行中空格后输 `/` 也开。 |
| A5 | **斜杠菜单/浮动条不翻边不夹紧** | :720-725、:741 | 手摆的 absolute,X4 抽出的 `floating.ts` 没用上这里。底部开菜单出视口;选区在头两行时浮动条 top 为负被裁。换共享定位。 |
| A6 | **斜杠菜单 ArrowDown 无下界** | :771 | `setAt(was+1)` 无限涨,渲染时才 clamp;按十次 ↓ 再按 ↑ 要按回来。小,顺手修。 |

## B · Notion 有、我们没有,Markdown 表达得干净(核心补齐)

按值得做的顺序:

1. **Tab / ⇧Tab 缩进/反缩进列表项。** Notion 肌肉记忆第一名。CM 的 Tab 默认移焦
   点,列表行上要接管(多光标下也对)。
2. **块把手:每行悬停 ⋮⋮ + ＋。** ⋮⋮ 拖动重排行/块、点开块菜单(Delete ·
   Duplicate · Turn into);＋ 在下方插块(等于开斜杠菜单)。Notion 的招牌,F6
   已点名,归进这里一起做。
3. **Turn into(块类型互转)** ——浮动条加一项 + 块菜单里一项:段落↔标题↔列表↔
   引用↔待办互转,改的是行首记号。配 Notion 的快捷键族 ⌘⌥0-6。
4. **粘贴 HTML → Markdown。** 从网页/Notion 粘过来现在只有纯文本(格式全丢)。
   turndown 一层,粘贴即 md。反向(复制成富文本)Notion 也有,列进候选。
5. **代码块:围栏内语法高亮 + 语言标签。** 围栏 info string 本来就是 md;
   CM `codeLanguages` 现成。语言小标签 + 一键复制按钮。斜杠菜单的 Code 顺带问
   语言。
6. **表格:Tab 在单元格间走,行尾 Tab 加列尾行。** 不做 Notion 的整套表格 UI,
   做 md 表格的键盘顺滑(A1 修好后 Enter 已能续行)。
7. **斜杠菜单补块**(都是干净 md):`### Heading 4`(Notion 菜单里有)、
   **Callout**(`> 💡 …` 引用变体,带图标)、**Page**(建子文档——嵌套已有,
   菜单里给入口,插一条子页链接)、**Link to page**(内部文档链接,要定一个
   链接形式:`[title](logue://doc_id)` 或相对 id)、**Block equation**
   (`$$…$$`,KaTeX 渲染)、**Mermaid**(围栏,就地渲染)。
8. **链接悬停卡。** 光标外的链接 hover 出小卡:开 · 改 · 拆。现在只有 ⌘点击开,
   改地址要把光标挪进那行。
9. **标题大纲(TOC 侧栏)。** 从标题派生,点击跳转;Notion 右缘悬停有,gdocs 左
   栏有,vibedoc 的 F6 清单也点了名。视图层,不进存储。
10. **`:emoji:` 自动补全。** 存的是 unicode,纯输入便利。
11. **图片:先把语法路走顺**——斜杠 Image 插 `![]()` 把光标放进地址;粘贴图片
    文件/截图**需要上传后端**,单独立项(见 C)。

## C · 要么要后端、要么要他拍板的

- **图片/文件上传**(粘贴截图、拖文件进来):要 Host 加存储端点 + URL 方案。值
  得做,但是独立一块。
- **导出为富文本/PDF**;**打印样式**。
- **协同/多光标他人**:不做,单机产品。

## D · Notion 有但 Markdown 表达不干净——**等他确认排除**(F5/F6 已挂过,汇总)

Toggle 折叠列表 · 多列布局 · 彩色文字/高亮底色 · Database 各视图 · Synced
block · Button · 视频/音频/文件/书签 embeds · AI blocks · @人/@日期(@页面例外,
见 B7)。每一条要么发明私有语法、要么存非 md 的东西,违背「存的就是 Markdown」。
**默认不做;哪条他点名要,单独设计存法再做。**

## 优先级一句话

A 全修(小而准,A1 已是 X6)→ B1–B4(键盘和把手,Notion 手感的大头)→ B5–B7
(块能力)→ B8–B11(顺滑度)→ C 图片上传。D 不动等确认。
