# Logue Web App 内 Extension 真实闭环

时间：2026-08-02 15:18（America/Los_Angeles）

这是当前 `apps/extension/dist` 重载后的真实 Chrome、真实麦克风、真实 Go/Gemini 与真实 `.logue-data` 证据，不是 Storybook 或模拟录音。

## 流程

1. 在 `chrome://extensions` 对 unpacked `Logue` 执行 Reload，再重新加载 `http://127.0.0.1:5173/?view=generate`。
2. 聚焦 Generate 的 `Task` textarea；页面只注入一个 `#logue-extension-host`，其 Shadow DOM 只包含语音与 Agent 两个启动器。host 自身带 `data-logue-extension="disabled"`，因此不会递归注入。
3. 点击语音启动器，真实进入 `Recording`；界面只有 `Cancel Esc` 与 `Stop and insert ↵`。
4. 通过扬声器播放 `fixtures/audio/logue-e2e.wav`，录音结束后按 Enter。
5. Extension 显示 `Transcribing and inserting…`，完成后 Task textarea 只包含一次：`Logue keeps every source and preserves the relationship between original notes and derived insights.`

## 强证据

- 操作前资料数：53；操作后：54。
- 新资料：`mat_f7538713a374f7c1`，`kind=voice`，`request_id=c21dbca3-6da4-4d9a-bcbf-f88d06abe55f`。
- 同一 request id 的资料数：1。
- 新资料的 `content` 与 `transcript` 均精确等于插入文字。
- Automatic organization 随后给出 0.9 置信度和英文理由，并安静完成整理。
- textarea 中期望文字出现次数：1；完整值精确匹配。
- 页面没有 form；URL 保持 `?view=generate`；Agent run 数操作前后均为 8，因此没有自动触发 Generate 或宿主提交。
- 最新构建 host 数为 1，Shadow DOM button 数为 2；没有重复或递归启动器。
- 本地截图：`/tmp/logue-extension-in-logue-complete.png`。截图含真实工作区标题，不提交到 Git，避免把用户资料带入公开仓库或 Release。
