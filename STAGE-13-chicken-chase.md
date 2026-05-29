# Last Call — Stage 13: Chicken Chase 🐔 + "is this you?" join

This one has a few database changes (new columns + one new table). Still quick.

**Time: ~2 minutes.**

---

## The step

Supabase → **SQL Editor** → **New query** → paste the whole block → **Run**:

```sql
-- people: flock membership + claim flag
alter table people add column if not exists flock uuid;
alter table people add column if not exists flock_joined_at timestamptz;
alter table people add column if not exists claimed boolean default true;

-- finds: who reported finding which chicken
create table if not exists finds (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references events(id) on delete cascade,
  finder_id     uuid references people(id) on delete cascade,
  finder_name   text not null,
  chicken_id    uuid references people(id) on delete cascade,
  chicken_name  text not null,
  status        text not null default 'pending',
  created_at    timestamptz not null default now()
);

alter table finds enable row level security;
create policy "open finds" on finds for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table finds;
```

> Note: existing people will get `claimed = true` by default, which is correct — only *newly host-created* people (added after this update) will be claimable, which is what we want.

"Success" = done. The realtime line on `finds` matters — without it the found→confirm handshake won't update live.

---

## How Chicken Chase works

It's a **mode** — drinking still tracks normally underneath, so you always have the regular leaderboard too.

1. **Host starts it** from the Leaderboard tab → "🐔 Start a Chicken Chase" → pick 1–4 people to be chickens. (Optional toggle: count flock drinks "all night" vs "after joining" — default is after joining.)
2. **Chickens** get pinned to the top of everyone's leaderboard with a CHICKEN label. Their chat messages and photos are visible to everyone (the clues).
3. **Hunters** see each chicken on the Leaderboard tab with an "🙌 I found them!" button.
4. When a hunter taps it, the **chicken gets a confirm panel** ("People who found you") that stays visible until they act — so a missed notification isn't a problem. They tap "Found me" to confirm.
5. Confirmed hunters **join that chicken's flock** and keep drinking. Their drinks now count toward the flock.
6. **Most-drinking flock wins** — shown live on the Leaderboard and in the end-of-night recap.

### Bar crawl list
In a chase, the host can add a list of bars (one per line). Everyone gets a **private** checklist to tick off bars they've hit — nobody else sees your check-offs.

---

## "Is this you?" join merge (all events)
If the host pre-adds someone (say "Joel") and Joel later joins on his own phone with the same name, he'll get a popup: *"The host already added a 'Joel' — is this you?"* He can claim that spot (so his drinks line up) or join as a new person. No more accidental duplicates.

---

## Uploading
Replace `src` files, commit/push, run the SQL block above.
