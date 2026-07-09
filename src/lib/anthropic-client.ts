import Anthropic from "@anthropic-ai/sdk";

// Shared bootstrap for every Claude-backed feature (mood search, on-demand
// match explanations, ...) - one client instance, one availability check,
// so each feature only owns its own prompt/schema, not client setup.
export function isAnthropicAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Generic - callers catch this and rethrow as their own domain error (e.g.
// MoodSearchError) with whatever message/status fits that feature.
export class AnthropicUnavailableError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY environment variable is not set");
    this.name = "AnthropicUnavailableError";
  }
}

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AnthropicUnavailableError();
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
