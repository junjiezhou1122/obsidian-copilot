// Removed BrevilabsClient dependency - YouTube transcription disabled
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const simpleYoutubeTranscriptionTool = tool(
  async ({ url }: { url: string }) => {
    return JSON.stringify({
      success: false,
      message:
        "YouTube transcription functionality has been disabled. Please provide transcripts manually or use alternative methods.",
    });
  },
  {
    name: "youtubeTranscription",
    description: "Get the transcript of a YouTube video (currently disabled)",
    schema: z.object({
      url: z.string().describe("The YouTube video URL"),
    }),
  }
);

export { simpleYoutubeTranscriptionTool };
