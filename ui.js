/* ===== Nudge · ui.js =====
   Small helpers every page uses: theme, toasts, safe text. */
window.Nudge = window.Nudge || {};

Nudge.ui = (function () {
  /* Theme: remembers the choice, otherwise follows the device */
  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }
  function isDark() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function initTheme() {
    applyTheme(Nudge.store.get("theme", null));
    const btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    const label = function () { btn.textContent = isDark() ? "Light mode" : "Dark mode"; btn.setAttribute("aria-pressed", String(isDark())); };
    label();
    btn.addEventListener("click", function () {
      const next = isDark() ? "light" : "dark";
      Nudge.store.set("theme", next);
      applyTheme(next);
      label();
    });
  }

  /* Toasts: the same action keeps the same name ("Saved", "Deleted") */
  function toast(message, type) {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " is-error" : "");
    t.textContent = message;
    region.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  /* Always escape user text before putting it in innerHTML */
  function esc(text) {
    const d = document.createElement("div");
    d.textContent = text == null ? "" : String(text);
    return d.innerHTML;
  }

  return { initTheme, applyTheme, toast, esc };
})();
