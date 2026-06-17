
# Murang'a County Municipal Board Portal

Simple, client-side municipal board portal implemented as static HTML/CSS/JS files. The app provides login, a dashboard, members/meetings/minutes/complaints/documents management, accessibility tools (text size, spacing, TTS) and a lightweight localStorage-backed data store for demo purposes.

## Features
- Multi-page split app: `index.html`, `home.html`, `settings.html`
- Shared styles in `styles.css` and application logic in `app.js`
- LocalStorage-based persistence and seeded demo data
- Accessibility toolbar (text size, spacing, theme, text-to-speech)
- Role-based UI (System Admin, Municipal Admin, Board Member, Department Officer, Social Officer)

## Project location

The project files live in the workspace folder:

- `c:\projo`

Key files:

- `index.html` — Login page
- `home.html` — Dashboard shell and SPA-like navigation
- `settings.html` — Settings and accessibility controls
- `styles.css` — Shared styling
- `app.js` — Application logic, localStorage persistence, seeded demo data

## Demo credentials

Use these seeded accounts for testing (passwords included):

- System Admin: `admin@muranga.go.ke` / `admin123`
- Kenol Admin: `kenol@muranga.go.ke` / `admin123`
- Kangare Admin: `kangare@kangare.go.ke` / `admin123`
- Murang'a Town Admin: `muranga@muranga.go.ke` / `admin123`

Note: The app stores a simple session in `localStorage` (key `mbp_session`). If you are redirected straight to `home.html`, clear site data (localStorage) or click Logout.

## Setup & Run

This is a static app — open `index.html` in your browser from the `c:\projo` folder. No build is required.

Quick steps (Windows):

```powershell
# from the workspace folder
start index.html
```

Or open the file directly in your browser.

## Development notes

- Data is stored under the `mbp_` prefix in `localStorage`.
- To reset seeded demo data, open the browser console and run: `localStorage.clear()` then reload `index.html`.
- Accessibility controls are implemented in `app.js` (functions: `setTextSize`, `setSpacing`, `toggleTheme`, `speakText`).

## File structure

```
c:\projo
├─ index.html
├─ home.html
├─ settings.html
├─ styles.css
├─ app.js
└─ README.md
```

## Next steps (suggested)

- Add server-side authentication and persistent storage (database) for production.
- Replace localStorage seed logic with API-backed data.
- Add automated tests for critical flows.

---
Generated and updated in workspace root `c:\projo`.

