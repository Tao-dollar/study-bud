/* ===== Nudge · app.js =====
   The shared shell for every logged-in page: guard + header + navigation. */
window.Nudge = window.Nudge || {};

Nudge.app = (function () {
  const links = [
    ["dashboard.html", "Home", "dashboard"],
    ["timetable.html", "Timetable", "timetable"],
    ["reminders.html", "Reminders", "reminders"],
    ["reading.html", "Reading", "reading"],
    ["settings.html", "Settings", "settings"]
  ];

  function init(page) {
    const user = Nudge.auth.requireAuth({ needsOnboarding: true });
    if (!user) return null;

    const header = document.getElementById("app-header");
    header.className = "app-header";
    header.innerHTML =
      '<div class="container">' +
        '<a class="brand" href="dashboard.html" aria-label="Nudge home">' +
          '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#FFD84D"/>' +
          '<path d="M11 21l6 6 12-14" fill="none" stroke="#1E1B4B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          'Nudge</a>' +
        '<nav class="app-nav" aria-label="Main">' +
          links.map(function (l) {
            return '<a href="' + l[0] + '"' + (l[2] === page ? ' aria-current="page"' : "") + ">" + l[1] + "</a>";
          }).join("") +
        "</nav>" +
        '<div class="app-actions">' +
          '<button class="theme-toggle hide-sm" type="button" data-theme-toggle aria-pressed="false">Dark mode</button>' +
          '<a class="btn btn-ghost btn-small alerts-link" href="notifications.html"' + (page === "notifications" ? ' aria-current="page"' : "") + '>Alerts<span class="badge" id="alert-badge" hidden></span></a>' +
          '<button class="btn btn-ghost btn-small" type="button" id="logout-btn">Log out</button>' +
        "</div>" +
      "</div>";
    document.body.classList.add("has-app-nav");

    document.getElementById("logout-btn").addEventListener("click", function () {
      Nudge.auth.logout();
      location.href = "index.html";
    });
    Nudge.ui.initTheme();

    /* Alerts: badge in the header, and start the scheduler that sends notifications */
    if (Nudge.alerts) {
      const badge = document.getElementById("alert-badge");
      const update = function () { const n = Nudge.alerts.count(); badge.textContent = n > 9 ? "9+" : String(n); badge.hidden = n === 0; };
      Nudge.alerts.onChange(update);
      Nudge.alerts.start();
      update();
    }
    return user;
  }

  return { init };
})();
