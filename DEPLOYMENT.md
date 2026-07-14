# ICEPRO — Deployment Guide

Frontend on **Vercel** (static CDN), backend on **Render** (Node server), database on
**MongoDB Atlas**. Free tiers throughout.

Do the steps in order. Each one needs a URL produced by the step before it — that dependency
is the reason CORS and email links are the classic things people get wrong.

---

## Why the app is split across two hosts

The React app compiles to static files that just need to be *handed* to a browser quickly —
that is a CDN's job. The Express API is a long-lived process holding a database connection and
doing real work per request — that is a server's job. Hosting both on one box optimises for
neither. This is also the answer if an interviewer asks why you split them.

---

## Known free-tier tradeoffs (accepted deliberately)

| Thing | Reality | Why it's OK here |
|---|---|---|
| Render sleeps after 15 min idle | First request then takes 30–60s to wake | Acceptable for a portfolio/low-traffic tool. Real traffic keeps it warm. |
| Render free = 512 MB RAM | Headless Chrome (PDFs) is memory-hungry | Mitigated by idle shutdown — see "PDF engine" below. **Verify after deploy.** |
| Atlas free = 512 MB storage | Plenty for this workload | — |
| Atlas needs an IP allowlist | Render has no fixed outbound IP on free tier | Allow `0.0.0.0/0` and rely on a strong DB password. A real tradeoff — know that you made it. |

---

## Step 1 — MongoDB Atlas

1. Create a free **M0** cluster.
2. **Database Access** → create a user with a long random password.
3. **Network Access** → allow `0.0.0.0/0` (see tradeoff above).
4. Copy the connection string. It becomes `MONGO_URI`.

---

## Step 2 — Push to GitHub

Push into the **same repository** as v1 — do not create a new one. The commit history showing
v1 evolve into v2 is itself a signal to anyone reviewing the repo.

Before pushing, confirm no secrets are committed:

```
git ls-files | grep -i env      # must show ONLY *.env.example files
```

---

## Step 3 — Backend on Render

Create a new **Web Service** from the repo.

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

> **Root Directory MUST be `backend`.** Puppeteer only picks up `.puppeteerrc.cjs` if the
> install runs with the backend folder as its working directory. Build from the repo root
> instead and Chrome lands in the wrong place — PDFs then fail at runtime with
> "Could not find Chrome", even though the build looked fine.

Then set the environment variables. **`backend/.env.example` is the authoritative checklist** —
every variable there marked `[PROD]` must be filled in. The ones that break things silently:

- **`NODE_ENV=production`** — switches the refresh cookie to `secure` + `sameSite=none`. Without
  it, login appears to work and then users are logged out on refresh. Looks like a JWT bug; isn't.
- **`FRONTEND_ORIGIN`** — the Vercel URL. Without it, CORS blocks every API call.
- **`FRONTEND_URL`** — the Vercel URL. Without it, verification emails link to `localhost:3000`
  and every new user gets a dead link.
- **`BREVO_API_KEY` + `EMAIL_FROM`** — email goes out over Brevo's HTTP API. **Do not try to
  use Gmail/SMTP here: Render blocks outbound SMTP ports.** Gmail failed with `ETIMEDOUT,
  command: 'CONN'` — the TCP connection never opened, so no credential was ever sent and no
  Gmail setting could fix it. Brevo rides HTTPS on 443, the same port the API already uses.
  `EMAIL_FROM` must be an address **verified as a sender** inside Brevo, or it rejects the send.

You do not have `FRONTEND_ORIGIN` / `FRONTEND_URL` yet — Vercel doesn't exist until Step 4.
Leave them for now and come back in Step 5. Do **not** set `PORT` (Render injects it) and leave
`PUPPETEER_CACHE_DIR` blank (`.puppeteerrc.cjs` handles it).

Confirm the API is up: `https://<your-service>.onrender.com/api/health`

---

## Step 4 — Frontend on Vercel

Import the same repo. The root `vercel.json` already sets the build command, output directory,
and the SPA rewrite — no manual build config needed.

Set one environment variable (Settings → Environment Variables):

- **`REACT_APP_API_URL`** = your Render origin, e.g. `https://icepro-api.onrender.com`
  (origin only — no trailing `/api`, no trailing slash)
- `REACT_APP_GOOGLE_CLIENT_ID` if you use Google sign-in.

> The `proxy` field in `frontend/package.json` only works in local dev. A production build has
> no proxy, so without `REACT_APP_API_URL` the deployed site asks *Vercel* for `/api/...` and
> gets a 404 on every request: the UI loads, then nothing works.

---

## Step 5 — Close the loop

1. On **Render**, set `FRONTEND_ORIGIN` and `FRONTEND_URL` to the live Vercel URL. Redeploy.
2. In the **Google Cloud console**, add the Vercel URL to *Authorized JavaScript origins*, or
   Google sign-in is rejected from the live site.

---

## Step 6 — Verify (do not skip)

**Sign up a brand-new user with a real email address.** That single flow exercises CORS, the
cross-site cookie, the email link, the SPA rewrite, and the database at once. If signup →
verify email → login → stay logged in after a refresh works, the deployment is sound.

Then test separately:

- **Generate a PDF** (Print Bill). This is the most likely thing to fail. Watch Render's
  **Metrics → Memory** tab while it runs.
- **Reload a deep link** directly, e.g. `https://<app>.vercel.app/reset-password/abc123`. It must
  render the app, not a 404. (That is what the `vercel.json` rewrite is for.)

---

## PDF engine on 512 MB — what to watch

PDFs are rendered server-side by Puppeteer (headless Chrome). Chrome is heavy, and Render's free
tier caps you at 512 MB **for the whole service**. If Chrome pushes past that, Render kills the
entire process — the API goes down, not just the PDF request.

Two mitigations are already in the code:

- `.puppeteerrc.cjs` keeps Chrome inside the project so it survives build → runtime.
- `pdf.service.js` **shuts Chrome down after idle** (`PDF_BROWSER_IDLE_MINUTES`, default 5) so it
  is not holding memory between invoices. The next PDF relaunches it, costing ~1–2s.

**If PDFs still OOM the service**, in order of preference:

1. Lower `PDF_BROWSER_IDLE_MINUTES` (e.g. `1`) so Chrome is resident less often. Cheapest fix.
2. Upgrade to Render's paid tier for more RAM. Correct answer if this is a real billing tool.
3. Move PDF generation to the browser (client-side). Biggest change; removes Chrome from the
   backend entirely. Only worth doing once you have evidence 1 and 2 are not viable.

---

## Interview notes

Worth being able to explain — these are real things you hit, and most candidates who only ever
ran on localhost have not:

- **Why split frontend and backend.** Static assets want a CDN; a stateful API wants a server.
- **The cold start.** "Render's free tier spins the container down after 15 minutes idle. It's a
  deliberate cost tradeoff for a portfolio deployment; production would keep a warm instance."
  That reframes a 40-second wait from an embarrassment into a decision.
- **Cross-site cookies.** Splitting the origins broke auth, because a cookie sent from a different
  site is dropped unless it is `SameSite=None; Secure` — which also forces HTTPS.
- **CI treating warnings as errors.** CRA fails the build on any lint warning when `CI` is set,
  which is why the deploy failed before the warnings were cleaned up.
- **Build-vs-runtime filesystem.** Puppeteer's Chrome download vanished between Render's build and
  run steps because it defaulted to `$HOME`, which is not carried across.
