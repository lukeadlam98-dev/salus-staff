# Salus Staff — Production Build

Internal team app for Salus House. Connects to your Supabase project for real shared data and real email logins.

---

## What's in this folder

```
salus-staff/
├── src/
│   ├── App.jsx            (the whole app — UI + Supabase wiring)
│   ├── main.jsx           (React entry point)
│   ├── index.css          (base styles)
│   └── lib/
│       ├── supabase.js    (Supabase client init)
│       └── transformers.js (snake_case ↔ camelCase helpers)
├── index.html
├── package.json
├── vite.config.js
├── .env.example           (template for your Supabase credentials)
├── .gitignore
└── README.md              (this file)
```

---

## Deployment — Session 2

You're going to do the following, with my guidance:

1. Push this folder to GitHub
2. Connect Vercel to that GitHub repo
3. Add your Supabase credentials as environment variables in Vercel
4. Vercel auto-deploys — your real app goes live
5. Test signing in with your manager account

### Step 1 — Push to GitHub

If you've done this before with the prototype, the process is identical. If not, here's the short version:

1. Go to github.com → click **+ New repository**
2. Name it `salus-staff` (or anything you like). Keep it **Private**.
3. Don't tick "add a README" — we already have one
4. Click **Create repository**
5. On the next page, click **uploading an existing file**
6. Drag the entire contents of this folder (everything *inside* `salus-app/`, not the folder itself) into the browser
7. Wait for upload, then click **Commit changes**

⚠️ Make sure you do NOT include `.env.local` if you've created one — `.gitignore` should prevent this, but double-check.

### Step 2 — Connect Vercel to the repo

1. Go to vercel.com → log in (with GitHub if you set that up before)
2. Click **Add New** → **Project**
3. Pick the `salus-staff` repo from the list, click **Import**
4. Vercel auto-detects it's a Vite project. Don't change any settings yet.
5. **Important**: BEFORE clicking Deploy, expand the **Environment Variables** section

### Step 3 — Add your Supabase environment variables

In the Environment Variables section:

Add the first variable:
- **Key:** `VITE_SUPABASE_URL`
- **Value:** your Project URL from your Supabase notes (e.g. `https://abcxyz1234.supabase.co`)

Click **Add**.

Add the second variable:
- **Key:** `VITE_SUPABASE_ANON_KEY`
- **Value:** your anon public key from your Supabase notes (the very long string)

Click **Add**.

Both variables should show in the list. Now click the big **Deploy** button.

### Step 4 — Wait for deployment

Vercel will build and deploy. Takes ~1-2 minutes. You'll see a build log streaming.

When done, you'll get a vercel.app URL like `salus-staff-xyz.vercel.app`. Click it.

### Step 5 — Sign in for the first time

You should see the Salus Staff login screen.

Enter:
- **Email:** the one you used when creating your Supabase auth account in Session 1
- **Password:** the one you set in Session 1

Tick the T&Cs box. Click **Sign in**.

You should land on the Timetable tab as the manager. It'll be empty (no classes yet) — that's expected. We haven't seeded the timetable data yet.

---

## Adding more users (manager-only, for now)

Until we build a proper Team Management UI, you add coaches manually via Supabase:

### Add a coach

1. Go to your Supabase dashboard → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter their email + a temporary password (e.g. `Coach2026!`)
4. Tick **Auto Confirm User**
5. Click **Create user**
6. Click into their row to find their UUID — copy it.

### Create their profile

1. Go to **SQL Editor** → **+ New query**
2. Paste this, filling in their details:

```sql
INSERT INTO profiles (id, name, role, coach_type, color, initials, email_prefs)
VALUES (
  'PASTE-THEIR-UID-HERE',
  'Their Name',
  'coach',
  'permanent',                 -- or 'cover' for a cover coach
  '#b85c38',                   -- pick any hex colour
  'TN',                        -- their initials
  '{"assignedCover":true,"coverPosted":false,"classReminder24h":true,"weeklySummary":false}'::jsonb
);
```

For a **cover coach** with qualifications:

```sql
INSERT INTO profiles (id, name, role, coach_type, color, initials, email_prefs, qualifications)
VALUES (
  'PASTE-THEIR-UID-HERE',
  'Their Name',
  'coach',
  'cover',
  '#7a8c8c',
  'TN',
  '{"assignedCover":true,"coverPosted":true,"classReminder24h":true,"notSelected":false,"weeklyOpportunities":false}'::jsonb,
  ARRAY['Salus Reformer', 'Reformer Beginner']
);
```

3. Click **Run**. Send them their email + temp password. They can sign in and use the app.

---

## Common colours for coaches

Pick from these to match the existing palette:
- `#b85c38` (terracotta)
- `#7a8c5c` (sage green)
- `#5b7a8c` (slate blue)
- `#c89c4a` (mustard)
- `#4a6b3a` (forest)
- `#8c5b7a` (mauve)
- `#a8703a` (russet)
- `#6b7a8c` (dusty blue)
- `#8c4a5c` (claret)
- `#c8442a` (red-orange)
- `#7a6b8c` (purple-grey)
- `#8c8c4a` (olive)

---

## Custom domain — Session 3 (later)

Once Phase 2 is working at the vercel.app URL, you'll point `staff.salus.house` at it.

In Vercel:
1. Go to your project → **Settings** → **Domains**
2. Click **Add** → enter `staff.salus.house`
3. Vercel gives you a CNAME record to add to your DNS

In whatever manages salus.house DNS (Webflow / GoDaddy / wherever):
1. Add a CNAME record: `staff` → `cname.vercel-dns.com`
2. Wait 5-15 minutes for DNS to propagate
3. Vercel will show **Valid Configuration** when ready

---

## Email notifications — Session 4 (later)

To make real emails fire when cover requests are posted, etc., you'll need:
1. A free Resend account
2. A Supabase Edge Function that sends emails on database triggers
3. To verify `salus.house` as a sender domain in Resend

This is a separate session. The app works fine without it — just no automatic emails.

---

## Running locally for development

If you ever want to run this on your own machine to test changes:

```bash
# 1. Install dependencies
npm install

# 2. Create a local env file
cp .env.example .env.local

# 3. Edit .env.local with your real Supabase values

# 4. Run the dev server
npm run dev
```

You'll see it running at `http://localhost:5173`.

---

## Help

If anything looks wrong, send a screenshot and I'll guide you through it. The most likely things to go wrong are:

- **Environment variables typo'd** → app loads but immediately errors. Fix: re-check the values in Vercel match your Supabase exactly.
- **Trying to sign in with wrong password** → Supabase will say "Invalid login credentials". Use your manager password from Session 1.
- **Empty app after sign-in** → that's normal! No classes yet. We add them in Session 3 or via the in-app UI.
