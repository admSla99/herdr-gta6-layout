// The Leonida crew: who plays each agent, how their card moves, what they're up to.
//
// Out of the box the crew is six animated pixel characters (sprites/, drawn by
// tools/sprites.py). If mods/vice-crew/cast/cast.json exists, its entries become the
// crew instead: { "<key>": "<Name>" }, each with a portrait cast/<key>.png. That
// folder is the person's own and is never published.

import * as fs from "fs/promises";
import { div, image } from "gpui-kit";
import { shared, setShared, appHome } from "herdr";

export const PIXEL_CREW = {
  bandit: "The Bandit",
  driver: "The Wheelman",
  hacker: "The Hacker",
  tourist: "Florida Man",
  skater: "The Skater",
  gator: "The Gator",
};
// { mode: "pixel" | "portraits", names: { key: name } }; vice-toast and vice-radar read it too.
export const CREW_KEY = "vice.crew";
// Terminal address -> crew member; vice-toast reads it too.
export const CAST_KEY = "vice.cast";

export const crewInfo = () => {
  const c = shared(CREW_KEY);
  return c?.mode === "portraits" && c.names && Object.keys(c.names).length ? c : { mode: "pixel", names: PIXEL_CREW };
};
export const crewKeys = () => Object.keys(crewInfo().names);
export const crewName = (member) => crewInfo().names[member] ?? null;

// Looks for the person's own cast once, when the crew list starts.
export async function loadCast() {
  let next = { mode: "pixel", names: PIXEL_CREW };
  try {
    const names = JSON.parse(await fs.readFile(`${appHome()}/mods/vice-crew/cast/cast.json`, "utf8"));
    if (names && typeof names === "object" && !Array.isArray(names) && Object.keys(names).length) next = { mode: "portraits", names };
  } catch {}
  if (JSON.stringify(next) !== JSON.stringify(shared(CREW_KEY))) setShared(CREW_KEY, next);
}

const MINUTE = 60000;
const WORK_PERIOD = 700;
const IDLE_PERIOD = 1800;
const PULSE_PERIOD = 1100;
const SIREN_PERIOD = 500;
// Loops only ease: swinging far past 0..1 clamps the opacity, so two stacked frames swap crisply.
const SWAP_LOW = -6;
const SWAP_HIGH = 7;

export const portrait = (member) => `mods/vice-crew/cast/${member}.png`;
const sprite = (name) => `mods/vice-crew/sprites/${name}.svg`;
// The picture a toast or a list shows for a member, still.
export const still = (member) => (crewInfo().mode === "portraits" ? portrait(member) : sprite(`${member}-idle`));

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
export function pickMember(address, taken, crew = crewKeys()) {
  const uses = (m) => taken.filter((x) => x === m).length;
  const fewest = Math.min(...crew.map(uses));
  const start = hash(address) % crew.length;
  for (let i = 0; i < crew.length; i++) {
    const m = crew[(start + i) % crew.length];
    if (uses(m) === fewest) return m;
  }
  return crew[start];
}

// Each agent keeps the member it got first. Terminals gone for FORGET_AFTER give theirs
// back. A member that isn't in the crew any more (the cast changed) is recast.
export function castFor(list, all, now = Date.now()) {
  const crew = crewKeys();
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
    if (crew.includes(cast[a.address])) continue;
    const taken = list.map((b) => cast[b.address]).filter((m) => crew.includes(m));
    cast[a.address] = pickMember(a.address, taken, crew);
    seen[a.address] = now;
    changed = seenChanged = true;
  }
  if (changed) setShared(CAST_KEY, cast);
  if (seenChanged) setShared(SEEN_KEY, seen);
  return cast;
}

function swap(a, b, period, size) {
  return div().relative().w(size).h(size).flex_none()
    .child(image(a).w(size).h(size).loop("opacity", { from: SWAP_HIGH, to: SWAP_LOW, period, easing: "linear" }))
    .child(image(b).absolute().top(0).left(0).w(size).h(size).loop("opacity", { from: SWAP_LOW, to: SWAP_HIGH, period, easing: "linear" }));
}

export const siren = (size) => swap(sprite("badge-siren-red"), sprite("badge-siren-blue"), SIREN_PERIOD, size);

const badge = (status, b) =>
  status === "blocked" ? siren(b) : status === "done" ? image(sprite("badge-cash")).w(b).h(b) : null;

// Pixel crew: the job in two frames while working, laying low in two slower frames
// when idle, the still pose otherwise. Portraits: the frame pulses in the working color,
// dims when idle. Either way, blocked flashes a police light and done shows the cash.
export function crewSprite(member, status, size = 40, colors = {}) {
  const b = Math.round(size * 0.5);
  const mark = badge(status, b);
  const box = div().relative().w(size).h(size).flex_none();
  let face;
  if (crewInfo().mode === "portraits") {
    const ring = colors[status] ?? "#ffffff55";
    face = box
      .child(image(portrait(member)).w(size).h(size).rounded(4).when(status === "idle", (el) => el.opacity(0.7)))
      .child(div().absolute().top(0).left(0).w(size).h(size).rounded(4).border(2).border_color(ring)
        .when(status === "working", (el) => el.loop("opacity", { from: 1, to: 0.15, period: PULSE_PERIOD })));
  } else if (status === "working") {
    face = box.child(swap(sprite(`${member}-work`), sprite(`${member}-work-2`), WORK_PERIOD, size));
  } else if (status === "idle") {
    face = box.child(swap(sprite(`${member}-idle`), sprite(`${member}-idle-2`), IDLE_PERIOD, size));
  } else {
    face = box.child(image(sprite(`${member}-idle`)).w(size).h(size));
  }
  return mark ? face.child(div().absolute().top(-5).left(-5).child(mark)) : face;
}

const STAGES = [
  { after: 60 * MINUTE, mood: "Most wanted" },
  { after: 30 * MINUTE, mood: "Hot pursuit" },
  { after: 10 * MINUTE, mood: "Heist in progress" },
];
const MOOD = { working: "On a job", idle: "Laying low", done: "Got paid", blocked: "Wanted" };

export const moodOf = (status, workingFor) =>
  status === "working" ? (STAGES.find((s) => workingFor >= s.after)?.mood ?? MOOD.working) : (MOOD[status] ?? "");
