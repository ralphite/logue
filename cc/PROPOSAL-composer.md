# 提案：详情里的输入框 → Claude Code → 队列自己更新

> **状态（2026-08-10）**：你选了简化版——不新建会话，复用一个你自己创建的会话，
> 并配一个 Settings 界面。那一版**已经做完了**，见 README。
>
> 这份文件留下来是因为 §2 的调研（认证为什么是唯一的坎）还成立，而 §4 里没被采用
> 的那几条路，将来要改主意时不用重新查一遍。已实现的与本文的差异：
> 没有 inbox 层、没有终端窗口那条退路、没有多 project 选择器（config 里就一个）。

## 1. 闭环长什么样

```
你在 R13 的详情里打一段话（可以贴图）
        ↓  POST /api/ask
server 落图 → 写一条 run → 起一个 Claude Code 进程
        ↓  claude -p "/cc <你的话>"  (cwd = 项目目录)
那个会话跑 cc.py：读队列、判断是新任务还是补充、写 input
        ↓  写回 tasks.json（走 PUT，带版本号）
server 的 mtime 轮询看见 → SSE 推给页面
        ↓
你打的那句话，出现在下面的 FROM YOU 里
```

**闭环的核心不是"起一个进程"，是 `/cc` skill 已经存在。** prompt 就是
`/cc <他说的话>`，skill 已经知道怎么读队列、判断新旧、原话不许润色、防覆盖。
server 不需要懂任何业务，它只负责"把话交出去"。

---

## 2. 先说唯一能挡住这件事的东西：认证

我实测了，结论要你确认一句话。

从这个会话里跑：

```bash
claude -p "Reply with exactly: ALIVE" --output-format json --tools ""
```

得到的是：

```
"result": "Failed to authenticate: OAuth session expired and could not be refreshed"
```

沙箱内外都一样，所以不是沙箱的问题。查了环境才明白：

| 证据 | 意思 |
| --- | --- |
| `CLAUDE_CODE_ENTRYPOINT=claude-desktop` | 这是 Claude Desktop 起的会话 |
| `CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH=1` | token 刷新由**桌面应用**代管，不在 CLI 手里 |
| keychain `Claude Code-credentials` mdat=2026-08-09 | CLI 那份凭据还在，但它自己刷不动 |

**桌面应用手里的 token 是活的，CLI 走的那份是死的。** 所以从这个会话 fork 出去的
`claude` 认证失败。

**但这不代表你的终端也不行。** 你在自己终端里跑过 `claude` 并登录过的话，那份
凭据可能是好的。我判断不了，只有你能。请在**你自己的终端**里跑一次上面那条命令：

- 打出 `ALIVE` → 方案 A 成立，下面全部照做
- 还是 `OAuth session expired` → 走方案 C（见 §4），功能一样成立，只是慢一步

**❓ 问题 1：上面那条命令在你终端里输出什么？**

---

## 3. 输入框（参照 agentrunner 的 composer）

位置就是你圈的那个红框：说明的下面，`FROM YOU` 的上面。它属于"我要对这条说点
什么"，所以站在两者中间是对的——上面是这条任务现在的样子，下面是它的来历。

```
┌──────────────────────────────────────────────────────┐
│ Say something about this task                        │
│                                                      │
│ [🖼 shot.png ×] [🖼 shot-2.png ×]                     │
│                          Logue ▾        ⌘⏎  Send  →  │
└──────────────────────────────────────────────────────┘
```

抄 agentrunner 三件事（`ComposerController.tsx`）：

1. **粘贴即附件** —— `onPaste` 扫 `clipboardData.items`，`type.startsWith("image/")`
   就 `getAsFile()` 并上传，同时 `preventDefault()`（否则文件名会被当文本插进去）
2. **拖进来也行** —— 用 `dragDepth` 计数配对 dragenter/dragleave，否则划过子元素
   时高亮会闪
3. **10MB 上限，超了当场说** —— 不要让它在上传半路失败

不抄的：agentrunner 那套 CAS 上传、slash 菜单、model/branch/access 选择器。那是一个
会话管理器该有的东西，这里只是一个说话的框。

键位：**⌘⏎ 发送，Enter 换行**。这个框里会贴多行、会贴中文，Enter 发送必然误触。

发送之后：输入框清空，`FROM YOU` 上方出现一行 `Thinking…`，完成后它消失、你的话
作为一条真正的 input 出现在下面。失败就留在那里，写明为什么，**并且你的原文还在框
里**——一条发不出去的消息不该消失。

**❓ 问题 2：⌘⏎ 发送 / Enter 换行，还是反过来？**

---

## 4. 怎么起那个 Claude Code

三条路，我建议 **A + C 都做，E 作为地基**。

### A. `claude -p`（推荐，前提是 §2 通过）

```bash
cd /Users/yadong/dev2/logue && claude -p "$PROMPT" \
  --output-format json \
  --allowedTools "Bash(python3 $HOME/.claude/skills/cc/cc.py *)" \
  --permission-mode dontAsk
```

**权限只开到 `cc.py` 这一条命令。** 不是 `--dangerously-skip-permissions`，不是
`--tools Bash`。一个网页触发的进程能跑什么，必须是一句话能说完的。它要做的事只有
一件：调 cc.py。

拿到 `session_id` 和 `result` 写进 run 记录。

### C. 在你自己的终端里开一个可见的会话（退路，且有独立价值）

```bash
osascript -e 'tell app "Terminal" to do script "cd /path && claude \"/cc ...\""'
```

继承你真实的 shell 环境，所以 §2 的认证问题在这里不存在（你终端能跑 claude，它就能
跑）。而且**你看得见它在干什么**，token 真过期了它会当场让你登录，而 `-p` 只会安静
地失败。代价：弹一个窗口。

### E. Inbox（地基，永远可用）

不管 A/C 成不成，消息**先落盘**：`cc/inbox.jsonl` 一条待处理记录。然后：

- A 或 C 成功 → 它消费掉，标记 done
- 都不成 → 它留在那里，页面顶部显示 `3 unprocessed`，你在任何 Claude Code 会话里
  敲一句 `/cc inbox` 就全部消化

**这一层让整件事不会被认证卡死。** 你的话在你按下发送那一刻就已经存住了，claude
起不起得来只影响它多快变成队列里的东西。这也正好是你那条规矩——不要停，做没被卡住
的那件。

**❓ 问题 3：A 之外，C（弹一个终端窗口）要不要做？还是只要 A + E？**

### B. `claude --bg` —— 我不建议

后台 agent 能用 `claude agents --json` 回读状态，听起来更适合。但它把会话交给一个
你要另外去管的池子，而我们要的只是"跑一条命令然后结束"。多一层生命周期，多一处能坏
的地方。

---

## 5. Project 怎么定

你说"就用当前 project，或者 hardcode 成 Logue"。我建议直接做成 config——成本是十
行代码，省掉将来一次改造。

新文件 `cc/config.json`：

```json
{
  "projects": [
    { "id": "logue", "label": "Logue", "cwd": "/Users/yadong/dev2/logue", "default": true }
  ],
  "claude": {
    "bin": "claude",
    "mode": "print",
    "model": "",
    "allowed_tools": "Bash(python3 ~/.claude/skills/cc/cc.py *)",
    "permission_mode": "dontAsk"
  }
}
```

- 只有一个 project 时，输入框右下角那个 `Logue ▾` **不显示**——一个选项的选择器是
  噪音。加第二个 project 它自己出现。
- task 上加一个可选的 `project` 字段。一条任务属于哪个仓库，是它自己的事实，不是
  发消息时才决定的。没有这个字段就用默认。
- 为什么不塞进 tasks.json：那是队列的正本，混进运行配置会让"agent 该编辑什么"变得
  含糊。两个文件，两件事。

**❓ 问题 4：config 单独一个 `config.json`，还是你更想要一个字段塞在 tasks.json 里？**

---

## 6. 图片怎么交给 claude

不走 base64、不走 `--input-format stream-json`。图片本来就要落进 `cc/shots/`
（`inputs[].images` 就是这么存的），所以：

1. `POST /api/upload` 存进 `cc/shots/`，返回 `shots/xxx.png`
2. prompt 里给**绝对路径**，让那个会话用 Read 工具自己看

```
/cc 他正在看任务 R13，说了这段话：

"""
选中之后工具条盖住了正文
"""

他还贴了这些截图，先读一下再判断：
  /Users/yadong/dev2/logue/cc/shots/paste-20260810-1243.png

用 `cc.py say --on R13 --image <路径>` 记在这条上，除非他明显在说别的事——
那就 `cc.py add`。原话一个字不许改。
```

这样图片既是给模型看的证据，又已经在它最终该待的地方，不需要搬第二次。

---

## 7. 看得见

`cc/runs.json` 存最近 50 条：`{id, at, task_id, project, text, images, status, session_id, result, error}`。

SSE 一起推（`{rev, data, runs}`），页面就能显示进行中的那条、以及失败的原因。失败不
自动消失——一次静默失败等于消息丢了。

**❓ 问题 5：失败的 run 要不要一个"重试"按钮？还是只要能看到，重发一遍就行？**

---

## 8. 一处安全，必须说

现在 server 没有任何来源校验。加了 `/api/ask` 之后，**任何本地网页的 JS 都能
`fetch('http://127.0.0.1:8788/api/ask')` 让你的机器跑一个 Claude Code 进程**。只绑
回环挡的是网络，挡不住你浏览器里另一个标签页。

两道闸，都很小：

1. **校验 Origin** —— 只放行本机自己（和 Logue Host 一样的做法：拿不出身份的页面
   不许写）
2. **写操作要一个 token** —— server 启动时生成，注入进 `index.html`。外面的页面拿
   不到它

读接口不用管，写接口（`/api/tasks` PUT、`/api/upload`、`/api/ask`）都要过。

**❓ 问题 6：这两道闸现在就加，还是先只加 Origin 校验、token 以后再说？**

---

## 9. 建议的顺序

| 步 | 做什么 | 卡不卡在 §2 |
| --- | --- | --- |
| 1 | 输入框 + 粘贴/拖拽图片 + `/api/upload` | 不卡 |
| 2 | Inbox（方案 E）+ 页面上的待处理计数 | 不卡 |
| 3 | Origin 校验 + token | 不卡 |
| 4 | `/api/ask` 起 `claude -p` + runs.json + 状态显示 | **卡** |
| 5 | 终端窗口那条退路（方案 C） | 不卡 |
| 6 | 多 project（config + 选择器） | 不卡 |

前三步做完，输入框就已经是有用的了——你打的话不会丢，只是要你一句 `/cc inbox` 才
变成队列里的东西。第 4 步等你回答问题 1。
