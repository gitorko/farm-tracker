# Farm Tracker

## Run Locally

1. Install dependencies: `npm install`
2. Create `.env.local` with your login credentials:
   ```
   VITE_AUTH_USER=admin
   VITE_AUTH_PASS=your-password
   ```
3. `npm run dev` → open `http://localhost:5173`

> Data is saved to browser localStorage locally — no database needed.

## Deploy to Vercel

1. Push to GitHub and import the repo in [vercel.com](https://vercel.com).
2. Go to **Storage** → attach a **Postgres (Neon)** database.
3. Go to **Settings → Environment Variables** and add:

   | Variable | Value |
   |---|---|
   | `AUTH_USERNAME` | `admin` |
   | `AUTH_PASSWORD` | your password |
   | `AUTH_SECRET` | run `openssl rand -hex 32` |

4. Deploy.

**To change the password:** update `AUTH_PASSWORD` in Vercel env vars and redeploy.
