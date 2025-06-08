import { indexTool, localSearchTool, webSearchTool } from "@/tools/SearchTools";
import {
  getCurrentTimeTool,
  getTimeInfoByEpochTool,
  getTimeRangeMsTool,
  pomodoroTool,
  TimeInfo,
} from "@/tools/TimeTools";
import { createGetFileTreeTool } from "@/tools/FileTreeTools";
import { simpleYoutubeTranscriptionTool } from "@/tools/YoutubeTools";

import { extractChatHistory, extractYoutubeUrl } from "@/utils";
// Removed BrevilabsClient dependency - using fallback intent analysis
import { Vault } from "obsidian";
import ProjectManager from "@/LLMProviders/projectManager";

// TODO: Add @index with explicit pdf files in chat context menu
export const COPILOT_TOOL_NAMES = ["@vault", "@composer", "@web", "@youtube", "@pomodoro"];

type ToolCall = {
  tool: any;
  args: any;
};

export class IntentAnalyzer {
  private static tools: any[] = [];

  static initTools(vault: Vault) {
    if (this.tools.length === 0) {
      this.tools = [
        getCurrentTimeTool,
        getTimeInfoByEpochTool,
        getTimeRangeMsTool,
        localSearchTool,
        indexTool,
        pomodoroTool,
        webSearchTool,
        simpleYoutubeTranscriptionTool,
        createGetFileTreeTool(vault.getRoot()),
      ];
    }
  }

  static async analyzeIntent(originalMessage: string): Promise<ToolCall[]> {
    // Use fallback intent analysis only (Broca API disabled)
    console.log("Using local intent analysis (Broca API disabled)...");
    return this.fallbackAnalyzeIntent(originalMessage);
  }

  /**
   * Fallback intent analysis when Broca API is unavailable
   * This provides basic @ command detection without the advanced AI analysis
   */
  private static async fallbackAnalyzeIntent(originalMessage: string): Promise<ToolCall[]> {
    const processedToolCalls: ToolCall[] = [];
    const message = originalMessage.toLowerCase();

    // Simple fallback analysis for @ commands only
    await this.processAtCommands(originalMessage, processedToolCalls, {
      salientTerms: [], // No salient terms available in fallback mode
    });

    // If no @ commands detected, try to determine if this might need vault search
    if (processedToolCalls.length === 0) {
      // Simple heuristic: if the message contains question words, add vault search
      const questionWords = [
        "what",
        "how",
        "why",
        "when",
        "where",
        "who",
        "which",
        "explain",
        "tell",
        "show",
      ];
      const containsQuestionWord = questionWords.some((word) => message.includes(word));

      if (containsQuestionWord) {
        processedToolCalls.push({
          tool: localSearchTool,
          args: {
            query: originalMessage,
            salientTerms: [],
          },
        });
      }
    }

    return processedToolCalls;
  }

  private static async processAtCommands(
    originalMessage: string,
    processedToolCalls: ToolCall[],
    context: {
      timeRange?: { startTime: TimeInfo; endTime: TimeInfo };
      salientTerms: string[];
    }
  ): Promise<void> {
    const message = originalMessage.toLowerCase();
    const { timeRange, salientTerms } = context;

    // Handle @vault command
    if (message.includes("@vault") && (salientTerms.length > 0 || timeRange)) {
      // Remove all @commands from the query
      const cleanQuery = this.removeAtCommands(originalMessage);

      processedToolCalls.push({
        tool: localSearchTool,
        args: {
          timeRange: timeRange || undefined,
          query: cleanQuery,
          salientTerms,
        },
      });
    }

    // Handle @web command
    if (message.includes("@web")) {
      const cleanQuery = this.removeAtCommands(originalMessage);
      const memory = ProjectManager.instance.getCurrentChainManager().memoryManager.getMemory();
      const memoryVariables = await memory.loadMemoryVariables({});
      const chatHistory = extractChatHistory(memoryVariables);

      processedToolCalls.push({
        tool: webSearchTool,
        args: {
          query: cleanQuery,
          chatHistory,
        },
      });
    }

    // Handle @pomodoro command
    if (message.includes("@pomodoro")) {
      const pomodoroMatch = originalMessage.match(/@pomodoro\s+(\S+)/i);
      const interval = pomodoroMatch ? pomodoroMatch[1] : "25min";
      processedToolCalls.push({
        tool: pomodoroTool,
        args: { interval },
      });
    }

    // Handle @youtube command
    if (message.includes("@youtube")) {
      const youtubeUrl = extractYoutubeUrl(originalMessage);
      if (youtubeUrl) {
        processedToolCalls.push({
          tool: simpleYoutubeTranscriptionTool,
          args: {
            url: youtubeUrl,
          },
        });
      }
    }
  }

  private static removeAtCommands(message: string): string {
    return message
      .split(" ")
      .filter((word) => !COPILOT_TOOL_NAMES.includes(word.toLowerCase()))
      .join(" ")
      .trim();
  }
}
