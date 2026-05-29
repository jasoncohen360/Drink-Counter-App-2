// ============================================================
// CONSTANTS + BAC ENGINE  (ported from the artifact, unchanged logic)
// ============================================================

export const DRINKS = {
  beer: { label: "Beer", emoji: "🍺", alcG: 14 },
  wine: { label: "Wine", emoji: "🍷", alcG: 14 },
  cocktail: { label: "Cocktail", emoji: "🍹", alcG: 17 },
  shot: { label: "Shot", emoji: "🥃", alcG: 14 },
};

export const DRINK_EMOJIS = ["🍹", "🥤", "🍾", "🍶", "🧉", "🍸", "🍺", "🍷", "🥃", "🫗", "🧋", "☕"];

export const SIZES = {
  small: { label: "Small", weightLb: 140 },
  medium: { label: "Medium", weightLb: 170 },
  tall: { label: "Tall", weightLb: 200 },
};

// Sex-specific weight presets (host-only visibility). Falls back to SIZES.
export const SIZES_BY_SEX = {
  male:   { small: 150, medium: 175, tall: 200 },
  female: { small: 125, medium: 145, tall: 170 },
};
export function weightFor(size, sex) {
  const bySex = SIZES_BY_SEX[sex];
  if (bySex && bySex[size] != null) return bySex[size];
  return (SIZES[size] || SIZES.medium).weightLb;
}

export const POUR = { S: { label: "S", mult: 0.65 }, M: { label: "M", mult: 1.0 }, L: { label: "L", mult: 1.5 } };
export const DEFAULT_POUR = "M";
const ABSORB_MINUTES = 45;
const VOMIT_CLEARS = 0.5;
const R = { male: 0.68, female: 0.55 };
const METAB_PER_HR = 0.015;

export const STATES = {
  NJ: 0.08, NY: 0.08, CA: 0.08, TX: 0.08, FL: 0.08, IL: 0.08, PA: 0.08, OH: 0.08,
  GA: 0.08, NC: 0.08, MI: 0.08, AZ: 0.08, WA: 0.08, MA: 0.08, CO: 0.08, VA: 0.08,
  UT: 0.05, NV: 0.08, CT: 0.08, MD: 0.08, MN: 0.08, WI: 0.08, OR: 0.08, MO: 0.08,
  LA: 0.08, AL: 0.08, SC: 0.08, KY: 0.08, TN: 0.08, IN: 0.08, DC: 0.08,
};

export const THEMES = {
  midnight: { label: "Midnight", accent: "#bfa46a", motif: "✦", pageBg: "radial-gradient(120% 80% at 50% 0%, #1a2238 0%, #121626 45%, #0c0e18 100%)", text: "#ece3d0" },
  blacktie: { label: "Black Tie", accent: "#d4af37", motif: "🎩", pageBg: "radial-gradient(120% 80% at 50% 0%, #1c1c1c 0%, #111 50%, #050505 100%)", text: "#f0ead6" },
  birthday: { label: "Birthday", accent: "#ff5fa2", motif: "🎉", pageBg: "radial-gradient(120% 80% at 50% 0%, #2a1840 0%, #3a1d52 40%, #1a0f2e 100%)", text: "#ffe9f4" },
  garden: { label: "Garden", accent: "#7fb069", motif: "🌿", pageBg: "radial-gradient(120% 80% at 50% 0%, #2c3a24 0%, #1f2a1a 45%, #131a10 100%)", text: "#eef3e2" },
  city: { label: "City Lights", accent: "#4ec1e0", motif: "🌃", pageBg: "radial-gradient(120% 80% at 50% 0%, #15233a 0%, #0f1929 45%, #080d16 100%)", text: "#e2eef5" },
  beach: { label: "Beach", accent: "#ffb454", motif: "🌅", pageBg: "radial-gradient(120% 80% at 50% 0%, #2a4d6e 0%, #1f6b7a 45%, #0e3a44 100%)", text: "#eaf6f2" },
  bbq: { label: "BBQ", accent: "#ff7a3c", motif: "🔥", pageBg: "radial-gradient(120% 80% at 50% 0%, #4a2418 0%, #361510 45%, #1d0c08 100%)", text: "#f5e6da" },
};

export function defaultSettings() {
  return {
    state: "NJ",
    legalLimit: STATES.NJ,
    theme: "midnight",
    drinks: JSON.parse(JSON.stringify(DRINKS)),
    sizes: JSON.parse(JSON.stringify(SIZES)),
    sexWeights: JSON.parse(JSON.stringify(SIZES_BY_SEX)),
  };
}

export const getDrinks = (settings) => (settings && settings.drinks) || DRINKS;
export const getSizes = (settings) => (settings && settings.sizes) || SIZES;
export const getTheme = (settings) => THEMES[(settings && settings.theme) || "midnight"] || THEMES.midnight;
export const getLegalLimit = (settings) => (settings && settings.legalLimit) || 0.08;

export function bacDescriptor(bac) {
  if (bac <= 0.0) return { word: "Sober", tone: "#7dd3a0" };
  if (bac < 0.03) return { word: "A glow", tone: "#a8d97f" };
  if (bac < 0.06) return { word: "Buzzed", tone: "#e8c95a" };
  if (bac < 0.08) return { word: "Merry", tone: "#e8a94a" };
  if (bac < 0.12) return { word: "Legally drunk", tone: "#e07a3c" };
  if (bac < 0.2) return { word: "Quite drunk", tone: "#d9533b" };
  return { word: "Cut them off", tone: "#c0392b" };
}

const pourMult = (e) => POUR[e.pour || DEFAULT_POUR]?.mult ?? 1;
const drinkAlcG = (e, drinks = DRINKS) => (drinks[e.type]?.alcG || 0) * pourMult(e);
const ABSORB_START = 0.5; // a just-finished drink is already ~half absorbed
const absorbedFraction = (dT, t) => {
  const mins = (t - dT) / 60000;
  if (mins <= 0) return ABSORB_START;
  return Math.min(1, ABSORB_START + (1 - ABSORB_START) * (mins / ABSORB_MINUTES));
};

export function bacAtTime(person, t, drinks = DRINKS) {
  const events = person.log.filter((e) => e.t <= t).slice().sort((a, b) => a.t - b.t);
  if (events.length === 0) return 0;
  const weightG = person.weightLb * 453.592;
  const r = R[person.sex] || R.male;
  const dq = [];
  for (const e of events) {
    if (e.type === "vomit") {
      for (const d of dq) {
        const unabsorbed = d.grams * (1 - absorbedFraction(d.t, e.t));
        d.grams -= unabsorbed * VOMIT_CLEARS;
      }
    } else {
      dq.push({ t: e.t, grams: drinkAlcG(e, drinks) });
    }
  }
  let absorbedG = 0;
  for (const d of dq) absorbedG += d.grams * absorbedFraction(d.t, t);
  const hrs = (t - events[0].t) / 3600000;
  return Math.max(0, (absorbedG / (weightG * r)) * 100 - METAB_PER_HR * hrs);
}

export const drinkCountAtTime = (p, t) => p.log.filter((e) => e.t <= t && e.type !== "vomit").length;

export function peakBAC(person, now, drinks = DRINKS) {
  const ts = person.log.map((e) => e.t).concat([now]);
  let peak = 0;
  for (const t of ts) peak = Math.max(peak, bacAtTime(person, t, drinks));
  return peak;
}
export function hoursActive(person, now) {
  const drinks = person.log.filter((e) => e.type !== "vomit");
  if (drinks.length === 0) return 0;
  return Math.max(0.25, (now - Math.min(...drinks.map((e) => e.t))) / 3600000);
}
export const drinksPerHour = (p, now) => {
  const n = drinkCountAtTime(p, now);
  return n === 0 ? 0 : n / hoursActive(p, now);
};
export function bacRatePerHour(person, now, win = 30) {
  const earlier = Math.max(now - win * 60000, 0);
  return (bacAtTime(person, now) - bacAtTime(person, earlier)) / (win / 60);
}
export function favoriteDrink(person) {
  const tally = {};
  person.log.forEach((e) => { if (e.type !== "vomit") tally[e.type] = (tally[e.type] || 0) + 1; });
  let best = null, bestN = 0;
  for (const [k, n] of Object.entries(tally)) if (n > bestN) { best = k; bestN = n; }
  return best ? { type: best, n: bestN } : null;
}

// Best 30-minute drinking stretch for a person: the max drinks in any 30-min window.
export function bestStretch(person, windowMin = 30) {
  const drinks = person.log.filter((e) => e.type !== "vomit").map((e) => e.t).sort((a, b) => a - b);
  if (drinks.length === 0) return { count: 0, startT: null };
  const win = windowMin * 60000;
  let best = 0, bestStart = drinks[0];
  for (let i = 0; i < drinks.length; i++) {
    let c = 0;
    for (let j = i; j < drinks.length && drinks[j] - drinks[i] <= win; j++) c++;
    if (c > best) { best = c; bestStart = drinks[i]; }
  }
  return { count: best, startT: bestStart };
}

// Across everyone: who had the single best stretch.
export function bestStretchOverall(people, windowMin = 30) {
  let champ = null, champCount = 0, champStart = null;
  people.forEach((p) => {
    const s = bestStretch(p, windowMin);
    if (s.count > champCount) { champCount = s.count; champ = p; champStart = s.startT; }
  });
  return champ ? { name: champ.name, count: champCount, startT: champStart } : null;
}

export const valueAt = (person, t, metric) => (metric === "drinks" ? drinkCountAtTime(person, t) : bacAtTime(person, t));
export const LINE_COLORS = ["#bfa46a", "#7dd3a0", "#e8a94a", "#d9533b", "#6aa6e8", "#c084d9", "#e8c95a", "#5ad9c0", "#e87aa9", "#9ad97f"];

// Teams: up to 4, each with a name + color. Host enables in settings.
export const TEAM_DEFS = [
  { id: "red", label: "Red", color: "#d9533b", emoji: "🔴" },
  { id: "blue", label: "Blue", color: "#6aa6e8", emoji: "🔵" },
  { id: "green", label: "Green", color: "#7dd3a0", emoji: "🟢" },
  { id: "gold", label: "Gold", color: "#e8c95a", emoji: "🟡" },
  { id: "purple", label: "Purple", color: "#b18ad9", emoji: "🟣" },
  { id: "orange", label: "Orange", color: "#e89a5a", emoji: "🟠" },
  { id: "pink", label: "Pink", color: "#e88ab5", emoji: "🩷" },
  { id: "teal", label: "Teal", color: "#5ad9c0", emoji: "🩵" },
];
// Merge host's custom team names/emojis (settings.teams) over the defaults.
export function teamList(settings) {
  const count = (settings && settings.teamCount) || 0;
  const custom = (settings && settings.teams) || {};
  return TEAM_DEFS.slice(0, count).map((t) => ({
    ...t,
    label: custom[t.id]?.label || t.label,
    emoji: custom[t.id]?.emoji || t.emoji,
  }));
}
export function teamMeta(settings, teamId) {
  return teamList(settings).find((t) => t.id === teamId) || null;
}
export function teamStats(people, settings, now, drinks) {
  const active = teamList(settings);
  return active.map((t) => {
    const members = people.filter((p) => p.team === t.id);
    const total = members.reduce((a, p) => a + drinkCountAtTime(p, now), 0);
    const avg = members.length ? total / members.length : 0;
    return { ...t, members, total, avg };
  }).sort((a, b) => b.avg - a.avg);
}

// The legend: Wade Boggs and a flight's worth of beers.
export const BOGGS_NUMBER = 107;

// ============================================================
// CHICKEN CHASE (simplified — no flocks; private per-team "found" checklist)
// ============================================================
export function isChicken(personId, settings) {
  return Array.isArray(settings?.chickens) && settings.chickens.includes(personId);
}
export function chickenList(people, settings) {
  return (settings?.chickens || []).map((id) => people.find((p) => p.id === id)).filter(Boolean);
}

