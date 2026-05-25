# Last Call — Stage 5: Suggestions box (one quick step)

This update adds: removing past events, and a "Suggest a feature" box in Settings. Removing events needs no setup. The suggestion box needs **one small table** so ideas have somewhere to land.

**Time: ~3 minutes.**

---

## Step 1 — Add the suggestions table

In Supabase → **SQL Editor** → **New query** (blank box) → paste this → **Run**:

```sql
create table if not exists suggestions (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid,
  name       text,
  text       text not null,
  created_at timestamptz not null default now()
);

alter table suggestions enable row level security;

create policy "anyone can suggest" on suggestions for insert to anon, authenticated with check (true);
create policy "anyone can read suggestions" on suggestions for select to anon, authenticated using (true);
```

"Success" means done.

---

## Step 1b — Add the shot-call table (for the 🥃 Call Shots feature)

Same thing — **New query**, paste, **Run**:

```sql
create table if not exists shot_calls (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references events(id) on delete cascade,
  person_id  uuid references people(id) on delete set null,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table shot_calls enable row level security;
create policy "open shot calls" on shot_calls for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table shot_calls;
```

This one needs the realtime line (last line) so the shot blast reaches everyone's phones instantly. If it says "already member of publication," that's fine.

---

## Step 2 — Make yourself the developer (so you can read suggestions in the app)

So that *you* (and only you) can see submitted suggestions inside the app:

1. Open the code file `src/App.jsx`.
2. Near the top of the "SUGGESTION BOX" section there's a line:
   ```js
   const DEVELOPER_PHONE = "PUT_YOUR_PHONE_HERE";
   ```
3. Replace `PUT_YOUR_PHONE_HERE` with **your phone number, typed exactly the way you enter it on the welcome screen** (same spacing/format — if you type `5551234567` on the welcome screen, put `5551234567` here; if you type `555-123-4567`, match that).
4. Save the file (it'll get uploaded with the rest).

Now, when you're signed in with that phone number, Settings shows a **"View all suggestions (developer)"** link that nobody else sees. Tap it to read everything people have submitted.

> **Don't have it set / forget?** No harm — suggestions still save. You can always read them directly in Supabase: left sidebar → **Table Editor** → `suggestions` table. The in-app view is just the convenient version.

---

## Uploading

Same as always: replace your `src` files (and this is one where `App.jsx` changed), commit/push in GitHub, Vercel rebuilds. The suggestions table only needs to be created once.

---

## Quick reality check on "seeing suggestions as they come in"

Honest note: this shows you suggestions when you *open* the developer view — it doesn't text or email you when one arrives (that needs server stuff we don't have). So it's "check when you feel like it," either in-app or in the Supabase table. For a friends' app that's plenty; if you ever wanted real notifications, that's a bigger future project.
