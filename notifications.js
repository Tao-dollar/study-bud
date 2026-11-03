/* ===== Nudge · notifications.js: the Alerts page ===== */
(function () {
  const user = Nudge.app.init("notifications");
  if (!user) return;

  const A = Nudge.alerts, esc = Nudge.ui.esc;
  const $ = function (id) { return document.getElementById(id); };

  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return m + " min ago";
    const h = Math.round(m / 60);
    return h < 24 ? h + (h === 1 ? " hour ago" : " hours ago") : "Yesterday";
  }
  function when(ms) {
    const d = new Date(ms), now = new Date();
    const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
    if (d.toDateString() === now.toDateString()) return "Today, " + time;
    if (d.toDateString() === new Date(now.getTime() + 864e5).toDateString()) return "Tomorrow, " + time;
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + ", " + time;
  }

  /* Phone and laptop alerts: permission panel */
  function renderPermission() {
    const box = $("permission-box"), p = A.permission();
    box.className = "notice";
    if (p === "granted") {
      box.classList.add("is-on");
      box.innerHTML = "<p><strong>Phone and laptop alerts are on.</strong></p><p class=\"muted\">They arrive while Nudge is open or running in the background.</p>" +
        '<div class="actions"><button class="btn btn-ghost btn-small" type="button" id="test-btn">Send a test alert</button></div>';
    } else if (p === "denied") {
      box.classList.add("is-blocked");
      box.innerHTML = "<p><strong>Alerts are blocked in this browser.</strong></p><p class=\"muted\">Open your browser's site settings for this page, allow notifications, then come back. You'll still see everything here.</p>";
    } else if (p === "unsupported") {
      box.innerHTML = "<p><strong>This browser can't send alerts outside the app.</strong></p><p class=\"muted\">You'll still see them here. On iPhone, add Nudge to your home screen first, then turn alerts on.</p>";
    } else {
      box.innerHTML = "<p><strong>Get a nudge even when you're in another tab.</strong></p><p class=\"muted\">Turn on alerts so class warnings, deadlines and reading times reach you.</p>" +
        '<div class="actions"><button class="btn btn-primary btn-small" type="button" id="enable-btn">Turn on alerts</button></div>';
    }
  }

  function menu(a) {
    return '<details class="more"><summary>Snooze or move</summary><div class="menu">' +
      '<button type="button" data-act="snooze10">Snooze 10 minutes</button>' +
      '<button type="button" data-act="snooze60">Snooze 1 hour</button>' +
      '<button type="button" data-act="snoozeTomorrow">Tomorrow morning</button>' +
      (a.type === "reminder" ? '<button type="button" data-act="reschedule">Move due date 1 day later</button>' : "") +
      (a.type === "reading" ? '<button type="button" data-act="reschedule">Skip today</button>' : "") +
      "</div></details>";
  }

  function card(a) {
    const primary = a.type === "reminder" ? ["done", "Mark done"] : a.type === "reading" ? ["done", "I read this"] : ["dismiss", "Got it"];
    return '<li class="alert-card" data-type="' + a.type + '" data-id="' + esc(a.id) + '">' +
      '<div><h3>' + esc(a.title) + '</h3><p class="body">' + esc(a.body) + ' <span class="ago">· ' + ago(a.at) + "</span></p></div>" +
      '<div class="row"><button class="btn btn-primary btn-small" type="button" data-act="' + primary[0] + '">' + primary[1] + "</button>" +
      '<a class="btn btn-ghost btn-small" href="' + esc(a.href) + '">Open</a>' + (a.type === "daily" ? "" : menu(a)) + "</div></li>";
  }

  function render() {
    renderPermission();
    const list = A.active(), sn = A.snoozed(), nx = A.upcoming(6);

    $("summary").textContent = list.length ? (list.length === 1 ? "1 thing needs a look." : list.length + " things need a look.") : "You're all caught up.";
    $("clear-btn").hidden = list.length === 0;

    if (list.length === 0) {
      const e = Nudge.copy.empty.notifications;
      $("active-list").innerHTML = '<div class="empty"><h3>' + esc(e.title) + "</h3><p>" + esc(e.body) + "</p></div>";
    } else $("active-list").innerHTML = '<ul class="alerts">' + list.map(card).join("") + "</ul>";

    $("snoozed-section").hidden = sn.length === 0;
    $("snoozed-list").innerHTML = sn.map(function (a) {
      return "<li><span><span class=\"what\">" + esc(a.title) + '</span><span class="when">Back at ' + esc(when(a.until)) + "</span></span></li>";
    }).join("");

    $("next-list").innerHTML = nx.length === 0 ? '<p class="muted">Nothing scheduled yet. Add a class, reminder or reading goal and alerts will appear here.</p>' :
      '<ul class="plan-list">' + nx.map(function (a) {
        return "<li><span><span class=\"what\">" + esc(a.title) + '</span><span class="when">' + esc(when(a.at)) + "</span></span></li>";
      }).join("") + "</ul>";
  }

  document.addEventListener("click", function (ev) {
    if (ev.target.id === "enable-btn") { A.requestPermission().then(function (p) { if (p === "granted") { Nudge.ui.toast("Alerts are on."); A.test(); } render(); }); return; }
    if (ev.target.id === "test-btn") { A.test(); Nudge.ui.toast("Test alert sent."); return; }
    if (ev.target.id === "clear-btn") { A.clearAll(); Nudge.ui.toast("Cleared"); return; }
    const btn = ev.target.closest("[data-act]");
    if (!btn) return;
    const res = A.act(btn.closest(".alert-card").dataset.id, btn.dataset.act);
    Nudge.ui.toast(res.message, res.ok ? "" : "error");
  });

  A.onChange(render);

  /* Opened from a system notification button while the app was closed */
  const q = new URLSearchParams(location.search);
  if (q.get("alert")) {
    if (q.get("do")) {                                   // a plain tap just opens the page
      const res = A.act(q.get("alert"), q.get("do"));
      Nudge.ui.toast(res.message, res.ok ? "" : "error");
    }
    history.replaceState(null, "", "notifications.html");
  }
  render();
  setInterval(function () { if (!document.querySelector(".more[open]")) render(); }, 30000);
})();
