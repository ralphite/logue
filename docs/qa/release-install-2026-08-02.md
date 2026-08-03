# GitHub Release 与一行安装真实回归

日期：2026-08-02（America/Los_Angeles）

## 公开交付

- 旧 `ralphite/logue` 仓库已删除并以全新公开仓库重建；重建前确认只有旧 `main`，没有 Release、Tag、Issue、PR、Star 或 Fork。
- Release：`v0.1.1`。
- 一行入口：`curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | bash`。
- Release 由 Tag 流水线单次构建并上传；从公开 `latest/download` 重新下载的 arm64 包通过发布版 `checksums.txt` 校验。

## 无源码安装与同命令覆盖

在独立临时 HOME、独立数据目录和 `127.0.0.1:18792` 执行真实公开 URL，未使用本地源码或 GitHub 登录信息：

1. 第一次执行选择 `LOGUE_AUTO_START=yes`，发布包校验通过，安装后服务自动启动；`/v1/status` 返回 `ok: true`、`version: v0.1.1`、`ai_configured: true`。
2. 通过真实 API 创建文档 `doc_d9771d2fd60b36d5`，标题为 `Release upgrade sentinel`，正文为 `This document must survive reinstall.`，revision 为 1。
3. 再次执行完全相同的公开安装 URL，并选择 `LOGUE_AUTO_START=no`；安装器先停止旧 PID `21409`，再启动新 PID `21483`。
4. 覆盖后重新读取该文档，id、标题、正文和 revision 全部不变；稳定 Extension 目录仍为真实目录而不是版本软链接。
5. 第一次生成的 LaunchAgent 通过 `plutil -lint`，且不含 `GEMINI_API_KEY`；第二次拒绝自动启动后 plist 已移除。

另已由 `scripts/test-install.sh` 在隔离环境完成 `v0.1.0 → v0.1.1` 跨版本覆盖，证明版本软链接正确切换、旧服务退出、数据哈希保持、接受/拒绝登录自启均生效。

## v0.2.1 公开升级闭环

- 最新 Release：[`v0.2.1`](https://github.com/ralphite/logue/releases/tag/v0.2.1)，非 draft、非 prerelease；tag 指向 `8eb8cb5d5dc77dd23346f85a6b8868c209c963e2`。
- 公开 `latest/download` 的 install.sh、checksums、arm64/amd64 包已重新下载；两个 tar 的 SHA-256 均通过，arm64 二进制返回 `v0.2.1`，Extension manifest 为 `0.2.1`。
- 发布前审查发现安装器默认 `0.0.0.0` 会暴露无认证 API；`v0.2.1` 已改为默认 `127.0.0.1`。真实升级后 PID `89103` 只监听 `127.0.0.1:18831`。
- 安装器使用唯一版本目录后原子切换 `current`；Extension 先完整落地版本化 background/content，最后原子替换 manifest。同版本重复覆盖期间持续探针没有观察到断链。

在 `/tmp/logue-public-upgrade-v020.0NfOja` 的隔离 HOME 中，先用公开 `v0.1.1` 安装，再用完全相同的 `latest` 一行命令依次升级到 `v0.2.0` 和 `v0.2.1`。升级前通过真实 API 和 Gemini 创建：

- 语音资料 `mat_4d52d74e39e723de` 与捕获 `cap_6dc5b906e7eb43a4`；原始音频 SHA-256 为 `f93c753bd72d25211e2f29f038244f63bab7110ddb65d9606cee73205de61b05`。
- 项目 `Release QA`，含 overview 与两个 glossary 术语；资料的人工项目、Tag 和 confirmed 状态已固定。
- 文档 `doc_1130967ba929dd89`，revision 2，保留资料来源。
- 当时的自定义自动化与 Personal context / glossary 设置。

升级到 `v0.2.1` 后，上述 ID、正文、转写、项目、Tag、文档 revision/来源、自定义自动化、设置和音频 hash 全部保持。旧 PID 退出，新 PID 启动；LaunchAgent 通过 `plutil -lint` 且不含 Gemini Key；安装后的 Web 和 Extension 脚本与公开 arm64 Release 包逐字节一致。

真实浏览器最初在 `v0.2.0` 自定义端口发现 Web 错连固定 `8787`，页面显示 disconnected；`v0.2.1` 修复为 Go 托管端口使用同源 API。重新公开升级后，`http://127.0.0.1:18831/?view=generate` 成功加载升级前文档、来源和自定义 Agent，文档按钮首次点击即可打开，控制台 warn/error 为 0，页面无横向溢出。截图：`/tmp/logue-v021-public-document.png`。

## v0.2.3 事务安装与公开 latest

- 公开 `latest`、`v0.2.3` tag、`main` 与 `origin/main` 同为 `88d10b5`；Release workflow `30772874709` 成功，install.sh、checksums 和双架构包齐全。
- 安装器现在先验证自动启动配置、发布包、版本化 Extension、CLI 与 LaunchAgent，再停止旧服务；程序、Extension、CLI 和 LaunchAgent 任一步失败都会恢复完整旧状态并重启旧服务。
- CI `30772826114` 在同一提交真实运行 `scripts/test-install.sh`。公开日志对 extension、cli、autostart 三点分别断言：候选 `v0.1.1` 已切换、健康检查成功、随后注入故障、最后完整回滚；同时复核旧 current、Extension manifest/资产、CLI、LaunchAgent、旧服务、loopback 监听与数据 hash。
- 非法 `LOGUE_AUTO_START` 在停服前失败，旧 PID 不变。fresh-context Goal Governor 独立审查据此确认 F13/F14 可以关闭。
- 真实公开 `v0.1.1 → v0.2.2` 成功升级位于 `/tmp/logue-public-upgrade-v022.fL590P`：真实 Gemini 转写、音频 hash、资料、人工项目/Tag、文档 revision/来源、自建 Agent 与设置保持；Web 在 `18845` 首次点击打开文档与来源，控制台日志为空且无横向溢出。`v0.2.3` 相比该已验证正常事务只增加故障审计输出、CI 门禁和版本元数据。
