import { useState, useCallback } from "react";

const API_BASE = "http://localhost:8000/api/v1";

export function useAgentStream() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! Tell me what bureaucratic procedure you need assistance with (e.g., 'German student visa', 'Renew passport', or 'Aadhaar document check').",
    },
  ]);
  const [currentNode, setCurrentNode] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [activeTask, setActiveTask] = useState(null);

  const sendMessage = useCallback(async (query, taskId = null) => {
    if (!query.trim() || isStreaming) return;

    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setIsStreaming(true);
    setCurrentNode("parse_intent");

    try {
      const response = await fetch(`${API_BASE}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, task_id: taskId }),
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.replace("data: ", "").trim();
          if (raw === "[DONE]") break;

          try {
            const parsed = JSON.parse(raw);
            if (parsed.event === "node_update") {
              setCurrentNode(parsed.node);
              if (parsed.node === "parse_intent" && parsed.data?.procedure_topic) {
                setActiveTask((prev) => ({
                  ...prev,
                  topic: parsed.data.procedure_topic,
                  country: parsed.data.target_country,
                }));
              } else if (parsed.node === "audit_vault" && parsed.data?.checklist) {
                setChecklist(parsed.data.checklist);
              } else if (parsed.node === "synthesize_guidance" && parsed.data?.answer) {
                setMessages((prev) => [...prev, { role: "assistant", content: parsed.data.answer }]);
              }
            } else if (parsed.event === "task_created") {
              setActiveTask((prev) => ({ ...prev, id: parsed.task_id }));
            }
          } catch (e) {
            console.error("SSE parse error", e);
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}. Please verify the backend is running.` },
      ]);
    } finally {
      setIsStreaming(false);
      setCurrentNode(null);
    }
  }, [isStreaming]);

  return { messages, currentNode, isStreaming, checklist, activeTask, sendMessage };
}