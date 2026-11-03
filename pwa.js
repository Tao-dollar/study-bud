/* ===== Nudge · pwa.js =====
   Registers the service worker, powers the Install button, and tells people
   when they go offline. Loaded on every page. */
window.Nudge = window.Nudge || {};

Nudge.pwa = (function () {
  let deferred = null;
  const listeners = [], onlineHooks = [];

  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); renderBanner(); }
  function toast(msg) { if (Nudge.ui) Nudge.ui.toast(msg); }
  function isStandalone() { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function canInstall() { return !!deferred; }

  async function install() {
    if (!deferred) return "unavailable";
    deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null; emit();
    return choice.outcome;
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener("appinstalled", function () { deferred = null; emit(); toast("Nudge is installed. Find it with your other apps."); });

  /* Service workers need https or localhost (not file://) */
  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && secure) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  /* Offline / online */
  window.addEventListener("offline", function () { toast("You're offline. Everything is saved on this device."); });
  window.addEventListener("online", function () {
    toast("Back online.");
    onlineHooks.forEach(function (fn) { try { fn(); } catch (e) {} });   // hook for syncing once you add a backend
  });

  /* Install banner: shown on any page that has <div id="install-slot"> */
  function renderBanner() {
    const slot = document.getElementById("install-slot");
    if (!slot) return;
    const dismissedAt = Nudge.store ? Nudge.store.get("installDismissed", 0) : 0;
    if (isStandalone() || Date.now() - dismissedAt < 14 * 864e5) { slot.innerHTML = ""; return; }
    if (canInstall()) {
      slot.innerHTML = '<div class="install-banner"><div><strong>Put Nudge on your home screen</strong><span>It opens faster and keeps working without internet.</span></div>' +
        '<div class="install-actions"><button class="btn btn-primary btn-small" type="button" data-install>Install</button><button class="btn btn-ghost btn-small" type="button" data-install-dismiss>Not now</button></div></div>';
    } else if (isIOS()) {
      slot.innerHTML = '<div class="install-banner"><div><strong>Add Nudge to your home screen</strong><span>Tap the Share button, then choose Add to Home Screen.</span></div>' +
        '<div class="install-actions"><button class="btn btn-ghost btn-small" type="button" data-install-dismiss>Got it</button></div></div>';
    } else { slot.innerHTML = ""; }
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-install]")) install();
    if (e.target.closest("[data-install-dismiss]")) { if (Nudge.store) Nudge.store.set("installDismissed", Date.now()); renderBanner(); }
  });
  document.addEventListener("DOMContentLoaded", renderBanner);

  return { install, canInstall, isStandalone, isIOS, onChange: function (fn) { listeners.push(fn); }, onOnline: function (fn) { onlineHooks.push(fn); } };
})();
