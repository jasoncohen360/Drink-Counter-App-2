# Last Call — Stage 3: Get It Live

You've got the backend (Stage 1) and I've built the app (Stage 2). This stage puts it on the internet at a real link. **No coding — just following clicks.** Budget a calm hour; don't rush.

You'll do three things: (A) put your two keys into the app, (B) upload the app to GitHub, (C) connect it to Vercel, which gives you the live link.

---

## Part A — Put your keys in (~5 min)

Remember the two things you saved at the end of Stage 1: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. We'll give them to Vercel later (the clean way), so **you don't actually have to edit any files** — skip ahead to Part B. (If you'd rather hard-code them, open `src/supabaseClient.js` and replace the two `PASTE_...` placeholders, but the Vercel way below is cleaner and safer.)

---

## Part B — Upload to GitHub (~20 min)

GitHub is where your code lives so Vercel can read it. Think of it as Google Drive for code.

1. Go to **https://github.com** and make a free account (if you don't have one).
2. Click the **+** (top right) → **New repository**.
3. Name it `last-call`. Leave everything else default. Click **Create repository**.
4. On the next page you'll see options. The easiest path for a non-coder:
   - Click **uploading an existing file** (it's a link in the middle of the page).
   - Drag in **all the files I gave you** — the whole `last-call` folder contents: `index.html`, `package.json`, `vite.config.js`, and the `src` folder with everything in it. **Keep the folder structure** — `src` files must stay inside a `src` folder.
   - Scroll down, click **Commit changes**.

> **If drag-and-drop is fussy about folders:** GitHub's web uploader can be finicky with subfolders. If `src` won't upload as a folder, tell me and I'll give you an alternative (a single zip, or the GitHub Desktop app which is more forgiving). Don't fight it for more than a few minutes.

---

## Part C — Deploy on Vercel (~20 min)

Vercel reads your GitHub code and turns it into a live website.

1. Go to **https://vercel.com** → **Sign up** → choose **Continue with GitHub** (this links them automatically).
2. Once in, click **Add New… → Project**.
3. You'll see your `last-call` repository in a list. Click **Import** next to it.
4. **Before clicking Deploy**, find the **Environment Variables** section (you may need to expand it). Add these two — this is where your Stage 1 keys go:
   - Name: `VITE_SUPABASE_URL` → Value: *(paste your Supabase URL)*
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: *(paste your anon key)*
   - Click **Add** after each.
5. Click **Deploy**.
6. Wait ~1–2 minutes. You'll see build logs scroll. When it's done you'll see **"Congratulations"** and a screenshot of your app.
7. Click **Continue to Dashboard**, then **Visit** — that opens your live app. The link looks like `https://last-call-xxxx.vercel.app`. **That's your shareable link.** It works for anyone, on any phone.

---

## Part D — Test it for real (~10 min)

This is the moment we find out the live-sync works (the one thing I couldn't test while building).

1. On **your phone**, open the Vercel link. Enter your phone number + name, **Host a new party**, name it "Test."
2. You'll land in the live screen. Tap **📷 Share** — note the 5-letter code.
3. On a **second device** (a friend's phone, or your computer browser), open the same link. Enter a different name, **Join with a code**, type the code.
4. Now the test: on phone #1, log a drink. **Within a few seconds it should appear on phone #2's leaderboard and feed**, and vice versa. Post a chat message from one — it should show on the other.

If that works: **you're done. It's real, it's live, friends can join.** 🎉

If it *doesn't* sync (drinks only show on the phone that logged them): that's the one failure mode I flagged. Come back and tell me exactly what you saw, and I'll debug it with you — it's almost always one specific Supabase setting (realtime not enabled on a table) that's a 30-second fix.

---

## Things worth knowing

- **Updating the app later:** once it's on GitHub + Vercel, any change I give you, you upload to GitHub the same way, and Vercel rebuilds automatically in ~1 minute. No re-setup.
- **The link is permanent** as long as you keep the Vercel project. Free tier is fine for this.
- **A nicer link** (like `lastcall.party`) is optional — buy a domain (~$12/yr) and Vercel walks you through connecting it. Totally skippable.
- **Security reminder:** this is friends-level, not bank-level. Anyone with a join code can see/edit that event. Fine for parties; noted if it ever needs more.

---

## Checklist
- [ ] Part B: code uploaded to GitHub
- [ ] Part C: deployed on Vercel with the two environment variables
- [ ] Got my live link
- [ ] Part D: tested two devices, drinks sync between them

When two-device sync works, that's the whole thing — live, real, multiplayer. Tell me how the test goes.
