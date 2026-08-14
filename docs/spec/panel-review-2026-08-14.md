# 面板复审 · 2026-08-14(N14)

三个互不通气的 subagent 按 [review-process.md](review-process.md) 的三个镜头读了
**已上线**的面板(`Composer.tsx` / `Entry.tsx` / `sidepanel.tsx` / `useEntries.ts` /
`useVoice.ts`),对照 [panel-composer.md](panel-composer.md)、
[n13-panel-mock.html](n13-panel-mock.html)、[behaviors.md](behaviors.md) 和
[copy.md](copy.md)。共 **29 条发现**。

**状态:每条都引了文件和行号,但除标注外未在跑着的产品上逐条验真。** 按流程,修
之前先在真面板上把该条读出来;验不出的写明,不悄悄丢。行号以 redesign-c
`77b210be` 为准。

同日实测(在他登录的 Chrome、真 Google Doc 上,live 验证过的两条)见
[tasks 里的 X7](tasks.md)。

---

## Copy(10 条)

1. **一个动作三个名字:send / save / keep。** Composer.tsx:298 `Send` →
   Entry.tsx:91 `Saving…` → sidepanel.tsx:648 `Recordings are kept here.`(还有
   useEntries.ts:237 `Could not keep that.`)。面板自己的注释已裁决 "Sending
   keeps":Entry.tsx:91 改 `Keeping…`,完成句 `Added to {title}` 保留。
2. Composer.tsx:254 占位符 `Type here, or press the mic and talk` —— 旁边按钮叫
   `Talk` 不叫 mic,"Type here" 是废话。改 `Type, or talk`。带引用的变体
   `Say something about this passage, or send it as it is` 在占位符里教流程,改
   `Say something about this passage`。
3. Composer.tsx:276 `Into · nowhere` —— 读作一个叫 nowhere 的地方;兄弟控件用的
   是 `No Project`。统一成 `No Document` + 裸标题。
4. sidepanel.tsx:669 `…or just start typing.` —— "just" 是填充词,"comment on"
   是第四个动词。改 `Select a passage, or type below.`
5. sidepanel.tsx:106 `Logue's background service is restarting…` —— 说的是人看
   不见的实现件。改 `Logue did not answer. Try again.`
6. sidepanel.tsx:270 `Logue has this recording; the words did not come back.`
   —— 两个从句一个委婉语。改 `Not transcribed. The recording is kept.`
7. sidepanel.tsx:117/140/630 —— server 字段名了两次、又解释一次。菜单
   `Logue server…`,标签 `Logue server`,140 的帮助句删掉。
8. sidepanel.tsx:177 `${tries} attempt(s) so far.` —— "so far" 是填充词。改
   `Tried ${tries}×.`
9. Entry.tsx:313 `Would file this into a Project` —— "file" 在面板别处不出现。
   改 `Would add this to a Project`。
10. Composer.tsx:282/283、287/290 Tooltip+aria-label 同词各说两遍(读屏读两次);
    sidepanel.tsx:615/618 一个控件两个名(`Panel menu` / `More`)。

## Behaviour(11 条)

1. **Host 关着时同一条录音出两行、两套说法。** useVoice.ts:350-368 入队 +
   useEntries.ts:97 画失败行,sidepanel.tsx:591-597 又把存储队列画成 WaitingRow;
   entries.ts:138 的 merge 只去重 local-vs-Host,不去重 entries-vs-waiting。离线
   是常态,不是角落。
2. **IME 敲一半按 Enter 直接发出去。** Composer.tsx:244 没有 `isComposing` 守卫
   —— 中文选字的那下 Enter 变成了提交。
3. **按 Enter 后有一拍什么都不动。** sidepanel.tsx:498 在乐观行创建**之前** await
   `pageText()`/`executeScript`;Composer.tsx:137-143 等整个 promise(含
   appendToDocument)落定才清框。
4. **新条目可能落在屏幕外。** 没有任何 scrollIntoView;最新排最上,人往下滚着读
   时发送,看不见任何动静。
5. **引用比它的页面活得久。** sidepanel.tsx:408-428 换 tab 不清 quote,而 source
   按当前页算 —— 发出去挂错 URL。另:新选区不声不响顶掉正在评论的旧选区。
6. **录音把已打的字藏起来。** Composer.tsx:202 整个换掉 textarea;方案 §4 说
   "录音时输入框不换形状"。(mock 第 3 帧和方案矛盾 —— 要他裁决,见下"要裁决"。)
7. **一次 503 恢复后出两行。** useEntries.ts:84→102-109 把颤抖行变成转写,又在
   :185 由 submit 再建一行。
8. **分两段说话丢第一段音频。** sidepanel.tsx:517 `spoken.current` 每次插入被覆
   盖,发送的 Source 只带最后一段录音。
9. **发送失败没有 Try again。** Entry.tsx:99 用 `entry.captureId` 做门,而
   submit 的 catch 从不设它 —— 死行,字还在框里。
10. **⌘⇧K 到达后三个键要先点一下才生效。** 键挂在 window 上(Composer.tsx:147)
    但没人给面板焦点(sidepanel.tsx:547-566)。
11. **Try again 让没存上的行看起来存上了**(useEntries.ts:304-310 `keep:false`),
    还把同样的字插回框里 —— 再发一次,句子存在两份。

## Design-fidelity(8 条)

1. **存整页打出全文,不是页名。** useEntries.ts:245-262 拿 readable 正文当
   take.text;mock 第 5 帧是一行标题。
2. **排队中的录音不能播。** sidepanel.tsx:154-241 WaitingRow 没有 `<Recording>`
   没时长;mock 第 6 帧有播放键+波形+0:34;behaviors 明文 "audio playable"。
   HeldRow(:244)反而有 —— 同一种麻烦两种长相。
3. **取消选中不回整页。** sidepanel.tsx:424 `if (text) setQuote(…)` 故意忽略清
   空;方案 §3 和 behaviors 都说清空回整页。现在只有 ✕/Esc/发送能清。
4. = Behaviour 6(录音藏字)。mock 和方案互相矛盾,**要他裁决**。
5. **空态里第二个 Save this page**(sidepanel.tsx:670),书签就在 40px 下面 ——
   两个控件干一件事。
6. **工作区没有 Document 时 Into chip 整个消失**(Composer.tsx:269 的 length 门),
   而 22:12 的裁决是 chip 常在。
7. **Esc 丢引用只在框有焦点时生效**(Composer.tsx:248),下面的提示却无条件写着
   Esc(:338)。
8. **头部结构和 behaviors 冲突,mock 没写,要裁决**:上线版是一行(Logue·页
   名·⋯),Open Logue 收在菜单里;behaviors 要求 Logue 行在先、页名在后、进 app
   的入口用文字。

## 重叠说明

Copy 2/3 ≈ Fidelity 6(Into chip);Behaviour 6 = Fidelity 4(录音藏字);
Copy 6 与 X5 的模型话术改动可能已把 sidepanel.tsx:270 改掉 —— 修前先看现行。

## 要他裁决的(攒进最后的 review,不挡修别的)

- 录音时输入框换不换形状(方案说不换,mock 画的是换)。
- 面板头部一行还是两行,Open Logue 用词还是图标。
