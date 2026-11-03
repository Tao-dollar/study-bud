/* ===== Nudge · alerts.js =====
   Works out every alert the app should send, shows phone/laptop notifications
   when they're due, and handles Done / Snooze / Reschedule.

   HOW DELIVERY WORKS (important): with no server, alerts are scheduled by the
   app itself, so they fire while Nudge is open, installed and running in the
   background, or its tab is open. When the app is fully closed, a phone may not
   wake it. For that you need real push (Firebase Cloud Messaging / Web Push) and
   a small backend. sw.js already has a "push" handler ready for it.

   Alert types and when they fire:
     class     {lead} minutes before each class (lead is set in onboarding / settings)
     reminder  1 day before, 1 hour before, and at the due time
     reading   when a planned reading session starts
     daily     once a day at the time the user chose, previewing tomorrow          */
window.Nudge = window.Nudge || {};

Nudge.alerts = (function () {
  const S = Nudge.store, P = Nudge.planner;
  const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
  const RECENT = 15 * MIN;       // only send a system notification if the alert is this fresh
  const KEEP = 48 * HOUR;        // unhandled alerts stay in the Alerts page this long
  const listeners = [];
  let timer = null;

  /* ---------- small helpers ---------- */
  function fmt12(t) { const p = String(t).split(":"); let h = Number(p[0]); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + ":" + p[1] + " " + ap; }
  function atTime(d, hhmm) { const p = hhmm.split(":"); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), +p[0], +p[1]).getTime(); }
  function dayStart(now, offset) { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function applies(e, d) { return e.repeat === "once" ? e.date === P.ymd(d) : e.day === d.getDay(); }
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function getState() {
    const st = S.getForUser("alertState", null) || {};
    return { fired: st.fired || {}, dismissed: st.dismissed || {}, snoozed: st.snoozed || {} };
  }
  function setState(st) {
    const cut = Date.now() - 7 * DAY;
    ["fired", "dismissed", "snoozed"].forEach(function (k) { Object.keys(st[k]).forEach(function (id) { if (st[k][id] < cut) delete st[k][id]; }); });
    S.setForUser("alertState", st);
  }
  function eff(a, st) { return st.snoozed[a.id] || a.fireAt; }

  /* ---------- build the list of alerts ---------- */
  function generate(now, persistPlan) {
    const u = Nudge.auth.currentUser();
    if (!u) return [];
    const prof = u.profile || {}, flags = prof.alerts || {};
    const on = function (k) { return flags[k] !== false; };
    const lead = prof.lead || 30;
    const entries = S.getForUser("timetable", []);
    const reminders = S.getForUser("reminders", []);
    const out = [];

    if (on("class")) {
      for (let i = -2; i <= 7; i++) {
        const d = dayStart(now, i), key = P.ymd(d);
        entries.forEach(function (e) {
          if (!applies(e, d)) return;
          out.push({
            id: "class:" + e.id + ":" + key, type: "class", fireAt: atTime(d, e.start) - lead * MIN,
            title: e.course + (e.type === "study" ? " study block" : e.type === "lab" ? " lab" : e.type === "tutorial" ? " tutorial" : " class") + " starts in " + lead + " min",
            body: [fmt12(e.start) + " to " + fmt12(e.end), e.venue].filter(Boolean).join(" · "), href: "timetable.html"
          });
        });
      }
    }

    if (on("reminder")) {
      reminders.forEach(function (r) {
        if (r.done || !r.due) return;
        const due = new Date(r.due).getTime();
        const base = r.alertFrom ? new Date(r.alertFrom).getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : 0);
        [["day", DAY, "Due tomorrow"], ["hour", HOUR, "Due in 1 hour"], ["now", 0, "Due now"]].forEach(function (s) {
          const fireAt = due - s[1];
          if (fireAt < base) return;                           // don't announce stages that passed before it was created or moved
          out.push({ id: "rem:" + r.id + ":" + s[0] + ":" + due, type: "reminder", fireAt: fireAt, title: s[2] + ": " + r.title,
            body: [r.course, new Date(r.due).toLocaleString("en-GB", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).replace(/\b(am|pm)\b/, function (m) { return m.toUpperCase(); })].filter(Boolean).join(" · "),
            href: "reminders.html", ref: { reminderId: r.id } });
        });
      });
    }

    if (on("reading")) {
      /* P.plan() only looks ahead, so keep sessions that are about to start in a small cache.
         Otherwise a 6 PM session would vanish from the plan at 5:45 PM, before it could alert. */
      const goals = S.getForUser("goals", []);
      const sid = function (s) { return "read:" + s.goalId + ":" + s.date + ":" + s.start; };
      const fresh = P.plan(u), have = {};
      fresh.forEach(function (s) { have[sid(s)] = true; });
      const cache = S.getForUser("planCache", []);
      const keep = cache.filter(function (s) {
        const goal = goals.find(function (g) { return g.id === s.goalId; });
        const start = atTime(new Date(s.date + "T00:00:00"), s.start);
        return !have[sid(s)] && goal && P.doneThisWeek(goal.id) < goal.perWeek && start > now - 2 * HOUR && start < now + 20 * MIN;
      });
      const all = fresh.concat(keep);
      if (persistPlan) S.setForUser("planCache", all.filter(function (s) { return atTime(new Date(s.date + "T00:00:00"), s.start) > now - 3 * HOUR; }));
      all.forEach(function (s) {
        const m = (Number(s.end.split(":")[0]) * 60 + Number(s.end.split(":")[1])) - (Number(s.start.split(":")[0]) * 60 + Number(s.start.split(":")[1]));
        out.push({ id: sid(s), type: "reading", fireAt: atTime(new Date(s.date + "T00:00:00"), s.start),
          title: "Time to read " + s.course, body: m + " minutes · " + fmt12(s.start) + " to " + fmt12(s.end), href: "reading.html", ref: { goalId: s.goalId } });
      });
    }

    if (on("daily")) {
      for (let i = 0; i <= 1; i++) {                         // today's and tomorrow's summary only
        const d = dayStart(now, i), key = P.ymd(d), tom = dayStart(now, i + 1);
        const nClasses = entries.filter(function (e) { return applies(e, tom); }).length;
        const nDue = reminders.filter(function (r) { return !r.done && r.due && P.ymd(new Date(r.due)) === P.ymd(tom); }).length;
        out.push({ id: "daily:" + key, type: "daily", fireAt: atTime(d, prof.remindAt || "19:00"),
          title: nClasses || nDue ? "Tomorrow at a glance" : "Tomorrow looks clear",
          body: nClasses || nDue ? plural(nClasses, "class", "classes") + " and " + plural(nDue, "deadline", "deadlines") + ". Get your bag ready." : "Nothing scheduled. A good chance to get ahead on reading.",
          href: "dashboard.html" });
      }
    }
    return out;
  }

  /* ---------- views used by the Alerts page, header badge and dashboard ---------- */
  function active(now) {
    now = now || Date.now();
    const st = getState();
    return generate(now).filter(function (a) { const t = eff(a, st); return !st.dismissed[a.id] && t <= now && t >= now - KEEP; })
      .map(function (a) { return Object.assign({ at: eff(a, st) }, a); })
      .sort(function (a, b) { return b.at - a.at; });
  }
  function snoozed(now) {
    now = now || Date.now();
    const st = getState();
    return generate(now).filter(function (a) { return !st.dismissed[a.id] && st.snoozed[a.id] && st.snoozed[a.id] > now; })
      .map(function (a) { return Object.assign({ until: st.snoozed[a.id] }, a); }).sort(function (a, b) { return a.until - b.until; });
  }
  function upcoming(limit, now) {
    now = now || Date.now();
    const st = getState();
    return generate(now).filter(function (a) { const t = eff(a, st); return !st.dismissed[a.id] && t > now && t < now + 7 * DAY; })
      .map(function (a) { return Object.assign({ at: eff(a, st) }, a); }).sort(function (a, b) { return a.at - b.at; }).slice(0, limit || 6);
  }
  function count() { return active().length; }

  /* ---------- Done / Snooze / Reschedule ---------- */
  function advance(r) {
    const step = r.repeat === "weekly" ? 7 * DAY : DAY;
    let d = new Date(r.due).getTime();
    do { d += step; } while (d <= Date.now());
    r.due = new Date(d).toISOString(); r.done = false; r.alertFrom = new Date().toISOString();
  }
  function act(id, action) {
    const now = Date.now(), st = getState();
    const a = generate(now).find(function (x) { return x.id === id; });
    if (!a) return { ok: false, message: "That alert has already been handled." };
    let message = "Done";

    if (action === "snooze" || action === "snooze10") { st.snoozed[id] = now + 10 * MIN; message = "Snoozed for 10 minutes"; }
    else if (action === "snooze60") { st.snoozed[id] = now + HOUR; message = "Snoozed for 1 hour"; }
    else if (action === "snoozeTomorrow") {
      const t = dayStart(now, 1); t.setHours(8, 0, 0, 0); st.snoozed[id] = t.getTime(); message = "We'll remind you tomorrow morning";
    }
    if (st.snoozed[id] && String(action).indexOf("snooze") === 0) { delete st.fired[id]; setState(st); emit(); return { ok: true, message: message }; }

    if (action === "done") {
      if (a.type === "reminder") {
        const list = S.getForUser("reminders", []), r = list.find(function (x) { return x.id === a.ref.reminderId; });
        if (r) {
          if (r.repeat && r.repeat !== "none") { advance(r); message = "Done. Next one is on " + new Date(r.due).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); }
          else { r.done = true; r.completedAt = new Date().toISOString(); message = "Ticked off. Nice work."; }
          S.setForUser("reminders", list);
        }
      } else if (a.type === "reading") {
        const res = P.logSession(a.ref.goalId);
        message = res.done >= res.perWeek ? "Goal met for the week. Well done." : "Logged. " + res.done + " of " + res.perWeek + " this week.";
      } else message = "Got it";
    } else if (action === "reschedule") {
      if (a.type === "reminder") {
        const list = S.getForUser("reminders", []), r = list.find(function (x) { return x.id === a.ref.reminderId; });
        if (r) {
          r.due = new Date(Math.max(new Date(r.due).getTime(), now) + DAY).toISOString(); r.alertFrom = new Date().toISOString();
          S.setForUser("reminders", list);
          message = "Moved to " + new Date(r.due).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        }
      } else message = "Skipped for today. We'll find another slot.";
    } else if (action === "dismiss") message = "Cleared";

    st.dismissed[id] = now; delete st.snoozed[id];
    setState(st); emit();
    return { ok: true, message: message };
  }
  function clearAll() {
    const st = getState(), now = Date.now();
    active(now).forEach(function (a) { st.dismissed[a.id] = now; });
    setState(st); emit();
  }

  /* ---------- system notifications ---------- */
  function permission() { return "Notification" in window ? Notification.permission : "unsupported"; }
  function requestPermission() {
    if (!("Notification" in window)) return Promise.resolve("unsupported");
    return Notification.requestPermission().then(function (p) { emit(); return p; });
  }
  function notify(a) {
    if (permission() !== "granted") {
      if (document.visibilityState === "visible" && Nudge.ui) Nudge.ui.toast(a.title);   // no permission: still tell them in the app
      return;
    }
    const opts = {
      body: a.body, tag: a.id, icon: "assets/icons/icon-192.png", badge: "assets/icons/icon-192.png", data: { id: a.id },
      actions: a.type === "reminder" || a.type === "reading" ? [{ action: "done", title: "Done" }, { action: "snooze", title: "Snooze 10 min" }] : []
    };
    const plain = function () { try { new Notification(a.title, { body: a.body, tag: a.id }); } catch (e) {} };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification(a.title, opts); }).catch(plain);
    } else plain();
  }
  function test() { notify({ id: "test:" + Date.now(), type: "test", title: "Nudge is working", body: "This is what your reminders will look like." }); }

  /* ---------- the ticking loop ---------- */
  function tick() {
    const now = Date.now(), st = getState();
    let changed = false;
    generate(now, true).forEach(function (a) {
      if (st.dismissed[a.id] || st.fired[a.id]) return;
      const t = eff(a, st);
      if (t <= now && now - t <= RECENT) { st.fired[a.id] = now; changed = true; notify(a); }
    });
    if (changed) setState(st);
    emit();
  }

  function start() {
    if (timer) return;
    tick();
    timer = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") tick(); });
    window.addEventListener("storage", emit);                          // another tab changed something
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", function (e) {   // buttons tapped on a system notification
        const d = e.data || {};
        if (d.type === "alert-action" && d.id) { const r = act(d.id, d.action); if (Nudge.ui) Nudge.ui.toast(r.message); }
      });
    }
  }

  return { start, active, snoozed, upcoming, count, act, clearAll, permission, requestPermission, test, onChange: function (fn) { listeners.push(fn); } };
})();
