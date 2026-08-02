# 真实 Chrome：保存后输入目标丢失恢复

时间：2026-08-02 12:06（America/Los_Angeles）

这是一条真实运行证据，不是完成声明。环境为当前 production Extension、真实 Chrome、`http://beta.localhost:4175/` 输入夹具、真实麦克风、真实 Go/Gemini 和同一 `.logue-data`。

## 硬场景

1. 聚焦普通 textarea，单击语音按钮，用扬声器到麦克风的真实录音链路录入英文样本。
2. 按 Enter 触发“停止并插入”；转写、保存进行期间，宿主网页用新的 textarea 替换原输入框，模拟聊天应用重渲染、路由切换或响应丢失。
3. Gemini 转写与服务端保存成功后，Extension 没有误写新目标，也没有丢弃结果；面板明确显示“输入框已不可用”，保留“复制文字 / 取消 / 重新插入”。
4. 聚焦新的 textarea，单击一次“重新插入”，文字写入新目标并关闭面板。

## 一致性结果

- 最终文字：`Logue keeps every source and preserves the relationship between original notes and derived insights.`
- 服务端从保存成功到重新插入完成始终只有 1 条测试资料：`mat_65dadbe819e0660e`。
- 稳定 request id：`d5b4c299-999b-450e-82c0-5c77b607ea3f`；重试复用已保存 material id，没有再次调用保存。
- 新输入框只插入 1 次；夹具提交计数始终为 0，没有触发网页发送。
- 测试资料与关联 capture 已从真实工作区清理；夹具输入已恢复为测试基线。

## 截图

- `docs/qa/audit-2026-08-02-1905/24-extension-target-lost.png`：保存成功、原目标消失后的可恢复错误态。
- `docs/qa/audit-2026-08-02-1905/25-extension-target-recovered.png`：聚焦新目标后一次重新插入成功，提交计数仍为 0。
