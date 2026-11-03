# Nudge: study reminders for university students

Plain HTML, CSS and JavaScript. No build step.

## Run it

Service workers (offline mode, installing, notifications) need **http://localhost** or **https**.
Opening `index.html` by double-clicking works for the pages, but not for install or alerts.

    cd nudge
    python3 -m http.server 8000      # then open http://localhost:8000
    # or: npx serve    # or the VS Code "Live Server" extension

## Put it online (free, https included)

Drag the `nudge` folder onto https://app.netlify.com/drop, or push it to GitHub and
import it on Netlify, Vercel or GitHub Pages. Open the live link on your phone and
use "Add to Home Screen" / the Install button.

## What is saved where

Everything is stored in the browser (`localStorage`) through `js/storage.js`, and accounts
through `js/auth.js`. This is fine for building and testing but it is **not real security**
and data does not follow the user to another device.

## Next steps when you add a backend (Firebase or Supabase)

1. `js/auth.js`: replace signup, login, logout, currentUser (and add Google sign-in).
2. `js/storage.js`: replace getForUser / setForUser with database reads and writes.
3. `js/pwa.js`: use `Nudge.pwa.onOnline(fn)` to sync changes made while offline.
4. Background alerts: add Firebase Cloud Messaging or Web Push. `sw.js` already has a `push` handler.
5. Bump `VERSION` in `sw.js` every time you ship new files.

## Alerts: what to expect

Alerts are scheduled by the app itself, so they fire while Nudge is open or running in the
background. A fully closed app may not wake on a phone until real push is added (step 4).
On iPhone, notifications only work after the app is added to the Home Screen (iOS 16.4+).
