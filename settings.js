/* ===== Nudge · settings.js ===== */
(function () {
  let user = Nudge.app.init("settings");
  if (!user) return;

  const S = Nudge.store, A = Nudge.alerts, E = Nudge.copy.errors;
  const $ = function (id) { return document.getElementById(id); };
  const profileForm = $("profile-form"), alertsForm = $("alerts-form");

  function fieldError(id, msg) { const i = $(id); i.setAttribute("aria-invalid", "true"); $(id + "-error").textContent = msg; i.focus(); }
  function saveProfile(patch, topLevel) {
    const next = Nudge.auth.updateUser(Object.assign({ profile: Object.assign({}, user.profile, patch) }, topLevel || {}));
    if (!next) { Nudge.ui.toast(E.saveFailed, "error"); return false; }
    user = next; return true;
  }

  /* Profile */
  const p = user.profile || {};
  profileForm.elements.name.value = user.name || "";
  profileForm.elements.nickname.value = p.nickname || Nudge.auth.firstName(user);
  profileForm.elements.university.value = p.university || "";
  profileForm.elements.course.value = p.course || "";
  profileForm.elements.level.value = p.level || "100L";

  profileForm.addEventListener("submit", function (e) {
    e.preventDefault();
    profileForm.querySelectorAll(".error").forEach(function (x) { x.textContent = ""; });
    profileForm.querySelectorAll("[aria-invalid]").forEach(function (x) { x.removeAttribute("aria-invalid"); });
    const f = profileForm.elements, name = f.name.value.trim(), nick = f.nickname.value.trim();
    if (!name) return fieldError("p-name", E.required);
    if (!nick) return fieldError("p-nick", E.required);
    if (saveProfile({ nickname: nick, university: f.university.value.trim(), course: f.course.value.trim(), level: f.level.value }, { name: name })) Nudge.ui.toast("Saved");
  });

  /* Alert preferences save as soon as they change */
  const flags = p.alerts || {};
  ["class", "reminder", "reading", "daily"].forEach(function (k) { alertsForm.elements[k].checked = flags[k] !== false; });
  alertsForm.elements.lead.value = String(p.lead || 30);
  alertsForm.elements.remindAt.value = p.remindAt || "19:00";
  alertsForm.addEventListener("change", function () {
    const f = alertsForm.elements, a = {};
    ["class", "reminder", "reading", "daily"].forEach(function (k) { a[k] = f[k].checked; });
    if (saveProfile({ alerts: a, lead: Number(f.lead.value), remindAt: f.remindAt.value || "19:00" })) Nudge.ui.toast("Saved");
  });

  /* Browser permission */
  function renderPermission() {
    const box = $("permission-box"), st = A.permission();
    box.className = "notice";
    if (st === "granted") {
      box.classList.add("is-on");
      box.innerHTML = '<p><strong>Phone and laptop alerts are on.</strong></p><p class="muted">They arrive while Nudge is open or running in the background. When the app is fully closed, delivery depends on your device.</p><div class="actions"><button class="btn btn-ghost btn-small" type="button" id="test-btn">Send a test alert</button></div>';
    } else if (st === "denied") {
      box.classList.add("is-blocked");
      box.innerHTML = '<p><strong>Alerts are blocked in this browser.</strong></p><p class="muted">Open your browser\'s site settings for this page and allow notifications.</p>';
    } else if (st === "unsupported") {
      box.innerHTML = '<p><strong>This browser can\'t send alerts outside the app.</strong></p><p class="muted">You\'ll still see them on the Alerts page. On iPhone, add Nudge to your home screen first.</p>';
    } else {
      box.innerHTML = '<p><strong>Alerts outside the app are off.</strong></p><p class="muted">Turn them on so reminders reach you in other tabs and apps.</p><div class="actions"><button class="btn btn-primary btn-small" type="button" id="enable-btn">Turn on alerts</button></div>';
    }
  }
  document.addEventListener("click", function (e) {
    if (e.target.id === "enable-btn") A.requestPermission().then(function (r) { if (r === "granted") A.test(); renderPermission(); });
    if (e.target.id === "test-btn") { A.test(); Nudge.ui.toast("Test alert sent."); }
  });
  renderPermission();

  /* Theme */
  $("theme-select").value = S.get("theme", "") || "";
  $("theme-select").addEventListener("change", function (e) {
    const v = e.target.value;
    if (v) S.set("theme", v); else S.remove("theme");
    Nudge.ui.applyTheme(v || null);
    const t = document.querySelector("[data-theme-toggle]");
    if (t) { const dark = document.documentElement.getAttribute("data-theme") === "dark" || (!v && matchMedia("(prefers-color-scheme: dark)").matches); t.textContent = dark ? "Light mode" : "Dark mode"; }
  });

  /* Install */
  function renderInstall() {
    const text = $("install-text"), btn = $("install-btn");
    btn.hidden = true;
    if (Nudge.pwa.isStandalone()) text.textContent = "Nudge is installed on this device. You're using the app right now.";
    else if (Nudge.pwa.canInstall()) { text.textContent = "Add Nudge to your phone or laptop. It opens in its own window and works without internet."; btn.hidden = false; }
    else if (Nudge.pwa.isIOS()) text.textContent = "On iPhone or iPad: tap the Share button in Safari, then choose Add to Home Screen.";
    else text.textContent = "If your browser supports it, an install option appears in the address bar or the browser menu. Installing needs the site to be opened over https (or localhost while you build).";
  }
  Nudge.pwa.onChange(renderInstall);
  renderInstall();

  /* Your data */
  $("export-btn").addEventListener("click", function () {
    const out = { exportedAt: new Date().toISOString(), account: { name: user.name, email: user.email, profile: user.profile } };
    S.userKeys(user.id).forEach(function (k) { out[k.split(":").slice(2).join(":")] = S.get(k, null); });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "nudge-data.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    Nudge.ui.toast("Your data is downloading.");
  });

  const dlg = $("delete-dialog");
  $("delete-open").addEventListener("click", function () { $("del-confirm").value = ""; $("del-confirm-error").textContent = ""; dlg.showModal(); $("del-confirm").focus(); });
  $("del-cancel").addEventListener("click", function () { dlg.close(); });
  $("delete-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if ($("del-confirm").value.trim() !== "DELETE") { $("del-confirm-error").textContent = "Type DELETE in capitals to confirm."; $("del-confirm").focus(); return; }
    const id = user.id;
    S.removeUserData(id);
    S.set("users", S.get("users", []).filter(function (u) { return u.id !== id; }));
    S.remove("session");
    location.href = "index.html";
  });
})();
