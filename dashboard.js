/* ===== Nudge · dashboard.js =====
   Reads data the later stages will create:
     timetable   [{id, course, title, venue, lecturer, day(0=Sun..6=Sat), start:"HH:MM", end:"HH:MM", color:"#rrggbb"}]
     reminders   [{id, title, course, due:ISO string, priority, done:boolean}]
     goals       [{id, course, perWeek}]
     readingLog  [{goalId, at:ISO string}]
     streak      {count, last:"YYYY-MM-DD"}
   Until those exist, each section shows a friendly empty state. */
(function () {
  const user = Nudge.app.init("dashboard");
  if (!user) return;

  const S = Nudge.store, esc = Nudge.ui.esc, E = Nudge.copy.empty;
  const now = new Date();
  const today = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  function toMin(t) { const p = String(t).split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  function fmt12(t) {
    const p = String(t).split(":"); let h = Number(p[0]);
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return h + ":" + p[1] + " " + ap;
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function safeColor(c) { return /^#[0-9a-f]{6}$/i.test(c || "") ? c : ""; }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function sameDay(a, b) { return a.toDateString() === b.toDateString(); }
  function empty(key, href) {
    return '<div class="empty"><h3>' + esc(E[key].title) + "</h3><p>" + esc(E[key].body) + "</p>" +
      '<a class="btn btn-ghost btn-small" href="' + href + '">' + esc(E[key].action) + "</a></div>";
  }

  /* Greeting + chips */
  const first = Nudge.auth.firstName(user);
  const profile = user.profile || {};
  document.getElementById("dash-greeting").textContent = Nudge.copy.greeting(first);
  document.getElementById("dash-courses").innerHTML =
    [profile.level, profile.course].filter(Boolean).concat((profile.courses || []).map(function (c) { return c.code; }))
      .map(function (t) { return '<li class="chip">' + esc(t) + "</li>"; }).join("");

  /* Today's classes */
  const classes = S.getForUser("timetable", []).filter(function (c) { return c.repeat === "once" ? c.date === ymd(now) : c.day === today; })
    .sort(function (a, b) { return toMin(a.start) - toMin(b.start); });
  const todayEl = document.getElementById("today-list");
  if (classes.length === 0) {
    todayEl.innerHTML = '<div class="empty"><h3>No classes today</h3><p>' +
      (S.getForUser("timetable", []).length ? "A good day to get ahead on reading." : esc(E.timetable.body)) +
      '</p><a class="btn btn-ghost btn-small" href="timetable.html">' +
      (S.getForUser("timetable", []).length ? "Open my timetable" : esc(E.timetable.action)) + "</a></div>";
  } else {
    const nextIdx = classes.findIndex(function (c) { return toMin(c.start) > nowMin; });
    todayEl.innerHTML = '<ul class="slots">' + classes.map(function (c, i) {
      const past = toMin(c.end) <= nowMin;
      const live = toMin(c.start) <= nowMin && nowMin < toMin(c.end);
      const status = live ? '<span class="tag tag-done">Happening now</span>' : (i === nextIdx ? '<span class="tag">Up next</span>' : "");
      const color = safeColor(c.color);
      return '<li class="slot' + (past ? " is-past" : "") + '"' + (color ? ' style="--slot-color:' + color + '"' : "") + ">" +
        "<time>" + fmt12(c.start) + "<small>to " + fmt12(c.end) + "</small></time>" +
        "<div><h3>" + esc(c.course) + (c.title ? " · " + esc(c.title) : "") + "</h3>" +
        "<p>" + esc([c.venue, c.lecturer].filter(Boolean).join(" · ")) + "</p> " + status + "</div></li>";
    }).join("") + "</ul>";
  }

  /* Coming up: unfinished reminders in the next 7 days, plus anything overdue */
  const reminders = S.getForUser("reminders", []).filter(function (r) { return !r.done && r.due; })
    .sort(function (a, b) { return new Date(a.due) - new Date(b.due); });
  const weekAhead = new Date(now.getTime() + 7 * 864e5);
  const soon = reminders.filter(function (r) { return new Date(r.due) <= weekAhead; }).slice(0, 5);
  const dueToday = reminders.filter(function (r) { return sameDay(new Date(r.due), now); }).length;

  function when(r) {
    const d = new Date(r.due), diff = Math.ceil((d - now) / 864e5);
    if (d < now) return { text: "Overdue", urgent: true };
    if (sameDay(d, now)) return { text: "Today, " + d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }), urgent: true };
    return { text: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " (in " + plural(diff, "day", "days") + ")", urgent: false };
  }
  const soonEl = document.getElementById("deadline-list");
  soonEl.innerHTML = soon.length === 0 ? empty("reminders", "reminders.html") :
    '<ul class="rows">' + soon.map(function (r) {
      const w = when(r);
      return "<li><span>" + esc(r.title) + '<span class="meta">' + esc(r.course || "") + "</span></span>" +
        '<span class="tag' + (w.urgent ? " tag-urgent" : "") + '">' + esc(w.text) + "</span></li>";
    }).join("") + "</ul>";

  /* Reading goals: sessions logged since Monday */
  const goals = S.getForUser("goals", []);
  const log = S.getForUser("readingLog", []);
  const monday = new Date(now); monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const readEl = document.getElementById("reading-list");
  readEl.innerHTML = goals.length === 0 ? empty("reading", "reading.html") : goals.map(function (g) {
    const done = log.filter(function (l) { return l.goalId === g.id && new Date(l.at) >= monday; }).length;
    return '<div class="goal"><div class="top"><span>' + esc(g.course) + "</span><span>" + done + " of " + g.perWeek + " sessions</span></div>" +
      '<progress max="' + g.perWeek + '" value="' + Math.min(done, g.perWeek) + '" aria-label="' + esc(g.course) + ' reading progress"></progress></div>';
  }).join("");

  /* Friendly summary line */
  const summary = document.getElementById("dash-summary");
  if (classes.length === 0 && dueToday === 0) summary.textContent = "Nothing scheduled today. A good day to get ahead on reading.";
  else summary.textContent = "You have " + plural(classes.length, "class", "classes") + " and " + plural(dueToday, "deadline", "deadlines") + " today.";

  /* Streak only counts if the last reading day was today or yesterday */
  const st = S.getForUser("streak", { count: 0, last: null });
  const yesterday = new Date(now.getTime() - 864e5).toDateString();
  const alive = st.last && (new Date(st.last).toDateString() === now.toDateString() || new Date(st.last).toDateString() === yesterday);
  document.getElementById("streak-text").textContent = Nudge.copy.streak(alive ? st.count : 0);

  document.getElementById("dash-tip").textContent = "Study tip: " + Nudge.copy.tip();
})();
