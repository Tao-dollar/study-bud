/* ===== Nudge · onboarding.js: three short steps that personalise the app ===== */
(function () {
  Nudge.ui.initTheme();
  const user = Nudge.auth.requireAuth();
  if (!user) return;

  const total = 3;
  let step = 1;
  const profile = user.profile || {};
  let courses = (profile.courses || []).slice();

  const form = document.getElementById("onboard-form");
  const sections = form.querySelectorAll("[data-step]");
  const label = document.getElementById("step-label");
  const fill = document.getElementById("bar-fill");
  const back = document.getElementById("back-btn");
  const next = document.getElementById("next-btn");
  const formError = document.getElementById("form-error");

  /* Pre-fill (also lets people come back and edit later) */
  form.elements.nickname.value = profile.nickname || Nudge.auth.firstName(user);
  form.elements.university.value = profile.university || "";
  form.elements.course.value = profile.course || "";
  form.elements.level.value = profile.level || "";
  if (profile.remindAt) form.elements.remindAt.value = profile.remindAt;
  if (profile.lead) form.elements.lead.value = String(profile.lead);
  (profile.times || []).forEach(function (t) {
    const box = form.querySelector('input[name="times"][value="' + t + '"]');
    if (box) box.checked = true;
  });

  function fieldError(id, message) {
    const input = document.getElementById(id);
    const err = document.getElementById(id + "-error");
    if (message) { input.setAttribute("aria-invalid", "true"); err.textContent = message; input.focus(); }
    else { input.removeAttribute("aria-invalid"); err.textContent = ""; }
  }

  function show(n) {
    step = n;
    sections.forEach(function (s) { s.hidden = Number(s.dataset.step) !== n; });
    label.textContent = "Step " + n + " of " + total;
    fill.style.width = (n / total * 100) + "%";
    back.hidden = n === 1;
    next.textContent = n === total ? "Finish and open my dashboard" : "Continue";
    formError.textContent = "";
    const h = sections[n - 1].querySelector("h1");
    h.setAttribute("tabindex", "-1");
    h.focus();
  }

  function validate(n) {
    if (n === 1) {
      const required = [["nickname", "nickname"], ["university", "university"], ["course-of-study", "course"], ["level", "level"]];
      for (let i = 0; i < required.length; i++) {
        const id = required[i][0], name = required[i][1];
        const value = String(form.elements[name].value).trim();
        fieldError(id, null);
        if (!value) { fieldError(id, Nudge.copy.errors.required); return false; }
      }
    }
    if (n === 2 && courses.length === 0) {
      document.getElementById("course-error").textContent = Nudge.copy.errors.courseNeeded;
      document.getElementById("course-code").focus();
      return false;
    }
    return true;
  }

  /* Courses */
  const list = document.getElementById("course-list");
  const count = document.getElementById("course-count");
  const codeInput = document.getElementById("course-code");
  const titleInput = document.getElementById("course-title");

  function renderCourses() {
    list.innerHTML = courses.map(function (c, i) {
      return "<li><span><span class=\"code\">" + Nudge.ui.esc(c.code) + "</span>" + Nudge.ui.esc(c.title || "") + "</span>" +
        "<button type=\"button\" data-remove=\"" + i + "\" aria-label=\"Remove " + Nudge.ui.esc(c.code) + "\">Remove</button></li>";
    }).join("");
    count.textContent = courses.length === 0 ? "" : courses.length + (courses.length === 1 ? " course added." : " courses added.");
  }
  function addCourse() {
    const err = document.getElementById("course-error");
    const code = codeInput.value.trim().toUpperCase().replace(/\s+/g, "");
    err.textContent = "";
    if (!code) { err.textContent = Nudge.copy.errors.required; codeInput.focus(); return; }
    if (courses.some(function (c) { return c.code === code; })) { err.textContent = Nudge.copy.errors.courseDuplicate; return; }
    courses.push({ code: code, title: titleInput.value.trim() });
    codeInput.value = ""; titleInput.value = "";
    renderCourses();
    codeInput.focus();
  }
  document.getElementById("add-course").addEventListener("click", addCourse);
  [codeInput, titleInput].forEach(function (el) {
    el.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addCourse(); } });
  });
  list.addEventListener("click", function (e) {
    const i = e.target.getAttribute("data-remove");
    if (i === null) return;
    courses.splice(Number(i), 1);
    renderCourses();
  });
  renderCourses();

  /* Navigation */
  back.addEventListener("click", function () { if (step > 1) show(step - 1); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate(step)) return;
    if (step < total) { show(step + 1); return; }

    const times = Array.from(form.querySelectorAll('input[name="times"]:checked')).map(function (b) { return b.value; });
    const saved = Nudge.auth.updateUser({
      onboarded: true,
      profile: {
        nickname: form.elements.nickname.value.trim(),
        university: form.elements.university.value.trim(),
        course: form.elements.course.value.trim(),
        level: form.elements.level.value,
        courses: courses,
        times: times,
        remindAt: form.elements.remindAt.value || "19:00",
        lead: Number(form.elements.lead.value)
      }
    });
    if (!saved) { formError.textContent = Nudge.copy.errors.saveFailed; return; }
    location.href = "dashboard.html";
  });

  show(1);
})();
