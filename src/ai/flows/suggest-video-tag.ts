'use server';

/**
 * @fileOverview AI-powered tag suggestions for video frames, utilizing surrounding frames for accurate marine species annotation.
 *
 * - suggestVideoTag - A function that suggests tags for a given video frame.
 * - SuggestVideoTagInput - The input type for the suggestVideoTag function.
 * - SuggestVideoTagOutput - The return type for the suggestVideoTag function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestVideoTagInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  currentFrame: z.string().describe('The current frame of the video as a data URI.'),
  contextFrames: z
    .array(z.string())
    .describe('Array of surrounding frames (data URIs) for context.'),
});
export type SuggestVideoTagInput = z.infer<typeof SuggestVideoTagInputSchema>;

const SuggestVideoTagOutputSchema = z.object({
  suggestedTags: z
    .array(z.string())
    .describe('Array of suggested tags for the video frame.'),
});
export type SuggestVideoTagOutput = z.infer<typeof SuggestVideoTagOutputSchema>;

export async function suggestVideoTag(input: SuggestVideoTagInput): Promise<SuggestVideoTagOutput> {
  return suggestVideoTagFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestVideoTagPrompt',
  input: {schema: SuggestVideoTagInputSchema},
  output: {schema: SuggestVideoTagOutputSchema},
  prompt: `You are an expert marine biologist. Given a video frame and its surrounding context frames, suggest relevant tags for the marine species visible in the current frame.

Current Frame: {{media url=currentFrame}}

Context Frames:
{{#each contextFrames}}
  {{media url=this}}
{{/each}}

Suggest tags related to the marine species.`,
});

const suggestVideoTagFlow = ai.defineFlow(
  {
    name: 'suggestVideoTagFlow',
    inputSchema: SuggestVideoTagInputSchema,
    outputSchema: SuggestVideoTagOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
