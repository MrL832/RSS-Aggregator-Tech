import { ArrowUpRight, Clock, Mic, Newspaper } from "lucide-react";

import { formatRelative, isLatest } from "@/lib/format";
import type { FeedItem } from "@/types";

export default function FeedCard({ item }: { item: FeedItem }) {
  const isPodcast = item.category === "Podcast";
  const latest = isLatest(item.publishedAt);
  const Icon = isPodcast ? Mic : Newspaper;

  return (
    <article className="group relative flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.06]">
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-zinc-300">
          <Icon
            size={14}
            className={isPodcast ? "text-violet-400" : "text-sky-400"}
          />
          {item.sourceName}
        </span>

        {latest && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400 ring-1 ring-emerald-500/20">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Latest
          </span>
        )}

        <span className="ml-auto shrink-0 text-zinc-500">
          {formatRelative(item.publishedAt)}
        </span>
      </div>

      <h2 className="text-[15px] font-medium leading-snug text-zinc-100">
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="outline-none focus-visible:underline"
        >
          {item.title}
        </a>
      </h2>

      <div className="mt-auto flex items-center gap-3 text-xs text-zinc-500">
        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 capitalize text-zinc-400">
          {item.category}
        </span>

        {isPodcast && item.duration && (
          <span className="inline-flex items-center gap-1">
            <Clock size={13} />
            {item.duration}
          </span>
        )}

        <ArrowUpRight
          size={15}
          className="ml-auto text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
    </article>
  );
}
