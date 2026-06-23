# Farm Tracker

A labour time and payment tracking app built with React and Vite.

## Authentication

The app is protected by a login screen. Credentials are stored in Vercel environment variables — nothing is hardcoded in the repo.

Once logged in the session token is valid for **90 days** and stored in the browser. Users can sign out using the 🔓 button in the header.

## Run Locally

**Prerequisites:** Node.js 18+

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd farm-tracker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Fill in `.env.local` (already gitignored) with your local credentials:

   ```
   VITE_AUTH_USER=admin
   VITE_AUTH_PASS=your-password
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173` — sign in with the credentials from `.env.local`.

> **No database needed locally.** In dev mode the app uses browser `localStorage` instead of Postgres. A yellow banner in the app confirms this. Data added locally does not sync to the deployed database.

## Deploy to Vercel

### Step 1 — Push to GitHub

Push your code to a GitHub repository.

### Step 2 — Import in Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
2. Import your repository.
3. Vercel will auto-detect Vite. Confirm:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Step 3 — Set Environment Variables

Go to **Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `AUTH_USERNAME` | `admin` |
| `AUTH_PASSWORD` | your chosen password |
| `AUTH_SECRET` | a long random string (run `openssl rand -hex 32` to generate one) |
| `DATABASE_URL` | added automatically when you attach a Neon Postgres database |

### Step 4 — Attach a Database

In your Vercel project go to the **Storage** tab → **Create Database** → choose **Postgres (Neon)**. Vercel will automatically add `DATABASE_URL`. The `logs` table is created on the first request.

### Step 5 — Deploy

Click **Deploy**. Your app will be live in under a minute.

> Every push to your main branch triggers an automatic redeployment.

### Updating the Password

Go to **Settings → Environment Variables**, update `AUTH_PASSWORD`, and redeploy. Anyone already logged in stays logged in until their 90-day token expires.
