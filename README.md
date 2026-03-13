# CivicResolve AI

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

A full-stack civic grievance management platform powered by AI.

- **Frontend** — React + Vite, deployed on **GitHub Pages**
- **OTP** — Direct browser integration with EmailJS and Supabase
- **Database** — Supabase

🌐 **Live site**: https://sowmiyanarayanan07.github.io/civicresolve-ai/

---

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.local` and fill in the required keys (Supabase, Gemini, EmailJS).
3. Run the app:
   ```
   npm run dev
   ```

---

## Deploy to GitHub Pages

The site is **automatically deployed** to GitHub Pages via GitHub Actions on every push to `main`.

### Manual deploy (optional)
```
npm run deploy
```

### First-time setup
1. Go to **GitHub → repo → Settings → Pages**
2. Set **Source** to the `gh-pages` branch.
3. Add all required environment variables as **GitHub repository secrets** (Settings → Secrets and variables → Actions):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY`
   - `VITE_EMAILJS_SERVICE_ID`
   - `VITE_EMAILJS_TEMPLATE_ID`
   - `VITE_EMAILJS_PUBLIC_KEY`


