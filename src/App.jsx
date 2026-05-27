import React, { useState, useEffect, useRef } from "react";
import {
  DRINKS, DRINK_EMOJIS, SIZES, SIZES_BY_SEX, weightFor, POUR, DEFAULT_POUR, STATES, THEMES, defaultSettings,
  getDrinks, getSizes, getTheme, getLegalLimit, bacDescriptor, bacAtTime, drinkCountAtTime,
  peakBAC, drinksPerHour, bacRatePerHour, favoriteDrink, bestStretchOverall, valueAt, LINE_COLORS, TEAM_DEFS, teamStats, teamList, teamMeta, BOGGS_NUMBER, swordStats, resolveFight, TAUNTS,
} from "./engine.js";

// tiny convenience wrappers for team display
const teamLabel = (settings, id) => teamMeta(settings, id)?.label || "";
const teamColor = (settings, id) => teamMeta(settings, id)?.color || "#999";
const teamEmoji = (settings, id) => teamMeta(settings, id)?.emoji || "🚩";
import { useEvent, createEvent, findEventByCode, joinEvent, eventsForPhone, uploadChatPhoto, deleteEvent, leaveEventHistory, postSuggestion, fetchSuggestions } from "./useEvent.js";
import { styles, GLOBAL_CSS, SERIF } from "./styles.js";

// localStorage keys — remember who you are + which event you're in, on THIS device
const LS_PHONE = "lastcall_phone";
const LS_SIZE = "lastcall_size";
const LS_SEX = "lastcall_sex";
const LS_NAME = "lastcall_name";
const LS_EVENT = "lastcall_event";
const LS_PERSON = "lastcall_person";
const LS_WALKTHROUGH = "lastcall_walkthrough_seen";
const LS_STARS = "lastcall_stars";

// This phone number always gets host abilities (the app owner). Keys off the
// phone typed on the welcome screen, so it only applies on devices signed in
// with this number.
const DEVELOPER_PHONE = "9737386806";

// Catches any render crash and offers a way out, instead of a blank screen.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false, msg: "" }; }
  static getDerivedStateFromError(err) { return { crashed: true, msg: err?.message || String(err) }; }
  reset = () => {
    try { localStorage.removeItem(LS_EVENT); localStorage.removeItem(LS_PERSON); } catch (e) {}
    this.setState({ crashed: false, msg: "" });
    if (this.props.onReset) this.props.onReset();
    else if (typeof window !== "undefined") window.location.reload();
  };
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ ...styles.page, alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
          <div style={{ fontFamily: SERIF, fontSize: 24, color: "#f3ead4", fontStyle: "italic" }}>Something hiccuped</div>
          <div style={{ color: "#9aa0b5", fontSize: 14, lineHeight: 1.5 }}>The app hit a snag. This button clears the stuck event and takes you back to the start — your party data is safe in the cloud.</div>
          <button style={styles.primaryBtn} onClick={this.reset}>↺ Reset & go to start</button>
          <div style={{ fontSize: 10, color: "#5a6078" }}>{this.state.msg}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [eventId, setEventId] = useState(() => localStorage.getItem(LS_EVENT) || null);
  const [myPersonId, setMyPersonId] = useState(() => localStorage.getItem(LS_PERSON) || null);
  // direct-join link support: ?code=ABC12 lands you straight on the join screen
  const urlCode = (() => {
    try { return new URLSearchParams(window.location.search).get("code") || ""; } catch (e) { return ""; }
  })();

  const enterEvent = (eid, personId) => {
    localStorage.setItem(LS_EVENT, eid);
    if (personId) localStorage.setItem(LS_PERSON, personId);
    setEventId(eid);
    setMyPersonId(personId || null);
  };
  const leaveEvent = () => {
    localStorage.removeItem(LS_EVENT);
    localStorage.removeItem(LS_PERSON);
    setEventId(null);
    setMyPersonId(null);
  };

  if (!eventId) return <ErrorBoundary onReset={leaveEvent}><FrontDoor onEnter={enterEvent} urlCode={urlCode} /></ErrorBoundary>;
  return (
    <ErrorBoundary onReset={leaveEvent}>
      <EventScreen eventId={eventId} myPersonId={myPersonId} onLeave={leaveEvent} />
    </ErrorBoundary>
  );
}

// ============================================================
// FRONT DOOR — create, join, or pick from history
// ============================================================
function FrontDoor({ onEnter, urlCode = "" }) {
  const [mode, setMode] = useState(urlCode ? "join" : "home"); // home | create | join
  const [phone, setPhone] = useState(() => localStorage.getItem(LS_PHONE) || "");
  const [name, setName] = useState(() => localStorage.getItem(LS_NAME) || "");
  const [history, setHistory] = useState([]);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (phone) eventsForPhone(phone).then(setHistory).catch(() => {});
  }, [phone]);

  const remember = () => {
    if (phone) localStorage.setItem(LS_PHONE, phone);
    if (name) localStorage.setItem(LS_NAME, name);
  };

  if (mode === "create") {
    return <CreateScreen phone={phone} setPhone={setPhone} name={name} setName={setName}
      onBack={() => setMode("home")} onCreated={(eid, pid) => { remember(); onEnter(eid, pid); }} />;
  }
  if (mode === "join") {
    return <JoinScreen phone={phone} setPhone={setPhone} name={name} setName={setName} prefillCode={urlCode}
      onBack={() => setMode("home")} onJoined={(eid, pid) => { remember(); onEnter(eid, pid); }} />;
  }

  return (
    <div style={styles.page}>
      <style>{GLOBAL_CSS}</style>
      <div style={styles.setupWrap}>
        <div style={styles.kicker}>WELCOME TO</div>
        <h1 style={styles.bigTitle}>Last Call</h1>
        <p style={styles.setupSub}>Host a party, or join one with a code.</p>

        <label style={styles.fieldLabel}>Your name</label>
        <input style={styles.inputBig} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <label style={styles.fieldLabel}>Phone number (optional)</label>
        <input style={styles.inputBig} placeholder="Only to remember your events over time" value={phone}
          onChange={(e) => { setPhone(e.target.value); }} inputMode="tel" />
        <div style={styles.phoneNote}>Optional — we use it only to show your past events next time. No texts, ever.</div>

        <button style={styles.primaryBtn} onClick={() => { remember(); setMode("join"); }}>Join with a code →</button>
        <button style={styles.hostSmallBtn} onClick={() => { remember(); setMode("create"); }}>or host a new party</button>

        {history.length > 0 && (
          <>
            <div style={{ ...styles.kicker, marginTop: 20 }}>YOUR PAST EVENTS</div>
            <div style={styles.histList}>
              {history.map((h) => (
                <div key={h.id} style={styles.histRow}>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { remember(); onEnter(h.id, h.personId || null); }}>
                    <div style={styles.histName}>{h.name}</div>
                    <div style={styles.histMeta}>{h.phase === "ended" ? "ended" : "live"} · {new Date(h.created_at).toLocaleDateString()} · {h.myRole}</div>
                  </div>
                  <button style={styles.histRemove} onClick={(e) => { e.stopPropagation(); setConfirmRemove(h); }}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}

        {confirmRemove && (
          <div style={styles.modalBg} onClick={() => setConfirmRemove(null)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalTitle}>Remove "{confirmRemove.name}"?</div>
              <p style={styles.confirmText}>
                {confirmRemove.myRole === "host"
                  ? "You're the host — this permanently deletes the whole event and everyone's data in it. This can't be undone."
                  : "This removes the event from your history. It stays live for everyone else."}
              </p>
              <div style={styles.formActions}>
                <button style={styles.cancelBtn} onClick={() => setConfirmRemove(null)}>Cancel</button>
                <button style={styles.dangerBtn} onClick={async () => {
                  try {
                    if (confirmRemove.myRole === "host") await deleteEvent(confirmRemove.id);
                    else await leaveEventHistory(confirmRemove.personId);
                  } catch (e) {}
                  setHistory((hs) => hs.filter((x) => x.id !== confirmRemove.id));
                  setConfirmRemove(null);
                }}>{confirmRemove.myRole === "host" ? "Delete event" : "Remove"}</button>
              </div>
            </div>
          </div>
        )}

        <p style={styles.disclaimer}>
          Phone number's optional — just lets us remember your past events. No texts, ever.
          BAC is a fun estimate, not a real reading.
        </p>
      </div>
    </div>
  );
}

function CreateScreen({ phone, name, setName, onBack, onCreated }) {
  const [evName, setEvName] = useState("");
  const [size, setSize] = useState(() => localStorage.getItem(LS_SIZE) || "medium");
  const [sex, setSex] = useState(() => localStorage.getItem(LS_SEX) || "male");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const go = async () => {
    setBusy(true); setErr("");
    try {
      try { localStorage.setItem(LS_SIZE, size); localStorage.setItem(LS_SEX, sex); } catch (e) {}
      const { eventId, hostPersonId } = await createEvent({
        eventName: evName, hostName: name, size, sex, weightLb: weightFor(size, sex),
        settings: defaultSettings(), hostPhone: phone,
      });
      onCreated(eventId, hostPersonId);
    } catch (e) {
      setErr(e.message || "Could not create the event.");
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <style>{GLOBAL_CSS}</style>
      <div style={styles.setupWrap}>
        <button style={styles.linkBtn} onClick={onBack}>‹ Back</button>
        <div style={styles.kicker}>HOST A PARTY</div>
        <h1 style={styles.bigTitle}>New event</h1>
        <input style={styles.inputBig} placeholder="Event name (e.g. Evan & Hillary's Wedding)" value={evName}
          onChange={(e) => setEvName(e.target.value)} autoFocus />
        <input style={styles.inputBig} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={styles.formRow}>
          <SizeInfoLabel />
          <div style={styles.toggle}>
            {Object.entries(SIZES).map(([k, s]) => (
              <button key={k} style={{ ...styles.toggleBtn, ...(size === k ? styles.toggleOn : {}) }} onClick={() => setSize(k)}>{s.label}</button>
            ))}
          </div>
        </div>
        <div style={styles.formRow}>
          <span style={styles.fieldLabel}>Sex</span>
          <div style={styles.toggle}>
            {["male", "female"].map((s) => (
              <button key={s} style={{ ...styles.toggleBtn, ...(sex === s ? styles.toggleOn : {}) }} onClick={() => setSex(s)}>{s}</button>
            ))}
          </div>
        </div>
        {err && <div style={{ color: "#d9533b", fontSize: 13 }}>{err}</div>}
        <button style={styles.primaryBtn} disabled={busy} onClick={go}>{busy ? "Creating…" : "Start the night →"}</button>
      </div>
    </div>
  );
}

function JoinScreen({ phone, name, setName, onBack, onJoined, prefillCode = "" }) {
  const [code, setCode] = useState(prefillCode.toUpperCase());
  const [size, setSize] = useState(() => localStorage.getItem(LS_SIZE) || "medium");
  const [sex, setSex] = useState(() => localStorage.getItem(LS_SEX) || "male");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const go = async () => {
    setBusy(true); setErr("");
    try {
      const ev = await findEventByCode(code);
      if (!ev) { setErr("No party found with that code. Double-check it?"); setBusy(false); return; }
      try { localStorage.setItem(LS_SIZE, size); localStorage.setItem(LS_SEX, sex); } catch (e) {}
      const person = await joinEvent({ eventId: ev.id, name, size, sex, weightLb: weightFor(size, sex), phone });
      onJoined(ev.id, person.id);
    } catch (e) {
      setErr(e.message || "Could not join."); setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <style>{GLOBAL_CSS}</style>
      <div style={styles.setupWrap}>
        <button style={styles.linkBtn} onClick={onBack}>‹ Back</button>
        <div style={styles.kicker}>JOIN A PARTY</div>
        <h1 style={styles.bigTitle}>Enter code</h1>
        <input style={{ ...styles.inputBig, fontSize: 28, letterSpacing: 6, textAlign: "center", textTransform: "uppercase" }}
          placeholder="ABC12" maxLength={5} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus />
        <label style={styles.fieldLabel}>Your name</label>
        <input style={styles.inputBig} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={styles.formRow}>
          <SizeInfoLabel />
          <div style={styles.toggle}>
            {Object.entries(SIZES).map(([k, s]) => (
              <button key={k} style={{ ...styles.toggleBtn, ...(size === k ? styles.toggleOn : {}) }} onClick={() => setSize(k)}>{s.label}</button>
            ))}
          </div>
        </div>
        <div style={styles.formRow}>
          <span style={styles.fieldLabel}>Sex</span>
          <div style={styles.toggle}>
            {["male", "female"].map((s) => (
              <button key={s} style={{ ...styles.toggleBtn, ...(sex === s ? styles.toggleOn : {}) }} onClick={() => setSex(s)}>{s}</button>
            ))}
          </div>
        </div>
        {err && <div style={{ color: "#d9533b", fontSize: 13 }}>{err}</div>}
        <button style={styles.primaryBtn} disabled={busy} onClick={go}>{busy ? "Joining…" : "Join the party →"}</button>
      </div>
    </div>
  );
}

// ============================================================
// EVENT SCREEN — loads the live event, routes phase
// ============================================================
function EventScreen({ eventId, myPersonId, onLeave }) {
  const ev = useEvent(eventId);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => { setNow(Date.now()); }, [ev.people, ev.chat]);

  // auto-end a night that's been live more than 24 hours
  useEffect(() => {
    if (ev.event && ev.phase === "live" && ev.event.created_at) {
      const age = Date.now() - new Date(ev.event.created_at).getTime();
      if (age > 24 * 3600000) ev.actions.endNight();
    }
  }, [ev.event, ev.phase]);

  if (ev.loading) {
    return <div style={{ ...styles.page, alignItems: "center", justifyContent: "center" }}><div style={{ color: "#d9c7a3", fontFamily: SERIF }}>Loading the party…</div></div>;
  }
  if (ev.error || !ev.event) {
    return (
      <div style={{ ...styles.page, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ color: "#d9533b", textAlign: "center" }}>Couldn't load this event.<br />{ev.error}</div>
        <button style={styles.ghostBtn} onClick={onLeave}>← Back to start</button>
      </div>
    );
  }

  const liveNow = Math.max(now, ev.people.reduce((m, p) => p.log.reduce((mm, e) => Math.max(mm, e.t), m), 0));

  if (ev.phase === "ended") return <WrappedScreen ev={ev} myPersonId={myPersonId} liveNow={liveNow} onLeave={onLeave} />;
  return <LiveScreen ev={ev} myPersonId={myPersonId} liveNow={liveNow} onLeave={onLeave} />;
}

function themedPage(settings, extra = {}) {
  const th = getTheme(settings);
  return { ...styles.page, background: th.pageBg, color: th.text, ...extra };
}

// ============================================================
// LIVE SCREEN
// ============================================================
function LiveScreen({ ev, myPersonId, liveNow, onLeave }) {
  const { people, chat, shotCalls, fights = [], settings, actions, joinCode, eventName } = ev;
  const drinksMap = getDrinks(settings);
  const sizesMap = getSizes(settings);
  const theme = getTheme(settings);
  const legalLimit = getLegalLimit(settings);

  const [tab, setTab] = useState("leaderboard");
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [statsFocusId, setStatsFocusId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState("drinks");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmVomitId, setConfirmVomitId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [chatSeen, setChatSeen] = useState(Date.now());
  const [stars, setStars] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_STARS) || "[]"); } catch (e) { return []; }
  });
  const toggleStar = (pid) => setStars((s) => {
    const next = s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid];
    try { localStorage.setItem(LS_STARS, JSON.stringify(next)); } catch (e) {}
    return next;
  });
  const [banner, setBanner] = useState(null);
  const bannerQueue = useRef([]);
  const bannerTouch = useRef(null);
  const toastTouch = useRef(null);
  const [showWalkthrough, setShowWalkthrough] = useState(() => {
    try { return !localStorage.getItem(LS_WALKTHROUGH); } catch (e) { return false; }
  });
  const dismissWalkthrough = () => { try { localStorage.setItem(LS_WALKTHROUGH, "1"); } catch (e) {} setShowWalkthrough(false); };
  const [toast, setToast] = useState(null);
  const lastChatRef = useRef(chat.length);

  const me = people.find((p) => p.id === myPersonId);
  const myPhone = (typeof localStorage !== "undefined" && localStorage.getItem(LS_PHONE)) || "";
  const amHost = me?.role === "host" || (myPhone && myPhone === DEVELOPER_PHONE);
  const isDeveloper = myPhone && myPhone === DEVELOPER_PHONE;

  // pop a toast when a new chat arrives from someone else
  useEffect(() => {
    if (chat.length > lastChatRef.current) {
      const newest = chat[chat.length - 1];
      if (newest && newest.text && newest.text.startsWith("__shotin__")) { lastChatRef.current = chat.length; return; }
      // only toast messages I'm allowed to see: public, or a private message addressed to me
      const visibleToMe = newest && (!newest.toPerson || (me && newest.toPerson === me.id));
      const fromSomeoneElse = newest && (!me || newest.personId !== me.id);
      if (visibleToMe && fromSomeoneElse) {
        const isDM = newest.toPerson && me && newest.toPerson === me.id;
        setToast(isDM ? { ...newest, name: "🔒 " + newest.name } : newest);
        const id = setTimeout(() => setToast(null), 4000);
        lastChatRef.current = chat.length;
        return () => clearTimeout(id);
      }
    }
    lastChatRef.current = chat.length;
  }, [chat, me]);

  const unreadChat = chat.filter((m) => m.t > chatSeen && !(m.text && m.text.startsWith("__shotin__")) && (!m.toPerson || (me && (m.toPerson === me.id || m.personId === me.id)))).length;
  const openTab = (t) => { if (t === "chat") setChatSeen(Date.now()); setTab(t); };
  const partyDrinks = people.reduce((a, p) => a + drinkCountAtTime(p, liveNow), 0);

  // drink + vomit alerts. Drinks are host-toggled; vomits always notify.
  const drinkNotifsOn = settings.drinkNotifs === true;
  const lastDrinkRef = useRef(null);
  useEffect(() => {
    // most recent log entry of any kind across everyone
    let newest = null, newestPid = null;
    people.forEach((p) => p.log.forEach((e) => { if (!e._pending && (!newest || e.t > newest.t)) { newest = { ...e, name: p.name }; newestPid = p.id; } }));
    if (!newest) return;
    const key = newest.name + ":" + newest.t + ":" + newest.type;
    if (lastDrinkRef.current === null) { lastDrinkRef.current = key; return; } // skip first load
    if (key !== lastDrinkRef.current && Date.now() - newest.t < 15000 && !(me && newestPid === me.id)) {
      if (newest.type === "vomit") {
        setToast({ name: `🤮 ${newest.name}`, text: "had a rough moment", t: Date.now(), personId: newestPid, goStats: true });
      } else if (drinkNotifsOn) {
        const d = drinksMap[newest.type] || { emoji: "🍸", label: "drink" };
        setToast({ name: `${d.emoji} ${newest.name}`, text: `had a ${d.label.toLowerCase()}`, t: Date.now(), personId: newestPid, goStats: true });
      }
    }
    lastDrinkRef.current = key;
  }, [people, drinkNotifsOn, me]);

  // shot call: show a full-screen takeover for any new call (including my own)
  const shotEnabled = settings.shotCallEnabled !== false;
  const [activeShot, setActiveShot] = useState(null);
  const shotRef = useRef((shotCalls || []).length);
  useEffect(() => {
    if ((shotCalls || []).length > shotRef.current) {
      const newest = shotCalls[shotCalls.length - 1];
      if (newest) {
        setActiveShot(newest);
        // if I'm the caller, auto-count me in so I never tap "I'm in"
        if (me && newest.personId === me.id) actions.postChat(me.id, me.name, `__shotin__${newest.id}`, null, null);
      }
    }
    shotRef.current = (shotCalls || []).length;
  }, [shotCalls]);
  const myShotUsed = me && (shotCalls || []).some((s) => s.personId === me.id);
  const fireShot = (note) => {
    if (!me) return;
    if (myShotUsed && !isDeveloper) return;
    actions.callShots(me.id, me.name, note || null);
  };

  // --- Beer Fights ---
  const fightsOn = settings.fightsEnabled === true;
  const [activeFight, setActiveFight] = useState(null); // the fight currently in UI (pending challenge or active battle)
  const [challengeTarget, setChallengeTarget] = useState(null); // person I'm about to challenge (composer open)
  const fightRef = useRef(0);
  useEffect(() => {
    if (!me) return;
    // newest fight involving me
    const mine = fights.filter((f) => f.challengerId === me.id || f.opponentId === me.id).sort((a, b) => b.t - a.t);
    const newest = mine[0];
    if (!newest) return;
    // surface pending challenges where I'm the opponent, and active fights either side
    if (newest.status === "pending" && newest.opponentId === me.id) setActiveFight(newest);
    else if (newest.status === "active") setActiveFight(newest);
    else if (newest.status === "done" && activeFight && activeFight.id === newest.id) setActiveFight(newest);
    else if (newest.status === "declined" || newest.status === "expired") {
      if (activeFight && activeFight.id === newest.id) setActiveFight(null);
    }
  }, [fights, me]);
  // 30s auto-expire for pending challenges (only the challenger triggers it to avoid races)
  useEffect(() => {
    if (!activeFight || activeFight.status !== "pending") return;
    if (!me || activeFight.challengerId !== me.id) return;
    const elapsed = Date.now() - activeFight.t;
    const remaining = Math.max(0, 30000 - elapsed);
    const id = setTimeout(() => { actions.expireFight(activeFight.id); }, remaining);
    return () => clearTimeout(id);
  }, [activeFight, me]);
  // Same auto-expire for pending shot calls (~30s)
  useEffect(() => {
    if (!activeShot) return;
    const elapsed = Date.now() - activeShot.t;
    const remaining = Math.max(0, 30000 - elapsed);
    const id = setTimeout(() => setActiveShot(null), remaining);
    return () => clearTimeout(id);
  }, [activeShot]);
  // my fight record on the night
  const myFightRecord = me ? fights.reduce((acc, f) => {
    if (f.status !== "done" || !f.winnerId) return acc;
    const involved = f.challengerId === me.id || f.opponentId === me.id;
    if (!involved) return acc;
    if (f.winnerId === me.id) return { ...acc, wins: acc.wins + 1 };
    return { ...acc, losses: acc.losses + 1 };
  }, { wins: 0, losses: 0 }) : { wins: 0, losses: 0 };
  const fightRecord = (pid) => fights.reduce((acc, f) => {
    if (f.status !== "done" || !f.winnerId) return acc;
    const involved = f.challengerId === pid || f.opponentId === pid;
    if (!involved) return acc;
    if (f.winnerId === pid) return { ...acc, wins: acc.wins + 1 };
    return { ...acc, losses: acc.losses + 1 };
  }, { wins: 0, losses: 0 });

  // notify me when someone reacts to one of my feed items
  const feedRx = ev.feedReactions || {};
  const myRxSeen = useRef(null);
  useEffect(() => {
    if (!me) return;
    const mineTargets = new Set();
    people.forEach((p) => { if (p.id === me.id) p.log.forEach((e) => mineTargets.add("log:" + (e._id || e.t))); });
    chat.forEach((m) => { if (m.personId === me.id) mineTargets.add("chat:" + m.id); });
    (shotCalls || []).forEach((s) => { if (s.personId === me.id) mineTargets.add("shot:" + s.id); });
    people.forEach((p) => { if (p.id === me.id) { const dl = p.log.filter((e) => e.type !== "vomit").sort((a, b) => a.t - b.t); dl.forEach((e, idx) => { if ((idx + 1) % 5 === 0) mineTargets.add("ms:" + p.id + ":" + (idx + 1)); }); } });
    const sig = [];
    Object.entries(feedRx).forEach(([target, emojis]) => {
      if (!mineTargets.has(target)) return;
      Object.entries(emojis).forEach(([emoji, ids]) => ids.forEach((id) => { if (id !== me.id) sig.push(target + emoji + id); }));
    });
    const sigStr = sig.sort().join("|");
    if (myRxSeen.current === null) { myRxSeen.current = sigStr; return; }
    if (sigStr !== myRxSeen.current && sig.length > myRxSeen.current.split("|").filter(Boolean).length) {
      setToast({ name: "Someone reacted", text: "to something you did 🎉", t: Date.now(), personId: null });
    }
    myRxSeen.current = sigStr;
  }, [feedRx, me]);

  // ---- milestone banners (announce-style, queued) ----
  const enqueueBanner = (b) => {
    bannerQueue.current.push(b);
    if (!banner) {
      const next = bannerQueue.current.shift();
      setBanner(next);
    }
  };
  useEffect(() => {
    if (!banner && bannerQueue.current.length > 0) {
      setBanner(bannerQueue.current.shift());
    }
  }, [banner]);
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(id);
  }, [banner]);

  // track milestones: per-person 5/10/15..., crossing legal limit, group Boggs
  const milestoneRef = useRef(null);
  useEffect(() => {
    const snapshot = {};
    let groupTotal = 0;
    people.forEach((p) => {
      const n = drinkCountAtTime(p, liveNow);
      const bac = n ? bacAtTime(p, liveNow, drinksMap) : 0;
      snapshot[p.id] = { n, drunk: bac >= legalLimit, name: p.name };
      groupTotal += n;
    });
    const prev = milestoneRef.current;
    if (prev === null) { milestoneRef.current = { per: snapshot, groupTotal, boggs: groupTotal >= BOGGS_NUMBER }; return; }
    // per-person milestones
    people.forEach((p) => {
      const before = prev.per[p.id];
      const after = snapshot[p.id];
      if (!before || !after) return;
      // skip anyone mid-write: a pending optimistic entry can transiently
      // inflate the count by one, which would fire a milestone too early.
      if (p.log.some((e) => e._pending)) return;
      const crossed5or10 = Math.floor(after.n / 5) > Math.floor(before.n / 5) && after.n >= 5;
      if (crossed5or10) {
        const tens = after.n % 10 === 0;
        enqueueBanner({ kind: "milestone", emoji: tens ? "🔥" : "🍻", title: `${after.name} hit ${after.n}!`, sub: tens ? "absolute machine" : "on a roll", personId: p.id });
      }
      if (after.drunk && !before.drunk) {
        enqueueBanner({ kind: "legal", emoji: "🚦", title: `${after.name} is legally drunk`, sub: "officially feeling it", personId: p.id });
      }
    });
    // Boggs group easter egg
    if (!prev.boggs && groupTotal >= BOGGS_NUMBER) {
      enqueueBanner({ kind: "boggs", emoji: "🍺", title: `${BOGGS_NUMBER} BEERS`, sub: "You just pulled a Wade Boggs. Legendary.", personId: null, big: true });
    }
    // For anyone mid-write, keep their PREVIOUS baseline so the real milestone
    // fires once the count settles (don't bake in the transient inflated value).
    const mergedPer = { ...snapshot };
    people.forEach((p) => { if (p.log.some((e) => e._pending) && prev.per[p.id]) mergedPer[p.id] = prev.per[p.id]; });
    milestoneRef.current = { per: mergedPer, groupTotal, boggs: groupTotal >= BOGGS_NUMBER };
  }, [people, liveNow, drinksMap, legalLimit]);

  if (showSettings) {
    return <SettingsScreen settings={settings} amHost={amHost}
      onSave={(s) => { actions.saveSettings(s); setShowSettings(false); }}
      onCancel={() => setShowSettings(false)} />;
  }

  return (
    <div style={themedPage(settings)}>
      <style>{GLOBAL_CSS}</style>

      {showWalkthrough && <WalkthroughModal onClose={dismissWalkthrough} shotEnabled={settings.shotCallEnabled !== false} teamsOn={(settings.teamCount || 0) > 0} />}

      {activeShot && (() => {
        const amCaller = me && activeShot.personId === me.id;
        const ins = (chat || []).filter((m) => m.toPerson === null && m.text === `__shotin__${activeShot.id}`);
        const names = [...new Set(ins.map((m) => m.name))];
        const iAmIn = me && ins.some((m) => m.personId === me.id);
        return (
          <div style={styles.shotOverlay}>
            <div style={styles.shotGlass}>🥃</div>
            <div style={styles.shotName}>{amCaller ? "You called" : `${activeShot.name} is calling`}</div>
            <div style={styles.shotBig}>SHOTS!</div>
            {activeShot.note ? <div style={styles.shotWhere}>📍 {activeShot.note}</div> : <div style={styles.shotSub}>Everyone grab one 🍻</div>}
            {names.length > 0 && <div style={styles.shotTally}>🍻 {names.join(", ")} {names.length === 1 ? "is" : "are"} in</div>}
            {amCaller ? (
              <button style={styles.shotDismiss} onClick={() => setActiveShot(null)}>Let's go 🥃</button>
            ) : (
              <>
                {!iAmIn && <button style={styles.shotDismiss} onClick={() => { if (me) actions.postChat(me.id, me.name, `__shotin__${activeShot.id}`, null, null); }}>I'm in 🥃</button>}
                <button style={styles.shotDecline} onClick={() => setActiveShot(null)}>{iAmIn ? "Close" : "Nah, I'm good"}</button>
              </>
            )}
          </div>
        );
      })()}

      {challengeTarget && me && (
        <ChallengeComposer me={me} target={challengeTarget}
          onSend={async (taunt) => {
            try { await actions.challengeFight({ challengerId: me.id, challengerName: me.name, opponentId: challengeTarget.id, opponentName: challengeTarget.name, taunt }); }
            catch (e) {}
            setChallengeTarget(null);
          }}
          onCancel={() => setChallengeTarget(null)} />
      )}

      {activeFight && me && (
        <FightOverlay fight={activeFight} me={me} people={people} drinks={drinksMap} liveNow={liveNow} actions={actions}
          onClose={() => setActiveFight(null)} />
      )}

      {banner && (
        <div style={{ ...styles.banner, ...(banner.big ? styles.bannerBig : {}) }}
          onClick={() => { if (banner.personId) { setStatsFocusId(banner.personId); setTab("stats"); } setBanner(null); }}
          onTouchStart={(e) => { bannerTouch.current = e.touches[0].clientY; }}
          onTouchMove={(e) => { if (bannerTouch.current != null && bannerTouch.current - e.touches[0].clientY > 30) setBanner(null); }}>
          <span style={styles.bannerEmoji}>{banner.emoji}</span>
          <div style={styles.bannerTextWrap}>
            <div style={styles.bannerTitle}>{banner.title}</div>
            <div style={styles.bannerSub}>{banner.sub}</div>
          </div>
          <span style={styles.bannerX}>✕</span>
        </div>
      )}

      {toast && (
        <div style={styles.toast}
          onClick={() => { if (toast.goStats && toast.personId) { setStatsFocusId(toast.personId); setTab("stats"); } else { openTab("chat"); } setToast(null); }}
          onTouchStart={(e) => { toastTouch.current = e.touches[0].clientY; }}
          onTouchMove={(e) => { if (toastTouch.current != null && toastTouch.current - e.touches[0].clientY > 30) setToast(null); }}>
          <span style={styles.toastIcon}>{toast.goStats ? "📊" : "💬"}</span>
          <span style={styles.toastText}><b>{toast.name}</b>{toast.text ? " " + toast.text : (toast.imageUrl ? " 📷 photo" : "")}</span>
          <span style={styles.bannerX}>✕</span>
        </div>
      )}

      <header style={styles.liveHeader}>
        <div style={styles.headerRow}>
          <button style={styles.gearBtn} onClick={() => setShowSettings(true)}>⚙ Settings</button>
          <div style={styles.eventTitleRow}>
            <span style={styles.themeMotif}>{theme.motif}</span>
            <span style={styles.kicker}>{eventName.toUpperCase()}</span>
          </div>
          <button style={styles.gearBtn} onClick={() => setShowShare(true)}>✉️ Invite</button>
        </div>
        <div style={styles.liveStat}>
          <b>{partyDrinks}</b> drinks · <b>{people.length}</b> people · code <b>{joinCode}</b>
          <button style={styles.homeLink} onClick={onLeave}>⌂ leave</button>
        </div>
      </header>

      {/* ---- LEADERBOARD TAB ---- */}
      {tab === "leaderboard" && (
        partyDrinks > 0 ? (
          <>
            {(settings.teamCount || 0) > 0 && <TeamStandings people={people} settings={settings} now={liveNow} drinks={drinksMap} />}
            <Leaderboard people={people} now={liveNow} accent={theme.accent} stars={stars} toggleStar={toggleStar} />
            <GroupStats people={people} now={liveNow} drinks={drinksMap} />
            <FavoriteDrinksChart people={people} drinks={drinksMap} />
            <TimelineGraph people={people} now={liveNow} metric={metric} setMetric={setMetric} legalLimit={legalLimit} />
          </>
        ) : <div style={styles.emptyState}>No drinks yet. Tap the <b>＋</b> below to start logging.</div>
      )}

      {/* ---- STATS TAB (everyone's details, starred first) ---- */}
      {tab === "stats" && (
        <>
          {(settings.teamCount || 0) > 0 && me && (
            <div style={styles.teamPickWrap}>
              <div style={styles.quickTitle}>{me.team ? "Your team" : "🚩 Pick your team"}{settings.teamsLocked && me.team ? " 🔒" : ""}</div>
              <div style={styles.teamPickRow}>
                {teamList(settings).map((t) => (
                  <button key={t.id} disabled={settings.teamsLocked && !!me.team} style={{ ...styles.teamPickBtn, borderColor: t.color, ...(me.team === t.id ? { background: t.color, color: "#15182a", fontWeight: 700 } : {}), ...(settings.teamsLocked && me.team ? { opacity: 0.5 } : {}) }}
                    onClick={() => { if (!(settings.teamsLocked && me.team)) actions.setTeam(me.id, t.id); }}>{t.emoji} {t.label}</button>
                ))}
              </div>
            </div>
          )}
          {[...people].sort((a, b) => {
            // me first, then starred, then by drinks
            if (a.id === myPersonId) return -1; if (b.id === myPersonId) return 1;
            const as = stars.includes(a.id), bs = stars.includes(b.id);
            if (as !== bs) return as ? -1 : 1;
            return drinkCountAtTime(b, liveNow) - drinkCountAtTime(a, liveNow);
          }).map((p) => (
            <PersonCard key={p.id} p={p} now={liveNow} drinks={drinksMap} sizes={sizesMap}
              expanded={expandedId === p.id} toggleExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
              onEdit={() => setEditingId(p.id)} actions={actions} setConfirmVomitId={setConfirmVomitId}
              canLog={p.id === myPersonId || amHost}
              starred={stars.includes(p.id)} onStar={() => toggleStar(p.id)}
              isMe={p.id === myPersonId}
              settings={settings} amHost={amHost}
              fightsOn={fightsOn} onChallenge={(target) => setChallengeTarget(target)} record={fightRecord(p.id)} />
          ))}
          {amHost && (adding ? (
            <PersonForm sizes={sizesMap} onCancel={() => setAdding(false)}
              onSave={(name, size, sex) => { actions.addPerson({ name, size, sex, weightLb: weightFor(size, sex) }); setAdding(false); }} />
          ) : <button style={styles.addPerson} onClick={() => setAdding(true)}>+ Add someone</button>)}
        </>
      )}

      {/* ---- FEED TAB ---- */}
      {tab === "feed" && (
        <BigFeed people={people} now={liveNow} drinks={drinksMap} chat={chat} shotCalls={shotCalls} fights={fights} me={me} feedReactions={ev.feedReactions || {}} onReact={(target, emoji, already) => me && actions.toggleFeedReaction(target, me.id, emoji, already)} onPerson={(pid) => { setStatsFocusId(pid); setTab("stats"); }} />
      )}

      {/* ---- CHAT TAB ---- */}
      {tab === "chat" && (
        <ChatBox chat={chat} me={me} people={people} eventId={ev.event.id} onPost={(text, imageUrl, toPerson) => me && actions.postChat(me.id, me.name, text, imageUrl, toPerson)} onDelete={actions.deleteChat} onReact={actions.toggleReaction} now={liveNow} />
      )}

      <p style={styles.disclaimer}>BAC here is a fun estimate, not a real reading — don't make real decisions off it.</p>

      {/* ---- ADD SHEET (center +) ---- */}
      {showAdd && me && (
        <AddSheet me={me} people={people} now={liveNow} drinks={drinksMap} actions={actions}
          shotEnabled={shotEnabled} myShotUsed={myShotUsed && !isDeveloper} onShot={fireShot}
          onVomit={() => { setConfirmVomitId(me.id); }}
          onClose={() => setShowAdd(false)} />
      )}

      {editingId && (
        <EditModal person={people.find((p) => p.id === editingId)} sizes={sizesMap}
          onSave={(f) => { actions.updatePerson(editingId, f); setEditingId(null); }}
          onRemove={() => { actions.removePerson(editingId); setEditingId(null); }}
          onClose={() => setEditingId(null)}
          canRemove={people.length > 1 && people.find((p) => p.id === editingId)?.role !== "host"} />
      )}

      {showShare && <ShareModal joinCode={joinCode} onClose={() => setShowShare(false)} />}

      {confirmVomitId && (
        <Modal title="Log a vomit?" onClose={() => setConfirmVomitId(null)}
          body={`This records a vomit for ${people.find((p) => p.id === confirmVomitId)?.name} and applies a rough BAC knockdown. You can remove it later from their log.`}
          actions={<>
            <button style={styles.cancelBtn} onClick={() => setConfirmVomitId(null)}>Cancel</button>
            <button style={styles.saveBtn} onClick={() => { actions.addVomit(confirmVomitId); setConfirmVomitId(null); }}>Yes, log it</button>
          </>} />
      )}

      {confirmEnd && (
        <Modal title="End the night?" onClose={() => setConfirmEnd(false)}
          body={`This closes out ${eventName} and generates everyone's final summary. You can still look back at stats, but no more drinks can be logged. Only you, the host, can do this.`}
          actions={<>
            <button style={styles.cancelBtn} onClick={() => setConfirmEnd(false)}>Keep going</button>
            <button style={styles.dangerBtn} onClick={() => { actions.endNight(); setConfirmEnd(false); }}>End the night</button>
          </>} />
      )}

      {amHost && tab === "leaderboard" && (
        <button style={styles.endBtnSmall} onClick={() => setConfirmEnd(true)}>🌙 Night's Over</button>
      )}

      {/* ---- BOTTOM TAB BAR with center + ---- */}
      <div style={styles.tabBarFixed}>
        <div style={styles.tabBarInner}>
          {[{ key: "leaderboard", icon: "🏆", name: "Board" }, { key: "stats", icon: "📊", name: "Stats" }].map((t) => (
            <button key={t.key} style={{ ...styles.tab, ...(tab === t.key ? { ...styles.tabOn, borderColor: theme.accent, color: theme.accent } : {}) }} onClick={() => openTab(t.key)}>
              <span style={styles.tabIcon}>{t.icon}</span><span style={styles.tabName}>{t.name}</span>
            </button>
          ))}
          <button style={{ ...styles.plusTab, background: theme.accent }} onClick={() => setShowAdd(true)} aria-label="Add a drink">＋</button>
          {[{ key: "feed", icon: "📣", name: "Feed" }, { key: "chat", icon: "💬", name: "Chat" }].map((t) => (
            <button key={t.key} style={{ ...styles.tab, ...(tab === t.key ? { ...styles.tabOn, borderColor: theme.accent, color: theme.accent } : {}) }} onClick={() => openTab(t.key)}>
              <span style={styles.tabIcon}>{t.icon}</span><span style={styles.tabName}>{t.name}</span>
              {t.key === "chat" && unreadChat > 0 && <span style={styles.tabBadge}>{unreadChat}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- small modal helper ----
function Modal({ title, body, actions, onClose }) {
  return (
    <div style={styles.modalBg} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalTitle}>{title}</div>
        <p style={styles.confirmText}>{body}</p>
        <div style={styles.formActions}>{actions}</div>
      </div>
    </div>
  );
}

function ShareModal({ joinCode, onClose }) {
  const url = typeof window !== "undefined" ? window.location.origin + "?code=" + joinCode : "";
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const qrSrc = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=" + encodeURIComponent(url);
  return (
    <div style={styles.modalBg} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalTitle}>Invite people</div>
        <p style={styles.confirmText}>Share the code or the link — anyone can join from their own phone.</p>
        <div style={styles.codeBox}>{joinCode}</div>
        {showQR && (
          <div style={styles.qrBox}>
            <img src={qrSrc} alt={"QR code to join " + joinCode} style={styles.qrImg} />
            <div style={styles.qrCaption}>Point a phone camera here to join</div>
          </div>
        )}
        <div style={styles.shareRow}>
          <button style={styles.saveBtn} onClick={copy}>{copied ? "Copied!" : "Copy invite link"}</button>
          <button style={styles.ghostBtnSm} onClick={() => setShowQR(!showQR)}>{showQR ? "Hide QR" : "Show QR code"}</button>
        </div>
        <p style={styles.chatNote}>The code and QR stay the same all night — screenshot the QR and put it on a table if you like.</p>
        <div style={styles.formActions}><button style={styles.cancelBtn} onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}

// ============================================================
// LIVE FEED
// ============================================================
function LiveFeed({ people, now, drinks = DRINKS, chat = [], shotCalls = [] }) {
  const events = [];
  people.forEach((p) => p.log.forEach((e) => events.push({ kind: "log", ...e, name: p.name })));
  chat.forEach((m) => { if (!m.toPerson && !(m.text && m.text.startsWith("__shotin__"))) events.push({ kind: "chat", t: m.t, name: m.name, text: m.text, imageUrl: m.imageUrl }); });
  shotCalls.forEach((s) => events.push({ kind: "shot", t: s.t, name: s.name }));
  events.sort((a, b) => b.t - a.t);

  const phrase = (e) => {
    const mins = Math.round((now - e.t) / 60000);
    const ago = mins < 1 ? "just now" : `${mins}m ago`;
    if (e.kind === "shot") return { icon: "🥃", text: `${e.name} called shots!`, ago, chat: true };
    if (e.kind === "chat") return { icon: e.imageUrl && !e.text ? "📷" : "💬", text: e.imageUrl && !e.text ? `${e.name} sent a photo` : `${e.name}: ${e.text}`, ago, chat: true };
    if (e.type === "vomit") return { icon: "🤮", text: `${e.name} had a rough moment`, ago };
    const d = drinks[e.type] || { emoji: "🍸", label: "drink" };
    const sz = POUR[e.pour || "M"].label;
    return { icon: d.emoji, text: `${e.name} had a ${sz === "M" ? "" : sz + " "}${d.label.toLowerCase()}`, ago };
  };

  return (
    <div style={styles.feedV}>
      <div style={styles.feedVHead}><span style={styles.feedDot} /><span style={styles.feedVTitle}>LIVE FEED</span></div>
      {events.length === 0 ? (
        <div style={styles.feedVEmpty}>Log a drink or say something to start the night…</div>
      ) : (
        <div style={styles.feedVList}>
          {events.map((e, i) => { const ph = phrase(e); return (
            <div key={i} style={styles.feedVRow}>
              <span style={styles.feedVIcon}>{ph.icon}</span>
              <span style={{ ...styles.feedVText, ...(ph.chat ? styles.feedVChat : {}) }}>{ph.text}</span>
              <span style={styles.feedVAgo}>{ph.ago}</span>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TEAM STANDINGS
// ============================================================
function TeamStandings({ people, settings, now, drinks }) {
  const teams = teamStats(people, settings, now, drinks);
  const maxAvg = Math.max(0.001, ...teams.map((t) => t.avg));
  const anyMembers = teams.some((t) => t.members.length > 0);
  return (
    <div style={styles.lbWrap}>
      <div style={styles.lbTitle}>🚩 Team standings</div>
      {!anyMembers && <div style={styles.chatEmpty}>No one's picked a team yet — head to My Drinks to join one.</div>}
      {teams.map((t, i) => (
        <div key={t.id} style={styles.teamRow}>
          <span style={styles.lbRank}>{i === 0 && t.avg > 0 ? "👑" : i + 1}</span>
          <div style={{ flex: 1 }}>
            <div style={styles.teamRowHead}>
              <span style={{ ...styles.teamDot, background: t.color }} />
              <span style={styles.teamName}>{t.label}</span>
              <span style={styles.teamMembers}>{t.members.length} {t.members.length === 1 ? "person" : "people"}</span>
            </div>
            <div style={styles.teamBarTrack}><div style={{ ...styles.teamBarFill, width: `${(t.avg / maxAvg) * 100}%`, background: t.color }} /></div>
          </div>
          <div style={styles.teamScore}>
            <div style={{ ...styles.teamAvg, color: t.color }}>{t.avg.toFixed(1)}</div>
            <div style={styles.teamTotal}>{t.total} total</div>
          </div>
        </div>
      ))}
      <div style={styles.settingHint}>Ranked by average drinks per person.</div>
    </div>
  );
}

// ============================================================
// LEADERBOARD
// ============================================================
function Leaderboard({ people, now, accent, stars = [], toggleStar }) {
  const [sortBy, setSortBy] = useState("drinks");
  const rows = [...people].map((p) => ({ p, n: drinkCountAtTime(p, now), bac: bacAtTime(p, now) }))
    .sort((a, b) => sortBy === "bac" ? (b.bac - a.bac || b.n - a.n) : (b.n - a.n || b.bac - a.bac));
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div style={styles.lbWrap}>
      <div style={styles.lbHead}>
        <div style={styles.lbTitle}>Leaderboard</div>
        <div style={styles.metricToggle}>
          <button style={{ ...styles.metricBtn, ...(sortBy === "drinks" ? styles.metricOn : {}) }} onClick={() => setSortBy("drinks")}># Drinks</button>
          <button style={{ ...styles.metricBtn, ...(sortBy === "bac" ? styles.metricOn : {}) }} onClick={() => setSortBy("bac")}>BAC</button>
        </div>
      </div>
      {rows.map((r, i) => {
        const desc = bacDescriptor(r.bac);
        const starred = stars.includes(r.p.id);
        return (
          <div key={r.p.id} style={{ ...styles.lbRow, ...(i === 0 && r.n > 0 ? { background: "rgba(191,164,106,0.08)" } : {}) }}>
            <span style={styles.lbRank}>{i < 3 && r.n > 0 ? medals[i] : i + 1}</span>
            <button style={styles.starBtn} onClick={() => toggleStar && toggleStar(r.p.id)} title={starred ? "Unfollow" : "Follow"}>{starred ? "⭐" : "☆"}</button>
            <div style={styles.lbName}>
              <span>{r.p.name}{r.p.role === "host" && <span style={styles.hostTag}>HOST</span>}</span>
              <span style={{ ...styles.lbDesc, color: desc.tone }}>{desc.word}</span>
            </div>
            <div style={styles.lbRight}>
              <span style={{ ...styles.lbCount, color: accent }}>{r.n}</span>
              <span style={styles.lbBac}>~{r.bac.toFixed(3)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// GROUP STATS + FAVORITE DRINKS
// ============================================================
function GroupStats({ people, now, drinks = DRINKS }) {
  const tally = {};
  people.forEach((p) => p.log.forEach((e) => { if (e.type !== "vomit") tally[e.type] = (tally[e.type] || 0) + 1; }));
  let favType = null, favN = 0;
  for (const [k, n] of Object.entries(tally)) if (n > favN) { favType = k; favN = n; }
  const groupPace = people.reduce((a, p) => a + drinksPerHour(p, now), 0);
  let mover = null, moverRate = -Infinity;
  people.forEach((p) => { const rate = bacRatePerHour(p, now); if (rate > moverRate) { moverRate = rate; mover = p; } });
  let leader = null, leaderN = -1;
  people.forEach((p) => { const n = drinkCountAtTime(p, now); if (n > leaderN) { leaderN = n; leader = p; } });
  return (
    <div style={styles.groupWrap}>
      <div style={styles.groupTitle}>The group, right now</div>
      <div style={styles.groupGrid}>
        <div style={styles.groupCell}><div style={styles.groupBig}>{leader ? leader.name : "—"}</div><div style={styles.groupLabel}>leading · {leaderN > 0 ? leaderN : 0} drinks</div></div>
        <div style={styles.groupCell}><div style={styles.groupBig}>{favType ? `${(drinks[favType] || DRINKS[favType]).emoji} ${(drinks[favType] || DRINKS[favType]).label}` : "—"}</div><div style={styles.groupLabel}>drink of the night</div></div>
        <div style={styles.groupCell}><div style={styles.groupBig}>{groupPace.toFixed(1)}</div><div style={styles.groupLabel}>group drinks/hr</div></div>
        <div style={styles.groupCell}><div style={styles.groupBig}>{mover && moverRate > 0.005 ? mover.name : "—"}</div><div style={styles.groupLabel}>climbing fastest</div></div>
      </div>
    </div>
  );
}

function FavoriteDrinksChart({ people, drinks = DRINKS }) {
  const tally = {};
  people.forEach((p) => p.log.forEach((e) => { if (e.type !== "vomit") tally[e.type] = (tally[e.type] || 0) + 1; }));
  const rows = Object.entries(tally).map(([type, n]) => ({ type, n, d: drinks[type] || DRINKS[type] || { emoji: "🍸", label: type } })).sort((a, b) => b.n - a.n);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <div style={styles.groupWrap}>
      <div style={styles.groupTitle}>What the group is drinking</div>
      <div style={styles.barList}>
        {rows.map((r) => (
          <div key={r.type} style={styles.barRow}>
            <span style={styles.barLabel}>{r.d.emoji} {r.d.label}</span>
            <div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${(r.n / max) * 100}%` }} /></div>
            <span style={styles.barCount}>{r.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PERSON CARD + INDIVIDUAL STATS
// ============================================================
function PersonCard({ p, now, drinks = DRINKS, sizes = SIZES, expanded, toggleExpand, onEdit, actions, setConfirmVomitId, canLog = false, starred = false, onStar, isMe = false, settings = {}, amHost = false, fightsOn = false, onChallenge, record = { wins: 0, losses: 0 } }) {
  const count = drinkCountAtTime(p, now);
  const bac = count ? bacAtTime(p, now, drinks) : 0;
  const desc = bacDescriptor(bac);
  const vomits = p.log.filter((e) => e.type === "vomit").length;
  const pace = count ? drinksPerHour(p, now) : 0;
  const rate = count ? bacRatePerHour(p, now) : 0;
  const trend = rate > 0.005 ? { sym: "↑", color: "#e07a3c" } : rate < -0.005 ? { sym: "↓", color: "#7dd3a0" } : { sym: "→", color: "#9aa0b5" };
  const tally = {};
  p.log.forEach((d) => { if (d.type !== "vomit") tally[d.type] = (tally[d.type] || 0) + 1; });
  const dd = (k) => drinks[k] || DRINKS[k] || { emoji: "🍸", label: "drink" };
  const teamsOn = (settings.teamCount || 0) > 0;
  return (
    <div style={{ ...styles.card, ...(isMe ? { borderColor: "rgba(191,164,106,0.5)" } : {}) }}>
      <div style={styles.cardTop}>
        <div style={{ flex: 1 }}>
          <div style={{ ...styles.name, cursor: "pointer" }} onClick={toggleExpand}>
            {!isMe && onStar && <button style={styles.starBtnSm} onClick={(e) => { e.stopPropagation(); onStar(); }}>{starred ? "⭐" : "☆"}</button>}
            {p.name}{isMe && <span style={styles.youTag}>YOU</span>}{p.role === "host" && <span style={styles.hostTag}>HOST</span>}
            {teamsOn && p.team && teamLabel(settings, p.team) ? <span style={{ ...styles.teamTag, background: teamColor(settings, p.team) }}>{teamEmoji(settings, p.team)} {teamLabel(settings, p.team)}</span> : null}
            <span style={styles.expandCaret}>{expanded ? "▾" : "›"}</span>
          </div>
          <div style={styles.bodyline}>
            {(sizes[p.size]?.label) || "Medium"} · {p.sex}
            {vomits > 0 && <span style={styles.vomitTag}> · 🤮 ×{vomits}</span>}
            {fightsOn && (record.wins > 0 || record.losses > 0) && <span style={styles.fightRecord}> · ⚔️ {record.wins}-{record.losses}</span>}
            <button style={styles.editBtn} onClick={onEdit}>edit</button>
            {fightsOn && !isMe && onChallenge && <button style={styles.fightBtn} onClick={(e) => { e.stopPropagation(); onChallenge(p); }}>⚔️ Fight</button>}
          </div>
          {teamsOn && amHost && (
            <div style={styles.assignRow}>
              <span style={styles.assignLabel}>team:</span>
              {teamList(settings).map((t) => (
                <button key={t.id} style={{ ...styles.assignChip, borderColor: t.color, ...(p.team === t.id ? { background: t.color, color: "#15182a" } : {}) }}
                  onClick={() => actions.setTeam(p.id, p.team === t.id ? null : t.id)}>{t.emoji} {t.label}</button>
              ))}
            </div>
          )}
        </div>
        <div style={styles.bacBlock}>
          <div style={{ ...styles.bacWord, color: desc.tone }}>{desc.word}</div>
          <div style={styles.bacNum}>~{bac.toFixed(3)} BAC{count > 0 && <span style={{ ...styles.trendArrow, color: trend.color }}> {trend.sym}</span>}</div>
        </div>
      </div>
      <div style={styles.meterTrack}><div style={{ ...styles.meterFill, width: `${Math.min(100, (bac / 0.2) * 100)}%`, background: desc.tone }} /></div>
      <div style={styles.countRow}>
        <span style={styles.bigCount}>{count}</span>
        <span style={styles.countLabel}>drink{count === 1 ? "" : "s"}</span>
        {count > 0 && <span style={styles.paceChip}>{pace.toFixed(1)}/hr</span>}
        {canLog && <button style={styles.vomitMini} onClick={() => setConfirmVomitId(p.id)} title="Log a vomit">🤮</button>}
        {canLog && p.log.length > 0 && <button style={styles.undo} onClick={() => actions.undoLast(p.id)}>↶</button>}
      </div>
      {count > 0 && <div style={styles.tallyRow}>{Object.entries(tally).map(([t, n]) => <span key={t}>{dd(t).emoji} {n}</span>)}</div>}
      {canLog && (
        <div style={styles.drinkBtns}>
          {Object.entries(drinks).map(([key, d]) => (
            <button key={key} style={styles.drinkBtn} onClick={() => actions.addDrink(p.id, key)}>
              <span style={styles.drinkEmoji}>{d.emoji}</span><span style={styles.drinkLabel}>{d.label}</span>
            </button>
          ))}
        </div>
      )}
      {expanded && <IndividualStats p={p} now={now} drinks={drinks} actions={actions} canEdit={canLog} />}
      <button style={styles.seeMore} onClick={toggleExpand}>{expanded ? "Show less ▲" : "See more ▾"}</button>
    </div>
  );
}

function IndividualStats({ p, now, drinks = DRINKS, actions, canEdit = false }) {
  const peak = peakBAC(p, now, drinks);
  const fav = favoriteDrink(p);
  const dd = (k) => drinks[k] || DRINKS[k] || { emoji: "🍸", label: "drink" };
  const avgPace = drinksPerHour(p, now);
  const rate = bacRatePerHour(p, now);
  const rateWord = rate > 0.005 ? "still climbing" : rate < -0.005 ? "sobering up" : "holding steady";
  const lastDrink = [...p.log].reverse().find((e) => e.type !== "vomit");
  const sinceMin = lastDrink ? Math.round((now - lastDrink.t) / 60000) : null;
  const [editT, setEditT] = useState(null);
  const Stat = ({ k, v }) => <div style={styles.statRow}><span style={styles.statKey}>{k}</span><span style={styles.statVal}>{v}</span></div>;
  return (
    <div style={styles.statsPanel}>
      <Stat k="Peak BAC tonight" v={`~${peak.toFixed(3)}`} />
      <Stat k="Favorite drink" v={fav ? `${dd(fav.type).emoji} ${dd(fav.type).label} ×${fav.n}` : "—"} />
      <Stat k="Pace (avg)" v={`${avgPace.toFixed(1)} drinks/hr`} />
      <Stat k="BAC trend" v={`${rate >= 0 ? "+" : ""}${rate.toFixed(3)}/hr · ${rateWord}`} />
      <Stat k="Last drink" v={sinceMin === null ? "—" : sinceMin < 1 ? "just now" : `${sinceMin} min ago`} />
      {p.log.length > 0 && (
        <>
          <div style={styles.statDivider} />
          <div style={styles.logHeader}>The night, drink by drink</div>
          <div style={styles.logList}>
            {[...p.log].sort((a, b) => a.t - b.t).map((e) => {
              const time = new Date(e.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              if (e.type === "vomit") return (
                <div key={e._id} style={styles.logEntry}>
                  <span style={styles.logTime}>{time}</span><span style={styles.logVomit}>🤮 vomit</span>
                  {canEdit && <button style={{ ...styles.logDelete, marginLeft: "auto" }} onClick={() => actions.deleteEntry(e._id)}>✕</button>}
                </div>
              );
              const isEditing = editT === e._id;
              return (
                <div key={e._id} style={styles.logEntryCol}>
                  <div style={styles.logEntry}>
                    <span style={styles.logTime}>{time}</span>
                    <span style={styles.logType}>{dd(e.type).emoji} {dd(e.type).label}</span>
                    <span style={styles.logSizeBadge}>{POUR[e.pour || DEFAULT_POUR].label}</span>
                    {canEdit && <button style={styles.logEditBtn} onClick={() => setEditT(isEditing ? null : e._id)}>{isEditing ? "done" : "edit"}</button>}
                    {canEdit && <button style={styles.logDelete} onClick={() => actions.deleteEntry(e._id)}>✕</button>}
                  </div>
                  {isEditing && canEdit && (
                    <div style={styles.logControls}>
                      <div style={styles.logChipRow}>
                        {Object.entries(drinks).map(([k, d]) => (
                          <button key={k} title={d.label} style={{ ...styles.logChip, ...(e.type === k ? styles.logChipOn : {}) }} onClick={() => actions.setDrinkType(e._id, k)}>{d.emoji}</button>
                        ))}
                      </div>
                      <div style={styles.logChipRow}>
                        {Object.entries(POUR).map(([k, pr]) => (
                          <button key={k} style={{ ...styles.logSize, ...((e.pour || DEFAULT_POUR) === k ? styles.logChipOn : {}) }} onClick={() => actions.setPour(e._id, k)}>{pr.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// TIMELINE GRAPH (scrubbable)
// ============================================================
function TimelineGraph({ people, now, metric, setMetric, legalLimit = 0.08 }) {
  const W = 320, H = 180, padL = 34, padR = 10, padT = 14, padB = 24;
  const [scrubT, setScrubT] = useState(null);

  const allTs = people.flatMap((p) => p.log.map((d) => d.t));
  if (allTs.length === 0) return null;
  const t0 = Math.min(...allTs);
  const t1 = Math.max(now, t0 + 120000); // grow from a 2-min floor, not 10
  const span = t1 - t0;
  const STEPS = 40;
  const sampleTimes = Array.from({ length: STEPS + 1 }, (_, i) => t0 + (span * i) / STEPS);
  let maxV = 0;
  const series = people.map((p, idx) => {
    const pts = sampleTimes.map((t) => { const v = valueAt(p, t, metric); if (v > maxV) maxV = v; return { t, v }; });
    return { person: p, color: LINE_COLORS[idx % LINE_COLORS.length], pts };
  });
  if (maxV <= 0) maxV = 1;
  const x = (t) => padL + ((t - t0) / span) * (W - padL - padR);
  const y = (v) => H - padB - (v / maxV) * (H - padT - padB);
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yLabel = (v) => (metric === "bac" ? v.toFixed(2) : Math.round(v));
  const fmtVal = (v) => (metric === "bac" ? `~${v.toFixed(3)}` : `${Math.round(v)}`);

  const tipData = scrubT != null ? series.map((s) => ({ name: s.person.name, color: s.color, v: valueAt(s.person, scrubT, metric) })) : null;

  // Restored from the original version that worked well: handlers directly on
  // the SVG, mouse + touch, marker shows while dragging and clears on release.
  const svgRef = useRef(null);
  const pointerToTime = (clientX) => {
    const svg = svgRef.current; if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const clamped = Math.max(padL, Math.min(W - padR, px));
    return t0 + ((clamped - padL) / (W - padL - padR)) * span;
  };
  const handleMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const t = pointerToTime(clientX);
    if (t != null) setScrubT(t);
  };
  // Note: we intentionally do NOT clear on release — so a tap selects a moment
  // and its stats stay visible until you pick another spot or tap Clear.

  return (
    <div style={styles.graphWrap}>
      <div style={styles.graphHead}>
        <span style={styles.graphTitle}>The night so far</span>
        <div style={styles.metricToggle}>
          {[{ key: "drinks", label: "Drinks" }, { key: "bac", label: "BAC" }].map((m) => (
            <button key={m.key} style={{ ...styles.metricBtn, ...(metric === m.key ? styles.metricOn : {}) }} onClick={() => setMetric(m.key)}>{m.label}</button>
          ))}
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", touchAction: "none", display: "block", cursor: "crosshair" }}
          onMouseDown={handleMove} onMouseMove={(e) => e.buttons === 1 && handleMove(e)}
          onTouchStart={handleMove} onTouchMove={handleMove}>
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => { const gv = maxV * f; return (
            <g key={i}>
              <line x1={padL} y1={y(gv)} x2={W - padR} y2={y(gv)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <text x={padL - 5} y={y(gv) + 3} fontSize="8" fill="#6f758c" textAnchor="end">{yLabel(gv)}</text>
            </g>
          ); })}
          <text x={padL} y={H - 8} fontSize="8" fill="#6f758c" textAnchor="start">{fmtTime(t0)}</text>
          <text x={W - padR} y={H - 8} fontSize="8" fill="#6f758c" textAnchor="end">{fmtTime(t1)}</text>
          {metric === "bac" && legalLimit <= maxV && (
            <g>
              <line x1={padL} y1={y(legalLimit)} x2={W - padR} y2={y(legalLimit)} stroke="#d9533b" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.85" />
              <text x={W - padR} y={y(legalLimit) - 4} fontSize="8" fill="#d9533b" textAnchor="end">legal limit {legalLimit.toFixed(2)}</text>
            </g>
          )}
          {series.map((s) => {
            const path = s.pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${x(pt.t).toFixed(1)} ${y(pt.v).toFixed(1)}`).join(" ");
            const last = s.pts[s.pts.length - 1];
            return <g key={s.person.id}><path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />{last.v > 0 && <circle cx={x(last.t)} cy={y(last.v)} r="2.5" fill={s.color} />}</g>;
          })}
          {scrubT != null && (
            <g>
              <line x1={x(scrubT)} y1={padT - 6} x2={x(scrubT)} y2={H - padB} stroke="#f3ead4" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
              {series.map((s) => <circle key={s.person.id} cx={x(scrubT)} cy={y(valueAt(s.person, scrubT, metric))} r="3" fill={s.color} stroke="#15182a" strokeWidth="0.5" />)}
            </g>
          )}
        </svg>
        {scrubT != null && tipData && (
          <div style={styles.scrubPanel}>
            <div style={styles.scrubPanelHead}>
              <span>📍 {fmtTime(scrubT)}</span>
              <button style={styles.scrubClear} onClick={() => setScrubT(null)}>clear</button>
            </div>
            {[...tipData].sort((a, b) => b.v - a.v).map((r) => (
              <div key={r.name} style={styles.tipRow}>
                <span style={{ ...styles.legendDot, background: r.color }} />
                <span style={styles.tipName}>{r.name}</span>
                <span style={styles.tipVal}>{fmtVal(r.v)} {metric === "bac" ? "BAC" : "drinks"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={styles.legend}>{series.map((s) => <span key={s.person.id} style={styles.legendItem}><span style={{ ...styles.legendDot, background: s.color }} />{s.person.name}</span>)}</div>
      <div style={styles.scrubHint}>{scrubT != null ? `${metric === "bac" ? "BAC" : "Drinks"} at ${fmtTime(scrubT)}` : "Press and drag across the chart to rewind the night"}</div>
    </div>
  );
}

// ============================================================
// CHAT
// ============================================================
function ChatBox({ chat, me, people = [], eventId, onPost, onDelete, onReact, now }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [dm, setDm] = useState(null); // null = group; otherwise a personId
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const REACTIONS = ["❤️", "👍", "👎", "🥂", "❗"];

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [chat.length, dm]);

  // filter: group view shows messages with no recipient; DM view shows messages between me and the selected person
  const visible = chat.filter((m) => {
    if (m.text && m.text.startsWith("__shotin__")) return false;
    if (!dm) return !m.toPerson;
    if (!me) return false;
    return (m.personId === me.id && m.toPerson === dm) || (m.personId === dm && m.toPerson === me.id);
  });
  const others = people.filter((p) => me && p.id !== me.id);

  const send = () => { const t = text.trim(); if (!t || !me) return; onPost(t, null, dm); setText(""); };
  const pickPhoto = () => fileRef.current?.click();
  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    setUploading(true);
    try {
      const url = await uploadChatPhoto(eventId, file);
      onPost(text.trim() || "", url, dm);
      setText("");
    } catch (err) {
      alert("Photo upload failed. Make sure photo storage is set up (see deploy notes). " + (err.message || ""));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const timeStr = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const react = (chatId, emoji) => {
    if (!me) return;
    const who = (chat.find((c) => c.id === chatId)?.reactions?.[emoji]) || [];
    onReact(chatId, me.id, emoji, who.includes(me.id));
    setPickerFor(null);
  };
  const dmName = dm ? (people.find((p) => p.id === dm)?.name || "someone") : null;

  return (
    <div style={styles.chatWrap}>
      <div style={styles.chatModeRow}>
        <button style={{ ...styles.chatModeBtn, ...(dm === null ? styles.chatModeOn : {}) }} onClick={() => setDm(null)}>Group</button>
        {others.length > 0 && (
          <select style={styles.chatDmSelect} value={dm || ""} onChange={(e) => setDm(e.target.value || null)}>
            <option value="">Direct message…</option>
            {others.map((p) => <option key={p.id} value={p.id}>🔒 {p.name}</option>)}
          </select>
        )}
      </div>
      {dm && <div style={styles.dmBanner}>🔒 Direct with {dmName} — only you two see this</div>}
      <div style={styles.chatList} ref={listRef}>
        {visible.length === 0 && <div style={styles.chatEmpty}>{dm ? `No messages with ${dmName} yet.` : "No messages yet. Say hi 👋"}</div>}
        {[...visible].sort((a, b) => a.t - b.t).map((m) => {
          const mine = me && m.personId === me.id;
          const rx = m.reactions || {};
          const hasRx = Object.values(rx).some((arr) => arr.length > 0);
          return (
            <div key={m.id} style={{ ...styles.bubbleRow, justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", maxWidth: "92%", minWidth: 0 }}>
                <div style={{ ...styles.bubble, ...(mine ? styles.bubbleMine : styles.bubbleTheirs) }} onDoubleClick={() => react(m.id, "❤️")}>
                  {!mine && <div style={styles.bubbleName}>{m.name}</div>}
                  {m.imageUrl && <img src={m.imageUrl} alt="" style={styles.bubbleImg} />}
                  {m.text && <div style={styles.bubbleText}>{m.text}</div>}
                  <div style={styles.bubbleTime}>{timeStr(m.t)}{mine && <button style={styles.bubbleDel} onClick={() => onDelete(m.id)}>delete</button>}</div>
                </div>
                <div style={{ ...styles.reactBar, justifyContent: mine ? "flex-end" : "flex-start" }}>
                  {hasRx && Object.entries(rx).map(([emoji, arr]) => arr.length > 0 && (
                    <button key={emoji} style={{ ...styles.reactChip, ...(me && arr.includes(me.id) ? styles.reactChipMine : {}) }} onClick={() => react(m.id, emoji)}>
                      {emoji} {arr.length}
                    </button>
                  ))}
                  <button style={styles.reactAdd} onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}>{pickerFor === m.id ? "×" : "+"}</button>
                  {pickerFor === m.id && (
                    <div style={styles.reactPicker}>
                      {REACTIONS.map((e) => <button key={e} style={styles.reactPick} onClick={() => react(m.id, e)}>{e}</button>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={styles.chatInputRow}>
        <button style={styles.photoBtn} onClick={pickPhoto} disabled={uploading} title="Add photo">{uploading ? "…" : "📷"}</button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhoto} />
        <input style={styles.chatInput} placeholder={dm ? `Message ${dmName}…` : "Message…"} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button style={styles.chatSend} onClick={send}>Send</button>
      </div>
    </div>
  );
}

function InfoInline({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button style={styles.infoDot} onClick={() => setOpen(!open)} type="button">ⓘ</button>
      {open && <span style={styles.infoPop} onClick={() => setOpen(false)}>{text}</span>}
    </span>
  );
}

function SizeInfoLabel() {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", width: 56, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={styles.fieldLabel}>Size</span>
      <button style={styles.infoDot} onClick={() => setOpen(!open)} type="button">ⓘ</button>
      {open && (
        <span style={styles.infoPop} onClick={() => setOpen(false)}>
          Your size sets the body weight used to estimate BAC — the same drinks raise a smaller person's BAC more. Pick the closest. (The host can fine-tune exact weights later.)
        </span>
      )}
    </span>
  );
}

// ============================================================
// WALKTHROUGH (shown once on first join)
// ============================================================
function WalkthroughModal({ onClose, shotEnabled, teamsOn }) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: "🍸", title: "Welcome to Last Call", body: "A fun way to track the night together. Here's the 20-second tour." },
    { icon: "➕", title: "Log your drinks", body: "On the My Drinks tab, tap a drink each time you have one. Your count and a rough BAC estimate update live." },
    { icon: "🏆", title: "Leaderboard", body: "See how everyone's doing, the group's favorite drink, and a timeline you can drag to rewind the night." },
    { icon: "💬", title: "Chat", body: "Talk trash, send photos, react. New messages pop up at the top." },
  ];
  if (teamsOn) steps.push({ icon: "🚩", title: "Teams", body: "This party has teams — pick yours and rack up drinks for your side. Scored by average per person, so small teams still have a shot." });
  steps.push({ icon: "🍻", title: "That's it", body: "Tap, sip, talk trash. Let's get into it." });
  const s = steps[step];
  const last = step >= steps.length - 1;
  return (
    <div style={styles.modalBg}>
      <div style={styles.modal}>
        <div style={{ fontSize: 48, textAlign: "center" }}>{s.icon}</div>
        <div style={{ ...styles.modalTitle, textAlign: "center" }}>{s.title}</div>
        <p style={{ ...styles.confirmText, textAlign: "center", minHeight: 60 }}>{s.body}</p>
        <div style={styles.wrappedDots}>{steps.map((_, i) => <span key={i} style={{ ...styles.wDot, ...(i === step ? styles.wDotOn : {}) }} />)}</div>
        <div style={styles.formActions}>
          {step > 0 && <button style={styles.cancelBtn} onClick={() => setStep(step - 1)}>Back</button>}
          {!last ? <button style={styles.saveBtn} onClick={() => setStep(step + 1)}>Next</button>
                 : <button style={styles.saveBtn} onClick={onClose}>Let's go 🎉</button>}
        </div>
        <button style={styles.linkBtn} onClick={onClose}>Skip</button>
      </div>
    </div>
  );
}

// ============================================================
// ADD SHEET (center + → roll-up overlay for logging)
// ============================================================
function AddSheet({ me, people = [], now, drinks = DRINKS, actions, shotEnabled, myShotUsed, onShot, onVomit, onClose }) {
  const count = drinkCountAtTime(me, now);
  const bac = count ? bacAtTime(me, now, drinks) : 0;
  const desc = bacDescriptor(bac);
  const [flash, setFlash] = useState(null);
  const [justLogged, setJustLogged] = useState(false);
  const [showShot, setShowShot] = useState(false);
  const [shotNote, setShotNote] = useState("");
  const ranked = [...people].map((p) => ({ id: p.id, n: drinkCountAtTime(p, now) })).sort((a, b) => b.n - a.n);
  const place = ranked.findIndex((r) => r.id === me.id) + 1;
  const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const tally = {};
  me.log.forEach((d) => { if (d.type !== "vomit") tally[d.type] = (tally[d.type] || 0) + 1; });

  const logIt = (key) => {
    actions.addDrink(me.id, key);
    const d = drinks[key] || { emoji: "🍸", label: "drink" };
    setFlash(d.emoji);
    setJustLogged(true);
    setTimeout(() => setFlash(null), 700);
  };
  const photoRef = useRef(null);
  const onEmptyPic = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // attach to my most recent landed (non-pending) drink
    const landed = me.log.filter((l) => l.type !== "vomit" && !l._pending).sort((a, b) => b.t - a.t)[0];
    if (!landed) { alert("Give it a second for the drink to save, then try the photo again."); return; }
    try { await actions.attachDrinkPhoto(landed._id, file); setJustLogged(false); } catch (err) { alert("Photo upload failed: " + (err.message || "")); }
    if (photoRef.current) photoRef.current.value = "";
  };

  return (
    <div style={styles.sheetBg} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.sheetHandle} />
        <div style={styles.sheetStat}>
          <span style={styles.sheetCount}>{count}</span>
          <span style={styles.sheetCountLabel}>drink{count === 1 ? "" : "s"} · <span style={{ color: desc.tone }}>{desc.word}</span></span>
          <span style={styles.sheetBac}>~{bac.toFixed(3)} BAC{count > 0 && people.length > 1 ? ` · ${ord(place)} place` : ""}</span>
          {count > 0 && <div style={styles.sheetTally}>{Object.entries(tally).map(([t, n]) => <span key={t} style={styles.sheetTallyItem}>{(drinks[t] || { emoji: "🍸" }).emoji} {n}</span>)}</div>}
        </div>
        {flash && (
          <div style={styles.sheetFlashWrap}>
            <div style={styles.sheetFlashRing} />
            <div style={styles.sheetFlash}>{flash}</div>
            <div style={styles.sheetFlashTxt}>+1 🎉</div>
          </div>
        )}
        <div style={styles.sheetGrid}>
          {Object.entries(drinks).map(([key, d]) => (
            <button key={key} style={styles.sheetDrink} onClick={() => logIt(key)}>
              <span style={styles.sheetDrinkEmoji}>{d.emoji}</span>
              <span style={styles.sheetDrinkLabel}>{d.label}{tally[key] ? ` · ${tally[key]}` : ""}</span>
            </button>
          ))}
        </div>
        {justLogged && (
          <div style={styles.emptyPicPrompt}>
            <span style={styles.emptyPicText}>Nice. Want to snap the empty? (optional)</span>
            <button style={styles.emptyPicBtn} onClick={() => photoRef.current?.click()}>📷 Add pic</button>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onEmptyPic} />
          </div>
        )}
        <div style={styles.sheetRow}>
          <button style={styles.sheetVomit} onClick={() => { onVomit(); onClose(); }}>🤮 Vomit</button>
          {shotEnabled && (
            myShotUsed
              ? <button style={{ ...styles.sheetShot, opacity: 0.5 }} disabled>🥃 Shot used</button>
              : <button style={styles.sheetShot} onClick={() => setShowShot(true)}>🥃 Call shots</button>
          )}
        </div>
        {showShot && (
          <div style={styles.shotComposerWrap}>
            <div style={styles.shotWarn}>⚠️ You only get one shot call all night — make it count.</div>
            <div style={styles.shotComposer}>
              <input style={styles.chatInput} placeholder="where? (optional, e.g. back bar)" value={shotNote} onChange={(e) => setShotNote(e.target.value)} maxLength={40} />
              <button style={styles.chatSend} onClick={() => { onShot(shotNote.trim()); setShowShot(false); onClose(); }}>Send it 🥃</button>
            </div>
          </div>
        )}
        <button style={styles.sheetClose} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// ============================================================
// BIG FEED (full tab — social wall)
// ============================================================
function BigFeed({ people, now, drinks = DRINKS, chat = [], shotCalls = [], fights = [], me, feedReactions = {}, onReact, onPerson }) {
  const events = [];
  people.forEach((p) => p.log.forEach((e) => events.push({ kind: "log", ...e, name: p.name, personId: p.id, target: "log:" + (e._id || e.t) })));  chat.forEach((m) => { if (!m.toPerson && !(m.text && m.text.startsWith("__shotin__"))) events.push({ kind: "chat", t: m.t, name: m.name, text: m.text, imageUrl: m.imageUrl, personId: m.personId, target: "chat:" + m.id }); });
  shotCalls.forEach((s) => events.push({ kind: "shot", t: s.t, name: s.name, note: s.note, personId: s.personId, target: "shot:" + s.id }));
  fights.forEach((f) => { if (f.status === "done" && f.winnerId) { const winner = f.winnerId === f.challengerId ? f.challengerName : f.opponentName; const loser = f.winnerId === f.challengerId ? f.opponentName : f.challengerName; events.push({ kind: "fight", t: (f.endedAt || f.t), name: winner, personId: f.winnerId, loser, target: "fight:" + f.id }); } });
  // derived milestones: every 5th drink per person
  people.forEach((p) => {
    const dl = p.log.filter((e) => e.type !== "vomit").sort((a, b) => a.t - b.t);
    dl.forEach((e, idx) => {
      const n = idx + 1;
      if (n % 5 === 0) events.push({ kind: "milestone", t: e.t, name: p.name, personId: p.id, n, target: "ms:" + p.id + ":" + n });
    });
  });
  events.sort((a, b) => b.t - a.t);
  const [pickFor, setPickFor] = useState(null);
  const REACTIONS = ["❤️", "👍", "🔥", "🥂", "👏"];
  const doReact = (target, emoji) => {
    const who = (feedReactions[target] && feedReactions[target][emoji]) || [];
    onReact && onReact(target, emoji, me && who.includes(me.id));
    setPickFor(null);
  };

  const row = (e, i) => {
    const mins = Math.round((now - e.t) / 60000);
    const ago = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
    let icon, text;
    if (e.kind === "shot") { icon = "🥃"; text = `${e.name} called shots!${e.note ? " — " + e.note : ""}`; }
    else if (e.kind === "fight") { icon = "⚔️"; text = `${e.name} beat ${e.loser} in a beer fight`; }
    else if (e.kind === "milestone") { icon = e.n % 10 === 0 ? "🔥" : "🍻"; text = `${e.name} hit ${e.n} drinks!`; }
    else if (e.kind === "chat") { icon = e.imageUrl && !e.text ? "📷" : "💬"; text = e.imageUrl && !e.text ? `${e.name} sent a photo` : `${e.name}: ${e.text}`; }
    else if (e.type === "vomit") { icon = "🤮"; text = `${e.name} had a rough moment`; }
    else { const d = drinks[e.type] || { emoji: "🍸", label: "drink" }; const sz = POUR[e.pour || "M"].label; icon = d.emoji; text = `${e.name} had a ${sz === "M" ? "" : sz + " "}${d.label.toLowerCase()}`; }
    const rx = feedReactions[e.target] || {};
    const hasRx = Object.values(rx).some((arr) => arr.length > 0);
    return (
      <div key={i} style={styles.bigFeedItem}>
        <div style={styles.bigFeedRow} onClick={() => e.personId && onPerson && onPerson(e.personId)}>
          <span style={styles.bigFeedIcon}>{icon}</span>
          <span style={styles.bigFeedText}>{text}</span>
          {e.kind === "log" && e.imageUrl && <img src={e.imageUrl} alt="" style={styles.feedThumb} />}
          <span style={styles.bigFeedAgo}>{ago}</span>
        </div>
        <div style={styles.feedReactBar}>
          {hasRx && Object.entries(rx).map(([emoji, arr]) => arr.length > 0 && (
            <button key={emoji} style={{ ...styles.reactChip, ...(me && arr.includes(me.id) ? styles.reactChipMine : {}) }} onClick={() => doReact(e.target, emoji)}>{emoji} {arr.length}</button>
          ))}
          <button style={styles.reactAdd} onClick={() => setPickFor(pickFor === e.target ? null : e.target)}>{pickFor === e.target ? "×" : "♡"}</button>
          {pickFor === e.target && (
            <div style={styles.reactPicker}>
              {REACTIONS.map((em) => <button key={em} style={styles.reactPick} onClick={() => doReact(e.target, em)}>{em}</button>)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.bigFeedWrap}>
      <div style={styles.bigFeedHead}><span style={styles.feedDot} /> THE NIGHT, LIVE</div>
      {events.length === 0 ? <div style={styles.feedVEmpty}>Nothing yet — tap ＋ to log the first drink.</div> : events.map(row)}
    </div>
  );
}

// ============================================================
// BEER FIGHTS — challenge composer + fight overlay
// ============================================================
function ChallengeComposer({ me, target, onSend, onCancel }) {
  const [taunt, setTaunt] = useState(null);
  return (
    <div style={styles.modalBg} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 42, textAlign: "center" }}>⚔️</div>
        <div style={{ ...styles.modalTitle, textAlign: "center" }}>Challenge {target.name}?</div>
        <p style={{ ...styles.confirmText, textAlign: "center" }}>Best tap count wins. Your drinks tonight built your sword.</p>
        <div style={styles.tauntList}>
          <div style={styles.tauntLabel}>Add a taunt (optional)</div>
          {TAUNTS.map((t, i) => (
            <button key={i} style={{ ...styles.tauntBtn, ...(taunt === t ? styles.tauntBtnOn : {}) }} onClick={() => setTaunt(taunt === t ? null : t)}>{t}</button>
          ))}
        </div>
        <div style={styles.formActions}>
          <button style={styles.cancelBtn} onClick={onCancel}>Back down</button>
          <button style={styles.dangerBtn} onClick={() => onSend(taunt)}>Send challenge ⚔️</button>
        </div>
      </div>
    </div>
  );
}

function FightOverlay({ fight, me, people, drinks, liveNow, actions, onClose }) {
  const amChallenger = fight.challengerId === me.id;
  const amOpponent = fight.opponentId === me.id;
  const mySide = amChallenger ? "challenger" : "opponent";
  const myKey = amChallenger ? "challengerTaps" : "opponentTaps";
  const theirKey = amChallenger ? "opponentTaps" : "challengerTaps";
  const challenger = people.find((p) => p.id === fight.challengerId);
  const opponent = people.find((p) => p.id === fight.opponentId);

  // PENDING (waiting for opponent decision)
  if (fight.status === "pending") {
    return (
      <div style={styles.fightOverlay}>
        <div style={styles.fightGlyph}>⚔️</div>
        {amOpponent ? (
          <>
            <div style={styles.fightHead}>{fight.challengerName} challenges you!</div>
            {fight.taunt && <div style={styles.fightTaunt}>"{fight.taunt}"</div>}
            <div style={styles.fightSub}>Best tap count wins. Ready?</div>
            <button style={styles.fightAccept} onClick={() => actions.respondToFight(fight.id, true)}>Bring it on ⚔️</button>
            <button style={styles.fightDecline} onClick={() => actions.respondToFight(fight.id, false)}>Not tonight</button>
          </>
        ) : (
          <>
            <div style={styles.fightHead}>Waiting for {fight.opponentName}…</div>
            {fight.taunt && <div style={styles.fightTaunt}>"{fight.taunt}"</div>}
            <div style={styles.fightSub}>30 seconds to respond</div>
            <button style={styles.fightDecline} onClick={onClose}>Cancel</button>
          </>
        )}
      </div>
    );
  }

  if (fight.status === "declined") {
    return (
      <div style={styles.fightOverlay}>
        <div style={styles.fightGlyph}>🛡️</div>
        <div style={styles.fightHead}>{amChallenger ? `${fight.opponentName} declined.` : "You declined."}</div>
        <div style={styles.fightSub}>{amChallenger ? "Coward." : "Live to fight another round."}</div>
        <button style={styles.fightAccept} onClick={onClose}>OK</button>
      </div>
    );
  }
  if (fight.status === "expired") {
    return (
      <div style={styles.fightOverlay}>
        <div style={styles.fightGlyph}>⏳</div>
        <div style={styles.fightHead}>Challenge expired</div>
        <div style={styles.fightSub}>{amChallenger ? `${fight.opponentName} didn't respond.` : "Too slow."}</div>
        <button style={styles.fightAccept} onClick={onClose}>OK</button>
      </div>
    );
  }

  // ACTIVE — running fight UI
  return <FightActive fight={fight} mySide={mySide} myKey={myKey} theirKey={theirKey}
    me={me} challenger={challenger} opponent={opponent} drinks={drinks} liveNow={liveNow}
    actions={actions} onClose={onClose} />;
}

function FightActive({ fight, mySide, myKey, theirKey, me, challenger, opponent, drinks, liveNow, actions, onClose }) {
  // 3 phases: countdown(3s) → tap window(5s) → result
  const [phase, setPhase] = useState("countdown");
  const [count, setCount] = useState(3);
  const [taps, setTaps] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const tapsRef = useRef(0);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) { setPhase("tap"); return; }
    const id = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, count]);

  useEffect(() => {
    if (phase !== "tap") return;
    const id = setTimeout(() => {
      setPhase("submitted");
      actions.submitFightTaps(fight.id, mySide, tapsRef.current).catch(() => {});
      setSubmitted(true);
    }, 5000);
    return () => clearTimeout(id);
  }, [phase, fight.id, mySide]);

  // When both sides have submitted, finalize (challenger does it to avoid races)
  useEffect(() => {
    if (fight.challengerTaps == null || fight.opponentTaps == null) return;
    if (fight.status === "done" || !fight.result) {
      if (me.id !== fight.challengerId) return; // only challenger finalizes
      if (fight.status === "done") return;
      const cStats = swordStats(challenger, liveNow, drinks);
      const oStats = swordStats(opponent, liveNow, drinks);
      const result = resolveFight(
        { name: challenger.name, taps: fight.challengerTaps, stats: cStats },
        { name: opponent.name, taps: fight.opponentTaps, stats: oStats }
      );
      const winnerId = result.winner === "tie" ? null : result.winner === "a" ? challenger.id : opponent.id;
      actions.finalizeFight(fight.id, { ...result, winnerId, challengerStats: cStats, opponentStats: oStats }).catch(() => {});
    }
  }, [fight.challengerTaps, fight.opponentTaps, fight.status, me, challenger, opponent, liveNow, drinks]);

  const tap = () => {
    if (phase !== "tap") return;
    tapsRef.current += 1;
    setTaps(tapsRef.current);
  };

  if (fight.status === "done" && fight.result) {
    const r = fight.result;
    const amWinner = r.winnerId === me.id;
    const isTie = !r.winnerId;
    return (
      <div style={styles.fightOverlay}>
        <div style={styles.fightGlyph}>{isTie ? "⚖️" : amWinner ? "🏆" : "💀"}</div>
        <div style={styles.fightHead}>{isTie ? "Dead tie!" : amWinner ? "You won!" : `${(amWinner ? me : (me.id === challenger.id ? opponent : challenger)).name} won`}</div>
        <div style={styles.fightScoreRow}>
          <div style={styles.fightScoreSide}>
            <div style={styles.fightScoreName}>{challenger.name}</div>
            <div style={styles.fightScoreTaps}>{fight.challengerTaps} taps</div>
            <div style={styles.fightScoreDmg}>dmg {r.aScore.toFixed(1)}</div>
          </div>
          <div style={styles.fightVs}>vs</div>
          <div style={styles.fightScoreSide}>
            <div style={styles.fightScoreName}>{opponent.name}</div>
            <div style={styles.fightScoreTaps}>{fight.opponentTaps} taps</div>
            <div style={styles.fightScoreDmg}>dmg {r.bScore.toFixed(1)}</div>
          </div>
        </div>
        {r.log && r.log.length > 0 && r.log.map((line, i) => <div key={i} style={styles.fightLogLine}>{line}</div>)}
        <button style={styles.fightAccept} onClick={onClose}>Done</button>
      </div>
    );
  }

  if (phase === "submitted") {
    return (
      <div style={styles.fightOverlay}>
        <div style={styles.fightGlyph}>⏱️</div>
        <div style={styles.fightHead}>{taps} taps locked in</div>
        <div style={styles.fightSub}>Waiting for the other side…</div>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div style={styles.fightOverlay}>
        <div style={styles.fightGlyph}>⚔️</div>
        <div style={styles.fightHead}>Ready…</div>
        <div style={styles.fightCount}>{count > 0 ? count : "GO!"}</div>
      </div>
    );
  }

  // tap phase
  return (
    <div style={styles.fightOverlay} onClick={tap} onTouchStart={tap}>
      <div style={styles.fightTapPrompt}>TAP! TAP! TAP!</div>
      <div style={styles.fightTapCount}>{taps}</div>
      <div style={styles.fightSub}>swing that sword</div>
    </div>
  );
}

// ============================================================
// SUGGESTION BOX (everyone can submit; developer can read)
// ============================================================
function SuggestionBox() {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [list, setList] = useState(null);
  const myName = (typeof localStorage !== "undefined" && localStorage.getItem(LS_NAME)) || "anon";
  const myPhone = (typeof localStorage !== "undefined" && localStorage.getItem(LS_PHONE)) || "";
  const isDev = myPhone && myPhone === DEVELOPER_PHONE;

  const submit = async () => {
    const t = text.trim(); if (!t) return;
    try { await postSuggestion({ name: myName, text: t }); setText(""); setSent(true); setTimeout(() => setSent(false), 2500); } catch (e) {}
  };
  const loadDev = async () => {
    setShowDev(true);
    try { setList(await fetchSuggestions()); } catch (e) { setList([]); }
  };

  return (
    <div style={styles.settingBlock}>
      <div style={styles.settingTitle}>💡 Suggest a feature</div>
      <div style={styles.settingHint}>Got an idea to make Last Call better? Tell us — we actually read these.</div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input style={{ ...styles.chatInput, flex: 1 }} placeholder="Your idea…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button style={styles.chatSend} onClick={submit}>{sent ? "Thanks!" : "Send"}</button>
      </div>
      {isDev && (
        <div style={{ marginTop: 12 }}>
          {!showDev ? (
            <button style={styles.linkBtn} onClick={loadDev}>▾ View all suggestions (developer)</button>
          ) : (
            <div>
              <div style={{ ...styles.kicker, marginBottom: 6 }}>ALL SUGGESTIONS</div>
              {list === null && <div style={styles.chatEmpty}>Loading…</div>}
              {list && list.length === 0 && <div style={styles.chatEmpty}>None yet.</div>}
              {list && list.map((s) => (
                <div key={s.id} style={styles.suggestRow}>
                  <div style={styles.suggestText}>{s.text}</div>
                  <div style={styles.suggestMeta}>{s.name || "anon"} · {new Date(s.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function SettingsScreen({ settings, amHost, onSave, onCancel }) {
  const init = settings && settings.legalLimit != null ? settings : defaultSettings();
  const [stateCode, setStateCode] = useState(init.state || "NJ");
  const [limit, setLimit] = useState(init.legalLimit ?? 0.08);
  const [theme, setTheme] = useState(init.theme || "midnight");
  const [drinks, setDrinks] = useState(JSON.parse(JSON.stringify(init.drinks || DRINKS)));
  const [sizes, setSizes] = useState(JSON.parse(JSON.stringify(init.sizes || SIZES)));
  const [sexWeights, setSexWeights] = useState(JSON.parse(JSON.stringify(init.sexWeights || SIZES_BY_SEX)));
  const [shotCallEnabled, setShotCallEnabled] = useState(init.shotCallEnabled !== false);
  const [teamCount, setTeamCount] = useState(init.teamCount || 0);
  const [teams, setTeams] = useState(JSON.parse(JSON.stringify(init.teams || {})));
  const [teamsLocked, setTeamsLocked] = useState(init.teamsLocked === true);
  const setTeamField = (id, field, val) => setTeams((t) => ({ ...t, [id]: { ...(t[id] || {}), [field]: val } }));
  const [drinkNotifs, setDrinkNotifs] = useState(init.drinkNotifs === true);
  const [fightsEnabled, setFightsEnabled] = useState(init.fightsEnabled === true);
  const setSexWeight = (sex, sz, v) => setSexWeights((w) => ({ ...w, [sex]: { ...w[sex], [sz]: v } }));
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState(DRINK_EMOJIS[0]);
  const [newAlc, setNewAlc] = useState(14);

  const pickState = (c) => { setStateCode(c); if (STATES[c] != null) setLimit(STATES[c]); };
  const setDrinkAlc = (k, v) => setDrinks((d) => ({ ...d, [k]: { ...d[k], alcG: v } }));
  const setSizeWeight = (k, v) => setSizes((s) => ({ ...s, [k]: { ...s[k], weightLb: v } }));
  const removeDrink = (k) => setDrinks((d) => { const c = { ...d }; delete c[k]; return c; });
  const addCustomDrink = () => {
    const label = newName.trim(); if (!label) return;
    const key = "c_" + label.toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + Math.random().toString(36).slice(2, 5);
    setDrinks((d) => ({ ...d, [key]: { label, emoji: newEmoji, alcG: Number(newAlc) || 14, custom: true } }));
    setNewName(""); setNewAlc(14);
  };
  const save = () => onSave({ state: stateCode, legalLimit: Number(limit) || 0.08, theme, drinks, sizes, sexWeights, shotCallEnabled, teamCount, drinkNotifs, teams, teamsLocked, fightsEnabled });

  return (
    <div style={themedPage({ theme })}>
      <style>{GLOBAL_CSS}</style>
      <header style={styles.liveHeader}>
        <div style={styles.headerRow}><button style={styles.gearBtn} onClick={onCancel}>‹ Back</button><div style={styles.kicker}>SETTINGS</div><span style={{ width: 60 }} /></div>
      </header>

      {!amHost && <div style={styles.settingBlock}><div style={styles.confirmText}>Only the host can change event settings (theme, drinks, limits). You can read everything here.</div></div>}

      <div style={styles.settingBlock}>
        <div style={styles.settingTitle}>How this works & drinking safely</div>
        <div style={styles.explainer}>
          <p style={styles.explainerP}>Last Call estimates everyone's blood alcohol (BAC) using the <b>Widmark formula</b> — a real method that factors in what you've had, your body weight, a men-vs-women difference, and time (your body burns it off slowly, so the number drifts down when you ease up).</p>
          <p style={styles.explainerP}>Smaller folks and women climb faster on the same drinks — just how the math shakes out.</p>
          <p style={styles.explainerP}>It's a ballpark for fun, not a breathalyzer. Now go enjoy. 🥂</p>
        </div>
      </div>

      {amHost && (
        <div style={styles.settingBlock}>
          <div style={styles.settingTitle}>Legal limit</div>
          <div style={styles.settingRow}><span style={styles.settingLabel}>State</span>
            <select style={styles.select} value={stateCode} onChange={(e) => pickState(e.target.value)}>{Object.keys(STATES).map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <div style={styles.settingRow}><span style={styles.settingLabel}>BAC limit</span>
            <input style={styles.numInput} type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
        </div>
      )}

      {amHost && (
        <div style={styles.settingBlock}>
          <div style={styles.settingTitle}>Theme</div>
          <div style={styles.themeGrid}>
            {Object.entries(THEMES).map(([k, th]) => (
              <button key={k} style={{ ...styles.themeChip, background: th.pageBg, border: theme === k ? `2px solid ${th.accent}` : "1px solid rgba(255,255,255,0.15)" }} onClick={() => setTheme(k)}>
                <span style={{ color: th.text }}>{th.motif} {th.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {amHost && (
        <div style={styles.settingBlock}>
          <div style={styles.settingTitle}>Drinks & alcohol weighting (grams)</div>
          {Object.entries(drinks).map(([k, d]) => (
            <div key={k} style={styles.settingRow}>
              <span style={styles.settingLabel}>{d.emoji} {d.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input style={styles.numInput} type="number" step="1" value={d.alcG} onChange={(e) => setDrinkAlc(k, Number(e.target.value))} />
                {Object.keys(drinks).length > 1 && <button style={styles.miniDelete} onClick={() => removeDrink(k)}>✕</button>}
              </div>
            </div>
          ))}
          <div style={styles.settingHint}>Standard drink ≈ 14g. Higher = stronger effect on BAC.</div>
          <div style={styles.addDrinkRow}>
            <div style={styles.emojiPickRow}>{DRINK_EMOJIS.map((em) => <button key={em} style={{ ...styles.emojiPick, ...(newEmoji === em ? styles.emojiPickOn : {}) }} onClick={() => setNewEmoji(em)}>{em}</button>)}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input style={{ ...styles.chatInput, flex: 1 }} placeholder="Custom drink name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input style={styles.numInput} type="number" step="1" value={newAlc} onChange={(e) => setNewAlc(e.target.value)} />
              <button style={styles.chatSend} onClick={addCustomDrink}>Add</button>
            </div>
          </div>
        </div>
      )}

      {amHost && (
        <div style={styles.settingBlock}>
          <div style={styles.settingTitle}>Body size presets (lb) — host only</div>
          <div style={styles.settingHint}>Used for BAC math. Separate weights for men and women per size. Guests never see this.</div>
          <div style={{ ...styles.settingRow, color: "#9aa0b5", fontSize: 11 }}>
            <span style={{ flex: 1 }} /><span style={{ width: 70, textAlign: "center" }}>Men</span><span style={{ width: 70, textAlign: "center" }}>Women</span>
          </div>
          {["small", "medium", "tall"].map((sz) => (
            <div key={sz} style={styles.settingRow}>
              <span style={{ ...styles.settingLabel, flex: 1, textTransform: "capitalize" }}>{sz}</span>
              <input style={{ ...styles.numInput, width: 70 }} type="number" step="5" value={sexWeights.male[sz]} onChange={(e) => setSexWeight("male", sz, Number(e.target.value))} />
              <input style={{ ...styles.numInput, width: 70 }} type="number" step="5" value={sexWeights.female[sz]} onChange={(e) => setSexWeight("female", sz, Number(e.target.value))} />
            </div>
          ))}
        </div>
      )}

      {amHost && (
        <div style={styles.settingBlock}>
          <div style={styles.settingTitle}>Party extras</div>
          <div style={styles.settingRow}>
            <span style={styles.settingLabel}>🥃 Shot call <InfoInline text="Gives everyone one 'Call shots!' blast per night that takes over all phones with a full-screen alert. A fun way to rally the group for a round. Off by default." /></span>
            <button style={{ ...styles.toggleBtn, ...(shotCallEnabled ? styles.toggleOn : {}) }} onClick={() => setShotCallEnabled(!shotCallEnabled)}>{shotCallEnabled ? "On" : "Off"}</button>
          </div>
          <div style={{ ...styles.settingRow, marginTop: 10 }}>
            <span style={styles.settingLabel}>🚩 Teams</span>
            <div style={styles.toggle}>
              {[0, 2, 3, 4].map((n) => (
                <button key={n} style={{ ...styles.toggleBtn, ...(teamCount === n ? styles.toggleOn : {}) }} onClick={() => setTeamCount(n)}>{n === 0 ? "Off" : n}</button>
              ))}
            </div>
          </div>
          <div style={styles.settingHint}>Split the party into teams. People pick their side; you can reassign anyone from the My Drinks tab. Scored by average drinks per person, so uneven teams stay fair.</div>
          {teamCount > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {TEAM_DEFS.slice(0, teamCount).map((t) => (
                <div key={t.id} style={styles.teamEditRow}>
                  <span style={{ ...styles.teamDot, background: t.color }} />
                  <input style={{ ...styles.input, width: 56, textAlign: "center", padding: "8px 4px" }} value={teams[t.id]?.emoji ?? t.emoji} onChange={(e) => setTeamField(t.id, "emoji", e.target.value)} maxLength={2} />
                  <input style={{ ...styles.input, flex: 1 }} value={teams[t.id]?.label ?? t.label} onChange={(e) => setTeamField(t.id, "label", e.target.value)} placeholder={t.label} />
                </div>
              ))}
            </div>
          )}
          {teamCount > 0 && (
            <div style={{ ...styles.settingRow, marginTop: 10 }}>
              <span style={styles.settingLabel}>🔒 Lock teams</span>
              <button style={{ ...styles.toggleBtn, ...(teamsLocked ? styles.toggleOn : {}) }} onClick={() => setTeamsLocked(!teamsLocked)}>{teamsLocked ? "Locked" : "Open"}</button>
            </div>
          )}
          {teamCount > 0 && <div style={styles.settingHint}>Lock once teams are set — players can no longer change their own team (you can still reassign).</div>}
          <div style={{ ...styles.settingRow, marginTop: 10 }}>
            <span style={styles.settingLabel}>🔔 Drink alerts</span>
            <button style={{ ...styles.toggleBtn, ...(drinkNotifs ? styles.toggleOn : {}) }} onClick={() => setDrinkNotifs(!drinkNotifs)}>{drinkNotifs ? "On" : "Off"}</button>
          </div>
          <div style={styles.settingHint}>When on, a little banner pops up when anyone logs a drink (only while the app's open — these aren't phone push notifications). Off by default.</div>
          <div style={{ ...styles.settingRow, marginTop: 10 }}>
            <span style={styles.settingLabel}>⚔️ Beer Fights <InfoInline text="A silly side mini-game. Challenge someone from their Stats card → both phones tap as fast as they can for 5 seconds. Drinks build your sword. Off by default. Doesn't affect the leaderboard." /></span>
            <button style={{ ...styles.toggleBtn, ...(fightsEnabled ? styles.toggleOn : {}) }} onClick={() => setFightsEnabled(!fightsEnabled)}>{fightsEnabled ? "On" : "Off"}</button>
          </div>
        </div>
      )}

      {amHost && <button style={styles.primaryBtn} onClick={save}>Save settings</button>}

      <SuggestionBox />

      <button style={styles.reset} onClick={onCancel}>Cancel</button>
    </div>
  );
}

// ============================================================
// FORMS
// ============================================================
function PersonForm({ onSave, onCancel, sizes = SIZES }) {
  const [name, setName] = useState("");
  const [size, setSize] = useState("medium");
  const [sex, setSex] = useState("male");
  return (
    <div style={styles.form}>
      <input style={styles.input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div style={styles.formRow}><span style={styles.fieldLabel}>Size</span><div style={styles.toggle}>{Object.entries(sizes).map(([k, s]) => <button key={k} style={{ ...styles.toggleBtn, ...(size === k ? styles.toggleOn : {}) }} onClick={() => setSize(k)}>{s.label}</button>)}</div></div>
      <div style={styles.formRow}><span style={styles.fieldLabel}>Sex</span><div style={styles.toggle}>{["male", "female"].map((s) => <button key={s} style={{ ...styles.toggleBtn, ...(sex === s ? styles.toggleOn : {}) }} onClick={() => setSex(s)}>{s}</button>)}</div></div>
      <div style={styles.formActions}><button style={styles.cancelBtn} onClick={onCancel}>Cancel</button><button style={styles.saveBtn} onClick={() => onSave(name, size, sex)}>Add</button></div>
    </div>
  );
}

function EditModal({ person, onSave, onRemove, onClose, canRemove, sizes = SIZES }) {
  const [name, setName] = useState(person.name);
  const [size, setSize] = useState(person.size || "medium");
  const [sex, setSex] = useState(person.sex);
  return (
    <div style={styles.modalBg} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalTitle}>Edit {person.name}</div>
        <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        <div style={styles.formRow}><span style={styles.fieldLabel}>Size</span><div style={styles.toggle}>{Object.entries(sizes).map(([k, s]) => <button key={k} style={{ ...styles.toggleBtn, ...(size === k ? styles.toggleOn : {}) }} onClick={() => setSize(k)}>{s.label}</button>)}</div></div>
        <div style={styles.formRow}><span style={styles.fieldLabel}>Sex</span><div style={styles.toggle}>{["male", "female"].map((s) => <button key={s} style={{ ...styles.toggleBtn, ...(sex === s ? styles.toggleOn : {}) }} onClick={() => setSex(s)}>{s}</button>)}</div></div>
        <div style={styles.formActions}>
          {canRemove && <button style={styles.removeBtn} onClick={onRemove}>Remove</button>}
          <button style={styles.saveBtn} onClick={() => onSave({ name, size, weightLb: weightFor(size, sex), sex })}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// WRAPPED
// ============================================================
function WrappedScreen({ ev, myPersonId, liveNow, onLeave }) {
  const { people, settings, eventName, event, actions } = ev;
  const drinks = getDrinks(settings);
  const endT = event?.ended_at ? new Date(event.ended_at).getTime() : liveNow;
  const [slide, setSlide] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const slides = buildWrappedSlides(people, eventName, event, endT, drinks);
  const me = people.find((p) => p.id === myPersonId);
  const myPhone = (typeof localStorage !== "undefined" && localStorage.getItem(LS_PHONE)) || "";
  const amHost = me?.role === "host" || (myPhone && myPhone === DEVELOPER_PHONE);

  if (showDetail) {
    return <DetailView ev={ev} endT={endT} drinks={drinks} amHost={amHost} onBack={() => setShowDetail(false)} onReopen={amHost ? () => actions.reopen() : null} onLeave={onLeave} />;
  }
  const s = slides[slide];
  const atEnd = slide >= slides.length - 1;
  return (
    <div style={{ ...styles.page, justifyContent: "space-between" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={styles.wrappedTop}>
        <div style={styles.wrappedDots}>{slides.map((_, i) => <span key={i} style={{ ...styles.wDot, ...(i === slide ? styles.wDotOn : {}) }} />)}</div>
        <div style={styles.wrappedEvent}>{eventName}</div>
      </div>
      <div style={{ ...styles.wrappedSlide, background: s.bg }} onClick={() => setSlide((n) => Math.min(slides.length - 1, n + 1))}>
        <div style={styles.wKicker}>{s.kicker}</div>
        <div style={styles.wBig}>{s.big}</div>
        {s.sub && <div style={styles.wSub}>{s.sub}</div>}
        {s.list && <div style={styles.wList}>{s.list.map((row, i) => <div key={i} style={styles.wListRow}><span style={styles.wListRank}>{i + 1}</span><span style={styles.wListName}>{row.name}</span><span style={styles.wListVal}>{row.val}</span></div>)}</div>}
      </div>
      <div style={styles.wrappedNav}>
        {slide > 0 ? <button style={styles.wNavBtn} onClick={() => setSlide((n) => n - 1)}>‹ Back</button> : <span />}
        {!atEnd ? <button style={styles.wNavBtn} onClick={() => setSlide((n) => n + 1)}>Next ›</button> : <button style={styles.wNavBtn} onClick={() => setShowDetail(true)}>See all stats ›</button>}
      </div>
      <div style={styles.wrappedFooter}>
        <button style={styles.linkBtn} onClick={() => setShowDetail(true)}>Skip to full stats</button>
        <span style={styles.dotSep}>·</span>
        <button style={styles.linkBtn} onClick={onLeave}>Exit</button>
      </div>
    </div>
  );
}

function buildWrappedSlides(people, eventName, event, endT, drinks) {
  const totalDrinks = people.reduce((a, p) => a + drinkCountAtTime(p, endT), 0);
  const startT = event?.created_at ? new Date(event.created_at).getTime() : endT;
  const hours = Math.max(0.5, (endT - startT) / 3600000);
  const byDrinks = [...people].map((p) => ({ name: p.name, n: drinkCountAtTime(p, endT) })).sort((a, b) => b.n - a.n);
  const byPeak = [...people].map((p) => ({ name: p.name, b: peakBAC(p, endT, drinks) })).sort((a, b) => b.b - a.b);
  const tally = {};
  people.forEach((p) => p.log.forEach((e) => { if (e.type !== "vomit") tally[e.type] = (tally[e.type] || 0) + 1; }));
  let favType = null, favN = 0;
  for (const [k, n] of Object.entries(tally)) if (n > favN) { favType = k; favN = n; }
  const totalVomits = people.reduce((a, p) => a + p.log.filter((e) => e.type === "vomit").length, 0);
  const champ = byDrinks[0], highest = byPeak[0];
  const stretch = bestStretchOverall(people, 30);
  const dd = (k) => drinks[k] || DRINKS[k] || { emoji: "🍸", label: k };
  const slides = [
    { kicker: "THAT'S A WRAP ON", big: eventName, sub: `${people.length} people · ${Math.round(hours * 10) / 10} hours`, bg: "linear-gradient(160deg,#3a2a5a,#1a2238)" },
    { kicker: "TOGETHER YOU PUT AWAY", big: `${totalDrinks}`, sub: `drink${totalDrinks === 1 ? "" : "s"} — ${(totalDrinks / hours).toFixed(1)} per hour as a group`, bg: "linear-gradient(160deg,#7a3b2e,#2a1622)" },
    { kicker: "DRINK OF THE NIGHT", big: favType ? `${dd(favType).emoji} ${dd(favType).label}` : "—", sub: favType ? `ordered ${favN} times` : "no drinks logged", bg: "linear-gradient(160deg,#2e5a4a,#15222a)" },
    { kicker: "BEST 30-MINUTE STRETCH", big: stretch && stretch.count > 0 ? `🔥 ${stretch.name}` : "—", sub: stretch && stretch.count > 0 ? `${stretch.count} drinks in half an hour${stretch.startT ? ` · from ${new Date(stretch.startT).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}` : "no big runs tonight", bg: "linear-gradient(160deg,#7a4a1e,#2a1a10)" },
    { kicker: "TONIGHT'S CHAMPION", big: champ && champ.n > 0 ? `♛ ${champ.name}` : "—", sub: champ && champ.n > 0 ? `${champ.n} drinks, no notes` : "nobody drank", bg: "linear-gradient(160deg,#7a6328,#2a2415)" },
    { kicker: "HIGHEST PEAK BAC", big: highest && highest.b > 0 ? `~${highest.b.toFixed(3)}` : "—", sub: highest && highest.b > 0 ? `${highest.name} reached the summit` : "—", bg: "linear-gradient(160deg,#5a2e4a,#221522)" },
    { kicker: "THE FINAL LEADERBOARD", big: "", list: byDrinks.filter((r) => r.n > 0).map((r) => ({ name: r.name, val: `${r.n}` })), bg: "linear-gradient(160deg,#2a3b5a,#15182a)" },
  ];
  if (totalVomits > 0) slides.splice(5, 0, { kicker: "FOR THE RECORD", big: `🤮 ${totalVomits}`, sub: `casualt${totalVomits === 1 ? "y" : "ies"} on the night. Hydrate, everyone.`, bg: "linear-gradient(160deg,#3a5a2e,#15221a)" });
  if ((event?.settings?.teamCount || 0) > 0) {
    const ts = teamStats(people, event.settings, endT, drinks);
    const ranked = ts.filter((t) => t.members.length > 0);
    if (ranked.length > 0 && ranked[0].avg > 0) {
      const winner = ranked[0];
      // headline winner slide
      slides.splice(1, 0, { kicker: "WINNING TEAM", big: `${winner.emoji} ${winner.label}`, sub: `${winner.avg.toFixed(1)} per person · ${winner.total} total`, bg: `linear-gradient(160deg, ${winner.color}, #1a2238)` });
      // full standings slide right after it
      slides.splice(2, 0, { kicker: "TEAM STANDINGS", big: "", list: ranked.map((t) => ({ name: `${t.emoji} ${t.label}`, val: `${t.avg.toFixed(1)}/person · ${t.total}` })), bg: "linear-gradient(160deg,#2a3b5a,#15182a)" });
    }
  }
  return slides;
}

function DetailView({ ev, endT, drinks, amHost = false, onBack, onReopen, onLeave }) {
  const { people, settings, eventName } = ev;
  const [metric, setMetric] = useState("drinks");
  const [expandedId, setExpandedId] = useState(null);
  return (
    <div style={styles.page}>
      <style>{GLOBAL_CSS}</style>
      <header style={styles.liveHeader}>
        <button style={styles.linkBtn} onClick={onBack}>‹ Back to recap</button>
        <div style={styles.kicker}>{eventName.toUpperCase()} · FINAL</div>
      </header>
      {(settings.teamCount || 0) > 0 && <TeamStandings people={people} settings={settings} now={endT} drinks={drinks} />}
      <Leaderboard people={people} now={endT} accent={getTheme(settings).accent} />
      <GroupStats people={people} now={endT} drinks={drinks} />
      <FavoriteDrinksChart people={people} drinks={drinks} />
      <TimelineGraph people={people} now={endT} metric={metric} setMetric={setMetric} legalLimit={getLegalLimit(settings)} />
      <div style={styles.cards}>
        {people.map((p) => {
          const count = drinkCountAtTime(p, endT);
          const peak = peakBAC(p, endT, drinks);
          const fav = favoriteDrink(p);
          return (
            <div key={p.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div>
                  <div style={{ ...styles.name, cursor: "pointer" }} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                    {p.name}{p.role === "host" && <span style={styles.hostTag}>HOST</span>}<span style={styles.expandCaret}>{expandedId === p.id ? "▾" : "›"}</span>
                  </div>
                  <div style={styles.bodyline}>{count} drinks · peak ~{peak.toFixed(3)}</div>
                </div>
                <div style={styles.bacBlock}><div style={styles.bacNum}>{fav ? `${(drinks[fav.type] || DRINKS[fav.type]).emoji} ${(drinks[fav.type] || DRINKS[fav.type]).label}` : "—"}</div></div>
              </div>
              {expandedId === p.id && <IndividualStats p={p} now={endT} drinks={drinks} actions={{ deleteEntry: () => {}, setDrinkType: () => {}, setPour: () => {}, undoLast: () => {} }} />}
            </div>
          );
        })}
      </div>
      {amHost && onReopen && <button style={styles.addPerson} onClick={onReopen}>↩ Reopen the night (keep logging)</button>}
      <button style={styles.reset} onClick={onLeave}>Exit to start</button>
    </div>
  );
}
