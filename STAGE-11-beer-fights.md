# Last Call — Stage 11: Beer Fights ⚔️

A silly, optional mini-game. Off by default. The host turns it on in Settings → Party extras.

**Time: ~2 minutes.**

---

## The one step

Supabase → **SQL Editor** → **New query** → paste → **Run**:

```sql
create table if not exists fights (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid references events(id) on delete cascade,
  challenger_id    uuid references people(id) on delete set null,
  challenger_name  text not null,
  opponent_id      uuid references people(id) on delete set null,
  opponent_name    text not null,
  taunt            text,
  status           text not null default 'pending',
  challenger_taps  int,
  opponent_taps    int,
  winner_id        uuid,
  result_json      jsonb,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  ended_at         timestamptz
);

alter table fights enable row level security;
create policy "open fights" on fights for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table fights;
```

"Success" = done. The realtime line is important — without it, both phones won't see the fight unfold.

---

## How it works

1. **Host turns it on** in Settings → Party extras → ⚔️ Beer Fights.
2. From the **Stats tab**, every other person's card shows a small **⚔️ Fight** button next to their name.
3. Tap it → pick an optional taunt → send.
4. The opponent's phone gets a takeover: **"Bring it on"** or **"Not tonight"**. 30-second auto-expire if they don't respond.
5. Both phones do a 3-second countdown then a **5-second tap window**. Tap as fast as you can.
6. Winner is decided by tap count × sword stats (your drinks build your sword) × a little randomness.
7. Result shows on both phones, posts to the **Feed**, updates your night's **W-L record** on your stats card.

### What your drinks do

- **Beer:** steady length. The reliable workhorse.
- **Wine:** longer length, but **~15% chance to crack mid-fight** (weakens you, doesn't auto-lose).
- **Shot:** short length, but adds **crit chance** (chance of a big bonus hit).
- **Cocktails (and anything else):** baseline length, but **higher variance** — wider swing between worst and best.

### Fairness

Sword length is partly BAC-scaled — a small woman who's actually drunk competes fine with a big guy who barely drank. Choices still matter more than body size, but biology gets a small adjustment.

### Doesn't affect anything

Fights are purely for fun. No effect on the leaderboard, the Wrapped recap, or any stats outside the game itself.

---

## Uploading

Replace `src` files, commit/push, run the one SQL block.
