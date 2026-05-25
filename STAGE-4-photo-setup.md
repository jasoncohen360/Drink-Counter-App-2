# Last Call — Stage 4: Two quick database add-ons

The new version adds **photos in chat**, which needs two small one-time things in Supabase. Everything else in this update works without any setup — just upload the new code. Do this part only if you want photo sharing to work.

**Time: ~5 minutes.**

---

## Add-on 1 — a column for photo links (~2 min)

1. In Supabase → **SQL Editor** → **New query**.
2. Paste this and click **Run**:

```sql
alter table chat add column if not exists image_url text;
```

That's it — "Success" means done. (If you skip this, photo posts will error but text chat still works.)

---

## Add-on 2 — a place to store the photos (~3 min)

1. In Supabase, left sidebar → **Storage**.
2. Click **New bucket**.
3. Name it exactly: `chat-photos`
4. Toggle **Public bucket** to **ON** (so photos can show in the chat).
5. Click **Save** / **Create**.

Then allow uploads (paste in SQL Editor and Run):

```sql
-- let anyone with the app upload + view chat photos (friends-level, matches the rest)
create policy "chat photos upload" on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'chat-photos');
create policy "chat photos read" on storage.objects for select
  to anon, authenticated using (bucket_id = 'chat-photos');
```

> If it says a policy already exists, that's fine — it means you ran it before.

---

## That's the setup

Now upload the new code (same GitHub way as before — see below), and photos will work. If you ever see "Photo upload failed" in the app, it means one of these two add-ons didn't take — come back and we'll check which.

---

## Uploading the updated code

Same as Stage 3, but now you're **replacing** files in your existing GitHub repo:

**Easiest (GitHub Desktop app):**
1. Replace the files in your local `last-call` folder with the new ones I gave you (overwrite when asked).
2. Open GitHub Desktop — it shows everything that changed.
3. Type a message like "big update" at bottom-left, click **Commit to main**, then **Push origin** (top).
4. Vercel notices automatically and rebuilds in ~1 minute. Refresh your live link.

**That's the whole update loop from now on:** change files → commit → push → Vercel auto-rebuilds. No re-setup ever again.
