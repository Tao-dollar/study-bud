/* ===== Nudge · auth.js =====
   FRONTEND-ONLY accounts. Everything is saved in this browser so you can build and
   test the whole app now. Passwords are hashed, but this is NOT real security:
   when you add a backend (Firebase Auth / Supabase), replace the inside of
   signup(), login(), logout() and currentUser(). The rest of the app won't change. */
window.Nudge = window.Nudge || {};

Nudge.auth = (function () {
  const S = Nudge.store;
  const E = function () { return Nudge.copy.errors; };

  function users() { return S.get("users", []); }
  function saveUsers(list) { return S.set("users", list); }

  async function hash(password, salt) {
    const data = salt + ":" + password;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }
    let h = 5381;                                    // fallback for very old browsers
    for (let i = 0; i < data.length; i++) h = ((h << 5) + h + data.charCodeAt(i)) | 0;
    return "x" + (h >>> 0).toString(16);
  }

  function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); }
  function norm(email) { return String(email || "").trim().toLowerCase(); }

  async function signup(input) {
    const name = String(input.name || "").trim();
    const email = norm(input.email);
    if (!name) return { ok: false, field: "name", message: E().required };
    if (!validEmail(email)) return { ok: false, field: "email", message: E().emailInvalid };
    if (String(input.password || "").length < 8) return { ok: false, field: "password", message: E().passwordShort };
    if (input.password !== input.confirm) return { ok: false, field: "confirm", message: E().passwordMismatch };

    const list = users();
    if (list.some(function (u) { return u.email === email; })) {
      return { ok: false, field: "email", message: E().emailTaken };
    }
    const salt = S.uid();
    const user = {
      id: S.uid(), name: name, email: email, salt: salt,
      passHash: await hash(input.password, salt),
      createdAt: new Date().toISOString(),
      onboarded: false, profile: {}
    };
    list.push(user);
    if (!saveUsers(list)) return { ok: false, field: "", message: E().saveFailed };
    S.set("session", user.id);
    return { ok: true, user: user };
  }

  async function login(input) {
    const email = norm(input.email);
    if (!validEmail(email)) return { ok: false, field: "email", message: E().emailInvalid };
    if (!input.password) return { ok: false, field: "password", message: E().required };
    const user = users().find(function (u) { return u.email === email; });
    // Same message for "no such email" and "wrong password" on purpose
    if (!user || (await hash(input.password, user.salt)) !== user.passHash) {
      return { ok: false, field: "", message: E().loginFailed };
    }
    S.set("session", user.id);
    return { ok: true, user: user };
  }

  function logout() { S.remove("session"); }

  function currentUser() {
    const id = S.currentUserId();
    if (!id) return null;
    return users().find(function (u) { return u.id === id; }) || null;
  }

  function updateUser(patch) {
    const list = users();
    const i = list.findIndex(function (u) { return u.id === S.currentUserId(); });
    if (i < 0) return null;
    list[i] = Object.assign({}, list[i], patch);
    saveUsers(list);
    return list[i];
  }

  function firstName(user) {
    if (!user) return "";
    const nick = user.profile && user.profile.nickname;
    return nick || String(user.name || "").split(" ")[0];
  }

  /* Page guards: call at the top of any private page */
  function requireAuth(opts) {
    const user = currentUser();
    if (!user) { location.replace("login.html"); return null; }
    if (opts && opts.needsOnboarding && !user.onboarded) { location.replace("onboarding.html"); return null; }
    return user;
  }

  return { signup, login, logout, currentUser, updateUser, firstName, requireAuth, validEmail };
})();
