import Anthropic from "@anthropic-ai/sdk";
import { getTemplate } from "@/lib/reports/templates";
import { buildReportContext } from "@/lib/reports/context";
import { resolveServiceKeys } from "@/lib/connections/store";
import { getEffectiveConnections } from "@/lib/connections/mode";
import { getWorld } from "@/lib/data/world";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 120;

const MODEL = process.env.ANALYST_MODEL ?? "claude-sonnet-5";

export async function POST(req: Request) {
  let templateId: string;
  try {
    const body = await req.json();
    templateId = String(body.templateId ?? "");
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const template = getTemplate(templateId);
  if (!template) return new Response("Unknown report template", { status: 404 });

  const { mode, connections } = await getEffectiveConnections();
  const keys = resolveServiceKeys(connections);

  if (mode === "live") {
    const world = await getWorld();
    if (world.liveEmpty || world.metrics.length === 0) {
      return new Response(
        "No connected-account data to report on yet. Connect an ad account, or switch to the Seeded demo board.",
        { status: 409, headers: { "x-report-source": "empty" } },
      );
    }
  }

  if (!keys.anthropic) {
    return new Response(
      "Report generation needs an Anthropic key — add yours on the Connections page (stored only in your encrypted cookie).",
      { status: 503, headers: { "x-report-source": "unavailable" } },
    );
  }

  const limit = rateLimit(`reports:${clientKey(req)}`, { capacity: 6, refillPerMinute: 1.5 });
  if (!limit.ok) {
    return new Response("Rate limited — try again in a minute.", { status: 429 });
  }

  try {
    const context = await buildReportContext({
      platform: template.platform,
      includeAds: template.includeAds,
    });

    const client = new Anthropic({ apiKey: keys.anthropic });
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "disabled" },
      system: template.system,
      messages: [
        {
          role: "user",
          content: `Here is the account data. Write the report.\n\n${context}`,
        },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(readable, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-report-source": "live" },
    });
  } catch (err) {
    console.error("report generation failed:", err);
    return new Response("Report generation failed — try again.", { status: 502 });
  }
}
