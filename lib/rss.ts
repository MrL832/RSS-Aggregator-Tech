import Parser from "rss-parser";

import sourcesData from "@/data/sources.json";
import type { Category, FeedItem, Source } from "@/types";

/** Feed configuration loaded from data/sources.json */
export const sources: Source[] = sourcesData as Source[];

/** Maximum entries pulled from each feed. */
const MAX_ITEMS_PER_SOURCE = 10;

const FETCH_TIMEOUT_MS = 15_000;

const USER_AGENT =
  "Mozilla/5.0 (compatible; TechPulse/0.1; +https://example.com/tech-pulse)";

type CustomItem = {
  "itunes:duration"?: string;
  "dc:creator"?: string;
};

const parser: Parser<unknown, CustomItem> = new Parser({
  customFields: {
    item: ["itunes:duration", "dc:creator"],
  },
});

/** Turn a raw duration (seconds or "h:mm:ss") into a readable "h:mm:ss". */
function normalizeDuration(raw?: string): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;

  // Already in clock format, e.g. "42:15" or "1:02:15".
  if (value.includes(":")) return value;

  // Numeric seconds.
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");

  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function toIsoString(date?: string): string {
  if (date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

/** Fetch and parse a single feed into normalized {@link FeedItem}s. */
async function fetchSource(source: Source): Promise<FeedItem[]> {
  const res = await fetch(source.rss_url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${source.name}: HTTP ${res.status}`);
  }

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  return (feed.items ?? []).slice(0, MAX_ITEMS_PER_SOURCE).map((item, index) => {
    const link = item.link ?? "";
    const publishedAt = toIsoString(item.isoDate ?? item.pubDate);

    return {
      id: item.guid ?? link ?? `${source.name}-${index}`,
      title: item.title?.trim() || "(untitled)",
      sourceName: source.name,
      category: source.category as Category,
      link,
      publishedAt,
      duration:
        source.category === "Podcast"
          ? normalizeDuration(item["itunes:duration"])
          : undefined,
    } satisfies FeedItem;
  });
}

export interface FeedResult {
  items: FeedItem[];
  /** Sources that could not be loaded, with the reason. */
  failures: { name: string; message: string }[];
}

/**
 * Fetch every configured source, normalize the entries, and return a single
 * timeline sorted newest-first. A failing feed never breaks the whole page.
 */
export async function getFeed(): Promise<FeedResult> {
  const results = await Promise.allSettled(sources.map(fetchSource));

  const items: FeedItem[] = [];
  const failures: FeedResult["failures"] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      const reason = result.reason;
      failures.push({
        name: sources[i].name,
        message: reason instanceof Error ? reason.message : String(reason),
      });
    }
  });

  items.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return { items, failures };
}
