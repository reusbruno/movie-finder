import { NextRequest, NextResponse } from "next/server";
import {
  elaborateMatch,
  isExplainMatchAvailable,
  ExplainMatchError,
  EXPLAIN_MATCH_LIMITS,
} from "@/lib/explain-match";

export async function GET() {
  return NextResponse.json({ available: isExplainMatchAvailable() });
}

export async function POST(request: NextRequest) {
  if (!isExplainMatchAvailable()) {
    return NextResponse.json({ error: "This feature is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const title = (body as { title?: unknown } | null)?.title;
  const explanation = (body as { explanation?: unknown } | null)?.explanation;

  if (typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "Field 'title' is required" }, { status: 400 });
  }
  if (typeof explanation !== "string" || explanation.trim() === "") {
    return NextResponse.json({ error: "Field 'explanation' is required" }, { status: 400 });
  }
  if (title.length > EXPLAIN_MATCH_LIMITS.maxTitleLength) {
    return NextResponse.json(
      { error: `Field 'title' must be ${EXPLAIN_MATCH_LIMITS.maxTitleLength} characters or fewer` },
      { status: 400 }
    );
  }
  if (explanation.length > EXPLAIN_MATCH_LIMITS.maxExplanationLength) {
    return NextResponse.json(
      {
        error: `Field 'explanation' must be ${EXPLAIN_MATCH_LIMITS.maxExplanationLength} characters or fewer`,
      },
      { status: 400 }
    );
  }

  try {
    const text = await elaborateMatch({
      candidateTitle: title.trim(),
      shortExplanation: explanation.trim(),
    });
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof ExplainMatchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to expand explanation" }, { status: 500 });
  }
}
