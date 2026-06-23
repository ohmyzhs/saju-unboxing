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
    maxTokens: 3200,
    timeoutMs: 180000,
    onDelta,
    onReset,
  });
}
