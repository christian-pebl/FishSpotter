"use server"

import { suggestVideoTag, type SuggestVideoTagInput } from "@/ai/flows/suggest-video-tag"

export async function getTagSuggestions(currentFrame: string): Promise<string[]> {
  if (!currentFrame) {
    return []
  }

  try {
    const input: SuggestVideoTagInput = {
      // The AI flow is designed for a full video context, which is complex to provide from the client.
      // We are adapting by providing only the most critical piece of information: the current frame.
      // The prompt has been designed to handle this gracefully.
      videoDataUri: '', 
      currentFrame,
      contextFrames: [],
    }

    const result = await suggestVideoTag(input)
    return result.suggestedTags || []
  } catch (error) {
    console.error("Error getting AI tag suggestions:", error)
    // In a real application, you'd want more robust error handling and logging.
    return []
  }
}
