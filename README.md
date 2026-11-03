This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Local account login

The shared header supports username/password signup, login, and logout via `/api/auth`.
Passwords use salted scrypt hashes; random sessions are stored as SHA-256 hashes and
expire after seven days. Cookies are HttpOnly, SameSite=Lax, and Secure in production.
Account/session data is stored in `.data/accounts.json`, excluded from Git.
This storage supports one persistent Node process. For production, set `AUTH_DATA_DIR`
to a persistent writable directory; ephemeral/serverless or multi-instance deployment
requires replacing this store with a shared database. No account database is committed.
Passwords cannot currently be reset. Game points/items remain browser-local and are
not yet attached to an account or synchronized across devices.

### Football news (Google News RSS)

No account or API key is required. `/api/news` fetches Korean overseas-football
headlines from Google News RSS for the past seven days, cached for 15 minutes.
Cards show the publisher, feed publication time in Korea time, and a Google News
article link that leads to the publisher. No article body or images are copied.
GDELT was replaced because live requests repeatedly returned HTTP 429.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### AI headline-card summaries

Add `GEMINI_API_KEY` to `.env.local` and restart the dev server. Optionally set
`GEMINI_MODEL` (default: `gemini-3.5-flash-lite`), choosing a model with URL context support.
Never use a NEXT_PUBLIC variable for this key. The server sends only current feed
article URLs/titles to Gemini URL Context. Missing retrieval or inaccessible article
bodies produce an unavailable message rather than a title-only summary.
Only the featured article on each page requests a summary. Successful summaries
are cached in process memory for 24 hours, failed attempts for one minute, with
concurrent requests deduplicated. This cache resets on server restart and is not
shared between deployed instances. Free quota and URL accessibility depend on
Google/model/account; verify your plan before enabling billing.
Docs: https://ai.google.dev/gemini-api/docs/url-context
