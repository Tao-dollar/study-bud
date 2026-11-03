/* ===== Nudge · timetable.js =====
   Entry shape (shared with the dashboard):
   {id, type, course, title, venue, lecturer, repeat:"weekly"|"once",
    day:0-6 (0=Sunday), date:"YYYY-MM-DD" (once only), start:"HH:MM", end:"HH:MM", color} */
(function () {
  const user = Nudge.app.init("timetable");
  if (!user) return;

  const S = Nudge.store, esc = Nudge.ui.esc, E = Nudge.copy.errors;
  const PPM = 1;                                   // pixels per minute (60px per hour)
  const COLORS = [["#FFD84D", "Yellow"], ["#12806F", "Green"], ["#C93B63", "Rose"], ["#4F6BED", "Blue"], ["#8A5CF6", "Violet"], ["#F08A24", "Orange"]];
  const ORDER = [1, 2, 3, 4, 5, 6, 0];             // Monday first
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let entries = S.getForUser("timetable", []);
  let cfg = Object.assign({ startHour: 6, endHour: 22, slot: 60 }, S.getForUser("ttSettings", {}));
  let view = window.matchMedia("(max-width: 759px)").matches ? "day" : "week";
  let weekOffset = 0;
  let focusDay = new Date().getDay();
  let dragging = null;

  /* ---------- helpers ---------- */
  const $ = function (id) { return document.getElementById(id); };
  function toMin(t) { const p = String(t).split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  function toTime(m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function fmt12(t) { const p = String(t).split(":"); let h = Number(p[0]); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + ":" + p[1] + " " + ap; }
  function hourLabel(h) { const ap = h >= 12 && h < 24 ? "PM" : "AM"; return (h % 12 || 12) + " " + ap; }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dayOfDate(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); }
  function parseYmd(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function monday() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7);
    return d;
  }
  function dateForDay(day) { const d = monday(); d.setDate(d.getDate() + ORDER.indexOf(day)); return d; }
  function columns() { return view === "week" ? ORDER.map(dateForDay) : [dateForDay(focusDay)]; }
  function applies(e, date) { return e.repeat === "once" ? e.date === ymd(date) : e.day === date.getDay(); }
  function persist() { if (!S.setForUser("timetable", entries)) Nudge.ui.toast(E.saveFailed, "error"); }
  function persistCfg() { S.setForUser("ttSettings", cfg); }

  /* Two entries clash if they can fall on the same date AND their times overlap */
  function sharesDate(a, b) {
    const ao = a.repeat === "once", bo = b.repeat === "once";
    if (ao && bo) return a.date === b.date;
    if (ao) return dayOfDate(a.date) === b.day;
    if (bo) return dayOfDate(b.date) === a.day;
    return a.day === b.day;
  }
  function findClashes(c, ignoreId) {
    return entries.filter(function (o) {
      return o.id !== ignoreId && sharesDate(c, o) && toMin(c.start) < toMin(o.end) && toMin(o.start) < toMin(c.end);
    });
  }
  function clashLabel(o) { return o.course + " (" + fmt12(o.start) + " to " + fmt12(o.end) + ")"; }

  /* Put overlapping entries side by side instead of on top of each other */
  function layout(list) {
    const sorted = list.slice().sort(function (a, b) { return toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end); });
    const out = []; let cluster = [], clusterEnd = -1;
    function flush() {
      const lanes = [];
      cluster.forEach(function (e) {
        let l = lanes.findIndex(function (end) { return end <= toMin(e.start); });
        if (l < 0) { l = lanes.length; lanes.push(0); }
        lanes[l] = toMin(e.end);
        out.push({ e: e, lane: l, cluster: cluster });
      });
      out.forEach(function (o) { if (o.cluster === cluster) o.lanes = lanes.length; });
      cluster = []; clusterEnd = -1;
    }
    sorted.forEach(function (e) {
      if (cluster.length && toMin(e.start) >= clusterEnd) flush();
      cluster.push(e); clusterEnd = Math.max(clusterEnd, toMin(e.end));
    });
    if (cluster.length) flush();
    return out;
  }

  /* ---------- rendering ---------- */
  function render() {
    const cols = columns();
    const startMin = cfg.startHour * 60, endMin = cfg.endHour * 60;
    const total = (endMin - startMin) * PPM;
    const grid = $("tt");
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();

    grid.style.setProperty("--cols", cols.length);
    grid.style.setProperty("--slot-px", cfg.slot * PPM + "px");
    grid.style.setProperty("--total", total + "px");

    let html = '<div class="tt-corner"></div>';
    cols.forEach(function (d) {
      const isToday = ymd(d) === ymd(now);
      html += '<div class="tt-dayhead' + (isToday ? " is-today" : "") + '"><span>' + DAYS[d.getDay()].slice(0, 3) + "</span><b>" + d.getDate() + "</b></div>";
    });
    html += '<div class="tt-times" aria-hidden="true">';
    for (let h = cfg.startHour; h <= cfg.endHour; h++) html += '<span style="top:' + (h - cfg.startHour) * 60 * PPM + 'px">' + hourLabel(h) + "</span>";
    html += "</div>";

    cols.forEach(function (d) {
      const dayEntries = entries.filter(function (e) { return applies(e, d); });
      html += '<div class="tt-col" data-date="' + ymd(d) + '">';
      layout(dayEntries).forEach(function (item) {
        const e = item.e, s = toMin(e.start), en = toMin(e.end);
        if (en <= startMin || s >= endMin) return;                    // outside the visible hours
        const top = Math.max(0, (s - startMin) * PPM), bottom = Math.min(total, (en - startMin) * PPM);
        const clash = findClashes(e, e.id).length > 0;
        const color = /^#[0-9a-f]{6}$/i.test(e.color || "") ? e.color : COLORS[0][0];
        const w = 100 / item.lanes;
        html += '<button type="button" class="block' + (e.type === "study" ? " is-study" : "") + (clash ? " is-clash" : "") + '" draggable="true" data-id="' + esc(e.id) + '"' +
          ' style="--c:' + color + ";top:" + top + "px;height:" + Math.max(24, bottom - top - 2) + "px;left:" + item.lane * w + "%;width:calc(" + w + '% - 4px)"' +
          ' aria-label="' + esc(e.course + ", " + DAYS[d.getDay()] + " " + fmt12(e.start) + " to " + fmt12(e.end) + (clash ? ", clashes with another entry" : "") + ". Edit") + '">' +
          esc(e.course) + "<small>" + fmt12(e.start) + " to " + fmt12(e.end) + (e.venue ? " · " + esc(e.venue) : "") + "</small></button>";
      });
      if (ymd(d) === ymd(now) && nowMin >= startMin && nowMin <= endMin) html += '<div class="now-line" style="top:' + (nowMin - startMin) * PPM + 'px"></div>';
      html += "</div>";
    });
    grid.innerHTML = html;

    /* Labels, tabs, empty state, free time */
    const first = cols[0], last = cols[cols.length - 1];
    const fmtD = function (d, o) { return d.toLocaleDateString("en-GB", o); };
    $("range-label").textContent = view === "week"
      ? fmtD(first, { day: "numeric", month: "short" }) + " to " + fmtD(last, { day: "numeric", month: "short", year: "numeric" })
      : fmtD(first, { weekday: "long", day: "numeric", month: "long" });
    $("prev-btn").textContent = view === "week" ? "Previous week" : "Previous";
    document.querySelectorAll("[data-view]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === view)); });

    const tabs = $("day-tabs");
    tabs.hidden = view !== "day";
    tabs.innerHTML = ORDER.map(function (day) {
      return '<button type="button" data-day="' + day + '" aria-pressed="' + (day === focusDay) + '">' + DAYS[day].slice(0, 3) + "</button>";
    }).join("");

    $("tt-empty").innerHTML = entries.length ? "" :
      '<div class="empty"><h3>' + esc(Nudge.copy.empty.timetable.title) + "</h3><p>" + esc(Nudge.copy.empty.timetable.body) + "</p></div>";
    renderFree();
  }

  function renderFree() {
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const date = view === "day" ? dateForDay(focusDay) : (weekOffset === 0 ? now : monday());
    const isToday = ymd(date) === ymd(now);
    let from = cfg.startHour * 60; const to = cfg.endHour * 60;
    if (isToday) from = Math.max(from, Math.ceil(nowMin / 15) * 15);

    const busy = entries.filter(function (e) { return applies(e, date); })
      .map(function (e) { return [toMin(e.start), toMin(e.end)]; }).sort(function (a, b) { return a[0] - b[0]; });
    const gaps = []; let cursor = from;
    busy.forEach(function (b) { if (b[0] - cursor >= 45) gaps.push([cursor, b[0]]); cursor = Math.max(cursor, b[1]); });
    if (to - cursor >= 45) gaps.push([cursor, to]);

    $("free-h").textContent = "Free time " + (isToday ? "today" : "on " + date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }));
    const dur = function (m) { const h = Math.floor(m / 60), r = m % 60; return (h ? h + " hr " : "") + (r ? r + " min" : "").trim(); };
    $("free-list").innerHTML = gaps.length === 0
      ? '<p class="muted">No long gaps left. Short breaks still count.</p>'
      : '<ul class="free">' + gaps.slice(0, 5).map(function (g) {
          return "<li><span>" + fmt12(toTime(g[0])) + " to " + fmt12(toTime(g[1])) + '</span><span class="tag">' + dur(g[1] - g[0]).trim() + " free</span></li>";
        }).join("") + "</ul>";
  }

  /* ---------- dialog ---------- */
  const dlg = $("entry-dialog"), form = $("entry-form");
  let editingId = null, armed = false;

  $("swatches").insertAdjacentHTML("beforeend", COLORS.map(function (c) {
    return '<label><input type="radio" name="color" value="' + c[0] + '"><span class="dot" style="--c:' + c[0] + '"></span><span class="visually-hidden">' + c[1] + "</span></label>";
  }).join(""));

  function setColor(c) { const r = form.querySelector('input[name="color"][value="' + c + '"]'); if (r) r.checked = true; }
  function nextColor() {
    const used = {}; entries.forEach(function (e) { used[e.course] = true; });
    return COLORS[Object.keys(used).length % COLORS.length][0];
  }
  function toggleRepeat() {
    const once = form.elements.repeat.value === "once";
    $("date-field").hidden = !once; $("day-field").hidden = once;
  }
  function resetArmed() { armed = false; $("clash-warn").hidden = true; $("save-btn").textContent = "Save"; }
  function clearErrors() {
    form.querySelectorAll(".error").forEach(function (e) { e.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach(function (i) { i.removeAttribute("aria-invalid"); });
  }
  function fieldError(id, msg) { const i = $("f-" + id); i.setAttribute("aria-invalid", "true"); $("f-" + id + "-error").textContent = msg; i.focus(); }

  $("course-options").innerHTML = ((user.profile && user.profile.courses) || []).map(function (c) {
    return '<option value="' + esc(c.code) + '">' + esc(c.title || "") + "</option>";
  }).join("");

  function openDialog(id, prefill) {
    editingId = id; resetArmed(); clearErrors(); $("delete-btn").textContent = "Delete";
    const e = id ? entries.find(function (x) { return x.id === id; }) : Object.assign({
      type: "class", course: "", title: "", venue: "", lecturer: "", repeat: "weekly",
      day: view === "day" ? focusDay : new Date().getDay(), date: ymd(new Date()), start: "09:00", end: "10:00", color: nextColor()
    }, prefill || {});
    if (!e) return;
    $("dlg-title").textContent = id ? "Edit class" : "Add a class";
    ["type", "course", "title", "venue", "lecturer", "repeat", "start", "end"].forEach(function (k) { form.elements[k].value = e[k] || ""; });
    form.elements.day.value = String(e.day);
    form.elements.date.value = e.date || ymd(new Date());
    setColor(e.color || COLORS[0][0]);
    toggleRepeat();
    $("delete-btn").hidden = !id;
    dlg.showModal();
    form.elements.course.focus();
  }

  form.elements.repeat.addEventListener("change", function () { toggleRepeat(); resetArmed(); });
  ["day", "date", "start", "end"].forEach(function (n) { form.elements[n].addEventListener("input", resetArmed); });
  form.elements.course.addEventListener("change", function () {
    if (editingId) return;
    const same = entries.find(function (x) { return x.course.toUpperCase() === form.elements.course.value.trim().toUpperCase(); });
    if (same) setColor(same.color);
  });
  $("cancel-btn").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (ev) { if (ev.target === dlg) dlg.close(); });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault(); clearErrors();
    const f = form.elements;
    const v = {
      id: editingId || S.uid(), type: f.type.value, course: f.course.value.trim().toUpperCase(),
      title: f.title.value.trim(), venue: f.venue.value.trim(), lecturer: f.lecturer.value.trim(),
      repeat: f.repeat.value, day: Number(f.day.value), start: f.start.value, end: f.end.value,
      color: (form.querySelector('input[name="color"]:checked') || {}).value || COLORS[0][0]
    };
    if (!v.course) return fieldError("course", E.required);
    if (!v.start || !v.end) return fieldError(v.start ? "end" : "start", E.required);
    if (toMin(v.end) <= toMin(v.start)) return fieldError("end", E.endBeforeStart);
    if (v.repeat === "once") {
      if (!f.date.value) return fieldError("date", E.dateNeeded);
      v.date = f.date.value; v.day = dayOfDate(v.date);
    }
    const clashes = findClashes(v, editingId);
    if (clashes.length && !armed) {
      armed = true;
      const w = $("clash-warn");
      w.textContent = "This overlaps with " + clashes.map(clashLabel).join(" and ") + ". Change the time, or save anyway if that's intended.";
      w.hidden = false; $("save-btn").textContent = "Save anyway";
      return;
    }
    if (toMin(v.start) < cfg.startHour * 60) cfg.startHour = Math.floor(toMin(v.start) / 60);
    if (toMin(v.end) > cfg.endHour * 60) cfg.endHour = Math.min(24, Math.ceil(toMin(v.end) / 60));
    persistCfg(); syncCfgControls();

    const i = entries.findIndex(function (x) { return x.id === v.id; });
    if (i >= 0) entries[i] = v; else entries.push(v);
    persist(); dlg.close(); render();
    Nudge.ui.toast(i >= 0 ? "Saved" : "Added " + v.course + " to your week");
  });

  let deleteTimer = null;
  $("delete-btn").addEventListener("click", function () {
    const btn = $("delete-btn");
    if (btn.textContent === "Delete") {                   // first tap asks, second tap confirms
      btn.textContent = "Tap again to delete";
      deleteTimer = setTimeout(function () { btn.textContent = "Delete"; }, 4000);
      return;
    }
    clearTimeout(deleteTimer);
    entries = entries.filter(function (x) { return x.id !== editingId; });
    persist(); dlg.close(); render(); Nudge.ui.toast("Deleted");
  });

  /* ---------- grid interactions ---------- */
  const grid = $("tt");

  grid.addEventListener("click", function (ev) {
    const block = ev.target.closest(".block");
    if (block) { openDialog(block.dataset.id); return; }
    const col = ev.target.closest(".tt-col");
    if (!col) return;
    const y = ev.clientY - col.getBoundingClientRect().top;
    const start = cfg.startHour * 60 + Math.floor(y / PPM / cfg.slot) * cfg.slot;
    const date = parseYmd(col.dataset.date);
    openDialog(null, { day: date.getDay(), date: col.dataset.date, start: toTime(Math.min(start, 23 * 60)), end: toTime(Math.min(start + 60, 24 * 60 - 1)) });
  });

  grid.addEventListener("dragstart", function (ev) {
    const block = ev.target.closest(".block");
    if (!block) return;
    dragging = { id: block.dataset.id, grab: ev.clientY - block.getBoundingClientRect().top };
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", dragging.id);
    block.classList.add("is-dragging");
  });
  grid.addEventListener("dragend", function () { dragging = null; render(); });
  grid.addEventListener("dragover", function (ev) {
    const col = ev.target.closest(".tt-col");
    if (!col || !dragging) return;
    ev.preventDefault();
    grid.querySelectorAll(".drop-target").forEach(function (c) { if (c !== col) c.classList.remove("drop-target"); });
    col.classList.add("drop-target");
  });
  grid.addEventListener("drop", function (ev) {
    const col = ev.target.closest(".tt-col");
    if (!col || !dragging) return;
    ev.preventDefault();
    const e = entries.find(function (x) { return x.id === dragging.id; });
    if (!e) return;
    const dur = toMin(e.end) - toMin(e.start);
    const y = ev.clientY - col.getBoundingClientRect().top - dragging.grab;
    let start = cfg.startHour * 60 + Math.round(y / PPM / cfg.slot) * cfg.slot;
    start = Math.max(cfg.startHour * 60, Math.min(start, cfg.endHour * 60 - dur));
    const date = parseYmd(col.dataset.date);
    const moved = Object.assign({}, e, { start: toTime(start), end: toTime(start + dur), day: date.getDay() });
    if (e.repeat === "once") moved.date = col.dataset.date;
    const clash = findClashes(moved, e.id);
    dragging = null;
    if (clash.length) { render(); Nudge.ui.toast("That slot overlaps with " + clashLabel(clash[0]) + ". Pick another time or move that one first.", "error"); return; }
    entries[entries.indexOf(e)] = moved;
    persist(); render(); Nudge.ui.toast("Moved " + e.course + " to " + DAYS[moved.day] + ", " + fmt12(moved.start));
  });

  /* ---------- controls ---------- */
  document.querySelectorAll("[data-view]").forEach(function (b) { b.addEventListener("click", function () { view = b.dataset.view; render(); }); });
  $("day-tabs").addEventListener("click", function (ev) {
    const b = ev.target.closest("[data-day]"); if (!b) return;
    focusDay = Number(b.dataset.day); render();
  });
  $("prev-btn").addEventListener("click", function () { weekOffset--; render(); });
  $("next-btn").addEventListener("click", function () { weekOffset++; render(); });
  $("today-btn").addEventListener("click", function () { weekOffset = 0; focusDay = new Date().getDay(); render(); });
  $("add-btn").addEventListener("click", function () { openDialog(null); });

  /* Hours settings */
  const selStart = $("cfg-start"), selEnd = $("cfg-end"), selSlot = $("cfg-slot");
  for (let h = 0; h <= 23; h++) selStart.insertAdjacentHTML("beforeend", '<option value="' + h + '">' + hourLabel(h) + "</option>");
  for (let h = 1; h <= 24; h++) selEnd.insertAdjacentHTML("beforeend", '<option value="' + h + '">' + hourLabel(h % 24) + (h === 24 ? " (midnight)" : "") + "</option>");
  function syncCfgControls() { selStart.value = cfg.startHour; selEnd.value = cfg.endHour; selSlot.value = cfg.slot; }
  function onCfg() {
    const s = Number(selStart.value), en = Number(selEnd.value);
    if (en - s < 2) { Nudge.ui.toast("Leave at least two hours between start and end.", "error"); syncCfgControls(); return; }
    cfg = { startHour: s, endHour: en, slot: Number(selSlot.value) };
    persistCfg(); render();
  }
  [selStart, selEnd, selSlot].forEach(function (el) { el.addEventListener("change", onCfg); });
  syncCfgControls();

  render();
  setInterval(function () { if (!dragging && !dlg.open) render(); }, 60000);   // keeps the "now" line moving
})();
