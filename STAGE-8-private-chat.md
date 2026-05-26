# Last Call — Stage 8: Private messages (one column)

This update adds private 1-on-1 chat, host team assignment, custom team names/emojis, bigger small text, a lighter tone, and an info button on the shot-call toggle. Only private chat needs a database change.

**Time: ~1 minute.**

---

## The one step

Supabase → **SQL Editor** → **New query** → paste → **Run**:

```sql
alter table chat add column if not exists to_person uuid;
```

"Success" = done.

---

## How private chat works

In the Chat tab there's now a **Group / Private** switch. Pick a person from the "Private message…" dropdown and you get a 1-on-1 thread — only the two of you see those messages.

**Honest note on "private":** this is friends-level private, not encrypted-secure. The messages are filtered so only you and the other person see them *in the app*, but like everything else, the data lives in the same open database — someone technical with your keys could read it. Fine for "don't show the group," not for actual secrets.

---

## Everything else needs no setup
- Host team assignment (My Drinks tab, tap a team chip under each person)
- Custom team names + emojis (Settings → Party extras)
- Bigger small fonts, lighter tone, shot-call info button — all just code.

Upload the `src` files, commit/push, run the one SQL line. Done.
