import { describe, expect, it } from "vitest";
import { readablePageText } from "./readable";

/** jsdom has no layout, so `innerText` is ours to supply. */
function paragraph(text: string, tag = "p"): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = text;
  Object.defineProperty(element, "innerText", { value: text, configurable: true });
  return element;
}

describe("reading a page", () => {
  it("keeps Chinese prose, which has no spaces in it", () => {
    // Real sentences from zh.wikipedia's 语音识别. Requiring a space to prove a
    // block was more than one word threw every one of these away.
    const body = document.createElement("main");
    body.append(
      paragraph("语音识别技术所涉及的领域包括：信号处理、模式识别、概率论和信息论、发声机理和听觉机理、人工智能等等。"),
      paragraph("目前，主流的大词汇量语音识别系统多采用统计模式识别技术。"),
    );
    document.body.replaceChildren(body);

    const text = readablePageText();
    expect(text).toContain("语音识别技术所涉及的领域");
    expect(text).toContain("统计模式识别技术");
  });

  it("still leaves navigation behind", () => {
    const body = document.createElement("main");
    body.append(paragraph("系统构成", "h2"), paragraph("声学模型", "h2"), paragraph("這一段長到不可能是一個選單項目，它是正文。"));
    document.body.replaceChildren(body);

    const text = readablePageText();
    expect(text).not.toContain("系统构成");
    expect(text).not.toContain("声学模型");
    expect(text).toContain("這一段長到不可能是一個選單項目");
  });
});
