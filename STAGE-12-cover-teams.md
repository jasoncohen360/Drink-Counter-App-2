# Last Call — Stage 12: cover photo, create-time teams, pong (beta)

Most of this is code-only. One database column is needed for the optional cover photo.

**Time: ~1 minute.**

---

## The one step

Supabase → **SQL Editor** → **New query** → paste → **Run**:

```sql
alter table events add column if not exists cover_url text;
```

"Success" = done.

---

## What changed (no setup needed for these)
- **Cover photo (optional):** when creating an event, the host can add a banner photo. It shows behind the event name at the top of the leaderboard. Uses the same photo storage as everything else (the `chat-photos` bucket).
- **Individual vs Teams at creation:** the host now picks the format up front. Choosing **Teams** lets you set how many (2–4) and customize each team's name + emoji right there. Players still pick their own team when they join, and the host can reassign anyone anytime.
- **Beer Pong** toggle now labeled **(beta)** and stays off by default.
- **Drink alerts** confirmed on by default.

---

## Uploading
Replace `src` files, commit/push, run the one SQL line.
