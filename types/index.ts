export type Category = "News" | "Podcast";

/** A configured RSS feed from data/sources.json */
export interface Source {
  name: string;
  category: Category;
  rss_url: string;
}

/** A single normalized entry rendered in the unified timeline. */
export interface FeedItem {
  id: string;
  title: string;
  sourceName: string;
  category: Category;
  link: string;
  /** ISO 8601 timestamp */
  publishedAt: string;
  /** Podcasts only, human readable e.g. "1:02:15" */
  duration?: string;
}

export type FeedFilter = "All" | Category;
