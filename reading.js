/* ===== Nudge · reading.js: goals, this week's progress, and the planned sessions ===== */
(function () {
  const user = Nudge.app.init("reading");
  if (!user) return;

  const S = Nudge.store, P = Nudge.planner, esc = Nudge.ui.esc, E = Nudge.copy.errors;
  let goals = S.getForUser("goals", []);
  let editingId = null;
  const $ = function (id) { return document.getElementById(id); };

  function persist() { if (!S.setForUser("goals", goals)) Nudge.ui.toast(E.saveFailed, "error"); }
  function fmt12(t) { const p = t.split(":"); let h = Number(p[0]); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + ":" + p[1] + " " + ap; }
  function mins(m) { const h = Math.floor(m / 60), r = m % 60; return (h ? h + " hr" : "") + (h && r ? " " : "") + (r ? r + " min" : ""); }

  function dayLabel(key) {
    const d = new Date(key.split("-")[0], key.split("-")[1] - 1, key.split("-")[2]);
    const today = P.ymd(new Date()), tomorrow = P.ymd(new Date(Date.now() + 864e5));
    const name = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
    return key === today ? "Today · " + name : key === tomorrow ? "Tomorrow · " + name : name;
  }

  function render() {
    /* Goals */
    if (goals.length === 0) {
      const e = Nudge.copy.empty.reading;
      $("goals").innerHTML = '<div class="empty"><h3>' + esc(e.title) + "</h3><p>" + esc(e.body) + '</p><button class="btn btn-primary" type="button" id="empty-add">' + esc(e.action) + "</button></div>";
    } else {
      $("goals").innerHTML = goals.map(function (g) {
        const done = P.doneThisWeek(g.id);
        const met = done >= g.perWeek;
        return '<article class="goal-card" data-id="' + esc(g.id) + '">' +
          '<div class="top"><h3>' + esc(g.course) + '</h3><span class="muted">' + done + " of " + g.perWeek + " sessions · " + mins(g.minutes) + " each</span></div>" +
          '<progress max="' + g.perWeek + '" value="' + Math.min(done, g.perWeek) + '" aria-label="' + esc(g.course) + ' weekly progress"></progress>' +
          '<div class="goal-actions">' +
            (met ? '<span class="tag tag-done">Goal met this week</span>' : "") +
            '<button class="btn btn-primary btn-small" type="button" data-act="log">I just read this</button>' +
            '<button class="btn btn-ghost btn-small" type="button" data-act="edit">Edit goal</button>' +
          "</div></article>";
      }).join("");
    }

    /* Plan */
    const sessions = goals.length ? P.plan(user) : [];
    if (goals.length === 0) {
      $("plan").innerHTML = '<p class="muted">Once you set a goal, your reading sessions will appear here.</p>';
    } else if (sessions.length === 0) {
      const anyLeft = goals.some(function (g) { return P.doneThisWeek(g.id) < g.perWeek; });
      $("plan").innerHTML = anyLeft
        ? '<div class="empty"><h3>We couldn\'t find free time</h3><p>Your timetable fills the study times you picked. Choose more times to read and we\'ll try again.</p><a class="btn btn-ghost btn-small" href="onboarding.html">Update my study times</a></div>'
        : '<div class="empty"><h3>All your goals are met</h3><p>' + esc(Nudge.copy.progress(1)) + "</p></div>";
    } else {
      const byDay = {};
      sessions.forEach(function (s) { (byDay[s.date] = byDay[s.date] || []).push(s); });
      $("plan").innerHTML = Object.keys(byDay).sort().map(function (key) {
        return '<div class="plan-day"><h3>' + esc(dayLabel(key)) + '</h3><ul class="plan-list">' + byDay[key].map(function (s) {
          return "<li><span><span class=\"what\">" + esc(s.course) + '</span><span class="when">' + fmt12(s.start) + " to " + fmt12(s.end) + " · " + mins(s.minutes) + "</span></span>" +
            '<button class="btn btn-ghost btn-small" type="button" data-log="' + esc(s.goalId) + '">I read this</button></li>';
        }).join("") + "</ul></div>";
      }).join("");
    }
  }

  function log(goalId) {
    const res = P.logSession(goalId);
    const goal = goals.find(function (g) { return g.id === goalId; });
    let msg = "Nice. " + goal.course + " is at " + res.done + " of " + res.perWeek + " this week.";
    if (res.done >= res.perWeek) msg = goal.course + " goal met for the week. Well done.";
    else if (res.streak > 1) msg += " " + Nudge.copy.streak(res.streak);
    Nudge.ui.toast(msg);
    render();
  }

  document.addEventListener("click", function (ev) {
    if (ev.target.id === "empty-add") { openDialog(null); return; }
    const logBtn = ev.target.closest("[data-log]");
    if (logBtn) { log(logBtn.dataset.log); return; }
    const btn = ev.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest(".goal-card").dataset.id;
    if (btn.dataset.act === "log") log(id); else openDialog(id);
  });
  $("add-btn").addEventListener("click", function () { openDialog(null); });

  /* Dialog */
  const dlg = $("dlg"), form = $("form");
  $("course-options").innerHTML = ((user.profile && user.profile.courses) || []).map(function (c) {
    return '<option value="' + esc(c.code) + '">' + esc(c.title || "") + "</option>";
  }).join("");

  function openDialog(id) {
    editingId = id;
    form.querySelectorAll(".error").forEach(function (e) { e.textContent = ""; });
    $("f-course").removeAttribute("aria-invalid");
    $("delete-btn").textContent = "Delete"; $("delete-btn").hidden = !id;
    const g = id ? goals.find(function (x) { return x.id === id; }) : null;
    $("dlg-title").textContent = g ? "Edit reading goal" : "Set a reading goal";
    form.elements.course.value = g ? g.course : "";
    form.elements.minutes.value = g ? String(g.minutes) : "60";
    form.elements.perWeek.value = g ? String(g.perWeek) : "3";
    dlg.showModal();
    form.elements.course.focus();
  }
  $("cancel-btn").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (ev) { if (ev.target === dlg) dlg.close(); });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    const course = form.elements.course.value.trim().toUpperCase().replace(/\s+/g, "");
    const input = $("f-course"), err = $("f-course-error");
    input.removeAttribute("aria-invalid"); err.textContent = "";
    if (!course) { input.setAttribute("aria-invalid", "true"); err.textContent = E.required; input.focus(); return; }
    if (goals.some(function (g) { return g.course === course && g.id !== editingId; })) {
      input.setAttribute("aria-invalid", "true"); err.textContent = E.goalDuplicate; input.focus(); return;
    }
    const data = { course: course, minutes: Number(form.elements.minutes.value), perWeek: Number(form.elements.perWeek.value) };
    if (editingId) Object.assign(goals.find(function (g) { return g.id === editingId; }), data);
    else goals.push(Object.assign({ id: S.uid() }, data));
    persist(); dlg.close(); render();
    Nudge.ui.toast(editingId ? "Saved" : "Goal set. We've found time for it below.");
  });

  let armed = false;
  $("delete-btn").addEventListener("click", function () {
    const btn = $("delete-btn");
    if (!armed) { armed = true; btn.textContent = "Tap again to delete"; setTimeout(function () { armed = false; btn.textContent = "Delete"; }, 4000); return; }
    armed = false;
    goals = goals.filter(function (g) { return g.id !== editingId; });
    persist(); dlg.close(); render(); Nudge.ui.toast("Deleted");
  });

  render();
})();
