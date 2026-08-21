# DentiNexa AI — Frontend Only (Preview Build)

This is the UI/UX only — **no backend, no server, no setup required.** Open `index.html` directly in your browser (double-click it, or drag it into a browser tab) and everything works, including login, booking, and all four role dashboards.

## How it works

All "API" calls are mocked in `js/api.js`. Instead of talking to a server, that file reads and writes to your browser's `localStorage`, seeded with the same demo data the real backend uses. Every other file — every HTML page, every other JS file, all the CSS — is **identical** to the real, backend-connected version. When you're ready to connect it for real, you only need to swap this one file back out.

## Try it

Open `index.html`, then `login.html`, and use any of these (password for all: `Demo@1234`):

| Role | Email |
|---|---|
| Patient | patient@dentcare.ai |
| Dentist | dr.amaka@dentcare.ai |
| Receptionist | reception@dentcare.ai |
| Admin | admin@dentcare.ai |

Try booking an appointment as the patient, then log in as the dentist to confirm it, or the admin to see it reflected in the stats — it all persists in your browser's localStorage between page loads.

**Reset the demo data:** open your browser's dev tools console and run `localStorage.clear()`, then refresh.

## What's real vs. simulated here

- **Real:** every layout, style, interaction, form validation, role-based navigation, dark/light mode, responsive behavior.
- **Simulated:** the "server" — no network requests happen, nothing leaves your browser, and nothing here is secure (passwords are stored in plain text in localStorage). This build is for design review only, not for handling real patient data.

## Going from this to the connected version

The full project (this frontend + the real Express/SQLite backend) is available separately. To reconnect them: replace `js/api.js` in this folder with the real one, and change the root-relative paths (`css/...`, `js/...`) back to server-absolute paths (`/css/...`, `/js/...`) since they'll be served from an Express root again.
