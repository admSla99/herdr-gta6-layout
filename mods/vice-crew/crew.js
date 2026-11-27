// The Leonida crew: who plays each agent, how their card moves, what they're up to.
// Portraits in cast/ are crops of the person's own images (local use only).

import { div, image } from "gpui-kit";
import { shared, setShared } from "herdr";

export const CREW = ["lucia", "jason", "cal", "boobie", "drequan", "dimez", "raul", "brian", "mandy"];
export const CREW_NAMES = {
  lucia: "Lucia",
  jason: "Jason",
  cal: "Cal Hampton",
  boobie: "Boobie Ike",
  drequan: "Dre'Quan Priest",
  dimez: "Real Dimez",
  raul: "Raul Bautista",
  brian: "Brian Heder",
  mandy: "Mandy",
};
// Terminal address -> crew member; vice-toast reads it too.
export const CAST_KEY = "vice.cast";

const MINUTE = 60000;
const PULSE_PERIOD = 1100;
const SIREN_PERIOD = 500;
// Loops only ease: swinging far past 0..1 clamps the opacity, so two stacked frames swap crisply.
const SWAP_LOW = -6;
const SWAP_HIGH = 7;

export const portrait = (member) => `mods/vice-crew/cast/${member}.png`;
const sprite = (name) => `mods/vice-crew/sprites/${name}.svg`;

// When each cast terminal was last seen (ms): a member is only given back after
// its terminal has been gone this long, so a reload or a slow start never recasts.
export const SEEN_KEY = "vice.cast.seen";
const FORGET_AFTER = 10 * MINUTE;
// Don't write "seen" stamps more often than this: every write re-renders every mod.
const SEEN_STEP = MINUTE;

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// The least-cast member, starting from one the address itself picks: deterministic,
// so the same agent gets the same member again even if the cast were lost.
export function pickMember(address, taken) {
  const uses = (m) => taken.filter((x) => x === m).length;
  const fewest = Math.min(...CREW.map(uses));
  const start = hash(address) % CREW.length;
  for (let i = 0; i < CREW.length; i++) {
    const m = CREW[(start + i) % CREW.length];
    if (uses(m) === fewest) return m;
  }
  return CREW[start];
}

// Each agent keeps the member it got first. Terminals gone for FORGET_AFTER give theirs back.
export function castFor(list, all, now = Date.now()) {
  const cast = { ...(shared(CAST_KEY) ?? {}) };
  const seen = { ...(shared(SEEN_KEY) ?? {}) };
  let changed = false;
  let seenChanged = false;
  const present = new Set([...list.map((a) => a.address), ...all.map((t) => t.address)]);
  for (const address of Object.keys(cast)) {
    if (present.has(address)) {
      if (!seen[address] || now - seen[address] >= SEEN_STEP) { seen[address] = now; seenChanged = true; }
    } else if (!seen[address]) {
      // Cast before stamps existed: start its clock now rather than drop it.
      seen[address] = now; seenChanged = true;
    } else if (now - seen[address] > FORGET_AFTER) {
      delete cast[address]; delete seen[address]; changed = seenChanged = true;
    }
  }
  for (const a of list) {
    if (CREW.includes(cast[a.address])) continue;
    const taken = list.map((b) => cast[b.address]).filter(Boolean);
    cast[a.address] = pickMember(a.address, taken);
    seen[a.address] = now;
    changed = seenChanged = true;
  }
  if (changed) setShared(CAST_KEY, cast);
  if (seenChanged) setShared(SEEN_KEY, seen);
  return cast;
}

export function siren(size) {
  return div().relative().w(size).h(size).flex_none()
    .child(image(sprite("badge-siren-red")).w(size).h(size).loop("opacity", { from: SWAP_HIGH, to: SWAP_LOW, period: SIREN_PERIOD, easing: "linear" }))
    .child(image(sprite("badge-siren-blue")).absolute().top(0).left(0).w(size).h(size)
      .loop("opacity", { from: SWAP_LOW, to: SWAP_HIGH, period: SIREN_PERIOD, easing: "linear" }));
}

// The member's portrait in a status frame. Working: the frame pulses in the working color.
// Idle: dimmed. Blocked: a police light flashing red and blue. Done: the cash.
export function crewSprite(member, status, size = 40, colors = {}) {
  const ring = colors[status] ?? "#ffffff55";
  const b = Math.round(size * 0.5);
  return div().relative().w(size).h(size).flex_none()
    .child(image(portrait(member)).w(size).h(size).rounded(4).when(status === "idle", (el) => el.opacity(0.7)))
    .child(div().absolute().top(0).left(0).w(size).h(size).rounded(4).border(2).border_color(ring)
      .when(status === "working", (el) => el.loop("opacity", { from: 1, to: 0.15, period: PULSE_PERIOD })))
    .when(status === "blocked", (el) => el.child(div().absolute().top(-5).left(-5).child(siren(b))))
    .when(status === "done", (el) => el.child(div().absolute().top(-5).left(-5).child(image(sprite("badge-cash")).w(b).h(b))));
}

const STAGES = [
  { after: 60 * MINUTE, mood: "Most wanted" },
  { after: 30 * MINUTE, mood: "Hot pursuit" },
  { after: 10 * MINUTE, mood: "Heist in progress" },
];
const MOOD = { working: "On a job", idle: "Laying low", done: "Got paid", blocked: "Wanted" };

export const moodOf = (status, workingFor) =>
  status === "working" ? (STAGES.find((s) => workingFor >= s.after)?.mood ?? MOOD.working) : (MOOD[status] ?? "");
