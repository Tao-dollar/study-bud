/* ===== Nudge · planner.js =====
   Turns reading goals into real sessions placed in your free time.
   Pure logic, no page code, so the reading page, dashboard and (in stage 5)
   the notification scheduler can all use it.
   Data it reads:  goals [{id, course, minutes, perWeek}], readingLog [{goalId, at}],
                   timetable entries, and the study windows chosen in onboarding. */
window.Nudge = window.Nudge || {};

Nudge.planner = (function () {
  const S = Nudge.store;
  const WINDOWS = { morning: [360, 600], afternoon: [780, 1020], evening: [1080, 1260], late: [1320, 1440] }; // minutes
  const MAX_PER_DAY = 2;

  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function toMin(t) { const p = String(t).split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  function toTime(m) { return String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function dayOfDate(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); }
  function applies(e, date) { return e.repeat === "once" ? e.date === ymd(date) : e.day === date.getDay(); }

  function weekStart() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  function doneThisWeek(goalId, log) {
    const mon = weekStart();
    return (log || S.getForUser("readingLog", [])).filter(function (l) { return l.goalId === goalId && new Date(l.at) >= mon; }).length;
  }

  /* Free stretches inside the user's chosen study windows, at least `len` minutes long */
  function gapsFor(windows, busy, from, len) {
    const out = [];
    const sorted = busy.slice().sort(function (a, b) { return a[0] - b[0]; });
    windows.forEach(function (w) {
      let cursor = Math.max(w[0], from);
      sorted.forEach(function (b) {
        if (b[1] <= cursor || b[0] >= w[1]) return;
        if (b[0] > cursor) out.push([cursor, Math.min(b[0], w[1])]);
        cursor = Math.max(cursor, b[1]);
      });
      if (cursor < w[1]) out.push([cursor, w[1]]);
    });
    return out.filter(function (g) { return g[1] - g[0] >= len; });
  }

  /* Plan the next 7 days. Spreads each goal's remaining sessions evenly,
     never twice in a day for the same goal, and at most MAX_PER_DAY a day overall. */
  function plan(user) {
    const goals = S.getForUser("goals", []);
    const log = S.getForUser("readingLog", []);
    const entries = S.getForUser("timetable", []);
    const chosen = (user && user.profile && user.profile.times && user.profile.times.length) ? user.profile.times : ["evening"];
    const windows = chosen.map(function (t) { return WINDOWS[t]; }).filter(Boolean).sort(function (a, b) { return a[0] - b[0]; });

    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const days = [];
    for (let i = 0; i < 7; i++) { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); days.push(d); }

    const sessions = [], perDay = {};
    goals.map(function (g) { return { g: g, remaining: Math.max(0, g.perWeek - doneThisWeek(g.id, log)) }; })
      .filter(function (x) { return x.remaining > 0; })
      .sort(function (a, b) { return b.remaining - a.remaining; })
      .forEach(function (x) {
        const r = Math.min(x.remaining, 7), usedDays = {};
        for (let i = 0; i < r; i++) {
          const startIdx = Math.floor(i * 7 / r);
          for (let k = 0; k < 7; k++) {
            const d = days[(startIdx + k) % 7], key = ymd(d);
            if (usedDays[key] || (perDay[key] || 0) >= MAX_PER_DAY) continue;
            const busy = entries.filter(function (e) { return applies(e, d); }).map(function (e) { return [toMin(e.start), toMin(e.end)]; })
              .concat(sessions.filter(function (s) { return s.date === key; }).map(function (s) { return [toMin(s.start), toMin(s.end) + 10]; }));   // 10 min break after each session
            const from = key === ymd(now) ? Math.ceil((nowMin + 15) / 15) * 15 : 0;
            const gap = gapsFor(windows, busy, from, x.g.minutes)[0];
            if (!gap) continue;
            const start = Math.ceil(gap[0] / 15) * 15;
            if (start + x.g.minutes > gap[1]) continue;
            sessions.push({ goalId: x.g.id, course: x.g.course, minutes: x.g.minutes, date: key, start: toTime(start), end: toTime(start + x.g.minutes) });
            usedDays[key] = true; perDay[key] = (perDay[key] || 0) + 1;
            break;
          }
        }
      });
    return sessions.sort(function (a, b) { return a.date.localeCompare(b.date) || a.start.localeCompare(b.start); });
  }

  /* Record a finished session and keep the streak honest */
  function logSession(goalId) {
    const log = S.getForUser("readingLog", []);
    log.push({ goalId: goalId, at: new Date().toISOString() });
    S.setForUser("readingLog", log);

    const now = new Date(), today = ymd(now);
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const st = S.getForUser("streak", { count: 0, last: null });
    if (st.last !== today) { st.count = st.last === ymd(y) ? st.count + 1 : 1; st.last = today; S.setForUser("streak", st); }

    const goal = S.getForUser("goals", []).find(function (g) { return g.id === goalId; });
    return { done: doneThisWeek(goalId, log), perWeek: goal ? goal.perWeek : 0, streak: st.count };
  }

  return { plan, logSession, doneThisWeek, ymd, dayOfDate, WINDOWS };
})();
