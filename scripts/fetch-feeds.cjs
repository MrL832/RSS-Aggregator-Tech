const fs = require("node:fs");
const path = require("node:path");
const Parser = require("rss-parser");
const { HttpsProxyAgent } = require("https-proxy-agent");

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8")
);
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;
const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent": "TechPulseRSS/1.0 (+https://github.com/)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  },
  requestOptions: proxyUrl ? { agent: new HttpsProxyAgent(proxyUrl) } : {},
  customFields: {
    item: [
      ["itunes:duration", "itunesDuration"],
      ["duration", "duration"],
    ],
  },
});

function normalizeDuration(raw) {
  if (!raw) return "";
  const value = String(raw).trim();
  if (value.includes(":")) return value;

  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  const pad = (number) => String(number).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(remainder)}`
    : `${minutes}:${pad(remainder)}`;
}

async function fetchSource(source) {
  let feed;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      feed = await parser.parseURL(source.rss_url);
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  if (!feed) throw lastError;

  const items = (feed.items || [])
    .slice(0, config.itemLimit || 6)
    .map((entry, index) => {
      const rawDate = entry.isoDate || entry.pubDate || entry.published || entry.updated;
      const published = rawDate ? new Date(rawDate) : null;
      const validDate = published && !Number.isNaN(published.getTime());

      if (
        source.category === "Podcast" &&
        (!validDate || published.getTime() > Date.now())
      ) {
        return null;
      }

      return {
        id: entry.guid || entry.id || entry.link || `${source.name}-${index}`,
        title: entry.title || "(untitled)",
        link: entry.link || "",
        sourceName: source.name,
        category: source.category,
        publishedAt: validDate ? published.toISOString() : new Date().toISOString(),
        duration:
          source.category === "Podcast"
            ? normalizeDuration(entry.itunesDuration || entry.duration)
            : "",
      };
    })
    .filter(Boolean);

  if (!items.length) throw new Error("No published items found");
  return items;
}

async function main() {
  const results = await Promise.all(
    config.sources.map(async (source) => {
      try {
        return { source: source.name, items: await fetchSource(source) };
      } catch (error) {
        return {
          source: source.name,
          error: error.message || String(error),
          items: [],
        };
      }
    })
  );

  const items = results.flatMap((result) => result.items);
  const failures = results
    .filter((result) => result.error)
    .map(({ source, error }) => ({ name: source, message: error }));

  if (!items.length) {
    throw new Error("Every RSS source failed; refusing to publish an empty feed.");
  }

  items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const snapshot = {
    generatedAt: new Date().toISOString(),
    items,
    failures,
  };

  fs.writeFileSync(
    path.join(__dirname, "..", "feed.json"),
    JSON.stringify(snapshot, null, 2) + "\n"
  );

  console.log(
    `Feed snapshot: ${items.length} items from ${results.length - failures.length}/${results.length} sources`
  );
  failures.forEach((failure) => {
    console.warn(`Feed unavailable: ${failure.name}: ${failure.message}`);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
