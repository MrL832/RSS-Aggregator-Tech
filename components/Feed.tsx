"use client";

import { useMemo, useState } from "react";

import FeedCard from "@/components/FeedCard";
import type { FeedFilter, FeedItem } from "@/types";

const FILTERS: FeedFilter[] = ["All", "News", "Podcast"];

const LABELS: Record<FeedFilter, string> = {
  All: "All",
  News: "News",
  Podcast: "Podcasts",
};

export default function Feed({ items }: { items: FeedItem[] }) {
  const [filter, setFilter] = useState<FeedFilter>("All");

  const visible = useMemo(
    () => (filter === "All" ? items : items.filter((i) => i.category === filter)),
    [filter, items],
  );

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Filter feed"
        className="inline-flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
      >
        {FILTERS.map((option) => {
          const active = filter === option;
          return (
            <button
              key={option}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(option)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {LABELS[option]}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          No {LABELS[filter].toLowerCase()} in the feed yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
