# Last Call — Stage 9: The big restructure (one column)

This is the large update: five-tab layout (Board · Stats · ＋ · Feed · Chat), the center ＋ button that rolls up an add sheet, star/follow people, milestone banners, the Wade Boggs Easter egg, and a shot call that can say *where*. Only one tiny database change is needed (for the shot-call location).

**Time: ~1 minute.**

---

## The one step

Supabase → **SQL Editor** → **New query** → paste → **Run**:

```sql
alter table shot_calls add column if not exists note text;
alter table reactions add column if not exists target text;
```

"Success" = done. If you haven't created the `shot_calls` or `reactions` tables yet (Stages 5 and 7), run those first.

> The `target` column lets reactions attach to feed items (drinks, milestones, shot calls), not just chat messages.

---

## What's new, at a glance

- **Five tabs.** Bottom bar is now: 🏆 Board · 📊 Stats · ➕ (center) · 📣 Feed · 💬 Chat.
- **Center ＋** opens a roll-up sheet to log drinks with big tap targets and live feedback (your count + BAC update instantly). Vomit and the shot call live in here too.
- **Stats tab** is everyone's detailed cards — you're pinned first, then anyone you've starred, then by drink count.
- **Star/follow** — tap the ☆ next to anyone on the Board to pin them to the top of your Stats view. It's personal to your phone; it doesn't change the actual leaderboard ranking.
- **Milestone banners** — slide in at the top for ~5 seconds when someone hits every 5th/10th drink, crosses the legal limit, etc. Tap one to jump to that person's stats. They don't cover the screen and fade on their own.
- **🍺 The Boggs.** When the *group's* total hits 107 beers, something special happens. That's all I'll say.
- **Shot call → with a location.** When you call shots from the ＋ sheet, you can add an optional "where?" (e.g. "back bar, now!") that shows on everyone's takeover screen.

## Teams (unchanged, still working)
Pick your team on the **Stats** tab; hosts reassign anyone from their card on Stats; standings show on the **Board**; the end-of-night recap now shows a winning-team slide *and* a full team-standings slide, and the post-night detail page lists team standings too.

---

## Uploading
Replace your `src` files, commit/push, Vercel rebuilds. Run the one SQL line above once.
