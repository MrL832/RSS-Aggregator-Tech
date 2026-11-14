/* Inline Lucide (https://lucide.dev, ISC licensed) icons so the page has zero
   runtime icon dependencies — important for a static GitHub Pages build. */
window.Icons = (function () {
  "use strict";

  function svg(paths, size, cls) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      (size || 16) +
      '" height="' +
      (size || 16) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="' +
      (cls || "") +
      '">' +
      paths +
      "</svg>"
    );
  }

  return {
    activity: function (size, cls) {
      return svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', size, cls);
    },
    newspaper: function (size, cls) {
      return svg(
        '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>',
        size,
        cls
      );
    },
    mic: function (size, cls) {
      return svg(
        '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
        size,
        cls
      );
    },
    clock: function (size, cls) {
      return svg(
        '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        size,
        cls
      );
    },
    arrowUpRight: function (size, cls) {
      return svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>', size, cls);
    },
    alert: function (size, cls) {
      return svg(
        '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        size,
        cls
      );
    },
    refresh: function (size, cls) {
      return svg(
        '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
        size,
        cls
      );
    },
  };
})();
