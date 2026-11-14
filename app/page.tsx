import { Activity, AlertTriangle } from "lucide-react";

import Feed from "@/components/Feed";
import { getFeed } from "@/lib/rss";

export default async function Home() {
  const { items, failures } = await getFeed();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-10 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20">
            <Activity size={20} className="text-emerald-400" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Tech Pulse
          </h1>
        </div>
        <p className="text-sm text-zinc-400">
          A unified timeline of the latest tech news and podcast episodes.
        </p>
      </header>

      {failures.length > 0 && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400/90">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p>
            Could not load{" "}
            {failures.map((f, i) => (
              <span key={f.name}>
                <span className="font-medium">{f.name}</span>
                {i < failures.length - 1 ? ", " : ""}
              </span>
            ))}
            . Showing the rest of the feed.
          </p>
        </div>
      )}

      <Feed items={items} />
    </main>
  );
}
