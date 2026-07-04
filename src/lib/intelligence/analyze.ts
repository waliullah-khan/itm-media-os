/**
 * Claude creative analysis: one structured-output call over the whole batch
 * of scraped ads (plus optional landing-page markdown) returns per-ad
 * breakdowns — hook, angle, why it works, and a reproduction prompt — and
 * account-level patterns.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { AdAnalysis, ScrapedAd } from "@/lib/intelligence/types";

const MODEL = process.env.ANALYST_MODEL ?? "claude-sonnet-5";

const AnalysisSchema = z.object({
  ads: z.array(
    z.object({
      adId: z.string(),
      hook: z.string().describe("The opening line/visual hook, quoted or described"),
      angle: z.string().describe("Persuasion angle, 2-5 words, e.g. 'social proof', 'fear of loss'"),
      format: z.string().describe("Creative format, e.g. 'UGC testimonial video', 'static product shot'"),
      emotion: z.string().describe("Primary emotion targeted, one word"),
      whyItWorks: z.string().describe("2-3 sentences on why this ad likely performs"),
      reproductionPrompt: z
        .string()
        .describe(
          "A complete, self-contained brief a creative team (or image/video model) could execute to produce a competitive version of this ad for a different brand: scene, casting, tone, hook structure, text overlays, CTA",
        ),
    }),
  ),
  patterns: z
    .array(z.string())
    .describe("3-5 patterns that repeat across these ads (hooks, formats, offers)"),
  recommendations: z
    .array(z.string())
    .describe("3-4 specific actions a media buying team should take based on this research"),
});

export async function analyzeAds(
  query: string,
  ads: ScrapedAd[],
  landingPageMarkdown: string | null,
  apiKey?: string,
): Promise<{
  analyses: AdAnalysis[];
  patterns: string[];
  recommendations: string[];
  landingPageNotes: string | null;
}> {
  const client = new Anthropic(apiKey ? { apiKey } : undefined);

  const adDescriptions = ads
    .map(
      (ad) => `<ad id="${ad.id}">
page: ${ad.pageName}
running since: ${ad.startedRunning ?? "unknown"}
platforms: ${ad.platforms.join(", ") || "unknown"}
format: ${ad.mediaKind ?? "text"}
headline: ${ad.title ?? "—"}
cta: ${ad.ctaType ?? "—"}
body: ${ad.body?.slice(0, 900) ?? "—"}
</ad>`,
    )
    .join("\n\n");

  const landingSection = landingPageMarkdown
    ? `\n\nLANDING PAGE of the first ad (markdown excerpt):\n${landingPageMarkdown}`
    : "";

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 6000,
    thinking: { type: "disabled" },
    system:
      "You are a direct-response creative strategist at an affiliate marketing company. You reverse-engineer competitor ads: what the hook is, what angle is doing the persuasion work, and how to reproduce the mechanics (never the brand assets) for our own offers. Longevity matters: an ad running for months is proven. Be specific and practical — your reproduction prompts get handed straight to the creative team.",
    messages: [
      {
        role: "user",
        content: `Research query: "${query}". Analyze each competitor ad below and extract account-level patterns.${landingSection}\n\n${adDescriptions}`,
      },
    ],
    output_config: { format: zodOutputFormat(AnalysisSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Analysis parsing failed");

  let landingPageNotes: string | null = null;
  if (landingPageMarkdown) {
    // Pull funnel observations into their own short call so ad analyses stay focused.
    const funnel = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      thinking: { type: "disabled" },
      system:
        "You are a CRO specialist. In 3-4 sentences, describe this landing page's funnel mechanics: the offer, how the lead is captured (form length, quiz, call), and the trust signals used. Plain prose, no headers.",
      messages: [{ role: "user", content: landingPageMarkdown }],
    });
    const block = funnel.content[0];
    landingPageNotes = block?.type === "text" ? block.text : null;
  }

  return {
    analyses: parsed.ads,
    patterns: parsed.patterns,
    recommendations: parsed.recommendations,
    landingPageNotes,
  };
}
