// The crew's money. Only vice-crew runs this (it sees every status change); the other
// mods read shared "vice.cash". Every transaction is also a line in
// ~/.config/herdr-app/data/vice-ledger.jsonl.
//
//   Payout     working -> done/idle: $500 + $100 a minute worked, at most $10,000,
//              times the model's rate and the streak multiplier. Jobs under 30 s don't pay.
//   Getaway    an agent that needed you is answered within 30 s: +$250.
//   Bail       an agent left wanted: -$200 for every full 5 minutes.
//   Busted     a terminal on a job disappears for good (30 s): -$300.
// Bail and Busted reset the streak; every payout adds to it (x1.25 per job, x2 at most).

import * as fs from "fs/promises";
import { shared, setShared, appHome } from "herdr";

export const CASH_KEY = "vice.cash";
const MINUTE = 60000;
const BASE = 500;
const PER_MINUTE = 100;
const MAX_PAYOUT = 10000;
const MIN_JOB = 30000;
const GETAWAY_WINDOW = 30000;
const GETAWAY_BONUS = 250;
const BAIL_EVERY = 5 * MINUTE;
const BAIL = 200;
const BUSTED = 300;
const BUSTED_AFTER = 30000;
const STREAK_STEP = 0.25;
const STREAK_MAX = 4;
// Time counts only while seen working, look to look; a longer gap (the mod wasn't
// running, the app was closed) counts at most this much.
const MAX_STEP = 90000;

export const tierOf = (minutes) => (minutes >= 30 ? "Big score" : minutes >= 10 ? "Heist" : "Job");

export function modelRate(name) {
  const n = (name ?? "").toLowerCase();
  if (n.startsWith("opus")) return 1.5;
  if (n.startsWith("fable")) return 1.3;
  if (n.startsWith("sonnet") || n.startsWith("gpt")) return 1.2;
  return 1;
}

export const money = (n) => `${n < 0 ? "-" : ""}$${String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
export const signed = (n) => `${n < 0 ? "-" : "+"}$${String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

export const cash = () => {
  const c = shared(CASH_KEY);
  return c && typeof c === "object" ? c : { balance: 0, day: null, today: 0, todayBy: {}, streak: 0, last: null };
};

export const ledgerPath = () => `${appHome()}/data/vice-ledger.jsonl`;

export class Economy {
  constructor() {
    try { this.s = JSON.parse(localStorage.getItem("economy") ?? "{}"); } catch { this.s = {}; }
    this.s.prev ??= {};    // address -> status at the last look
    this.s.jobs ??= {};    // address -> { start, seen, work }: a job on the go, last seen working, ms worked
    this.s.wanted ??= {};  // address -> { since, bails }
    this.s.missing ??= {}; // address -> since when an open job's terminal is gone
  }

  save() { localStorage.setItem("economy", JSON.stringify(this.s)); }

  // One look at every agent. `info(address)` gives { member, model, space }.
  step(list, all, now, info) {
    const s = this.s;
    let dirty = false;
    const tx = [];
    for (const a of list) {
      const prev = s.prev[a.address];
      const st = a.status;
      delete s.missing[a.address];
      if (st === "working") {
        const job = (s.jobs[a.address] ??= { start: now, seen: now, work: 0 });
        if (prev === "working") job.work = (job.work ?? 0) + Math.min(MAX_STEP, Math.max(0, now - job.seen));
        job.seen = now;
        dirty = true;
      } else if ((st === "done" || st === "idle") && s.jobs[a.address]) {
        // Finished: straight from working, or after you answered it (wanted, then done).
        const job = s.jobs[a.address];
        if (prev === "working") job.work = (job.work ?? 0) + Math.min(MAX_STEP, Math.max(0, now - job.seen));
        delete s.jobs[a.address];
        dirty = true;
        if ((job.work ?? 0) >= MIN_JOB) tx.push(this.payout(a, job, info(a.address), now));
      }
      if (st === "blocked") {
        const w = (s.wanted[a.address] ??= { since: now, bails: 0 });
        const due = Math.floor((now - w.since) / BAIL_EVERY);
        if (due > w.bails) {
          tx.push({ type: "bail", amount: -BAIL * (due - w.bails), label: "Bail", a, ...info(a.address) });
          w.bails = due;
        }
        dirty = true;
      } else if (s.wanted[a.address]) {
        const w = s.wanted[a.address];
        delete s.wanted[a.address];
        dirty = true;
        if (now - w.since <= GETAWAY_WINDOW) tx.push({ type: "getaway", amount: GETAWAY_BONUS, label: "Getaway", a, ...info(a.address) });
      }
      if (prev !== st) { s.prev[a.address] = st; dirty = true; }
    }
    // A job whose terminal is gone for good got busted. terminals() is empty right
    // after a start, so nothing is judged then.
    if (all.length) {
      const listed = new Set(list.map((a) => a.address));
      const alive = new Set(all.filter((t) => t.state === "live").map((t) => t.address));
      for (const address of Object.keys(s.jobs)) {
        if (listed.has(address) || alive.has(address)) { delete s.missing[address]; continue; }
        s.missing[address] ??= now;
        dirty = true;
        if (now - s.missing[address] >= BUSTED_AFTER) {
          delete s.jobs[address]; delete s.missing[address]; delete s.prev[address]; delete s.wanted[address];
          tx.push({ type: "busted", amount: -BUSTED, label: "Busted", a: { address }, ...info(address) });
        }
      }
      for (const address of Object.keys(s.prev)) if (!listed.has(address) && !alive.has(address) && !s.jobs[address]) { delete s.prev[address]; delete s.wanted[address]; dirty = true; }
    }
    if (dirty) this.save();
    if (tx.length) this.book(tx, now);
  }

  payout(a, job, who, now) {
    const minutes = (job.work ?? 0) / MINUTE;
    const streak = cash().streak ?? 0;
    const mult = 1 + STREAK_STEP * Math.min(streak, STREAK_MAX);
    const rate = modelRate(who.model);
    const base = Math.min(MAX_PAYOUT, BASE + PER_MINUTE * minutes);
    const amount = Math.round((base * rate * mult) / 10) * 10;
    return { type: "payout", amount, label: tierOf(minutes), minutes: Math.round(minutes * 10) / 10, rate, mult, a, ...who };
  }

  // Applies transactions to the balance (one shared write) and appends them to the ledger.
  book(tx, now) {
    const c = { ...cash() };
    const day = dayOf(now);
    if (c.day !== day) { c.day = day; c.today = 0; c.todayBy = {}; }
    c.todayBy = { ...(c.todayBy ?? {}) };
    const lines = [];
    for (const t of tx) {
      c.balance = (c.balance ?? 0) + t.amount;
      c.today += t.amount;
      c.todayBy[t.a.address] = (c.todayBy[t.a.address] ?? 0) + t.amount;
      if (t.type === "payout") c.streak = (c.streak ?? 0) + 1;
      if (t.type === "bail" || t.type === "busted") c.streak = 0;
      c.last = { id: `${now}-${t.a.address}-${t.type}`, amount: t.amount, label: t.label, member: t.member ?? null, agent: t.a.address, at: now };
      lines.push(JSON.stringify({
        at: new Date(now).toISOString(), type: t.type, label: t.label, amount: t.amount, balance: c.balance,
        agent: t.a.address, member: t.member ?? null, model: t.model ?? null, space: t.space ?? null,
        minutes: t.minutes ?? null, rate: t.rate ?? null, streak: t.mult ?? null,
      }));
    }
    setShared(CASH_KEY, c);
    this.append(lines);
  }

  // One write at a time, so two quick transactions never race on the file: the queue is
  // global, shared by every Economy this runtime makes (a reload makes a new one).
  append(lines) {
    const path = ledgerPath();
    globalThis.__viceLedger = (globalThis.__viceLedger ?? Promise.resolve()).then(async () => {
      await fs.mkdir(`${appHome()}/data`, { recursive: true }).catch(() => {});
      let old = "";
      try { old = await fs.readFile(path, "utf8"); } catch {}
      await fs.writeFile(path, old + lines.join("\n") + "\n");
    }).catch((e) => console.warn(`vice-crew: ledger write failed: ${e}`));
  }
}

// The ledger's lines, newest first (at most `limit`).
export async function readLedger(limit = 200) {
  try {
    const text = await fs.readFile(ledgerPath(), "utf8");
    return text.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse().slice(0, limit);
  } catch { return []; }
}
