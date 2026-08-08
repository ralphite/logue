# 真实 Chrome：选区语音批注断线恢复

时间：2026-08-02 11:38（America/Los_Angeles）

这是一条真实运行证据，不是完成声明。环境为当前已安装的 production Extension、真实 Chrome、`http://127.0.0.1:4175/` 输入夹具、真实 Go 服务与 Gemini。

## 硬场景

1. 在网页中选中完整原文：`Logue 的语音输入必须在一次停止操作后自动转写、保存并写入目标，不允许再要求第二次确认。`
2. 右键选择“保存到 Logue”，面板明确标记“完整原文 · 只读”。
3. 点击“开始语音”，录入英文批注：`Logue keeps every source and preserves the relationship between original notes and derived insights.`
4. 录音结束前关闭真实 Go 服务；点击“停止”后，Extension 保留录音并显示“无法连接 Logue 本机服务”，提供“删除录音 / 重新转写”，没有写入宿主页面。
5. 使用同一 `.logue-data` 和终端 Gemini 环境重启 Go；点击“重新转写”后自动完成转写和保存。

## 持久结果

- 请求前缀：`daf8b723-976f-471e-9af1-4adfc35fdd55`
- 原文：`selection`，request id 后缀 `:source`。
- 语音批注：`derived`，request id 后缀 `:annotation`，`parent_ids` 只指向该原文。
- 批注保留独立原始音频、机器转写和最终采用文字。
- 断线失败后恢复只生成一条原文和一条批注，没有重复；夹具三处提交计数始终为 0。
- 自动整理分别运行；低置信度批注保持现有项目，候选项目/标签只进入可审阅建议。
- 可回滚测试结束后，两条资料及音频已从真实数据删除；截图保留直接证据。

## 截图

- `docs/qa/audit-2026-08-02-1905/21-extension-selection-offline.png`：Go 断线时，录音保留并提供“重新转写”。
- `docs/qa/audit-2026-08-02-1905/19-selection-voice-chain-scrolled-320.png`：恢复后移动端详情的原始录音、机器转写与最终采用文字。
- `docs/qa/audit-2026-08-02-1905/20-selection-parent-link-320.png`：批注明确显示“派生自 1 条资料”与不可变原文。
