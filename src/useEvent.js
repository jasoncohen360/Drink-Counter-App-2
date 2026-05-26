import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient.js";

// ============================================================
// DATA LAYER
// Everything that talks to the database lives here. The UI
// calls these functions and reads `data`; it never touches
// Supabase directly. This keeps the app code clean and means
// if we ever change backends, only this file changes.
// ============================================================

// ---- one-time helpers (event creation / joining) ----------

function randomCode() {
  // 5-char alphanumeric, avoiding ambiguous chars (no O/0/I/1)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// Create a brand-new event. Returns { eventId, joinCode } or throws.
export async function createEvent({ eventName, hostName, size, sex, weightLb, settings, hostPhone }) {
  // try a few times in case of a code collision (rare)
  for (let attempt = 0; attempt < 5; attempt++) {
    const join_code = randomCode();
    const { data: ev, error } = await supabase
      .from("events")
      .insert({ name: eventName || "The Party", join_code, host_phone: hostPhone || "", settings: settings || {} })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") continue; // unique violation on join_code, retry
      throw error;
    }
    // add the host as the first person
    const { data: host, error: pErr } = await supabase
      .from("people")
      .insert({
        event_id: ev.id, name: hostName || "Host", phone: hostPhone || null,
        size: size || "medium", sex: sex || "male", weight_lb: weightLb || 170, role: "host",
      })
      .select()
      .single();
    if (pErr) throw pErr;
    return { eventId: ev.id, joinCode: ev.join_code, hostPersonId: host.id };
  }
  throw new Error("Could not generate a unique join code, please try again.");
}

// Find an event by its join code. Returns event row or null.
export async function findEventByCode(code) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("join_code", (code || "").toUpperCase().trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Join an existing event as a new person. Returns the person row.
export async function joinEvent({ eventId, name, size, sex, weightLb, phone, team }) {
  const { data, error } = await supabase
    .from("people")
    .insert({
      event_id: eventId, name: name || "Guest", phone: phone || null,
      size: size || "medium", sex: sex || "male", weight_lb: weightLb || 170, role: "guest", team: team || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Permanently delete an event and everything in it (host only, by choice).
export async function deleteEvent(eventId) {
  // cascade deletes people/drink_log/chat via the foreign keys set up in the schema
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

// Remove just MY participation in an event (so it leaves my history) without
// nuking the whole event for others. Deletes my person row from that event.
export async function leaveEventHistory(personId) {
  if (!personId) return;
  const { error } = await supabase.from("people").delete().eq("id", personId);
  if (error) throw error;
}

// ---- feature suggestions ----------------------------------
export async function postSuggestion({ eventId, name, text }) {
  const { error } = await supabase.from("suggestions").insert({ event_id: eventId || null, name: name || "anon", text });
  if (error) throw error;
}
export async function fetchSuggestions() {
  const { data, error } = await supabase.from("suggestions").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

// Look up which events a phone number has been part of (event history).
export async function eventsForPhone(phone) {
  if (!phone) return [];
  const { data, error } = await supabase
    .from("people")
    .select("id, event_id, role, events!inner(id, name, join_code, phase, created_at, ended_at)")
    .eq("phone", phone)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // de-dupe by event
  const seen = new Set();
  const out = [];
  for (const row of data || []) {
    if (seen.has(row.event_id)) continue;
    seen.add(row.event_id);
    out.push({ ...row.events, myRole: row.role, personId: row.id });
  }
  return out;
}

// Upload a chat photo to Supabase Storage, return its public URL.
export async function uploadChatPhoto(eventId, file) {
  const ext = (file.name || "photo.jpg").split(".").pop();
  const path = `${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from("chat-photos").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("chat-photos").getPublicUrl(path);
  return data.publicUrl;
}

// ---- the live hook ----------------------------------------
// Subscribes to one event and keeps people + drink_log + chat
// in sync across all connected devices. Returns the assembled
// state plus action functions.

export function useEvent(eventId) {
  const [event, setEvent] = useState(null);
  const [people, setPeople] = useState([]);
  const [logs, setLogs] = useState([]); // flat drink_log rows
  const [chat, setChat] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [shotCalls, setShotCalls] = useState([]);
  const [pendingLogs, setPendingLogs] = useState([]); // optimistic drinks shown instantly
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // initial load
  const reload = useCallback(async () => {
    if (!eventId) return;
    try {
      const [{ data: ev }, { data: ppl }, { data: dl }, { data: ch }, { data: sc }, { data: rx }] = await Promise.all([
        supabase.from("events").select("*").eq("id", eventId).single(),
        supabase.from("people").select("*").eq("event_id", eventId),
        supabase.from("drink_log").select("*").eq("event_id", eventId),
        supabase.from("chat").select("*").eq("event_id", eventId),
        supabase.from("shot_calls").select("*").eq("event_id", eventId),
        supabase.from("reactions").select("*").eq("event_id", eventId),
      ]);
      setEvent(ev || null);
      setPeople(ppl || []);
      setLogs(dl || []);
      setChat(ch || []);
      setShotCalls(sc || []);
      setReactions(rx || []);
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { reload(); }, [reload]);

  // When real logs arrive, drop optimistic entries that have now landed
  // (matched by person + type within a few seconds), and expire stale ones.
  useEffect(() => {
    if (pendingLogs.length === 0) return;
    const now = Date.now();
    setPendingLogs((pend) => pend.filter((pl) => {
      if (now - pl._localT > 8000) return false; // safety expire
      const landed = logs.some((l) => l.person_id === pl.person_id && l.type === pl.type && Math.abs(new Date(l.t).getTime() - pl._localT) < 8000);
      return !landed;
    }));
  }, [logs]);

  // realtime subscriptions — any change on any device refreshes the relevant slice
  useEffect(() => {
    if (!eventId) return;
    const ch = supabase
      .channel("event-" + eventId)
      .on("postgres_changes", { event: "*", schema: "public", table: "people", filter: `event_id=eq.${eventId}` },
        () => supabase.from("people").select("*").eq("event_id", eventId).then(({ data }) => data && setPeople(data)))
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_log", filter: `event_id=eq.${eventId}` },
        () => supabase.from("drink_log").select("*").eq("event_id", eventId).then(({ data }) => data && setLogs(data)))
      .on("postgres_changes", { event: "*", schema: "public", table: "chat", filter: `event_id=eq.${eventId}` },
        () => supabase.from("chat").select("*").eq("event_id", eventId).then(({ data }) => data && setChat(data)))
      .on("postgres_changes", { event: "*", schema: "public", table: "shot_calls", filter: `event_id=eq.${eventId}` },
        () => supabase.from("shot_calls").select("*").eq("event_id", eventId).then(({ data }) => data && setShotCalls(data)))
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions", filter: `event_id=eq.${eventId}` },
        () => supabase.from("reactions").select("*").eq("event_id", eventId).then(({ data }) => data && setReactions(data)))
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        () => supabase.from("events").select("*").eq("id", eventId).single().then(({ data }) => data && setEvent(data)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId]);

  // ---- assemble into the shape the UI expects ----
  // Each person gets a `log` array of { type, pour, t } sorted by time,
  // exactly like the artifact used, so the UI/engine code is unchanged.
  const assembledPeople = people.map((p) => {
    const realLogs = logs
      .filter((l) => l.person_id === p.id)
      .map((l) => ({ type: l.type, pour: l.pour, t: new Date(l.t).getTime(), _id: l.id }));
    const myPending = pendingLogs
      .filter((pl) => pl.person_id === p.id)
      .map((pl) => ({ type: pl.type, pour: pl.pour, t: pl._localT, _id: pl._id, _pending: true }));
    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      size: p.size,
      sex: p.sex,
      weightLb: p.weight_lb,
      role: p.role,
      team: p.team || null,
      log: [...realLogs, ...myPending].sort((a, b) => a.t - b.t),
    };
  });

  const assembledChat = chat
    .map((c) => {
      const myReactions = reactions.filter((r) => r.chat_id === c.id);
      const byEmoji = {};
      myReactions.forEach((r) => { (byEmoji[r.emoji] = byEmoji[r.emoji] || []).push(r.person_id); });
      return { id: c.id, name: c.name, text: c.text, imageUrl: c.image_url || null, personId: c.person_id, toPerson: c.to_person || null, t: new Date(c.created_at).getTime(), reactions: byEmoji };
    })
    .sort((a, b) => a.t - b.t);

  const assembledShotCalls = shotCalls
    .map((s) => ({ id: s.id, name: s.name, personId: s.person_id, note: s.note || null, t: new Date(s.created_at).getTime() }))
    .sort((a, b) => a.t - b.t);

  // ---- actions (optimistic-free; realtime brings the update back) ----
  const actions = {
    addDrink: async (personId, type) => {
      const localId = "pending_" + Math.random().toString(36).slice(2);
      setPendingLogs((pend) => [...pend, { _id: localId, _localT: Date.now(), person_id: personId, type, pour: "M" }]);
      await supabase.from("drink_log").insert({ person_id: personId, event_id: eventId, type, pour: "M" });
    },
    addVomit: async (personId) => {
      const localId = "pending_" + Math.random().toString(36).slice(2);
      setPendingLogs((pend) => [...pend, { _id: localId, _localT: Date.now(), person_id: personId, type: "vomit", pour: "M" }]);
      await supabase.from("drink_log").insert({ person_id: personId, event_id: eventId, type: "vomit", pour: "M" });
    },
    setPour: async (logId, pour) => {
      if (String(logId).startsWith("pending_")) return;
      await supabase.from("drink_log").update({ pour }).eq("id", logId);
    },
    setDrinkType: async (logId, type) => {
      if (String(logId).startsWith("pending_")) return;
      await supabase.from("drink_log").update({ type }).eq("id", logId);
    },
    deleteEntry: async (logId) => {
      if (String(logId).startsWith("pending_")) { setPendingLogs((pend) => pend.filter((p) => p._id !== logId)); return; }
      await supabase.from("drink_log").delete().eq("id", logId);
    },
    undoLast: async (personId) => {
      // if there's an unsent optimistic entry for this person, just drop the newest one
      const minePending = pendingLogs.filter((p) => p.person_id === personId);
      if (minePending.length > 0) {
        const newest = minePending.reduce((a, b) => (b._localT > a._localT ? b : a));
        setPendingLogs((pend) => pend.filter((p) => p._id !== newest._id));
        return;
      }
      const mine = logs.filter((l) => l.person_id === personId).sort((a, b) => new Date(b.t) - new Date(a.t));
      if (mine[0]) await supabase.from("drink_log").delete().eq("id", mine[0].id);
    },
    addPerson: async ({ name, size, sex, weightLb }) => {
      await supabase.from("people").insert({ event_id: eventId, name, size, sex, weight_lb: weightLb, role: "guest" });
    },
    updatePerson: async (personId, fields) => {
      const patch = {};
      if (fields.name != null) patch.name = fields.name;
      if (fields.size != null) patch.size = fields.size;
      if (fields.sex != null) patch.sex = fields.sex;
      if (fields.weightLb != null) patch.weight_lb = fields.weightLb;
      if (fields.team !== undefined) patch.team = fields.team;
      await supabase.from("people").update(patch).eq("id", personId);
    },
    setTeam: async (personId, team) => {
      await supabase.from("people").update({ team }).eq("id", personId);
    },
    removePerson: async (personId) => {
      await supabase.from("people").delete().eq("id", personId);
    },
    postChat: async (personId, name, text, imageUrl = null, toPerson = null) => {
      await supabase.from("chat").insert({ event_id: eventId, person_id: personId, name, text, image_url: imageUrl, to_person: toPerson });
    },
    callShots: async (personId, name, note = null) => {
      await supabase.from("shot_calls").insert({ event_id: eventId, person_id: personId, name, note });
    },
    deleteChat: async (chatId) => {
      await supabase.from("chat").delete().eq("id", chatId);
    },
    toggleReaction: async (chatId, personId, emoji, alreadyReacted) => {
      if (alreadyReacted) {
        await supabase.from("reactions").delete().eq("chat_id", chatId).eq("person_id", personId).eq("emoji", emoji);
      } else {
        await supabase.from("reactions").insert({ event_id: eventId, chat_id: chatId, person_id: personId, emoji });
      }
    },
    toggleFeedReaction: async (target, personId, emoji, alreadyReacted) => {
      if (alreadyReacted) {
        await supabase.from("reactions").delete().eq("target", target).eq("person_id", personId).eq("emoji", emoji);
      } else {
        await supabase.from("reactions").insert({ event_id: eventId, target, person_id: personId, emoji });
      }
    },
    saveSettings: async (settings) => {
      await supabase.from("events").update({ settings }).eq("id", eventId);
    },
    endNight: async () => {
      await supabase.from("events").update({ phase: "ended", ended_at: new Date().toISOString() }).eq("id", eventId);
    },
    reopen: async () => {
      await supabase.from("events").update({ phase: "live", ended_at: null }).eq("id", eventId);
    },
  };

  // feed reactions grouped by target id: { target: { emoji: [personIds] } }
  const feedReactions = {};
  reactions.forEach((r) => {
    if (!r.target) return;
    (feedReactions[r.target] = feedReactions[r.target] || {});
    (feedReactions[r.target][r.emoji] = feedReactions[r.target][r.emoji] || []).push(r.person_id);
  });

  return {
    loading,
    error,
    event,
    people: assembledPeople,
    chat: assembledChat,
    shotCalls: assembledShotCalls,
    feedReactions,
    settings: event?.settings || {},
    phase: event?.phase || "live",
    joinCode: event?.join_code || "",
    eventName: event?.name || "",
    reload,
    actions,
  };
}
