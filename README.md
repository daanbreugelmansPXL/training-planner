# Training Planner PWA ⚡

A high-performance, offline-capable Progressive Web App (PWA) designed for an 18-year-old Muay Thai athlete training at home plus 2 club sessions per week. Operates as a personal weekly planner, progressive overload tracker, and workout logbook.

Built with **100% vanilla HTML, CSS, and JavaScript** — zero build step, zero frameworks, zero external dependencies, and zero CDNs. Works completely offline.

---

## 🚀 Quick Start (Testing Locally)

Because this app uses modern PWA technologies (Service Worker and Web Manifest), it should be served via HTTP/HTTPS or `localhost`:

### Option A: Python (Built-in on Windows/Mac/Linux)
Open a terminal in the project directory and run:
```bash
python -m http.server 8080
```
Then navigate to: `http://localhost:8080` in Chrome, Safari, Edge, or Firefox.

### Option B: Node.js (via npx serve)
```bash
npx serve .
```

### Option C: VS Code Live Server
Right-click `index.html` and click **"Open with Live Server"**.

---

## 📱 How to Add to iPhone Home Screen (iOS Safari / Chrome)

For the full standalone app experience with safe area support and no browser address bar:

1. Open your hosted URL (or local network IP e.g. `http://192.168.1.X:8080`) in **Safari** on your iPhone.
2. Tap the **Share** button (the square with an arrow pointing upward at the bottom of the screen).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top right corner.
5. The **Training** app icon with a dark background and bold lightning bolt will appear on your Home Screen.
6. Launch it directly from your Home Screen: it will open in standalone full-screen mode, with cache-first offline storage.

---

## 🌐 Free Static Hosting Deployment

The app requires no build process. You can deploy it to any free static host in 60 seconds:

### 1. GitHub Pages
1. Push this folder to a GitHub repository (e.g. `training-planner`).
2. Go to repository **Settings** → **Pages**.
3. Under **Branch**, select `main` (root) and click **Save**.
4. Your PWA is live at `https://<username>.github.io/<repo>/`.

### 2. Cloudflare Pages
1. In the Cloudflare dashboard, go to **Workers & Pages** → **Create application** → **Pages**.
2. Connect your repository (or drag-and-drop this folder via Direct Upload).
3. Set build command to *empty* and output directory to `.`.
4. Click **Deploy site**.

### 3. Netlify
1. Log in to [Netlify](https://app.netlify.com).
2. Drag and drop this folder directly into the Netlify "Sites" area.
3. Your app is instantly live with free HTTPS and service worker support.

---

## 🧠 Key Features & Architectural Highlights

- **Weekly Plan Switcher**: Instant toggle between the **3-Day Strength Plan** (Mon MT1, Tue Strength A, Wed MT2, Thu Strength B, Fri Rest, Sat Strength C, Sun Aerobic & Mobility) and the **2-Day Fallback Plan** (for exam weeks, high fatigue, or after missing 2 strength days). Selection is preserved per ISO calendar week.
- **Dynamic Overrides Layer**: Custom exercises, rep range adjustments, rest periods, exercise replacements, and order changes are stored in `storage.js` as an overrides layer. `data/plan.js` is never mutated, ensuring clean updates and full "Reset to Default" restoration at any time.
- **Fast 3-Tap Logging**: Enter weight, reps, and tap the checkmark. Input placeholders automatically display previous session results for that exact movement.
- **Reschedule Engine with Rules & Warnings**: Sessions can be rescheduled to any day of the week, with built-in scheduling intelligence:
  - Muay Thai club sessions (Mon/Wed 20:00–21:30) are protected from accidental moving.
  - Warnings are surfaced if Strength B and C lack an easy/rest day between them, or if heavy intervals are placed the day before Muay Thai.
- **Timestamp-Based Floating Rest Timer**: When a set is checked off, a floating rest timer launches with +15s / -15s / Skip controls. It calculates remaining time from system clock timestamps, surviving screen locks, background throttling, and iOS device sleep. Triggers a WebAudio two-tone chime and haptic vibration on finish.
- **Zero-Dependency SVG Progress Charts**: Automatically plots estimated 1RM (Epley formula: $w \times (1 + r/30)$) or top weight over time using pure inline SVG. Includes 8-week consistency overview and active weekly streak counters.
- **Robust Backup & Transfer**: One-click JSON export (`training-backup-YYYY-MM-DD.json`) with Web Share API support on iOS and fallback download. Schema-validated import with choice of **Merge** or **Replace**. 14-day gentle reminder banner.
- **Apple Fitness / Strava Dark Aesthetic**: Clean dark mode with semantic badges, `100dvh` viewport adaptation, safe area insets (`env(safe-area-inset-*)`), and minimum 44x44px touch targets. Input font sizes are locked at 16px to prevent iOS auto-zoom.

---

## 🔌 Future Backend Integration (`storage.js`)

In accordance with Section 9, backend sync and accounts are out of scope for v1. However, the architecture is decoupled so a cloud database (e.g. Supabase, Firebase, CouchDB) can be connected simply by updating the methods in `storage.js`:
- `StorageService.load()`: fetch remote session records.
- `StorageService.save()`: push changes to user table/collection.
- `StorageService.exportData()` / `importData()`: sync with cloud backups.
All UI components communicate exclusively through `StorageService`, requiring zero changes to UI code when adding a backend later.
