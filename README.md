# Farm Tracker

A labour time and payment tracking app built with React and Vite.

## Authentication

The app is protected by a login screen. Credentials are stored in Vercel environment variables — nothing is hardcoded in the repo.

**Default credentials (set by you in Vercel):**
- Username: set via `AUTH_USERNAME`
- Password: set via `AUTH_PASSWORD`

Once logged in the session token is valid for **90 days** and stored in the browser. Users can sign out using the 🔓 button in the header.

## Run Locally

**Prerequisites:** Node.js 18+ and npm installed.

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd farm-tracker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Fill in your local environment variables in `.env.local` (already gitignored):

   ```
   AUTH_USERNAME=admin
   AUTH_PASSWORD=your-password
   AUTH_SECRET=any-long-random-string
   DATABASE_URL=your-neon-connection-string
   ```

   > In dev mode (`npm run dev`) the login screen is skipped entirely — you go straight into the app. Auth is only enforced in production.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open your browser at `http://localhost:5173`

> **No database needed for local development.** In dev mode the app automatically uses browser `localStorage` instead of Postgres. A yellow banner in the app confirms this. Data added locally does not sync to the deployed database.

## Database Setup (Neon Postgres)

This app uses Neon Postgres for persistent storage. Set it up once before deploying:

1. Go to your project in the [Vercel dashboard](https://vercel.com/dashboard).
2. Click the **Storage** tab → **Create Database** → choose **Postgres (Neon)**.
3. Follow the prompts — Vercel automatically adds `DATABASE_URL` to your project env vars.
4. The `logs` table is created automatically on the first request.

For **local development against the real database**, install the [Vercel CLI](https://vercel.com/docs/cli) and run:

```bash
npm install -g vercel
vercel link                   # link to your Vercel project
vercel env pull .env.local    # pulls DATABASE_URL — then add back AUTH_* and VITE_* vars
vercel dev                    # starts dev server with real API routes + Postgres
```

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

Before deploying, go to **Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `AUTH_USERNAME` | `admin` |
| `AUTH_PASSWORD` | your chosen password |
| `AUTH_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |
| `DATABASE_URL` | added automatically by Vercel Postgres |


### Step 4 — Deploy

Click **Deploy**. Your app will be live in under a minute.

> Every push to your main branch triggers an automatic redeployment.

### Updating the Password

To change the password later, go to **Settings → Environment Variables** in the Vercel dashboard, update `AUTH_PASSWORD`, and redeploy. Anyone already logged in will remain logged in until their 90-day token expires.
