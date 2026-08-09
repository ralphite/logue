# 任务队列

要做的事,和它们现在的状态。**这个文件是唯一的正本** —— 会话里的任务列表只是它的一份镜像,会话结束就没了。只存在于会话里的东西,一次崩溃就丢,而这份清单已经丢过一次。

**每一条新要求都在提出的当下写进这里**,写完再动手。只出现在回复里的要求不算入队。

两个文件,两件事。这里管**顺序**和**还没做的**;[behaviors.md](behaviors.md) 管**做完之后必须成立什么**,写成能扛过下一次重写的样子。一条要求通常两边都要落。

还有第三个:[proposals.md](proposals.md) —— 你要求"先出方案不要实现"的那几件,方案写在那里,每节末尾是要你回答的问题。
第四个:[audit.md](audit.md) —— T1 全面走查的结果,六条值得修的,按值不值得排好,等你点哪几条要动。

报 bug 的截图存进 `docs/spec/shots/`,被 git 忽略,由任务按文件名引用。图跟着任务走,不进仓库。

## 现在,按这个顺序

| | 任务 | 为什么在这 |
|---|---|---|
| **X20** | 转写完不要再问一次"要插入吗" | 你的原话是 "we don't need this. this violates our rule. must be very easy to use. least friction possible."。截图里:说完话之后弹出一个框,把转写出来的文字放在里面,底下一个 `↵ Insert ⌘↵` 按钮等你再点一次。**说了就该落到光标那里**,不用第二次确认 —— 这多出来的一步违反的正是"极简、摩擦最小"。改错在原地改(转写修订本来就有),不是先审后放。**注意别和 F3 搞混**:F3 里的 Esc/Enter 是 ⌘⇧K 那条路 —— 面板里的对话,你在说给一个 agent 听,那里"采纳"才有意义;这里是页面上的听写,目标是**光标处的输入框**,中间不该有任何一道闸。图:`shots/x20-insert-confirm-step.png` |
| **X21** | 插入后那条 "Inserted / Undo" 压在正文上,还挪不开 | 你的原话是 "why this cannot be moved? this blocks ui."。截图里那条 `✓ Inserted ↶ Undo ×` 正好盖在你刚插进去的那段字上 —— 挡着看不见,又拖不走。**任何 Logue 的浮层都不许压着人正在读或正在写的内容**。三条路可选(挑一条,别三条都做):①它自己躲开,总落在不遮挡的位置;②能拖走,并且记住你放的地方;③干脆不要这条独立浮条,把"已插入 / 撤销"并进已经在场的那条工具条里。**Undo 这个能力要留着**(采纳与撤销是写死的规则),要去掉的是它现在这个挡路的形态。和 X20 是同一段流程的前后两步,一起改最省事。图:`shots/x21-inserted-toast-blocks-text.png` |
| **X22** | 新建 Skill 建不出来:要一个屏幕上不存在的字段 | 你的原话是 "this is broken"。截图里:新建 Skill 只问了一个"What is this Skill called?",填好 `Transcription` 按 Create,却报 `instructions is required` —— **界面上根本没有 instructions 这个输入框**。要一个人填一个他看不见的东西,这是彻头彻尾的死路,一个 Skill 都建不出来。两条修法二选一,按"摩擦最小"应该选后者:①把 instructions 这一栏摆到表单上;②**创建时只要名字**,instructions 建完之后在 Skill 页上填 —— 反正 Skill 页本来就能编辑 prompt。顺带查一遍别处还有没有同样的毛病:后端要求的字段,前端却没给入口。图:`shots/x22-skill-create-missing-field.png` |
| **X23** | Side Panel 里空的分区照样摊开,占满整屏 | 你的原话是"这个违反了渐进式显示 UI 的规则"。截图里:"On this page → Nothing saved yet."、"What you added → No comments yet." —— 两个分区都是空的,却各自占着一大块,把"这里什么都没有"这件事说了两遍,还把真正有内容的东西挤到看不见的地方。空的分区不该摊开:要么整个收起来只留一行标题(数量是 0),要么干脆不显示。**注意别和另一条规则打架**:"空分区要给出一条出路"针对的是**边栏里能新建东西的地方**(那里空着人就没法开始);Side Panel 这两个分区是这一页的读数,没有"从这里新建"这回事,空了就该让位。图:`shots/x23-empty-sections-not-folded.png` |
| **X24** | Find 的输入框自己带一圈边,和放大镜之间多一条线 | 你的原话是 "remove border of search input text (b/t search icon and ab)"。**根因已经查到**:共享的 `Input` 组件([Field.tsx:6](packages/ui/src/Field.tsx:6))在 `control` 里写了 `focus:border-accent-line` 和 `focus:shadow-[0_0_0_2px_…]`;[FindDialog.tsx:145](web/src/app/FindDialog.tsx:145) 用 `border-0 shadow-none` 去关它,但**关不掉 focus 变体** —— 而这个框是 `autoFocus` 的,等于永远处在 focus 态,那圈边和光晕就一直亮着。对话框外面已经有一层边框了,里面这层是重复的。修法别在调用处再堆 `focus:border-0` 这类 override,给 `Input` 一个"无边框"的变体更干净,别处遇到同样的问题也能用。图:`shots/x24-search-input-double-border.png` |
| **X25** | 各个页面布局不统一,连宽度都三档 | 你的原话是 "we should use same layout if possible for pages (stream, project, doc etc). why they are different even for width?"。**量出来了**:[theme.css:58](packages/ui/src/theme.css:58) 定了三档宽度 —— reading `820px`、list `940px`、settings `1180px`;`Page` 组件默认走 `list`([AppShell.tsx:295](web/src/app/AppShell.tsx:295)),于是 **Documents 和 Skills 是 820,Stream 和 Projects 因为没写 axis 落到 940,Settings 是 1180**,而 Settings 里面还在 1180 之内又套了一层 `max-w-[560px]`([SettingsRoute.tsx:95](web/src/app/SettingsRoute.tsx:95))。所以宽度不一致既有设计上的三档,也有"没人显式选档"的默认值,两种原因混在一起。**要的是一套布局**:默认所有页面同宽同边距,只有真正读长文的地方才允许收窄,而且必须是显式声明的、说得出理由的例外 —— 不是靠"忘了传参数"决定的。顺手把 Settings 里那层多余的 560 收掉 |
| **T1** | 全面走查,把这一类一眼可见的问题一次找完 | 你的原话是 "do full audit to find all obvious issues like last one"。"like last one" 指的是 X25 这类:不用深挖、打开页面或读一眼代码就能看出来的不一致和破绽。**走查范围**:每个路由(Stream / Projects / Documents / Skills / Settings)、Side Panel 的每个分区、扩展在页面上的每个浮层。**照着已经写下的规则逐条对**(behaviors.md 的"界面"一节就是清单):宽度与边距是否一致、空态是否占地方、浮层是否压住正文、每个列表行是否点得进去、表单是否要了看不见的字段、控件是否重复、长内容是否撑破页面。**产出是一份清单交给你**,按"值不值得修"排好,不是闷头全改 —— 这条规矩你早就定了:先列清单再动手。用真实的长文档走查,不许用自制测试页。<br><br>**范围随后被你扩大了**,原话是 "ui design must be consistent! everywhere! all levels! this is the basics. on top of this we must do audit to follow ui design best practices. ALL"。所以走查分两层,两层都要**查全**:①**一致性** —— 同一件事在每一处、每一层是不是长得一样、用起来一样(宽度边距、标题空态、行卡片列表、按钮输入框菜单、图标间距字号颜色文案);②**在一致之上,照 UI 设计的正经标准过一遍** —— 层级、对齐、对比度、点击区域、焦点与键盘顺序,以及加载/空/出错/内容过多这四种状态每一处有没有做。**不许抽样,不许"挑几个典型"** |
| **X26** | 点一个区,直接给"新建"那一页 | 你先说的是 "we don't need http://127.0.0.1:5173/#/skills and others. just auto pick first one",随后改成 **"actually just show new ** page"** —— 以后一条为准。现在点 Skills(Documents、Projects 同理)落到的是一个只写着"从列表里挑一个"的页面,列表明明就在左边,白让人多点一次。**改成进去就是新建**:点 Skills 直接是新建 Skill 那一页,Documents 是新页,Projects 是新 Project。想看旧的,左边列表点一下就是 —— 这才是摩擦最小。四个细节别漏:①**不碰过不落盘**(X7 那条规则),这一页在你打第一个字之前不算存在,点五次不留五条空记录;②**URL 要说清现在是新建**,别停在光秃秃的 `#/skills`;③新建页要是**真的能用的编辑器**,不是一个"点这里新建"的按钮 —— 那等于又多一步;④**Stream 是例外**,它的东西是采进来的、没法"新建",那里维持原样。顺带把 X25 一起想:四个区应该共用同一个外壳,这条正好是那个外壳该管的事 |
| **X11** | **网页上弹出"访问此设备上的其他应用和服务"** —— 高优先,**两轮都没复现,需要你一句话** | 你的原话是 "this must be fixed. high prio"。**第一轮**:代码全树扫,`127.0.0.1:8787` 只出现一次(`api.ts` 的常量),页面侧调用全经 worker 中转;真机对照,同一页面装扩展与不装各跑一遍,用 CDP 数**归属于页面框架**的私有地址请求,两次都是 **0**。**第二轮**(补你没说但我该试的条件):在你截图那个站(noemamag.com)上,页面加载后、Side Panel 打开后、以及等了一段时间之后各数一次 —— 全程 **0**,`local-network-access` 始终是 `prompt`。**诚实的缺口**:选区那一步没成功(那个站的正文不在 `<p>` 里,我的选择器没选中),所以"选区工具条出现"这个条件**两轮都没真正到达**。**要你一句话**:弹框跳出来的那一刻你刚做了什么?(刚选中文字?刚按麦克风?刚开面板?还是页面一加载就弹?)有这一句我就能把最后那个条件补上。图:`shots/x11-noemamag-device-prompt.png`、`shots/x11-experimental-history-device-prompt.png` |
| **X17b** | Google Docs 的选区工具条:canvas 上没有 DOM 选区,要不要专门做 | X17 验证时坐实的边界:Docs 把选区画在 canvas 上,页面里**不存在** DOM selection,我们的选区检测无从读起 —— 选中文字只出 Google 自己的评论按钮。语音入光标那半已经全通;选区那半(工具条 + 选区 Skill)在 Docs 上今天做不到,除非专门去读 kix 的选区覆盖层(脆、无公开 API)。**要你拍板**:接受这个边界并写进 behaviors,还是投入做 Docs 专用的选区读取 |
| **X18b** | Side Panel 逐条对齐 v1 的行为 | 你的原话是 "high prio. ext panel must work. check v1 for behavior"。**打不开那一半已经修好**(见下"已完成"):面板是被自更新的 reload 打死的,现在会自愈。剩下这一半是你要的正事 —— 把 v1 的 Side Panel 从 git 历史里挖出来读一遍、列出它当时会做的每一件事,再逐条对现在这个,差在哪补哪,不是重新想一个。和 X16 同源,两件一起读 v1 |
| **F3** | ⌘⇧K:开面板、开录音,说完进对话 —— **先出清单,不要实现** | 你的原话是 "cmd+shift+k opens the ext panel and starts voice recording, esc to cancel and enter to accept. msg send to chat. in chat we can use existing skills configured (such as translate, add to project etc). the chat should use a llm agent that we can control. check notion for features. do not impl. propose list of features after deep research."。已经定下来的行为:⌘⇧K 一下,面板打开并立刻开始录;**Esc 取消,Enter 采纳**;采纳后这段话作为一条消息进入对话;对话里能调用已经配置好的 Skill(翻译、加进某个 Project……);对话背后是一个**我们自己能控制的 LLM agent**,不是一次性的 prompt。**明确不要现在实现** —— 先深入研究(Notion 的对话与 AI 功能是指定参照),再提出一份功能清单等你拍板。研究这部分和 R12 是同一片地,一起做,一份清单交付 |
| **F5** | 用历史里说过的话把转写越修越准 —— **先出方案,不要实现** | 你的原话是 "historical user inputs with high quality should be used to improve transcription. e.g. frequent special words/names should be correct. propose features and solution first"。目标很清楚:你反复说到的专有名词、人名,不该每次都被听错一遍。现成的地基有三块 —— Project 的词表(`transcription_profile.vocabulary.terms`,Host 转写时就在读)、光标附近的页面文字(已经当作临时词汇送进去)、以及你手动纠错留下的记录。缺的是把它们连起来的那一步:从历史里自动挑出该记住的词。**先提方案再动手**,方案里必须回答的:①什么算"高质量"输入(被采纳的?被你改过的?出现够多次的?);②词是自动进词表还是要你点头;③词表属于一个 Project 还是全局;④怎么不把口误也学进去,以及学错了怎么撤 |
| **F6** | 做一个叫 Transcription 的 Skill:把说出来的话清干净 | 你的原话是"把这些重复的不一致的嗯啊这些就是这些词都删掉。然后基本上就是整体保持一致吧,但是把一些可以简化的给简化,然后让它更通顺可读一点"。它要做四件事:①删掉语气词和口头禅("嗯""啊""就是""那个"这类);②删掉重复和自我纠正留下的碎句;③**整体保持一致** —— 意思、语气、你的用词都不动,这不是改写;④能简化的地方简化,让它读起来通顺。**边界要写死在 prompt 里:只删不加。** 不许补充你没说过的内容,不许换成更"书面"的说法,不许替你把话说完。建好之后设成转写的默认 Skill(`defaults.transcription` 这个槽位本来就在)。**依赖 X22** —— 现在新建 Skill 是坏的,建不出来。顺带一提,你提这个需求时说的那段话本身就是最好的测试样例 |
| **V3** | 异步听写 —— 转写的时候不锁住,可以接着打字 | **原来这条挂在"等你拍板",问的是"转写到底要等多久"。那不该问你,该我去量 —— 现在量完了:** 拿真的 Host、真的模型跑 fixtures 里的三段音频,5.1 秒的话等 **3.3 秒**,8.2 秒的等 **4.0 秒**,16 秒的等 **8.4~13.3 秒**。粗算是音频长度的**一半到八成**,而且会抖 —— 同一段 8 秒的音频,有一次等了 **25.7 秒**。<br><br>**结论:"一秒内返回"根本不成立,这件事必须做。** 而且它和 **F4** 撞在一起:你要能录十分钟,按这个速度就是**锁住界面五到八分钟**,没人受得了。所以 V3 不再是待定项,它是 F4 的前提 |
| **S3** | 真 key 到位后:重验所有 mock 之下验过的流程 | 替身模型只能证明管道通,不能证明产出对。要重验的:F6 的真话样例、审计的加载/出错/超长三态在真实延迟下的表现、X17 的真实转写、以及任何在此期间打了 mock 标的验证 |
| **R12** | 竞品扫描,以及它翻出来的东西 | 你的原话点了方向:"anywhere voice input with customizable skills, notion's skills in docs, lineage of all content, content gen from sources, pkm"。做完研究把值得的功能补上,"polish the ux/product design/features to make it very good. keep pushing automatically in this way" |

## 等你拍板

| | 任务 | 要定的是什么 |
|---|---|---|
| **V7** | 在文档里选一段,让模型改写,你逐段点"要"或"不要" | **要不要让模型直接动你的文档?** 现在的规矩是:模型只管写出来,放不放、放在哪儿由你说了算。如果让它就地改,改出来的句子上没有 `[Source n]`,就没人知道这句话是从哪来的 —— 而"每句话都能追回出处"正是这个产品的立身之本。**这件事只有你能定**,所以它在这里等着 |
| **V6** | CommandBox 里加麦克风 | 很小,等 V3 落地之后跟着做就行 |

## 长期规则(按你说的原话记)

这些是工作约定,不是任务。每一条在 [behaviors.md](behaviors.md) 里都有对应的详细版本。

- **自己管队列、自己往下推。** 顺序你来定,不要等人喊继续。
- **上一个做完立刻做下一个。** 有值得读的东西才汇报,不要每做一件报一次。
- **能量出来的,不要拿来问。** 你的原话是 "this is low quality qustion. avoid in future. why cant you measure? what do you think it could be?"。只有答案长在你脑子里的事才值得问你 —— 你想要什么、你偏向哪个取舍、什么程度算够好。**跑一下、读一下代码、掐个表就能知道的,不是问题,是我该去做的事。** 把数字带来,说清它对决定意味着什么,并给出建议。实在还量不到的,就说出预计是多少、依据是什么 —— 至少要有个能被证伪的判断,而不是把空白丢回给你。
- **不要停,做没被卡住的那件。** 你的原话是 "work on things not blocked. avoid being blocked."。有东西挡路就绕。真需要你拍板的那件,把问题写清楚留在队列里,然后**立刻往下做别的** —— 队列里永远有不需要等任何人的事。也要主动少给自己制造卡点:先做不依赖别人的部分,把要问的问题攒着一次问完,而不是问一句停一次。
- **短暂浮层上不要多余的字。** 你的原话是 "why the inserted and undo text? we should remove all of these useless words in UI"。人人认识的动作(撤销、关闭、勾)用图标 + 悬停提示,不配文字说明。**与"图标必须带字"不冲突**:那条禁的是没人看得懂的状态点(蓝点),这条删的是给已经看得懂的东西再配的字幕。
- **界面必须一致 —— 每一处、每一层。这是地基,不是收尾。** 你的原话是 "ui design must be consistent! everywhere! all levels! this is the basics."。同一件事在哪儿都得长得一样、用起来一样:页面宽度和边距、分区标题和空态、行/卡片/列表、按钮/输入框/菜单、图标、间距、字号、颜色、文案。两个屏幕用两种方式解决同一个问题,说明其中一个是错的 —— 挑一个用到两处,不是两个都留着。**在这之上,还要照 UI 设计的正经标准做审计**:层级、对齐、对比度、点击区域、焦点与键盘顺序,以及加载/空/出错/内容过多这四种状态,还有文案有没有说清会发生什么。这些要**成系统地查一遍**,不是碰巧看见才修。
- **新的要求进队列,不插到手上这件前面** —— 除非它现在就是坏的。
- **每一条被要求的行为,在被提出的当下就写下来**,让重写不能悄悄把它弄丢。
- **竞品的功能清单是菜单,不是命令。** 值得的留下,其余删掉。标准是极简、一眼就懂,不是"抄全"。
- **加回旧功能、采纳竞品功能,先列清单等你确认。** 你的原话是 "do not add back before i confirm"。
- **现有功能默认保留。** 你的原话是 "default to keep all unless very unnecessary"。
- **持续打磨不是一次性任务。** 你的原话是 "polish the ux/product design/features to make it very good. keep pushing automatically in this way"。
- **只在这个会话里干活。** 你的原话是 "only work in this session"。
- **该提交就提交,能推就推。** 你的原话是 "must commit when necessary. must push when possible"。一件事做完、验过,就落成一个提交并推上去 —— 只在本地的东西,一次机器故障就没了。
- **提交前必须逐个文件看 diff,不认识的文件绝不进提交。** 你的原话是 "alway check the diff when commit. never files you do not know about. check each file/diff before commit"。455 个文件的泄露正是"没看就 add -A"的代价;机器上的闸(check-secrets)是兜底,读 diff 是本分,两个都要,谁也不替谁。
- **暂时没有模型 key:用替身模型顶着,活不能停。** 你的原话是 "i dont have a key now. you must mock and continue the work"。这是你对"不许 mock"规则的**明确豁免**,只豁免模型这一层:Settings 里 key 填 `mock` 即启用,status 里 model 明写 mock,每条产出自报身份。**mock 之下验过的每一件都要打标,真 key 一到全部重验**(见队列 S3)。
- **在真实浏览器里、用真实 Host 和真实模型验证。** 不拿 mock 顶替。
- **要登录才能测的,就用你自己的浏览器测。** 你的原话是 "must use my browser with auth in qa when necessary (e.g. use app that needs login)"。Notion、Google Docs 这类必须登录的地方,不许用一个干净的测试浏览器绕过去,也不许拿"需要登录"当作跳过验证的理由。用带登录态的那个浏览器,并且只做验证要做的事:读、往 QA Project 里写,不删任何东西、不往外发任何东西。
- **不许拿自制的测试页当验证。** 你的原话是 "do not use these to test. use real content."。就是截图里那种 "Draft / Existing text. / Article / Asynchronous research…" —— 自己写的假页面,字少、结构干净、什么都刚刚好,而真实网页从来不长这样。要用真实内容:真的文章、真的 Notion 页面、真的 Google Doc、真的聊天输入框。一个假页面上跑通,证明不了任何事。反例存在 `shots/rule-no-synthetic-test-page.png`。
- **优先在 Logue 自己的应用里测,而且要用内容复杂的长文档。** 你的原话是 "prefer testing in logue app with a lot of complex text doc."。你给的正例就是那种真实文档:中英混排的长文、多级标题和列表、满篇 `[Source n]` 高亮引用、选区工具条压在正文上。这种页面才会把换行、选区、光标定位、浮层遮挡这些问题逼出来 —— 三行字的干净页面永远逼不出来。
- **必须在 Notion 里测。** 你的原话是 "must test in notion"。凡是碰到浏览器界面的改动,Notion 和 Google Docs 都要过 —— 测试页上的一个普通输入框证明不了任何事,光标、选区、重绘在这两个编辑器里都不一样。
- **验证写进 "Logue QA" Project,并且不删任何东西。**
- **你的浏览器上必须是最新的扩展,并且要定期更新。** 你的原话是 "my browser must have latest extension. update it regularly."。不只是部署后那一分钟 —— 要定期检查并推上去,让"我现在看到的是哪个构建"永远只有一个答案:当前那个。**拷进安装目录 ≠ 浏览器里正在跑** —— 一个开了一整天的标签页照样可能还在跑上周的脚本(X19 就是这么来的)。
- **该提交就提交,能推就推。** 你的原话是 "must commit when necessary. must push when possible."。一件事做完、验过,就落一个 commit,别攒着 —— 攒成一大坨,出问题时没法一步步往回退。有远端就推上去;推不上去(没配远端、没网、被拒)就说一声,别默不作声地留在本地。
- **一台机器只有一套** —— 一份代码、一个 Host、一个扩展 —— 而且全部装好、跑着,随时能查,不需要开终端。
- **用中文回复。**

## 已完成

**重建(R1–R11)** —— 归档、功能分级与十条使用路径、脚手架与四道门禁,然后 server、UI 包、web、扩展、安装,十条路径真机跑通,三轮复核,最后删掉归档的旧树。

**一台机器一个 Logue(M1)** —— Host 自己托管应用(`http://127.0.0.1:8787`),并且是会自动重启的登录项;v0.2.13 那套安装、它的十个 release 和它的登录项都清掉了。你的原话是 "there should be just one version in code and running service/extension … installed/running so that i can use/check anytime"。

**文档** —— 能读能回滚的版本历史(V5)、模型写出每个版本改了什么(V2)、标题在没人取名之前自己取名(V4)、打开的是哪一篇写进 URL(V8)。这三项来自 vibedoc 复核(U4)并经你确认。

**Skill 版本浏览(B3)** —— Skill 页上的 Revision 数字现在能点进去:每个旧 prompt 能读、能看逐行 diff、能回滚。回滚写成新版本,Run 记下的版本号永远指向还存在的 prompt。历史对话框和文档共用一个组件,Host 侧的 diff 算术也收敛成一份。

**不碰过就不落盘(X7)** —— 连点 `+` 五次不再留下五条空记录。你的原话是 "if a new doc/skill/proj is never touched it should not be saved"。

**左边栏** —— 分区的列表搬进去,仿 chatgpt.com(U2);改回平铺、每行左侧加类型图标、去掉看不懂的蓝点和图标按钮(U6);学会一个边栏该会的事,取自 agentrunner(U3);再做减法、对齐、hover `+`(U5);把只做了一半的补齐 —— Skills 的 `+`、不再是死胡同的空态、hover 压过 selected、鼠标能移进去的预览卡(U7)。

**外壳(U1)** —— 产品标识、每个路由一条固定顶栏、可折叠可拖宽并且都记住的边栏。你的原话是 "新的 UI 没有 header,也没有 Product logo … 参考第一版"。

**采集与 Side Panel(B1–B19)** —— 自动归组、转写修订与纠错、Side Panel 五个分区、血缘、删除影响预览、备份与恢复、⌘K、自动归类与复核队列、冻结的转写上下文、Tag、采用与撤销、默认 Skill 槽位。

**报过并修掉的 bug(X1–X9)** —— 同屏两个浮层(X1);扩展要手动 reload(X2);第二个写入者静默覆盖文档(X3);验证脚本写进真实工作区(X4);错误提示跟着你去下一个输入框(X5);标签页停在已被替换的构建 —— 这正是选区工具条下面还压着一个输入条的原因(X6);没碰过的新建项落盘(X7);一条长 Source 把整页撑到 6718px、右边一大片死区、每行被切断(X8);Sources 每行点不进 Stream(X9)。

**扩展韧性(B14)** —— 标签页自愈、Host 不在时录音进队列并在它回来时自动送达、选区上的 Skill 前两个直出其余进 `⋯`。顺带修掉一个陷阱:录音器卡住之后界面上没有任何出路。

**自更新死锁(X10)** —— 你 04:37 报的 "Already recording."。抛这句话的代码 B14 已删,但真 bug 在更深处:录音结束后 offscreen 文档没人关,而自更新见到它就让路 —— 录过一次音,浏览器就再也收不到新构建,修好卡住录音器的那个构建恰恰因此进不来。现在录完就关文档、检查时空闲文档先关再继续、真在录音仍然让路。隔离真机 8/8:录音中不打断、录完文档即关、下一次检查即换代、换代后录音干净。

**面板被更新打死(X18 前半)+ 第二地址(X13)** —— 你截图里那个 "Your file couldn't be accessed"。文件一直都在;是 reload 把已打开的面板文档拆了,框还在、里面空了,而面板里本该自救的代码跟着文档一起没了。内容脚本从一开始就有自愈,面板漏了 —— 它今天才现形,正因为 X10 把 reload 修活了。现在 worker 从 reload 回来会重新指向面板,路径带一个计数(不是构建号:手动 Reload 和半截部署都不会改构建号,路径不变就什么都不会发生)。真机 3/3。同时:面板里的"在 Logue 里打开"原本指向 dev server 的 5173 端口,只有在有人开发时才活着 —— 改成 Host 自己的地址,全树再无第二地址。诚实的边界:Chrome 不允许没有真实点击就打开侧边栏,所以"框自己活过来"是从路径变化推出来的,没有亲眼看着它复活。

**边栏全列 + 一个 Find(X12、X14)** —— 边栏原本在十二行上面印着 "Pinned" 和 "Everything else",再把其余的折进 "9 more":两个标题把顺序已经说过的话又说一遍,而折叠把行藏在了一个专职当导航的列表里。现在置顶排最前、一条不截、长了就滚(127 条 Source,127 行)。同时 Find 上面本来还压着第二个搜索框,只筛当前这一段列表 —— 窄的那个看起来才像答案,所以拆掉了;而 Find 自己也名不副实:搜 Source、文档、Project,唯独跳过 Skill —— 偏偏 Skill 的每一行都是你亲手写的 prompt,最难靠滚动找到。现在它搜,并且点得进去。真机 9/9。路上我自己两个测试 bug 都是"过了但什么都没证明":先用只标在高亮行上的 `data-at` 选行,于是只回来一条,被读成"Skills 没搜到";改完又用 /Skill/i 匹配,随便哪行的文字都能满足。现在按 Skill 全名断言。

**OpenAI 兼容 provider 就位(F7 代码半边)** —— Groq 和一切说 OpenAI 格式的免费档,一个 provider 类全包;Settings 里有了 Provider 选择(Gemini / OpenAI-compatible (Groq)),Groq 的地址和模型是默认值,**key 一贴就能用**。模型路由改成"合并到存档记录"而不是改实例 —— 否则 mock 在场时每次保存都会忘掉你选的 provider;切换 provider 会重置 base_url/model,免得 Gemini 的地址漏进 OpenAI 路径只换来 404。wire 格式用"请求记录器"钉死(Bearer 头、system+user 消息、multipart 的 prompt 字段带我们的转写计划),语音健康检查发一段真实的四分之一秒静音。116 条 Host 测试,真机 5/5。**剩你的半边:在 console.groq.com 建号拿 key**(或重新申请 Gemini key),贴进 Settings。

**Google Docs 真机通了(X17)⚠️ 转写内容打 mock 标** —— 按你的原话在你的浏览器里**新建了测试文档**(Drive 里叫 "Logue Test — Google Docs"),整条链在真实 Docs 上走完:光标旁出现麦克风 ✓;真实麦克风录音,**543,581 字节**音频走完 内容脚本→worker→offscreen→Host ✓;转写文本(替身)经 beforeinput 落回光标原处 ✓;X20(无二次确认)和 X21(Inserted/Undo 在工具条上不压正文)在真实 Docs 上同步得证;F4 的计时也在。**没通过的一半是诚实的边界**:Docs 的选区画在 canvas 上、DOM 里没有 selection,选区工具条和选区 Skill 在 Docs 上今天不存在 —— 拆成 X17b 等你拍板。真 key 到位后按 S3 重验转写内容。

**答案能打开,Source 能进去(X15)** —— Recent answers 里每一行原本印着 Skill 名、`28 Sources`、时间,全是死字:那二十八样东西你一个也够不着,答案本身也没有地方可读 —— 那是工作的记录,不是工作。现在整行打开答案,引用是活的;底下列出它依据的每一条 Source,一键就到它在 Stream 里的位置。真机 5/5。我自己的测试选择器又栽了一次:按"数字加空格"开头找行,而行的文字是 `1某某内容` 没有空格 —— 在一个明明列着 28 条的对话框上报了 0 条。现在那个列表是真的 list、有真的 label,检查读它的方式和读屏软件一样。

**快捷键真的绑上了(X16、F2)** —— 你问 "why the shortcuts are gone"。查了 v1:三个命令(⌘⇧Space 语音、⌘⇧M 问这一页、⌘⇧L 开面板)现在的 manifest 里一个不少,web 端还比 v1 多出 ⌘\、⌘1–5、⌥⌘↑↓、右键菜单、⇧F10、`?`。但**声明不等于绑上**:在只装了 Logue 的全新 profile 里问 Chrome 自己(`chrome.commands.getAll()`),**⌘⇧M 绑的是"什么都没有"** —— macOS 上那个键 Chrome 自己留着开个人资料菜单,它拒绝得悄无声息。改成 **⌘⇧U** 并实测绑上了。同时 ⌘⇧L 只会开不会关:按在一个已经开着的面板上什么都不发生,那读起来是键坏了,而不是面板已经在你要的位置 —— 现在一个键管两头。真机 6/6。

**长录音(F4)** —— 你要的四件事,每一件都翻出一个洞。①第一秒起就有计时,过一分钟还会写明"stops at 10:00" —— 没人应该靠撞上去才知道有上限。②十分钟就是那个上限:麦克风自己停,已经说过的话留着等你采纳(没人结束的录音会一直涨到别的东西先坏)。③音频改成**边说边一秒一存**,而不是结束时一整块 —— 中途意外结束也还剩到最后一秒;顺带修掉一个新引入的死结:上限触发后 `stop()` 还在等一个早就发生过的 `onstop`,十分钟的话会卡在 Accept 上永远回不来。④**转写失败现在说得出录音在哪** —— 音频本来就在模型之前写盘,但调用方只拿到失败,录音躺在盘上够不着,那和丢了一样;现在 capture_id 跟着错误回来,新路由 `POST /v1/captures/{id}/transcribe` 在原音频上重来,浮层给出入口。"什么都没听到"走同一条路:只说"音频留着"却不给任何去处,读起来就是"留着也没用"。另外离线队列改成**按字节**而不是按条数:十条十分钟录音是 25MB,而这个存储只有 10MB —— 按条数算的话,拒绝你的是配额、从别处、关于一个你看不见的东西。真机 7/7(真实语音)。

**页面级 Skill 进右键菜单(F1)** —— 在网页上右键,关于"整页"的 Skill 就在那里;哪些算页面级,读的是 Skill 自己的 `contexts`,不存在第二份要手工同步的清单。点一个,Side Panel 打开,里面两条消息:先说这次跑的是哪个 Skill,再是它的产出。页面在生成之前先被存成 Source —— 答案要站在一个存在、事后能追过去的东西上,这是别处都遵守的规矩,菜单不该是例外。真机 8/8(真实模型)。路上撞出一个坑:消息的类型联合和守它的运行时白名单是同一件事的两半,只加一半照样类型检查通过、到了运行时被丢掉 —— "读这一页"什么都不答就是这个原因。诚实的边界:Chrome 不合成右键点击,那一跳只在真实使用里发生,两边都验过了。

**"Already recording." 的真相(X19)** —— 队列里那个假设(换代后同页两份 Logue 抢录音)**我实测推翻了**:在真实网站上每 0.4 秒采样十五秒,连没有修复的构建也从没出现过两份 —— Chrome 在扩展 reload 时就把旧内容脚本的上下文杀掉了,旧的那份没机会把元素抢回去。真实链条更简单,而且已经修好了:**X10 的死锁**冻住了那个浏览器的自更新,于是长期开着的标签页一直跑着 B14 之前的构建 —— 那句话只存在于那个构建里;而它的修复只能通过它自己修的那条路送达。**证据取自你自己的浏览器**、开了一整天的那个真实 Notion 页面:一个宿主、构建戳是几分钟前、ready、无错误、页面上没有那句话。自更新重新够得着已打开的标签页了。留下的是防御性的一层,并且标明是防御:实例进场时登记一个退场方式,下一个实例挂载前先调用它;顺带修正一个真实的次序错误 —— 原来先移元素、后停观察器,而观察器会把元素塞回去。我自己第一版检查又是"过了什么都没证明":在 reload 之后 10 秒才数宿主,而旧脚本的孤儿轮询正好 10 秒 —— 是**拿掉修复跑同一个检查**才发现的。

**key 泄露的清场(S2)** —— 你的 Gemini key 随一份工作区备份进了公开仓库:`.gitignore` 写的是 `.logue-data/`,匹配不到重建时留下的 `.logue-data.before-rebuild-111251/`,455 个文件被我一次 `git add -A` 不看清单就提交了。Google 扫到,封了 key。清场按你的指令做完:本地历史用 filter-repo 重写(pickaxe 复扫,任何提交里不再有 key,也没有任何 AIza 形状的串);建了全新私有仓库(它从没见过那个对象,`4a420d33` 在上面是 No commit found),推入 main 461 个提交和 15 个标签;删掉旧仓库 —— 悬空提交和 13 个 v0.2.x 旧 release 随它一起消失;新仓库改名顶位 `ralphite/logue`,本地 origin 对齐。防再犯:pre-commit 闸(`scripts/check-secrets.sh`)拦工作区文件、按形状拦 key、超 120 个文件的提交要人点头,拿真 key 试过拦得住。**旧 key 已作废,必须换新的** —— 这是唯一剩下的事。重写前的全量备份在你磁盘上:`~/logue-before-rewrite-20260809-002546.bundle`(内含旧历史和 key,只此一份,别推到任何地方)。

**Host(S1)** —— 只绑回环、校验来源,拿不出 Logue 身份的页面不许写。

**vibedoc 与 agentrunner 复核(C1、U3、U4)** —— 读完、列清单、做减法,而不是照单全收。

**不用催也能接着干** —— cron 做不到,因为它只在会话空闲的那一瞬间触发,落在任务中间的每一次都被跳过。会退出的后台命令和 Monitor 心跳都能把会话叫醒,与忙闲无关。这是跑出来验证的,不是假设的。
