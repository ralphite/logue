# Release CUJ QA Gate

每一个新 Release tag 前必须完成本门槛。它只验证当前候选包，不能沿用旧
Release、fixture、单元测试或截图作为通过证据。

## 执行原则

1. 先跑自动检查和安装包检查；再只跑本次改动命中的真实 Chrome CUJ。
2. 每条真实 CUJ 使用当前 Chrome profile、当前服务和真实麦克风；记录候选
   version、Extension ID、服务 URL、截图，以及新建 Material/Capture ID（如有）。
3. 任一命中 CUJ 未执行或失败，不能创建 tag。已知的目标环境 P0 不得被隐瞒；
   如用户明确要求先发，必须在 `DECISIONS_AND_RISKS.md` 记录例外。
4. 临时目录只可验证安装器原子性，不能替代真实 Chrome 语音验收。

## 每次都跑（约 5 分钟）

| ID | 验证 | 通过条件 |
|---|---|---|
| A1 | `npm run typecheck && npm test` | 全部通过。 |
| A2 | `bash scripts/build-release.sh <candidate>`、`bash scripts/test-install.sh`、`bash scripts/test-install-extension.sh` | 包含正确版本；首次安装与覆盖升级均保留数据/Chrome stable folder。 |
| A3 | 在真实 Chrome 对候选包执行一次 Reload，打开 Side Panel | 正确版本化 URL、非空 UI、无 crash/error document；已有 Server 设置仍在。 |

## 按改动选择的真实 Chrome CUJ

| 改动范围 | 必跑 CUJ | 最小证明 |
|---|---|---|
| `sidePanel`、麦克风、录音、权限、`manifest`、`microphone.html` | C1 Side Panel 录音 | 第一次授权后，Record 进入录音控制；Cancel 后麦克风指示消失且零写入。再用一句人声 Stop，恰好保存一条带原始音频的 Material。 |
| content script、输入目标、插入、保存、转写 | C2 网页输入语音 | 在标准 textarea 或 contenteditable：一句人声 → Stop and insert；恰好保存一次、插入一次、宿主 submit 计数为 0。 |
| 无输入页面、Side Panel 历史、页面上下文 | C3 页面录音 | 无可写目标页面：一句人声 → Stop；新 Material 立即出现在该页面历史顶部，刷新后仍存在。 |
| Google Docs、Docs selector/焦点/inline recorder、共享 inline audio | C4 Docs 语音 | 真实 Docs canvas：launcher 可见；一句人声 → Enter；恰好保存/插入各一次且不触发 Docs 命令。另跑 Esc，零写入。 |
| 选区、Selection Skills、异步生成 | C5 选区保护 | 在 textarea/contenteditable：选择文本后启动 Skill；Esc 或改变选区/路由，再等待结果；原文不被迟到结果写回，submit 计数为 0。 |
| Server URL、权限、API routing、installer、Linux service | C6 远程连接 | 当前 Chrome 保留旧地址；连接精确新 origin 后，保存一次并由 Web/Side Panel 读回；Chrome Reload 后仍使用新地址。 |
| 快捷键、Side Panel 状态/焦点 | C7 打开/关闭 | `Cmd+Shift+L` 连续开关；重开后 Side Panel 获焦，`R` 可开始录音，不抢宿主文本输入。 |

## P0 现场验收（不因普通补丁自动宣称完成）

| ID | 需要的真实环境 | 完成条件 |
|---|---|---|
| F1 | 目标 Linux + systemd user service + 动态 LAN 域名 + Mac Chrome | 安装、连接、保存/读回、Chrome 重启、服务重启均通过。 |
| F2 | 真实 Google Docs + 人声 | C4 完整通过，且录音确为人声而非 fixture/系统合成音。 |

## 本次麦克风补丁的最小门槛

必须完成 A1–A3 与 C1；若 C1 的 Stop 转写路径改动到保存/插入，再加 C2。
只有用户明确要求仍然发布时，才可例外创建 tag；必须先将缺失证据、用户决定和
后续验收写入 `DECISIONS_AND_RISKS.md`，不得声称该 CUJ 已通过。
