# Capture-to-reuse 独立设计评审

日期：2026-08-04
对象：`docs/design/capture-to-reuse-product-design-2026-08-04.md` 冻结初稿

三位 reviewer 均保持只读、独立取证，彼此没有共享结论。初稿评分分别为 6.3、7.2、7.7 / 10，结论均为 `FAIL`。这代表初稿方向成立，但尚不能直接作为实现合同。

吸收三份结论并同步权威规范后，项目 `logue_product_designer` 对最终稿再次只读复审：**9.2 / 10，PASS，0 Blocker，0 Major**。真实人声、Google Docs 和目标 Linux/LAN 仍属于后续 runtime 验收，不阻塞本次产品设计合同。

## 共同确认正确

- 一级导航保持 `Stream / Projects / Documents / Skills / Settings`。
- 不新增 Ask、Inbox、Daily、Agents 或 Generate 页面。
- 正常保存、连接与后台组织保持安静；错误局部、可恢复。
- Selection Skills 使用选区附近的轻量入口，不复制完整格式工具条。
- `On this page` 只在非空时渐进出现。

## 共同阻塞与改稿结果

| 发现 | 改稿结果 |
| --- | --- |
| 旧 product/interaction/design-system 规范与 runtime 冲突 | 三份规范已同步五项 IA、Python/LAN 边界、安静 autosave、可读字号和响应式 panel |
| 异步取消、迟到结果与焦点恢复未统一 | 新增共享异步交互合同，覆盖 Voice、Selection Skill、Generate、Search、Sources |
| LAN/Linux 被缩成一个设置字段 | 增加 Python 3.13 同源 Web/API、受控网络、独立 Extension、精确 origin、统一 background API 与重启验收门槛 |
| Source 合同只覆盖 Document | Extension 短文本/QA 补充可展开 Sources 与 `[Source n]`；新增完整生命周期矩阵 |
| 生成入口会产生空 Document 或引入 Stream 多选 | 只保留共享 Source picker；生成成功后才创建 Document；取消/失败零写入；Stream 不加常驻多选 |
| 引用删除语义含混 | 明确 `Remove source` 删除同源全部引用、统一重编号并提供一次 Undo，不删除 Material |
| Selection Skill 取消与 Undo 不完整 | Esc 使 invocation/request 失效；Document 与网页分别定义可安全 Undo 条件；history 重试不重复替换 |
| Sources/Side Panel 宽度、滚动和键盘规则不足 | Chrome Side Panel 尊重用户宽度；Web panel 共享可调整规则；窄屏用 drawer；补充 focus、scroll 与 resizer 键盘合同 |
| 常驻安全说明、更新时间和成功色制造噪声 | 删除常驻说明与 title 下更新时间；正常连接/保存保持安静 |
| Skill 创建/复制/编辑和 future Context 缺失 | 增加 Skill editor 与 revision/run 追溯；只有用户采用/固定或可靠重复内容可进入未来 Context |
| 任意 Material 追加批注缺失 | 增加文字/语音 `Add annotation`，生成独立子 Material，重试幂等 |

## 有分歧时采用的最小边界

- 保留唯一右键入口 `Save to Logue`，直接保存；Side Panel/Material detail 负责后续 `Add note`。没有新增第二个右键菜单项。
- 不为 Selection Skill 承诺未经过真实宿主验证的全局快捷键。
- 不新增模糊去重算法；只沿用当前 `kind + 完整规范化 content` 的确定性分组。
- External integration 保留为无一级 UI 的只读 Project bundle 与受控追加写回，不升级成 Agents。

## 仍需真实 runtime 证明

- 当前安装 Extension 的准确版本/资源身份。
- 真实 ChatGPT、textarea、Google Docs 的 starting/recording/transcribing/saving/cancel/insert。
- 目标 Linux 的同源 Web/API、精确 origin、服务/Chrome/MV3 重启恢复。
- 真实 Documents/Skill runs 数据上的 Sources、Markdown、Undo、generation cancel 与引用重编号。

这些证据属于实现/验收 Slice 0–2，不得用旧截图、fixture 或不同版本 build 代替。
