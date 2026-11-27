import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme, run, window, keys, shared } from "herdr";

export default class WorkspaceStatus extends View {
  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  // Today's takings and the balance, in the cash colors.
  money(t) {
    const c = shared("vice.cash") ?? {};
    const today = c.day === new Date().toISOString().slice(0, 10) ? (c.today ?? 0) : 0;
    const fmt = (n, sign) => `${n < 0 ? "-" : sign ? "+" : ""}$${String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    return h_flex().gap(10).items_center()
      .child(div().text_color(today < 0 ? t.blocked : "#4fd66a").child(`Today ${fmt(today, true)}`))
      .child(div().text_color(t.muted).child(`Balance ${fmt(c.balance ?? 0)}`))
      .when((c.streak ?? 0) > 1, (el) => el.child(div().text_color(t.working).child(`Streak x${c.streak}`)));
  }

  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const count = (st) => list.filter(a => a.status === st).length;
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);
    // The crew by state, most urgent first; states nobody is in stay out.
    const STATES = [
      { st: "blocked", word: "wanted", icon: "badge-siren-red" },
      { st: "done", word: "got paid", icon: "badge-cash" },
      { st: "working", word: "on a job", icon: null },
      { st: "idle", word: "laying low", icon: null },
    ];
    const counts = STATES.map(s => ({ ...s, n: count(s.st) })).filter(s => s.n > 0);
    const chip = (s) => h_flex().gap(5).items_center().text_color(s.st === "blocked" ? t.blocked : t.muted)
      .child(s.icon ? image(`mods/vice-crew/sprites/${s.icon}.svg`).size(14) : div().size(7).rounded(4).bg(t[s.st]))
      .child(`${s.n} ${s.word}`);
    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch)))
      .when(counts.length === 0, el => el.child(div().text_color(t.dim).child("The streets are quiet")))
      .children(counts.map(chip))
      .child(div().flex_1())
      .child(this.money(t))
      .child(div().id("palette").text_color(t.dim).hover(s => s.text_color(t.foreground)).on_click(() => run("app.palette")).child(this.hint(t)));
  }
}
