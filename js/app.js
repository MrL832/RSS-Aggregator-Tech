/* UI controller: loads config.json, fetches the feeds and renders the
   "Daily Briefing" dashboard. Vanilla JS — no framework, no build. */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var HOUR = 3600 * 1000;
  var DAY = 24 * HOUR;

  var FILTERS = [
    { key: "All", label: "All" },
    { key: "News", label: "News" },
    { key: "Podcast", label: "Podcasts" },
  ];
  // Written as literals so Tailwind's scanner picks them up.
  var CHIP_ACTIVE = "bg-zinc-100 text-zinc-900";
  var CHIP_IDLE = "text-zinc-400 hover:text-zinc-100";

  var state = {
    config: null,
    items: [],
    failures: [],
    stale: false,
    filter: "All",
    loading: false,
  };

  /* ---------- helpers ---------- */

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function isLatest(iso) {
    var t = new Date(iso).getTime();
    return !isNaN(t) && Date.now() - t < DAY;
  }

  function formatRelative(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    var diff = Date.now() - t;
    if (diff < 60 * 1000) return "just now";
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + "m ago";
    var hours = Math.floor(diff / HOUR);
    if (hours < 24) return hours + "h ago";
    var days = Math.floor(diff / DAY);
    if (days < 7) return days + "d ago";
    return new Date(t).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatAbsolute(iso) {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }

  /* ---------- rendering ---------- */

  function renderFilters() {
    $("#filters").innerHTML = FILTERS.map(function (f) {
      var active = state.filter === f.key;
      return (
        '<button role="tab" aria-selected="' + active + '" data-filter="' + f.key + '"' +
        ' class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors ' +
        (active ? CHIP_ACTIVE : CHIP_IDLE) + '">' + f.label + "</button>"
      );
    }).join("");
  }

  function latestBadge() {
    return (
      '<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">' +
      '<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"></span>Latest</span>'
    );
  }

  function cardHtml(item) {
    var Icons = window.Icons;
    var isPodcast = item.category === "Podcast";
    var icon = isPodcast ? Icons.mic(15, "text-violet-400") : Icons.newspaper(15, "text-sky-400");

    return (
      '<article class="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.06]">' +
        '<div class="flex items-center gap-2 text-xs">' +
          '<span class="flex min-w-0 items-center gap-1.5 font-medium text-zinc-300">' +
            '<span class="shrink-0">' + icon + "</span>" +
            '<span class="truncate">' + escapeHtml(item.sourceName) + "</span>" +
          "</span>" +
          (isLatest(item.publishedAt) ? latestBadge() : "") +
          '<time class="ml-auto shrink-0 text-zinc-500" datetime="' + item.publishedAt + '" title="' +
            escapeHtml(formatAbsolute(item.publishedAt)) + '">' + formatRelative(item.publishedAt) + "</time>" +
        "</div>" +
        '<h3 class="text-[15px] font-medium leading-snug text-zinc-100">' +
          '<a href="' + escapeHtml(item.link) + '" target="_blank" rel="noopener noreferrer" ' +
            'class="transition-colors hover:text-white">' + escapeHtml(item.title) + "</a>" +
        "</h3>" +
        '<div class="mt-auto flex items-center gap-3 text-xs text-zinc-500">' +
          '<span class="rounded-md bg-white/[0.04] px-2 py-0.5 capitalize text-zinc-400">' + item.category + "</span>" +
          (isPodcast && item.duration
            ? '<span class="inline-flex items-center gap-1">' + Icons.clock(13) + escapeHtml(item.duration) + "</span>"
            : "") +
          '<span class="ml-auto text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">' +
            Icons.arrowUpRight(15) + "</span>" +
        "</div>" +
      "</article>"
    );
  }

  function visibleItems() {
    return state.filter === "All"
      ? state.items
      : state.items.filter(function (i) { return i.category === state.filter; });
  }

  function renderFeed() {
    var items = visibleItems();
    var feed = $("#feed");
    $("#count").textContent = items.length + (items.length === 1 ? " item" : " items");

    if (!items.length) {
      feed.className = "mt-6";
      feed.innerHTML =
        '<p class="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">Nothing here yet.</p>';
      return;
    }
    feed.className = "mt-6 grid gap-4 sm:grid-cols-2";
    feed.innerHTML = items.map(cardHtml).join("");
  }

  function renderStats() {
    var news = 0;
    var podcasts = 0;
    state.items.forEach(function (i) { i.category === "Podcast" ? podcasts++ : news++; });
    $("#stat-total").textContent = state.items.length;
    $("#stat-news").textContent = news;
    $("#stat-podcasts").textContent = podcasts;
  }

  function notice(text) {
    return (
      '<div class="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400/90">' +
      window.Icons.alert(15, "mt-0.5 shrink-0") + "<p>" + text + "</p></div>"
    );
  }

  function renderNotice() {
    var parts = [];
    if (state.stale) {
      parts.push(notice("Showing cached results — some feeds couldn't be reached just now."));
    }
    if (state.failures.length) {
      var names = state.failures.map(function (f) { return escapeHtml(f.name); }).join(", ");
      parts.push(
        notice(
          "Could not load: <span class=\"font-medium\">" + names + "</span>. " +
          'Public CORS proxies may be rate-limited — hit Refresh, or add your own proxy endpoint to ' +
          '<code class="rounded bg-white/10 px-1">config.json</code>.'
        )
      );
    }
    $("#notice").innerHTML = parts.join("");
  }

  function renderLoading() {
    $("#feed").className = "mt-6 grid gap-4 sm:grid-cols-2";
    $("#feed").innerHTML =
      '<p class="sm:col-span-2 text-xs text-zinc-500">Fetching feeds through CORS proxies — this can take a few seconds…</p>' +
      '<div class="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"></div>'.repeat(4);
    $("#count").textContent = "";
    $("#updated").textContent = "";
  }

  function renderError() {
    $("#feed").className = "mt-6";
    $("#feed").innerHTML =
      '<div class="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">' +
        '<p class="text-sm font-medium text-zinc-300">Could not load any feeds.</p>' +
        '<p class="mx-auto mt-2 max-w-md text-xs text-zinc-500">The public CORS proxies may be down or rate-limited. ' +
        'Try Refresh, or add your own proxy endpoint to <code class="rounded bg-white/10 px-1">config.json</code>.</p>' +
      "</div>";
  }

  /* ---------- data flow ---------- */

  function setLoading(on) {
    state.loading = on;
    var btn = $("#refresh");
    btn.disabled = on;
    btn.classList.toggle("opacity-50", on);
    $("#refresh-icon").classList.toggle("animate-spin", on);
  }

  function load() {
    setLoading(true);
    renderLoading();
    return window.RSS.getFeed(state.config)
      .then(function (result) {
        state.items = result.items;
        state.failures = result.failures;
        state.stale = result.stale;
        renderStats();
        renderNotice();
        renderFeed();
        $("#updated").textContent = "Updated " + new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      })
      .catch(function () {
        renderNotice();
        renderError();
      })
      .then(function () {
        setLoading(false);
      });
  }

  /* ---------- init ---------- */

  function init() {
    $("#brand-icon").innerHTML = window.Icons.activity(20);
    $("#refresh-icon").innerHTML = window.Icons.refresh(14);
    $("#brief-date").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    $("#filters").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-filter]");
      if (!btn) return;
      state.filter = btn.dataset.filter;
      renderFilters();
      renderFeed();
    });

    $("#refresh").addEventListener("click", function () {
      if (!state.loading) load();
    });

    fetch("./config.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (config) {
        state.config = config;
        if (config.title) {
          document.title = config.title + " — Daily Briefing";
          $("#app-title").textContent = config.title;
        }
        if (config.subtitle) $("#app-subtitle").textContent = config.subtitle;
        $("#brief-sub").textContent = greeting() + " — your daily briefing on tech news and podcasts.";
        $("#footer-text").textContent =
          "Vanilla JS · Tailwind CSS · RSS over a CORS proxy · " +
          ((config.sources && config.sources.length) || 0) + " sources · Frontend-only for GitHub Pages.";

        renderFilters();
        renderLoading();
        load();
      })
      .catch(function (err) {
        $("#feed").innerHTML =
          '<div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-10 text-center text-sm text-amber-400/90">' +
          "Could not load <code>config.json</code>: " + escapeHtml(err.message) + "</div>";
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
