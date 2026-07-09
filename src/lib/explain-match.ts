import Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicClient,
  isAnthropicAvailable,
  AnthropicUnavailableError,
} from "@/lib/anthropic-client";

export { isAnthropicAvailable as isExplainMatchAvailable };

export class ExplainMatchError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ExplainMatchError";
  }
}

// Free-text generation from an already-computed, structured explanation -
// same low-cost/low-latency model choice as mood search, since this is a
// small, bounded elaboration task, not open-ended reasoning.
const EXPLAIN_MATCH_MODEL = "claude-haiku-4-5";
const MAX_TITLE_LENGTH = 200;
const MAX_EXPLANATION_LENGTH = 300;

export async function elaborateMatch(input: {
  candidateTitle: string;
  shortExplanation: string;
}): Promise<string> {
  let anthropic: Anthropic;
  try {
    anthropic = getAnthropicClient();
  } catch (error) {
    if (error instanceof AnthropicUnavailableError) {
      throw new ExplainMatchError("This feature is not configured", 503);
    }
    throw error;
  }

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: EXPLAIN_MATCH_MODEL,
      max_tokens: 200,
      system:
        "You expand a short, mechanical movie/TV match explanation into one or two warm, natural sentences for a recommendation card. Stay strictly grounded in the given facts - do not invent plot details, themes, or comparisons not implied by the input. Respond with only the sentences, no preamble.",
      messages: [
        {
          role: "user",
          content: `Title: ${input.candidateTitle}\nMatch: ${input.shortExplanation}`,
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ExplainMatchError("This feature is not configured correctly", 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ExplainMatchError(
        "Temporarily rate-limited - try again shortly",
        429
      );
    }
    if (error instanceof Anthropic.APIError) {
      throw new ExplainMatchError("Temporarily unavailable", 502);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new ExplainMatchError("Could not expand this explanation", 422);
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new ExplainMatchError("Could not expand this explanation", 502);
  }

  return textBlock.text.trim();
}

export const EXPLAIN_MATCH_LIMITS = {
  maxTitleLength: MAX_TITLE_LENGTH,
  maxExplanationLength: MAX_EXPLANATION_LENGTH,
};
