# 任务队列

要做的事,和它们现在的状态。**这个文件是唯一的正本** —— 会话里的任务列表只是它的一份镜像,会话结束就没了。只存在于会话里的东西,一次崩溃就丢,而这份清单已经丢过一次。

**每一条新要求都在提出的当下写进这里**,写完再动手。只出现在回复里的要求不算入队。

两个文件,两件事。这里管**顺序**和**还没做的**;[behaviors.md](behaviors.md) 管**做完之后必须成立什么**,写成能扛过下一次重写的样子。一条要求通常两边都要落。

报 bug 的截图存进 `docs/spec/shots/`,被 git 忽略,由任务按文件名引用。图跟着任务走,不进仓库。

## 现在,按这个顺序

| | 任务 | 为什么在这 |
|---|---|---|
| **X11** | **网页上弹出"访问此设备上的其他应用和服务"** —— 高优先,**卡住,需要你一句话** | 你的原话是 "this must be fixed. high prio"。**查到目前为止:复现不出来,而且证据指向不是我们。** 做过的:①代码全树扫,`127.0.0.1:8787` 只出现一次(`api.ts` 的常量),页面侧所有调用都经 worker 中转,唯一直连的是 Side Panel 里的音频 `<audio src>` —— 那是扩展自己的页面,弹框会写 "Logue wants to" 而不是站点名;②真机对照,同一页面(www.experimental-history.com)装扩展跑一遍、不装再跑一遍,用 CDP 数**归属于页面框架**的私有地址请求:两次都是 **0 条**,`local-network-access` 权限状态两次都是 `prompt`(从没被请求过)。内容脚本如果发过这种请求,一定会记在页面这一侧 —— 它没有。**需要你补一句**:弹框跳出来的那一刻,你刚做了什么?(刚打开面板?刚选中文字?刚按了麦克风?还是页面一加载就弹?)有这一句我就能把条件补上重跑。图:`shots/x11-noemamag-device-prompt.png`、`shots/x11-experimental-history-device-prompt.png` |
| **X17** | **Google Docs 必须能用** —— 高优先 | 你的原话是 "high prio. we must make google docs work. create a new test google doc to confirm"。这是 behaviors 里写死的一条("Google Docs must work. It is not optional."),现在不成立。验证方式你也定了:**新建一个测试用 Google Doc**,在那上面确认 —— 不复用旧文档,免得旧页面上残留的老构建把结果说圆了。要在新文档里跑通的是:光标旁出现麦克风、录音、转写回到光标原处、选区工具条、Skill 直出 |
| **X18b** | Side Panel 逐条对齐 v1 的行为 | 你的原话是 "high prio. ext panel must work. check v1 for behavior"。**打不开那一半已经修好**(见下"已完成"):面板是被自更新的 reload 打死的,现在会自愈。剩下这一半是你要的正事 —— 把 v1 的 Side Panel 从 git 历史里挖出来读一遍、列出它当时会做的每一件事,再逐条对现在这个,差在哪补哪,不是重新想一个。和 X16 同源,两件一起读 v1 |
| **X16** | 快捷键回来:对照 v1 补齐 | 你的原话是 "why the shortcuts are gone? check v1 shortcuts"。v1 的树已删但在 git 历史里 —— 把它 manifest 的 commands 和页面内快捷键都挖出来列一遍,该回来的回来(该不该回来按老规矩:值得的留,不值的说明为什么) |
| **F1** | 右键菜单里出现页面级 Skill,结果落在面板的对话里 | 你的原话是 "when right click in a web page, custom skills for pages should show in list. e.g. translate to chinese skill. when clicked, the ext panel is shown with a chat ui with a skill usage msg and then a translation msg"。要的是:在网页上右键,菜单里列出适用于整页的自定义 Skill(例:翻译成中文);点一个,Side Panel 打开,里面是**对话形式** —— 先一条说明这次用了哪个 Skill,再一条是它的产出。两条消息,顺序固定,产出跟着 Skill 走而不是只有翻译。要定的细节:哪些 Skill 算"页面级"(用 Skill 已有的 contexts),以及面板现在的分区式界面怎么容下一个对话流 |
| **F2** | ⌘⇧L 开关扩展面板 | 你的原话是 "cmd+shift+l toggles the ext panel"。一个键管开也管关:面板没开就打开,开着就收起。一个已知的现成条件:装机 manifest 里 `toggle-side-panel` 这条命令已经存在,建议键正是 Command+Shift+L —— 所以要查的是它为什么没生效(是没接处理函数,还是被别的扩展占了同一个键),而不是从头加一个。和 X16(对照 v1 补齐快捷键)是同一件事的两面,一起做 |
| **F3** | ⌘⇧K:开面板、开录音,说完进对话 —— **先出清单,不要实现** | 你的原话是 "cmd+shift+k opens the ext panel and starts voice recording, esc to cancel and enter to accept. msg send to chat. in chat we can use existing skills configured (such as translate, add to project etc). the chat should use a llm agent that we can control. check notion for features. do not impl. propose list of features after deep research."。已经定下来的行为:⌘⇧K 一下,面板打开并立刻开始录;**Esc 取消,Enter 采纳**;采纳后这段话作为一条消息进入对话;对话里能调用已经配置好的 Skill(翻译、加进某个 Project……);对话背后是一个**我们自己能控制的 LLM agent**,不是一次性的 prompt。**明确不要现在实现** —— 先深入研究(Notion 的对话与 AI 功能是指定参照),再提出一份功能清单等你拍板。研究这部分和 R12 是同一片地,一起做,一份清单交付 |
| **F4** | 长录音:十分钟撑得住,一分钟起提醒,音频一次都不能丢 | 你的原话是 "must support long recording (10min). when over 1 min should show warning in ui. never lose audio. if fail to transcribe etc should still save audio and show try again ui"。四件事:①录满 **10 分钟**不断、不崩、不静默截断;②超过 **1 分钟**在界面上给出提醒(要定的是提醒说什么 —— 是"已录 1 分 20 秒"这样的实时长度,还是一句关于长录音的告知);③**音频永不丢失**,任何一步失败都不例外;④转写失败时,**录音照样存下来**,并且界面上给出"再试一次"的入口,而不是一句报错了事。既有的"先存录音再转写"和"Host 不在时排队"是地基,这条是把它延伸到长时长和失败之后 |
| **F5** | 用历史里说过的话把转写越修越准 —— **先出方案,不要实现** | 你的原话是 "historical user inputs with high quality should be used to improve transcription. e.g. frequent special words/names should be correct. propose features and solution first"。目标很清楚:你反复说到的专有名词、人名,不该每次都被听错一遍。现成的地基有三块 —— Project 的词表(`transcription_profile.vocabulary.terms`,Host 转写时就在读)、光标附近的页面文字(已经当作临时词汇送进去)、以及你手动纠错留下的记录。缺的是把它们连起来的那一步:从历史里自动挑出该记住的词。**先提方案再动手**,方案里必须回答的:①什么算"高质量"输入(被采纳的?被你改过的?出现够多次的?);②词是自动进词表还是要你点头;③词表属于一个 Project 还是全局;④怎么不把口误也学进去,以及学错了怎么撤 |
| **R12** | 竞品扫描,以及它翻出来的东西 | 你的原话点了方向:"anywhere voice input with customizable skills, notion's skills in docs, lineage of all content, content gen from sources, pkm"。做完研究把值得的功能补上,"polish the ux/product design/features to make it very good. keep pushing automatically in this way" |

## 等你拍板

| | 任务 | 要定的是什么 |
|---|---|---|
| **V7** | 文档内选区改写,逐段 accept/reject | **你想不想让模型直接改文档?** 现在是严格的"先产出、人再放置"。就地改写没有 `[Source n]`,这跟产品的立身之本冲突 |
| **V3** | 异步听写 —— 转写时不锁住,可以接着打字 | **转写实际要等多久?** 一秒内返回的话,整套队列+重映射就是白搭。先量 |
| **V6** | CommandBox 里加麦克风 | 很小,而且只有 V3 落地才有意义 |

## 长期规则(按你说的原话记)

这些是工作约定,不是任务。每一条在 [behaviors.md](behaviors.md) 里都有对应的详细版本。

- **自己管队列、自己往下推。** 顺序你来定,不要等人喊继续。
- **上一个做完立刻做下一个。** 有值得读的东西才汇报,不要每做一件报一次。
- **不要停,做没被卡住的那件。** 你的原话是 "work on things not blocked. avoid being blocked."。有东西挡路就绕。真需要你拍板的那件,把问题写清楚留在队列里,然后**立刻往下做别的** —— 队列里永远有不需要等任何人的事。也要主动少给自己制造卡点:先做不依赖别人的部分,把要问的问题攒着一次问完,而不是问一句停一次。
- **新的要求进队列,不插到手上这件前面** —— 除非它现在就是坏的。
- **每一条被要求的行为,在被提出的当下就写下来**,让重写不能悄悄把它弄丢。
- **竞品的功能清单是菜单,不是命令。** 值得的留下,其余删掉。标准是极简、一眼就懂,不是"抄全"。
- **加回旧功能、采纳竞品功能,先列清单等你确认。** 你的原话是 "do not add back before i confirm"。
- **现有功能默认保留。** 你的原话是 "default to keep all unless very unnecessary"。
- **持续打磨不是一次性任务。** 你的原话是 "polish the ux/product design/features to make it very good. keep pushing automatically in this way"。
- **只在这个会话里干活。** 你的原话是 "only work in this session"。
- **在真实浏览器里、用真实 Host 和真实模型验证。** 不拿 mock 顶替。
- **要登录才能测的,就用你自己的浏览器测。** 你的原话是 "must use my browser with auth in qa when necessary (e.g. use app that needs login)"。Notion、Google Docs 这类必须登录的地方,不许用一个干净的测试浏览器绕过去,也不许拿"需要登录"当作跳过验证的理由。用带登录态的那个浏览器,并且只做验证要做的事:读、往 QA Project 里写,不删任何东西、不往外发任何东西。
- **必须在 Notion 里测。** 你的原话是 "must test in notion"。凡是碰到浏览器界面的改动,Notion 和 Google Docs 都要过 —— 测试页上的一个普通输入框证明不了任何事,光标、选区、重绘在这两个编辑器里都不一样。
- **验证写进 "Logue QA" Project,并且不删任何东西。**
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

**答案能打开,Source 能进去(X15)** —— Recent answers 里每一行原本印着 Skill 名、`28 Sources`、时间,全是死字:那二十八样东西你一个也够不着,答案本身也没有地方可读 —— 那是工作的记录,不是工作。现在整行打开答案,引用是活的;底下列出它依据的每一条 Source,一键就到它在 Stream 里的位置。真机 5/5。我自己的测试选择器又栽了一次:按"数字加空格"开头找行,而行的文字是 `1某某内容` 没有空格 —— 在一个明明列着 28 条的对话框上报了 0 条。现在那个列表是真的 list、有真的 label,检查读它的方式和读屏软件一样。

**Host(S1)** —— 只绑回环、校验来源,拿不出 Logue 身份的页面不许写。

**vibedoc 与 agentrunner 复核(C1、U3、U4)** —— 读完、列清单、做减法,而不是照单全收。

**不用催也能接着干** —— cron 做不到,因为它只在会话空闲的那一瞬间触发,落在任务中间的每一次都被跳过。会退出的后台命令和 Monitor 心跳都能把会话叫醒,与忙闲无关。这是跑出来验证的,不是假设的。
