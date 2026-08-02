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
5. 第一次生成的 LaunchAgent 通过 `plutil -lint`，且不含 `GEMINI_API_KEY` 或 `GOOGLE_GENERATIVE_AI_API_KEY`；第二次拒绝自动启动后 plist 已移除。

另已由 `scripts/test-install.sh` 在隔离环境完成 `v0.1.0 → v0.1.1` 跨版本覆盖，证明版本软链接正确切换、旧服务退出、数据哈希保持、接受/拒绝登录自启均生效。
