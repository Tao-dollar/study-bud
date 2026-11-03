/* ===== Nudge · login.js ===== */
(function () {
  Nudge.ui.initTheme();

  const existing = Nudge.auth.currentUser();
  if (existing) { location.replace(existing.onboarded ? "dashboard.html" : "onboarding.html"); return; }

  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const modeButtons = document.querySelectorAll("[data-mode]");
  const asideTitle = document.getElementById("aside-title");
  const asideText = document.getElementById("aside-text");

  const copy = {
    login:  { title: "Welcome back.", text: "Your timetable and reminders are right where you left them.", doc: "Log in" },
    signup: { title: "Let's set up your semester.", text: "Make an account, tell us your courses, and Nudge handles the remembering.", doc: "Sign up" }
  };

  function setMode(mode) {
    const isSignup = mode === "signup";
    loginForm.hidden = isSignup;
    signupForm.hidden = !isSignup;
    modeButtons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === mode)); });
    asideTitle.textContent = copy[mode].title;
    asideText.textContent = copy[mode].text;
    document.title = copy[mode].doc + " · Nudge";
    history.replaceState(null, "", "?mode=" + mode);
  }
  modeButtons.forEach(function (b) { b.addEventListener("click", function () { setMode(b.dataset.mode); }); });
  setMode(new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "login");

  /* Error helpers */
  function clearErrors(form) {
    form.querySelectorAll(".error").forEach(function (e) { e.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach(function (i) { i.removeAttribute("aria-invalid"); });
    const general = form.querySelector(".form-error");
    if (general) general.textContent = "";
  }
  function showError(form, field, message) {
    const input = field ? form.elements[field] : null;
    if (input) {
      input.setAttribute("aria-invalid", "true");
      const err = document.getElementById(input.id + "-error");
      if (err) err.textContent = message;
      input.focus();
    } else {
      form.querySelector(".form-error").textContent = message;
    }
  }
  function values(form) {
    const out = {};
    new FormData(form).forEach(function (v, k) { out[k] = v; });
    return out;
  }

  async function handle(form, action) {
    clearErrors(form);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const res = await action(values(form));
      if (!res.ok) { showError(form, res.field, res.message); return; }
      location.href = res.user.onboarded ? "dashboard.html" : "onboarding.html";
    } finally { btn.disabled = false; }
  }
  loginForm.addEventListener("submit", function (e) { e.preventDefault(); handle(loginForm, Nudge.auth.login); });
  signupForm.addEventListener("submit", function (e) { e.preventDefault(); handle(signupForm, Nudge.auth.signup); });

  /* Show / hide password */
  document.querySelectorAll(".pw-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const input = btn.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  document.getElementById("google-btn").addEventListener("click", function () {
    Nudge.ui.toast("Google sign-in switches on once Nudge has a backend. Use your email for now.");
  });
})();
