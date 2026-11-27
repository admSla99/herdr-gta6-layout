import { View, div, svg, image, PathBuilder, Background } from "gpui-kit";
import { h_flex, v_flex, ScrollHandle } from "gpui-base";
import { spaces, panes, agents, run, openOverlay, theme, window as appWindow, shared, layout, settings } from "herdr";

const DISPLAY = "Anton";
const INK = "#1a0f2e";
const SUNSET = ["#ff4f9a", "#ff9447"];
// A poster panel: the shown tab leans like a cut from a loading screen.
const SLANT = () => PathBuilder.fill().add_polygon([["7%", 0], ["100%", 0], ["93%", "100%"], [0, "100%"]], true).build();
const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const paint = (path, from, to, angle = 100) =>
  window.paint_path(path, Background.linear_gradient(angle, from, to)).absolute().top(0).left(0).size_full();
const CASH_GREEN = "#4fd66a";
const MONEY_FONT = "Bungee";
// GTA's HUD money: white figures with a hard dark shadow (two stacked layers).
const hudMoney = (text, size, color) => div().relative().flex_none()
  .child(div().absolute().left(1.5).top(1.5).font_family(MONEY_FONT).text_size(size).text_color("#0b0716cc").child(text))
  .child(div().relative().font_family(MONEY_FONT).text_size(size).text_color(color).child(text));
const DELTA_MS = 4000;
const money = (n) => `${n < 0 ? "-" : ""}$${String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const signed = (n) => `${n < 0 ? "-" : "+"}$${String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const STAR = (on) => `mods/vice-tabs/star-${on ? "on" : "off"}.svg`;
const STARS = 6;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// Same as the agents mod: drops a status glyph, keeps a leading bracket or quote.
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();

// A tab Herdr named (unnamed, or after its program) follows its agent's live
// title, as the agents list does; a name the person gave stays.
function label(tab, lead) {
  const prog = lead?.program?.name;
  const base = tab.named ? tab.name : prog ?? "Terminal";
  if (!lead?.program?.agent) return base;
  const live = clean(lead.title);
  // clean() would strip a path's leading ~ or /: test the title with only its status glyph gone.
  const path = /^[~/]|^[A-Za-z]:\\/.test((lead.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  const telling = live && live !== lead.terminal && live !== prog && !path && !live.includes("@") && live.toLowerCase() !== lead.program.key;
  return (tab.name === prog || !tab.named) && telling ? live : base;
}

export default class Tabs extends View {
  init() {
    this.pressed = null;
    this.scroll = ScrollHandle.new();
    try { this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}"); } catch { this.panels = {}; }
    if (!this.panels || typeof this.panels !== "object" || Array.isArray(this.panels)) this.panels = {};
    this.swipe = { acc: 0, steps: 0, at: 0, last: 0 };
  }

  // One tab per wheel notch. A touchpad or smooth-scrolling mouse sends many
  // small events per gesture: a short swipe or one smoothed notch (about
  // 25 px) switches one tab, a longer swipe keeps going a tab per 60 px, at
  // most one every 100 ms so each shows.
  wheel(e) {
    if (e.delta_lines) {
      if (e.delta_lines.y) run(e.delta_lines.y > 0 ? "tab.prev" : "tab.next");
      return;
    }
    const s = this.swipe, now = Date.now();
    // Phases often arrive only as moves (a macOS touchpad included): a pause
    // or a turn starts a new gesture.
    if (e.touch_phase === "started" || now - s.at > 250 || e.delta.y * s.acc < 0) Object.assign(s, { acc: 0, steps: 0 });
    s.at = now;
    s.acc += e.delta.y;
    const need = s.steps ? 60 : 20;
    if (Math.abs(s.acc) < need || now - s.last < 100) return;
    s.acc -= Math.sign(s.acc) * need;
    s.steps++;
    s.last = now;
    run(e.delta.y > 0 ? "tab.prev" : "tab.next");
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  // The money HUD: the balance in Anton, and for a few seconds after a transaction
  // what it was ("+$1,250 Heist", "-$200 Bail"). Click: the statement.
  wallet(t, cx, stop) {
    const c = shared("vice.cash") ?? {};
    const last = c.last;
    const age = last ? Date.now() - last.at : Infinity;
    const fresh = age < DELTA_MS;
    // Hide the delta when its time is up: one timer per transaction, not a polling clock.
    if (fresh && this.deltaFor !== last.id) {
      this.deltaFor = last.id;
      cx?.timer?.after(DELTA_MS - age + 50, (cx) => cx.notify());
    }
    const balance = c.balance ?? 0;
    return h_flex().id("wallet").flex_none().gap(6).px(8).h(28).items_center().rounded(3).cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .tooltip(`Balance ${money(balance)}. Today ${signed(c.today ?? 0)}, streak ${c.streak ?? 0}. Click for the statement.`)
      .on_mouse_down("left", stop)
      .on_click(() => openOverlay({ mod: "vice-crew", kind: "dialog", width: 560, height: 0.8, props: { ledger: true } }))
      .when(fresh, (el) => el.child(div().flex_none().px(5).rounded(3).bg((last.amount < 0 ? t.blocked : CASH_GREEN) + "26")
        .text_size(11.5).font_semibold().text_color(last.amount < 0 ? t.blocked : CASH_GREEN)
        .loop("opacity", { from: 1, to: 0.45, period: 700 })
        .child(h_flex().gap(4).items_center()
          .child(div().font_family(MONEY_FONT).text_size(11.5).child(signed(last.amount)))
          .child(div().child(last.label)))))
      .child(hudMoney(money(balance), 17, balance < 0 ? "#ff6b7a" : "#ffffff"));
  }

  render(cx) {
    const t = theme();
    const space = spaces().find(p => p.active);
    const shown = space?.tabs ?? [];
    const active = shown.findIndex(tab => tab.active);
    const selected = shown[active]?.id;
    if (selected !== this.selected || active !== this.selectedIndex) {
      this.selected = selected;
      this.selectedIndex = active;
      if (active >= 0) this.scroll.scroll_to_item(active);
    }
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const lead = panes().find(p => p.tab === c.id && p.program?.agent) ?? panes().find(p => p.tab === c.id);
      const program = lead?.program;
      const name = label(c, lead);
      return h_flex().id(`tab-${c.id}`).relative().h(30).px(c.active ? 16 : 10).gap(7).items_center().flex_none().text_size(12.8)
        // A rename or status dot on this or an earlier tab can push the active one out.
        .when(i <= active, el => el.on_size_change((_size, cx) => { this.scroll.scroll_to_item(active); cx.notify(); }))
        .when(c.active, el => el.child(paint(SLANT(), SUNSET[0], SUNSET[1])).text_color(INK))
        .when(!c.active, el => el.rounded(3).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(14).text_color(c.active ? INK : t.muted) : image(program.icon).size(14)))
        .child(div().max_w(170).truncate().when(c.active, el => el.font_family(DISPLAY).text_size(15)).child(c.zoomed ? `${name} Z` : name))
        .when(c.status === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(c.active ? INK : t.working).spin(900)))
        .when(c.status === "blocked" || c.status === "done", el => el.child(div().size(7).rounded(4).border_1().border_color(c.active ? INK : t.chrome).bg(t[c.status])))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).text_color(INK + "b3").hover(s => s.text_color(INK)).on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg("mods/pane/close.svg").size(12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = appWindow();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    this.syncPanel(space, panel, body, enabled);
    const panelButton = (id, label, icon) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child(svg(icon).size(14)).child(label);
    };
    // Wanted level: one star per agent that needs you (six at most), flashing white.
    const wanted = Math.min(STARS, agents().filter(a => a.status === "blocked").length);
    const stars = h_flex().id("wanted").flex_none().gap(0).px(6).items_center().cursor_pointer()
      .tooltip(wanted ? `${wanted} ${wanted === 1 ? "agent needs" : "agents need"} you. Click to go there.` : "Wanted level: nobody needs you")
      .on_mouse_down("left", stop)
      .on_click(() => { if (wanted) run("agent.select", { index: 1 }); })
      .children(Array.from({ length: STARS }, (_, i) => {
        const on = i < wanted;
        const star = image(STAR(on)).size(19).flex_none();
        return on ? star.loop("opacity", { from: 1, to: 0.35, period: 900 }) : star;
      }));
    const bar = h_flex().size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => this.wheel(e))
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().track_scroll(this.scroll)
        .on_size_change((_size, cx) => { if (active >= 0) { this.scroll.scroll_to_item(active); cx.notify(); } })
        .children(shown.map(item)))
      .child(this.wallet(t, cx, stop))
      .child(stars)
      .child(button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .when(enabled.includes("files"), el => el.child(panelButton("files", "Files", "mods/files/file.svg")))
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/changes/changes.svg")))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/vice-tabs/win-min.svg").size(16) : "−", () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/vice-tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/vice-tabs/win-close.svg").size(16) : svg("mods/pane/close.svg").size(13), () => run("window.close"))));
    return v_flex().size_full().min_w(0)
      .child(bar.flex_1().h_auto().min_h(0))
      .child(div().relative().h(2).w_full().flex_none().child(paint(RECT(), SUNSET[0], SUNSET[1], 90)));
  }
}
