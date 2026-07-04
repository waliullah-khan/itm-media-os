import Anthropic from "@anthropic-ai/sdk";
import { buildAnalystContext } from "@/lib/analyst/context";
import { ANALYST_SYSTEM } from "@/lib/analyst/prompt";
import { FALLBACK_ANALYSIS } from "@/lib/analyst/fallback";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

const MODEL = process.env.ANALYST_MODEL ?? "claude-sonnet-5";

/** Simple in-memory cache: the dataset is static, so one analysis per
 * process is fresh enough. Bypassed with { force: true }. */
let cachedAnalysis: string | null = null;

export async function POST(req: Request) {
  let force = false;
  try {
    const body = await req.json();
    force = body?.force === true;
  } catch {
    // no body — defaults are fine
  }

  if (cachedAnalysis && !force) {
    return new Response(cachedAnalysis, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-analyst-source": "cached" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(FALLBACK_ANALYSIS, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-analyst-source": "fallback" },
    });
  }

  const limit = rateLimit(`analyst:${clientKey(req)}`, {
    capacity: 4,
    refillPerMinute: 1,
  });
  if (!limit.ok) {
    return new Response("Rate limited — try again shortly.", {
      status: 429,
      headers: { "retry-after": String(limit.retryAfterSec ?? 60) },
    });
  }

  try {
    const client = new Anthropic();
    const context = await buildAnalystContext();

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "disabled" },
      system: ANALYST_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Here is this week's account data. Write the review.\n\n${context}`,
        },
      ],
    });

    let full = "";
    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        stream.on("text", (delta) => {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        });
        stream.on("end", () => {
          cachedAnalysis = full;
          controller.close();
        });
        stream.on("error", (err) => controller.error(err));
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(readable, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-analyst-source": "live" },
    });
  } catch {
    return new Response(FALLBACK_ANALYSIS, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-analyst-source": "fallback" },
    });
  }
}
