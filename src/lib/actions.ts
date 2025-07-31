"use server"

import { suggestVideoTag, type SuggestVideoTagInput } from "@/ai/flows/suggest-video-tag"

export async function getTagSuggestions(currentFrame: string): Promise<string[]> {
  if (!currentFrame) {
    return []
  }

  try {
    const input: SuggestVideoTagInput = {
      currentFrame,
    }

    const result = await suggestVideoTag(input)
    return result.suggestedTags || []
  } catch (error) {
    console.error("Error getting AI tag suggestions:", error)
    // In a real application, you'd want more robust error handling and logging.
    return []
  }
}
