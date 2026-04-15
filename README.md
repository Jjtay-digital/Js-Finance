# Jason's Family Finance Dashboard — Phase 2

## First time setup (one time only)

1. Open this folder in Cursor
2. Open Terminal in Cursor (View → Terminal)
3. Run: npm install
4. Run: npm run dev
5. Open http://localhost:3000

## Deploy to Vercel

1. Upload this folder to your GitHub finance-dashboard repo (replace all files)
2. Vercel auto-deploys in 30 seconds

## After deploying to Vercel

Add these environment variables in Vercel dashboard:
- Settings → Environment Variables
- NEXT_PUBLIC_SUPABASE_URL = https://ouaimdbjivmrbrespclg.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Also add your Vercel URL to Google OAuth:
- console.cloud.google.com → Credentials → Family Finance Web
- Add to Authorised JavaScript origins: https://js-finance-flax.vercel.app
- Add to Authorised redirect URIs: https://ouaimdbjivmrbrespclg.supabase.co/auth/v1/callback
