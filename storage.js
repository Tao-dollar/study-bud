/* ===== Nudge · storage.js =====
   One small wrapper around localStorage so every page saves data the same way.
   Later you can swap the inside of these functions for Firebase/Supabase
   without touching the rest of the app. */
window.Nudge = window.Nudge || {};

Nudge.store = (function () {
  const PREFIX = "nudge:";

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch (e) {}
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Per-user data: keys are tied to whoever is logged in (built out in stage 2) */
  function currentUserId() { return get("session", null); }
  function userKey(name) {
    const id = currentUserId();
    return id ? "user:" + id + ":" + name : null;
  }
  function getForUser(name, fallback) {
    const k = userKey(name);
    return k ? get(k, fallback) : fallback;
  }
  function setForUser(name, value) {
    const k = userKey(name);
    return k ? set(k, value) : false;
  }

  /* Used by Settings: export or erase everything that belongs to one user */
  function userKeys(id) {
    const out = [], p = PREFIX + "user:" + id + ":";
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(p) === 0) out.push(k.slice(PREFIX.length)); } } catch (e) {}
    return out;
  }
  function removeUserData(id) { userKeys(id).forEach(remove); }

  return { get, set, remove, uid, currentUserId, getForUser, setForUser, userKeys, removeUserData };
})();
