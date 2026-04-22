import { JSDOM } from "jsdom";

export interface PageInsight {
  title: string;
  description: string;
  keywords: string[];
}

/**
 * A lightweight scraper to get marketing context from a landing page.
 */
export async function getWebpageInsight(url: string): Promise<PageInsight> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const html = await response.text();

    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const title = doc.querySelector("title")?.textContent || "";
    const description =
      doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";

    // Simple heuristic for keywords
    const h1s = Array.from(doc.querySelectorAll("h1"))
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    const h2s = Array.from(doc.querySelectorAll("h2"))
      .map((el) => el.textContent?.trim())
      .filter(Boolean);

    return {
      title,
      description,
      keywords: [...new Set([...h1s, ...h2s] as string[])].slice(0, 5),
    };
  } catch (error) {
    console.error(`[Scraper] Failed to crawl ${url}:`, error);
    return { title: "", description: "", keywords: [] };
  }
}
