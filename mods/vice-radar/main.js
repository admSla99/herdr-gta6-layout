// The minimap: a rounded map card in the sidebar's corner, light by day and dark by
// night (the clock decides, 7:00 to 19:00 is day). You are the arrow at the bottom;
// every agent is a blip. A pink route runs to whoever needs you most (wanted, then
// got paid, then on a job), with its waypoint on top. Hover a blip for who it is,
// click it to go there.

import { View, div, svg, image, PathBuilder } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, run, theme, shared, layout, window as appWindow } from "herdr";

const W = 248;
const H = 150;
const BLIP = 12;
const ME = { x: W / 2, y: H - 22 };
const ROUTE = "#ff5fa8";
const PIXEL_NAMES = { bandit: "The Bandit", driver: "The Wheelman", hacker: "The Hacker", tourist: "Florida Man", skater: "The Skater", gator: "The Gator" };
const names = () => { const c = shared("vice.crew"); return c?.mode === "portraits" && c.names ? c.names : PIXEL_NAMES; };
const WORD = { working: "on a job", idle: "laying low", done: "got paid", blocked: "wanted" };
const RANK = { blocked: 3, done: 2, working: 1 };

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;
const isDay = () => { const h = new Date().getHours(); return h >= 7 && h < 19; };

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Where an agent sits: its space picks a neighborhood, its address a spot in it, so a
// blip stays put and a space's crew stays together. Never on top of you.
function spot(a) {
  const nx = 24 + (hash(a.space) % (W - 48));
  const ny = 22 + (hash(a.space + "y") % (H - 76));
  const x = Math.min(W - 18, Math.max(10, nx + (hash(a.address) % 40) - 20));
  const y = Math.min(H - 46, Math.max(14, ny + (hash(a.address + "y") % 30) - 15));
  return { x, y };
}

const swap = (a, b, period) => (el) => el
  .child(svg("mods/vice-radar/blip.svg").size(BLIP).text_color(a).loop("opacity", { from: 7, to: -6, period, easing: "linear" }))
  .child(svg("mods/vice-radar/blip.svg").absolute().top(0).left(0).size(BLIP).text_color(b).loop("opacity", { from: -6, to: 7, period, easing: "linear" }));

export default class Radar extends View {
  init(_props, cx) {
    this.day = isDay();
    // Day and night turn over on the hour; a look every minute is plenty.
    cx.timer.every(60000, (cx) => {
      if (isDay() !== this.day) { this.day = isDay(); cx.notify(); }
    });
  }

  blip(t, a, cast, target) {
    const { x, y } = spot(a);
    const who = names()[cast[a.address]] ?? a.program?.name ?? a.address;
    const el = div().id(`blip-${a.address}`).absolute().left(x - BLIP / 2).top(y - BLIP / 2).size(BLIP).cursor_pointer()
      .tooltip(`${who}: ${WORD[a.status] ?? a.status} in ${a.space_name}`)
      .on_click(() => run("pane.focus", { pane: a.pane }));
    if (a.status === "blocked") return el.map(swap("#ff3b4f", "#3b7bff", 500));
    const color = a === target ? ROUTE : a.status === "done" ? t.done : "#ffffff";
    const dot = svg("mods/vice-radar/blip.svg").size(BLIP).text_color(color);
    if (a.status === "working") {
      return el.child(svg("mods/vice-radar/ring.svg").absolute().left(-6).top(-6).size(BLIP + 12).text_color(color)
        .loop("opacity", { from: 0.9, to: 0, period: 1400 })).child(dot.absolute().top(0).left(0));
    }
    return el.child(dot.when(a.status === "idle", (d) => d.opacity(0.6)));
  }

  // The route: from you, a soft curve up to the target, as the satnav draws it.
  route(to) {
    const mid = { x: (ME.x + to.x) / 2, y: (ME.y + to.y) / 2 };
    const bend = { x: mid.x + (to.y - ME.y) * 0.25, y: mid.y - (to.x - ME.x) * 0.25 };
    const path = PathBuilder.stroke(4).move_to(ME.x, ME.y - 8).curve_to(to.x, to.y, bend.x, bend.y).build();
    return window.paint_path(path, ROUTE).absolute().top(0).left(0).size_full();
  }

  render() {
    const t = theme();
    const list = agents();
    const cast = shared("vice.cast") ?? {};
    const me = list.find((a) => a.focused);
    const others = list.filter((a) => a !== me);
    const target = [...others].filter((a) => RANK[a.status]).sort((a, b) => RANK[b.status] - RANK[a.status])[0];
    const wanted = list.filter((a) => a.status === "blocked").length;
    const day = this.day;
    if (narrow()) {
      return h_flex().size_full().items_center().justify_center().bg(t.chrome).border_t(1).border_color(t.border)
        .child(div().size(10).rounded_full().bg(wanted ? t.blocked : list.some((a) => a.status === "working") ? t.working : t.dim)
          .when(wanted > 0, (el) => el.loop("opacity", { from: 1, to: 0.2, period: 600 })));
    }
    const ink = day ? "#111114" : "#f4f4f6";
    const chip = day ? "#ffffffd9" : "#111114cc";
    const label = target
      ? `${names()[cast[target.address]] ?? target.program?.name ?? "Agent"} · ${WORD[target.status]}`
      : `${list.length} crew · all clear`;
    const targetSpot = target ? spot(target) : null;
    return v_flex().size_full().items_center().justify_center().bg(t.chrome).border_t(1).border_color(t.border)
      .child(div().relative().w(W).h(H).flex_none()
        .child(image(`mods/vice-radar/map-${day ? "day" : "night"}.svg`).absolute().top(0).left(0).w(W).h(H))
        .when(Boolean(targetSpot), (el) => el.child(this.route(targetSpot)))
        // The waypoint on the map's top edge, above the target, like the satnav's pin.
        .when(Boolean(targetSpot), (el) => el.child(div().absolute().top(-6).left(targetSpot.x - 7).size(14).rounded_full()
          .bg(ROUTE).border_2().border_color(day ? "#ffffff" : "#111114")))
        .children(others.map((a) => this.blip(t, a, cast, target)))
        .child(image("mods/vice-radar/arrow.svg").absolute().left(ME.x - 10).top(ME.y - 10).size(20))
        .child(h_flex().absolute().top(8).right(10).size(18).rounded_full().bg("#111114").items_center().justify_center()
          .text_size(10).font_bold().text_color("#ffffff").child("N"))
        .child(div().absolute().top(10).left(12).max_w(W - 60).truncate().px(6).py(1).rounded(4).bg(chip)
          .text_size(11).font_semibold().text_color(target?.status === "blocked" ? t.blocked : ink).child(label)));
  }
}
