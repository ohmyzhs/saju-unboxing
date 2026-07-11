import { requestText } from "../legacy/_lib/aiTransport.js";
import { buildChatSystemPrompt } from "./prompt.js";
import { createReportTools, selectRelevantSection } from "./reportTools.js";

export async function runReportAgent({
  snapshot,
  history = [],
  question,
  model,
  generate = requestText,
  onDelta,
  onReset,
}) {
  const tools = createReportTools({ snapshot, history });
  const relevant = selectRelevantSection(snapshot, question);
  const sectionKey = relevant?.id ?? relevant?.title ?? "0";
  const toolCalls = [
    { name: "get_report_overview", result: tools.get_report_overview() },
    { name: "get_report_section", arguments: { sectionKey }, result: tools.get_report_section(sectionKey) },
    { name: "get_manse_facts", result: tools.get_manse_facts() },
    { name: "get_conversation_history", result: tools.get_conversation_history() },
  ];
  return generate({
    model,
    system: buildChatSystemPrompt(),
    input: JSON.stringify({
      question: String(question || "").trim(),
      evidence: { toolCalls },
    }),
    // 1600은 상세한 한국어 답변이 중간에 잘리던 값. 잘림(finish_reason=length)은
    // aiTransport가 감지해 이어서 질문하라는 안내를 붙인다.
    maxTokens: 4096,
    timeoutMs: 180000,
    onDelta,
    onReset,
  });
}
