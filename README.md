# Training Planner PWA ⚡

A calm, sport-focused personal training planner and workout logbook built for an 18-year-old Muay Thai athlete training at home with 2 weekly club sessions.

Designed with **vanilla HTML, CSS, and JavaScript** — zero build step, zero frameworks, zero external dependencies, and zero CDNs. Works 100% offline.

---

## 🚀 Local Testing

Because this app uses modern Progressive Web App (PWA) APIs (Service Worker, Web Manifest, and WebAudio), it must be served over `http://localhost` or `https://`:

### Option A: Python (Command Prompt / PowerShell)
```bash
python -m http.server 8080
```
Open `http://localhost:8080` in your browser.

### Option B: VS Code Live Server
Right-click `index.html` in VS Code and select **"Open with Live Server"**.

---

## 📱 How to Add to iPhone Home Screen

For a standalone full-screen experience with no Safari address bar:

1. Open your deployed GitHub Pages URL (`https://<username>.github.io/training-planner/`) in **Safari** on your iPhone.
2. Tap the **Share** button (the square with an arrow pointing upward).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top right corner.
5. The **Training** app icon (near-black square with bold white "T" and red accent bar) will appear on your Home Screen.

---

## 🔄 How to Force-Refresh After an Update

The app uses a cache-first service worker (`sw.js`). When a new version is deployed:
1. The service worker automatically detects changes, downloads the new cache, calls `skipWaiting()`, and triggers a **one-time seamless reload** via `controllerchange`.
2. To manually force a hard reload in Safari or Chrome on desktop: press `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac).
3. On an iPhone standalone web app: swipe the app up in the app switcher to close it, and reopen it with an active internet connection.

---

## 🌐 Deploy to GitHub Pages (Step-by-Step)

Because this app runs directly from static files under the `/training-planner/` subpath with relative paths (`./`), deployment takes under 60 seconds:

```bash
git add .
git commit -m "Refactor Training Planner v2: calm design, templates, fast 3-tap logging"
git push origin main
```

1. In your GitHub repository, open **Settings** → **Pages**.
2. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
3. Select branch **`main`** and folder **`/ (root)`**, then click **Save**.
4. Your PWA is live at:
   `https://<username>.github.io/training-planner/`

---

## 🏋️ Architectural Highlights (v2)

- **Calm, Strict Athletic Aesthetic**: Near-black background (`#0A0A0B`), hairline dividers (`1px`), single signal red accent (`#E5322D`), tabular numbers, and zero AI-app noise (no gradients, neon glows, emoji icons, or multi-column desktop sprawl). Single column centered (max 720px) on both mobile and desktop.
- **Fast 3-Tap Logging**:
  - Enter weight **once** per exercise and it automatically fills all sets.
  - Tap any individual set's weight to override it (for drop sets or ramps) with an accent underline.
  - Steppers `+2.5` / `-2.5` kg and a one-tap `+2.5 kg hint` when last time reached the top rep range.
  - Reps input prefills with last time's reps.
  - Checking a set starts the timestamp-based rest timer.
- **Templates Screen (Set once, applies everywhere)**:
  - Configure Strength A, B, C, Fallback 1 & 2, and mobility routines once.
  - Edits autosave and automatically apply to all upcoming, unstarted workouts.
  - Previous started and completed sessions retain their historical snapshot.
  - Quick-add line parses shorthand e.g. `Bench press 3x6-10 2min`.
- **Clean In-Session Edits**:
  - Inline "Edit" toggle with typeahead search to replace exercises.
  - "Just today" toggle (default on) protects templates, with a direct "Edit template" shortcut.
- **Pinned Exercise Notes**:
  - Exercise notes can be pinned with "Pin next time", surfacing as a clean banner with a dismissal `×` in the next workout.
- **One-Tap Reschedule**:
  - Tap "Move" to open a clean 7-day bottom sheet. Muay Thai club days are locked; tapping another day moves/swaps sessions with an instant 5-second **Undo toast**. No modal warnings or roadblocks.
- **Local-First & Data Persistence**:
  - Full v1 to v2 migration preserving all historical logs, weights, and settings.
  - One-click JSON backup export and validated import (Merge or Replace).

---

## 🔌 Later: Sync (Backend Remote Adapter)

In v2, all persistence operations are consolidated in [`storage.js`](file:///C:/Users/daanb/.gemini/antigravity/scratch/training-planner-pwa/storage.js) through an async interface:
- `getState()`
- `saveState(state)`
- `upsert(collection, record)`
- `remove(collection, id)`

Every record in `library`, `templates`, `logs`, and `weeks` has a stable `id` and an ISO `updatedAt` timestamp. When connecting a backend (such as Supabase, Cloudflare D1/KV, or Firebase):
1. Replace or wrap the `localStorage` calls in `StorageService.getState()` and `StorageService.saveState()` with your remote API client.
2. The UI components communicate exclusively with `StorageService`, so zero UI code needs to be modified.
