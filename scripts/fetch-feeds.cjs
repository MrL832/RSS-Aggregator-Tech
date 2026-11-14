const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { URL } = require("node:url");
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
const requestAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
const parser = new Parser({
  customFields: {
    item: [
      ["itunes:duration", "itunesDuration"],
      ["duration", "duration"],
    ],
  },
});

function downloadXml(feedUrl, redirects = 0) {
  return new Promise((resolve, reject) => {
    const url = new URL(feedUrl);
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.get(
      url,
      {
        agent: requestAgent,
        headers: {
          "User-Agent": "TechPulseRSS/1.0 (+https://github.com/)",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          if (redirects >= 5) {
            reject(new Error("Too many redirects"));
            return;
          }
          resolve(downloadXml(new URL(response.headers.location, url).toString(), redirects + 1));
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }

        let xml = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          xml += chunk;
        });
        response.on("end", () => resolve(xml));
        response.on("aborted", () => reject(new Error("Feed response aborted")));
        response.on("error", reject);
      }
    );
    const timeout = setTimeout(
      () => request.destroy(new Error("Feed request timed out after 12000ms")),
      12000
    );
    request.on("error", reject);
    request.on("close", () => clearTimeout(timeout));
  });
}

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
      const xml = await downloadXml(source.rss_url);
      feed = await parser.parseString(xml);
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
