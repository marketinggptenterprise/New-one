# Poster Creator Suite

A Vercel-ready poster creation app for local business social posts.

## Deploy to Vercel

1. Upload this folder to GitHub.
2. Import the repository in Vercel.
3. Add one environment variable:

```text
GEMINI_API_KEY=your_google_gemini_api_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=https://your-vercel-domain.vercel.app/api/google-callback
```

4. Deploy.

The app uses browser storage for profiles and gallery history, so it does not need PostgreSQL, Render, Replit Auth, or migrations.

Google Business Profile posting requires your Google Cloud OAuth app to have access to the Google Business Profile APIs and the `https://www.googleapis.com/auth/business.manage` scope.
