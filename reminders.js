/* ===== Nudge · reminders.js =====
   Reminder shape (shared with the dashboard):
   {id, title, course, kind, due:ISO string, priority:"high"|"medium"|"low",
    repeat:"none"|"daily"|"weekly", done:boolean, completedAt?:ISO string} */
(function () {
  const user = Nudge.app.init("reminders");
  if (!user) return;

  const S = Nudge.store, esc = Nudge.ui.esc, E = Nudge.copy.errors;
  const KINDS = { assignment: "Assignment", test: "Test", exam: "Exam", deadline: "Deadline", other: "Other" };
  const PRIORITY = { high: "High priority", medium: "Medium", low: "Low" };
  const HOUR = 36e5, DAY = 864e5;

  let items = S.getForUser("reminders", []);
  let filter = "upcoming";
  let editingId = null;
  const $ = function (id) { return document.getElementById(id); };

  /* ---------- helpers ---------- */
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function timeStr(d) { return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase(); }
  function shortDate(d) { return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); }
  function persist() { if (!S.setForUser("reminders", items)) Nudge.ui.toast(E.saveFailed, "error"); }
  function kindOf(r) { return r.done ? "done" : (new Date(r.due) < new Date() ? "overdue" : "upcoming"); }

  function dueText(r) {
    const d = new Date(r.due), now = new Date();
    if (d < now && !r.done) {
      const mins = Math.round((now - d) / 60000);
      if (mins < 60) return "Overdue by " + mins + " min";
      const h = Math.round(mins / 60);
      if (h < 48) return "Overdue by " + h + (h === 1 ? " hour" : " hours");
      return "Overdue by " + Math.round(h / 24) + " days";
    }
    const tomorrow = new Date(now.getTime() + DAY);
    if (ymd(d) === ymd(now)) return "Today, " + timeStr(d);
    if (ymd(d) === ymd(tomorrow)) return "Tomorrow, " + timeStr(d);
    return shortDate(d) + ", " + timeStr(d);
  }
  function isUrgent(r) { const d = new Date(r.due); return !r.done && (d < new Date() || ymd(d) === ymd(new Date())); }

  function advance(r) {                                    // roll a repeating reminder forward
    const step = r.repeat === "weekly" ? 7 * DAY : DAY;
    let d = new Date(r.due).getTime();
    do { d += step; } while (d <= Date.now());
    r.due = new Date(d).toISOString();
    r.done = false;
    r.alertFrom = new Date().toISOString();
  }

  /* ---------- rendering ---------- */
  function render() {
    const groups = { upcoming: [], overdue: [], done: [] };
    items.forEach(function (r) { groups[kindOf(r)].push(r); });
    groups.upcoming.sort(function (a, b) { return new Date(a.due) - new Date(b.due); });
    groups.overdue.sort(function (a, b) { return new Date(a.due) - new Date(b.due); });
    groups.done.sort(function (a, b) { return new Date(b.completedAt || 0) - new Date(a.completedAt || 0); });

    const labels = { upcoming: "Upcoming", overdue: "Overdue", done: "Done" };
    $("filters").innerHTML = Object.keys(labels).map(function (k) {
      return '<button type="button" data-filter="' + k + '" aria-pressed="' + (k === filter) + '">' + labels[k] +
        '<span class="count">' + groups[k].length + "</span></button>";
    }).join("");

    const n = groups.upcoming.length, o = groups.overdue.length;
    $("summary").textContent = o ? o + (o === 1 ? " thing is" : " things are") + " overdue. Start with the oldest."
      : n ? n + (n === 1 ? " thing" : " things") + " coming up. You've got this." : "You're all caught up.";

    const list = groups[filter];
    if (items.length === 0) {
      const e = Nudge.copy.empty.reminders;
      $("list").innerHTML = '<div class="empty"><h3>' + esc(e.title) + "</h3><p>" + esc(e.body) + '</p><button class="btn btn-primary" type="button" id="empty-add">' + esc(e.action) + "</button></div>";
      return;
    }
    if (list.length === 0) {
      const e = Nudge.copy.filterEmpty[filter];
      $("list").innerHTML = '<div class="empty"><h3>' + esc(e.title) + "</h3><p>" + esc(e.body) + "</p></div>";
      return;
    }
    $("list").innerHTML = '<ul class="tasks">' + list.map(row).join("") + "</ul>";
  }

  function row(r) {
    const d = new Date(r.due), id = esc(r.id);
    return '<li class="task' + (kindOf(r) === "overdue" ? " is-overdue" : "") + (r.done ? " is-done" : "") + '" data-id="' + id + '">' +
      '<input type="checkbox" id="t-' + id + '"' + (r.done ? " checked" : "") + ">" +
      '<label for="t-' + id + '"><span class="what">' + esc(r.title) + "</span>" +
        '<span class="meta">' +
          (r.course ? '<span class="tag">' + esc(r.course) + "</span>" : "") +
          '<span>' + esc(KINDS[r.kind] || "Reminder") + "</span>" +
          '<span class="tag ' + (r.priority === "high" ? "tag-urgent" : r.priority === "low" ? "tag-quiet" : "") + '">' + esc(PRIORITY[r.priority] || "Medium") + "</span>" +
          '<span class="when' + (isUrgent(r) ? " is-urgent" : "") + '">' + esc(dueText(r)) + (r.repeat && r.repeat !== "none" ? " · repeats " + (r.repeat === "daily" ? "daily" : "weekly") : "") + "</span>" +
        "</span></label>" +
      '<details class="more"><summary aria-label="Options for ' + esc(r.title) + '">Options</summary><div class="menu">' +
        '<button type="button" data-act="edit">Edit</button>' +
        (r.done ? "" : '<button type="button" data-act="later-hour">Move 1 hour later</button><button type="button" data-act="later-day">Move 1 day later</button>') +
        '<button type="button" class="danger" data-act="delete">Delete</button></div></details></li>';
  }

  /* ---------- actions ---------- */
  $("list").addEventListener("change", function (ev) {
    if (ev.target.type !== "checkbox") return;
    const li = ev.target.closest(".task"), r = items.find(function (x) { return x.id === li.dataset.id; });
    if (!r) return;

    if (!ev.target.checked) {                              // un-ticking from the Done tab
      r.done = false; delete r.completedAt; persist(); render(); return;
    }
    if (r.repeat && r.repeat !== "none") {
      advance(r); persist(); render();
      Nudge.ui.toast("Done. Next one is " + shortDate(new Date(r.due)) + ".");
      return;
    }
    r.done = true; r.completedAt = new Date().toISOString(); persist();
    const left = items.filter(function (x) { return kindOf(x) === "upcoming" || kindOf(x) === "overdue"; }).length;
    Nudge.ui.toast(left === 0 ? "That's everything. Go enjoy your day." : "Ticked off. " + left + " to go.");
    setTimeout(render, 450);                               // let the highlighter finish drawing
  });

  let confirmDelete = null;
  $("list").addEventListener("click", function (ev) {
    if (ev.target.id === "empty-add") { openDialog(null); return; }
    const btn = ev.target.closest("[data-act]");
    if (!btn) return;
    const li = btn.closest(".task"), r = items.find(function (x) { return x.id === li.dataset.id; });
    if (!r) return;
    const act = btn.dataset.act;

    if (act === "edit") { openDialog(r.id); return; }
    if (act === "delete") {
      if (confirmDelete !== r.id) { confirmDelete = r.id; btn.textContent = "Tap again to delete"; return; }
      confirmDelete = null;
      items = items.filter(function (x) { return x.id !== r.id; });
      persist(); render(); Nudge.ui.toast("Deleted"); return;
    }
    const base = Math.max(new Date(r.due).getTime(), Date.now());     // overdue items move from now
    r.due = new Date(base + (act === "later-hour" ? HOUR : DAY)).toISOString();
    r.alertFrom = new Date().toISOString();
    persist(); render();
    Nudge.ui.toast("Moved to " + shortDate(new Date(r.due)) + ", " + timeStr(new Date(r.due)));
  });

  $("filters").addEventListener("click", function (ev) {
    const b = ev.target.closest("[data-filter]"); if (!b) return;
    filter = b.dataset.filter; render();
  });

  /* ---------- dialog ---------- */
  const dlg = $("dlg"), form = $("form");
  $("course-options").innerHTML = ((user.profile && user.profile.courses) || []).map(function (c) {
    return '<option value="' + esc(c.code) + '">' + esc(c.title || "") + "</option>";
  }).join("");

  function clearErrors() {
    form.querySelectorAll(".error").forEach(function (e) { e.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach(function (i) { i.removeAttribute("aria-invalid"); });
  }
  function fieldError(id, msg) { const i = $("f-" + id); i.setAttribute("aria-invalid", "true"); $("f-" + id + "-error").textContent = msg; i.focus(); }
  function checkPast() {
    const v = form.elements.date.value && form.elements.time.value ? new Date(form.elements.date.value + "T" + form.elements.time.value) : null;
    $("past-note").hidden = !(v && v < new Date());
  }

  function openDialog(id) {
    editingId = id; clearErrors();
    const r = id ? items.find(function (x) { return x.id === id; }) : null;
    const tomorrow = new Date(Date.now() + DAY);
    const d = r ? new Date(r.due) : tomorrow;
    $("dlg-title").textContent = r ? "Edit reminder" : "Add a reminder";
    form.elements.title.value = r ? r.title : "";
    form.elements.kind.value = r ? r.kind : "assignment";
    form.elements.course.value = r ? (r.course || "") : "";
    form.elements.date.value = ymd(d);
    form.elements.time.value = r ? String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : "17:00";
    form.elements.priority.value = r ? r.priority : "medium";
    form.elements.repeat.value = r ? (r.repeat || "none") : "none";
    checkPast();
    dlg.showModal();
    form.elements.title.focus();
  }

  ["date", "time"].forEach(function (n) { form.elements[n].addEventListener("input", checkPast); });
  $("cancel-btn").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (ev) { if (ev.target === dlg) dlg.close(); });
  $("add-btn").addEventListener("click", function () { openDialog(null); });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault(); clearErrors();
    const f = form.elements;
    const title = f.title.value.trim();
    if (!title) return fieldError("title", E.required);
    if (!f.date.value) return fieldError("date", E.required);
    if (!f.time.value) return fieldError("time", E.required);

    const data = {
      title: title, kind: f.kind.value, course: f.course.value.trim().toUpperCase(),
      due: new Date(f.date.value + "T" + f.time.value).toISOString(),
      priority: f.priority.value, repeat: f.repeat.value
    };
    if (editingId) {
      const r = items.find(function (x) { return x.id === editingId; });
      Object.assign(r, data);
      r.alertFrom = new Date().toISOString();
      if (new Date(r.due) > new Date()) { r.done = false; delete r.completedAt; }
    } else {
      items.push(Object.assign({ id: S.uid(), done: false, createdAt: new Date().toISOString() }, data));
    }
    persist(); dlg.close(); filter = "upcoming"; render();
    Nudge.ui.toast(editingId ? "Saved" : "Added. We'll remind you before it's due.");
  });

  render();
  setInterval(function () { if (!dlg.open && !document.querySelector(".more[open]")) render(); }, 60000);        // overdue labels stay fresh
})();
