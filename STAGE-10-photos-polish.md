# Last Call — Stage 10: BAC tweak, shot polish, drink photos

Most of this update is code-only. One database column is needed for the optional empty-glass photo.

**Time: ~1 minute.**

---

## The one step

Supabase → **SQL Editor** → **New query** → paste → **Run**:

```sql
alter table drink_log add column if not exists image_url text;
```

"Success" = done.

---

## Photo storage — your questions answered

**How many photos can I store free?** Supabase's free tier gives you **1 GB of file storage**. Phone photos are roughly 1.5–3 MB each, so that's very roughly **400–600 photos** before you'd hit the limit. For a party or three, you're nowhere near it. If you ever ran big recurring events you'd want a paid tier or auto-cleanup.

**Can it auto-delete after a month?** Not automatically out of the box — Supabase doesn't expire files on a timer by itself. But there are two clean options:
1. **Manual:** every so often, empty the `chat-photos` bucket in the Supabase dashboard (one click).
2. **Automatic:** Supabase supports scheduled jobs (pg_cron) that could delete files older than 30 days. It's a bit of setup; if you want it, I can write you the exact SQL/cron later. For now, manual cleanup is simplest and free.

---

## What changed (no setup needed for these)
- **BAC starts ~halfway** when you log a drink (since you log it *finished*, it's already partly absorbed), then keeps rising a bit before falling. More realistic.
- **Shot call:** the caller now sees the takeover with the live "who's in" tally and is auto-counted in (no "I'm in" tap for the caller). Others still get "I'm in / Nah, I'm good."
- **You (developer phone) get unlimited shot calls.**
- **You no longer get notifications for your own actions.**
- **Snazzier graphic** when you log a drink.
- **Optional empty-glass photo:** after you tap a drink, a little "Add pic" prompt appears. Totally optional — logging is still one tap. The photo shows as a thumbnail in the feed.

---

## Uploading
Replace `src` files, commit/push, run the one SQL line.
