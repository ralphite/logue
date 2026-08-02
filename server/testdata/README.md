# Audio E2E fixture

这些 WAV 使用 macOS 系统语音生成，统一为 PCM 16-bit、16 kHz、单声道。它们调用真实 Gemini 音频输入，不使用 Mock。

## `logue-e2e.wav`

> Logue keeps every source and preserves the relationship between original notes and derived insights.

用于英文逐字基线和完整的“转写后保存为资料”链路。

## `logue-mixed-terms.wav`

> 在 Agent Harness 项目中，Logue 必须保留 Gemini 转写、原始音频和最终采用文字的来源关系。

用于中文、英文项目名和产品术语混合的识别。

## `logue-selection-annotation.wav`

> 我们在浏览器里选择一段文档，使用语音添加批注，然后把原文和派生分析分别保存到 Logue。以后 Agent 读取项目资料包时，必须能看见来源、项目和完整的父子关系。

用于较长中文句子、标点和领域词汇识别。
