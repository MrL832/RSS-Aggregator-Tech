/* Feed fetching + parsing. Runs entirely in the browser:
   RSS/Atom is fetched through a CORS proxy (see config.json) and parsed with
   the native DOMParser — no build step, no server. */
window.RSS = (function () {
  "use strict";

  var CACHE_PREFIX = "techpulse:v1:";

  /* ---------- proxy helpers ---------- */

  function proxyUrl(proxy, feedUrl) {
    return String(proxy.endpoint)
      .replace("{url}", encodeURIComponent(feedUrl))
      .replace("{rawurl}", feedUrl);
  }

  /* ---------- XML helpers ---------- */

  function child(el, names) {
    for (var i = 0; i < el.children.length; i++) {
      if (names.indexOf(el.children[i].localName) !== -1) return el.children[i];
    }
    return null;
  }

  function childText(el, names) {
    var node = child(el, names);
    return node ? (node.textContent || "").trim() : "";
  }

  function linkOf(el) {
    var node = child(el, ["link"]);
    if (!node) return "";
    return (node.getAttribute("href") || node.textContent || "").trim();
  }

  /** Seconds ("3725") or clock strings ("1:02:15") -> readable "1:02:05". */
  function normalizeDuration(raw) {
    if (!raw) return "";
    var value = String(raw).trim();
    if (!value) return "";
    if (value.indexOf(":") !== -1) return value; // already clock formatted
    var seconds = Number(value);
    if (!isFinite(seconds) || seconds <= 0) return "";
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  function toItem(node, source, index) {
    var title = childText(node, ["title"]) || "(untitled)";
    var link = linkOf(node);
    var rawDate = childText(node, ["pubDate", "published", "updated", "dc:date"]);
    var published = rawDate ? new Date(rawDate) : null;
    var valid = published && !isNaN(published.getTime());

    // Requirement: only surface podcast episodes that are actually published
    // (a real publish date, not in the future).
    if (source.category === "Podcast" && (!valid || published.getTime() > Date.now())) {
      return null;
    }

    return {
      id: childText(node, ["guid", "id"]) || link || source.name + "-" + index,
      title: title,
      link: link,
      sourceName: source.name,
      category: source.category,
      publishedAt: valid ? published.toISOString() : new Date().toISOString(),
      duration:
        source.category === "Podcast"
          ? normalizeDuration(childText(node, ["duration"]))
          : "",
    };
  }

  function parseFeed(xml, source, limit) {
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    if (!doc || doc.querySelector("parsererror")) return [];

    var nodes = doc.querySelectorAll("item"); // RSS
    if (!nodes.length) nodes = doc.querySelectorAll("entry"); // Atom

    var items = [];
    nodes.forEach(function (node, index) {
      var item = toItem(node, source, index);
      if (item) items.push(item);
    });
    return items.slice(0, limit);
  }

  /* ---------- cache (survives a flaky proxy) ---------- */

  function readCache(url) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + url);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed.items) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(url, items) {
    try {
      localStorage.setItem(
        CACHE_PREFIX + url,
        JSON.stringify({ t: Date.now(), items: items })
      );
    } catch (e) {
      /* storage full or disabled — not fatal */
    }
  }

  /* ---------- fetching ---------- */

  function fetchSource(source, proxies, limit, timeoutMs) {
    var lastError = null;

    // Try each proxy in order until one returns parseable items. Each attempt is
    // bounded by a timeout so a hanging proxy can't freeze the whole page.
    function attempt(i) {
      if (i >= proxies.length) {
        return Promise.reject(lastError || new Error(source.name + ": all proxies failed"));
      }
      var proxy = proxies[i];
      return fetch(proxyUrl(proxy, source.rss_url), {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      })
        .then(function (res) {
          if (!res.ok) throw new Error(proxy.name + ": HTTP " + res.status);
          return proxy.json ? res.json().then(function (d) { return d[proxy.json]; }) : res.text();
        })
        .then(function (xml) {
          if (!xml || xml.length < 40) throw new Error(proxy.name + ": empty response");
          var items = parseFeed(xml, source, limit);
          if (!items.length) throw new Error(proxy.name + ": no items found");
          writeCache(source.rss_url, items);
          return { items: items, stale: false };
        })
        .catch(function (err) {
          lastError = err;
          return attempt(i + 1);
        });
    }

    return attempt(0).catch(function (err) {
      var cached = readCache(source.rss_url);
      if (cached) return { items: cached.items, stale: true };
      throw err;
    });
  }

  /** Fetch every source concurrently and return one newest-first timeline. */
  function getFeed(config) {
    var sources = (config && config.sources) || [];
    var proxies = (config && config.proxies) || [];
    var limit = (config && config.itemLimit) || 12;
    var timeoutMs = (config && config.proxyTimeoutMs) || 12000;

    if (!proxies.length) {
      return Promise.reject(new Error("No CORS proxies configured in config.json"));
    }

    return Promise.allSettled(
      sources.map(function (source) {
        return fetchSource(source, proxies, limit, timeoutMs);
      })
    ).then(function (settled) {
      var items = [];
      var failures = [];
      var stale = false;

      settled.forEach(function (result, index) {
        if (result.status === "fulfilled") {
          Array.prototype.push.apply(items, result.value.items);
          if (result.value.stale) stale = true;
        } else {
          failures.push({
            name: sources[index].name,
            message: String((result.reason && result.reason.message) || result.reason),
          });
        }
      });

      items.sort(function (a, b) {
        return new Date(b.publishedAt) - new Date(a.publishedAt);
      });

      return { items: items, failures: failures, stale: stale };
    });
  }

  return {
    getFeed: getFeed,
    parseFeed: parseFeed,
    normalizeDuration: normalizeDuration,
  };
})();
