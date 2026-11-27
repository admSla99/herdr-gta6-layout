// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "vice-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";

const DISPLAY = "Anton";
const SIREN = (c) => `mods/vice-crew/sprites/badge-siren-${c}.svg`;

// Signal bars like a police radio: they rise and fall while the agent is talking (working),
// stand full when it's done, drop to one when it's laying low.
function signal(t, status) {
  const color = t[status] ?? t.dim;
  const heights = [4, 7, 10, 13];
  const lit = status === "working" || status === "done" || status === "blocked" ? 4 : status === "idle" ? 1 : 0;
  return h_flex().flex_none().h(14).gap(2).items_end().children(heights.map((h, i) => {
    const bar = div().w(3).h(h).rounded(1).bg(i < lit ? color : t.border);
    return status === "working" ? bar.loop("opacity", { from: 1, to: 0.2, period: 600 + i * 220 }) : bar;
  }));
}

function siren(size) {
  return div().relative().size(size).flex_none()
    .child(image(SIREN("red")).size(size).loop("opacity", { from: 7, to: -6, period: 500, easing: "linear" }))
    .child(image(SIREN("blue")).absolute().top(0).left(0).size(size).loop("opacity", { from: -6, to: 7, period: 500, easing: "linear" }));
}
import { panes, props, run, theme, home, layout } from "herdr";

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/vice-pane/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = p.name || ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(p.focused ? t.selected : t.chrome)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).text_color(p.focused ? t.foreground : t.muted)
        .font_family(DISPLAY).text_size(14).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "blocked", el => el.child(siren(16)).child(div().flex_none().font_family(DISPLAY).text_size(13).text_color(t.blocked).child("Wanted")))
      .when(st === "done", el => el.child(image("mods/vice-crew/sprites/badge-cash.svg").size(16).flex_none()))
      .when(Boolean(st), el => el.child(signal(t, st)))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}
