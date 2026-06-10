# Poster Creator Suite

A Vercel-ready poster creation app for local business social posts.

## Deploy to Vercel

1. Upload this folder to GitHub.
2. Import the repository in Vercel.
3. Add one environment variable:

```text
GEMINI_API_KEY=your_google_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
IMAGE_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_workers_ai_token
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=https://your-vercel-domain.vercel.app/api/google-callback
```

4. Deploy.

The app uses browser storage for profiles and gallery history, so it does not need PostgreSQL, Render, Replit Auth, or migrations.

Google Business Profile posting requires your Google Cloud OAuth app to have access to the Google Business Profile APIs and the `https://www.googleapis.com/auth/business.manage` scope.

For direct image posting, create/connect a Vercel Blob store in your Vercel project. New Vercel Blob projects may use OIDC and show `BLOB_STORE_ID` instead of a visible read-write token.
