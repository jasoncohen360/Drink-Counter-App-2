# Last Call — Stage 6: One column for Teams

This update adds Teams, a join walkthrough, direct-join links, auto-end after 24h, drink alerts, and a size info button. Only **one** of these needs a database change — the teams feature needs a place to store which team each person is on.

**Time: ~1 minute.**

---

## The one step

Supabase → **SQL Editor** → **New query** (blank box) → paste → **Run**:

```sql
alter table people add column if not exists team text;
```

"Success" means done. That's the only setup for this whole update.

---

## What needs nothing

- **Auto-end after 24h** — built into the app, no setup.
- **Walkthrough popup** — shows once per device automatically.
- **Direct-join links** — your invite link now looks like `yoursite.com?code=ABC12` and drops people straight onto the join screen. The Invite button already copies this.
- **Drink alerts** — host toggles in Settings → Party extras (off by default). In-app banners only (see note below).
- **Size info button** — the ⓘ next to Size on the join/create screens.

---

## Honest note on "notifications"

The drink alerts are **in-app only** — a banner pops up while someone has the app open. They are **not** phone push notifications (the kind that buzz you when the app is closed). Real push needs a native app or heavy web-push setup that this kind of web app can't do reliably, especially on iPhones. If that ever becomes a must-have, it's a separate, bigger project (going native). For a party where people have the app open, in-app alerts do the job.

---

## Uploading

Same as always: replace your `src` files, commit/push, Vercel rebuilds. Run the one SQL line above once.
