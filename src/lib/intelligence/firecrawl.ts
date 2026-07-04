/**
 * Firecrawl client — pulls the top ad's landing page as markdown so the
 * analysis can comment on the funnel (offer, form, trust signals), not just
 * the creative.
 */

export async function scrapeLandingPage(url: string, key?: string): Promise<string | null> {
  if (!key) return null;

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 30_000,
      }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: { markdown?: string };
    };
    const markdown = json.data?.markdown;
    if (!markdown) return null;

    // The analysis only needs the top of the funnel.
    return markdown.slice(0, 6_000);
  } catch {
    return null;
  }
}
