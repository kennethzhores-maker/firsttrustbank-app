The Vercel URL currently returns a Vercel `404 NOT_FOUND` response from my check, so the first issue is deployment/routing availability rather than the login code itself.

What to check now:

1. Confirm the exact live URL
   - Open Vercel dashboard → your project → Domains.
   - Make sure the production domain is exactly `https://nova-finance-hub.vercel.app`.
   - If Vercel shows a different domain, use that one.

2. Check Vercel deployment status
   - Go to Vercel → Project → Deployments.
   - The latest deployment must say `Ready`.
   - If it says `Error`, `Canceled`, or points to an old commit, redeploy the latest GitHub commit.

3. Confirm GitHub received the latest Lovable edits
   - The fix needs the current `src/hooks/useAuth.tsx` code where `setLoading(false)` happens immediately after session detection.
   - If Vercel is connected to GitHub but has not redeployed after that commit, the live app will still run the old spinner bug.

4. Check the failed login in Vercel browser console
   - On the Vercel app, open DevTools → Console and Network.
   - Try a user login.
   - Look for failed requests to Supabase, especially `/auth/v1/token` or `/rest/v1/users`.
   - If you paste those red errors here, I can identify the exact cause.

Most likely causes based on what we know:
- Vercel is serving a missing/incorrect deployment right now, because the root URL returns `404 NOT_FOUND`.
- Or Vercel is still on an older build that does not include the user-loading fix.
- Less likely: Supabase URL config/domain settings, because admin works and Lovable user login works.

If you want me to continue, send a screenshot of your Vercel Deployments page or the Console/Network error from the Vercel login attempt.