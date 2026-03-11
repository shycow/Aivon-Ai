import { useCallback, useState } from "react";
import { executeRun, planMessage, mockStreamResponse } from "../lib/ai/client.js";

export function useAi() {
  const [loading, setLoading] = useState(false);

  const plan = useCallback(async ({ chatId, message }) => {
    setLoading(true);
    try {
      const result = await planMessage({ chatId, message });
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const run = useCallback(async ({ chatId, runId, approvedToolIds, onEvent }) => {
    setLoading(true);
    try {
      await executeRun({ chatId, runId, approvedToolIds, onEvent });
    } finally {
      setLoading(false);
    }
  }, []);

  const mock = useCallback(async ({ message, onToken }) => {
    setLoading(true);
    try {
      await mockStreamResponse({ message, onToken });
    } finally {
      setLoading(false);
    }
  }, []);

  return { plan, run, mock, loading };
}