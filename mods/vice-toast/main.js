// How notifications look. Anything can post one with notify({ title, body,
// level, icon, action }); replace this mod to restyle them all. Click to
// run its action (e.g. go to the agent) and dismiss it.

import { View, div, image, PathBuilder, Background } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme, shared } from "herdr";

const DISPLAY = "Anton";
const PIXEL_NAMES = { bandit: "The Bandit", driver: "The Wheelman", hacker: "The Hacker", tourist: "Florida Man", skater: "The Skater", gator: "The Gator" };
const crew = () => { const c = shared("vice.crew"); return c?.mode === "portraits" && c.names ? c : { mode: "pixel", names: PIXEL_NAMES }; };
const picture = (member) => crew().mode === "portraits" ? `mods/vice-crew/cast/${member}.png` : `mods/vice-crew/sprites/${member}-idle.svg`;
const sprite = (name) => `mods/vice-crew/sprites/${name}.svg`;
const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const paint = (from, to, angle) =>
  window.paint_path(RECT(), Background.linear_gradient(angle, from, to)).absolute().top(0).left(0).size_full();

// Herdr's agent toasts read "<program> finished" / "<program> needs you" and go to the
// agent on click: find who on the crew that is (vice-crew keeps the cast in shared).
function crewOf(p) {
  const m = /^(.+) (finished|needs you)$/.exec(p.title ?? "");
  if (!m) return null;
  const terminal = p.action?.name === "agent.focus" ? p.action.args?.terminal : null;
  const member = terminal ? shared("vice.cast")?.[terminal] : null;
  return { program: m[1], done: m[2] === "finished", member: crew().names[member] ? member : null, terminal };
}

const DOT = { error: "blocked", warning: "working", success: "done", info: "accent" };

export default class Toast extends View {
  render(cx) {
    const t = theme();
    const p = props() ?? {};
    const crew = crewOf(p);
    if (crew) return this.crewToast(t, p, crew);
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    const text = (value) => p.fitHeight
      ? div().child(value)
      : div().truncate().child(typeof value === "string" ? value.split("\n", 1)[0] : value);
    return h_flex()
      .id("toast")
      .when(p.fitHeight, (el) => el.w_full().min_h(70).flex_none().py(12))
      .when(!p.fitHeight, (el) => el.size_full())
      .px(18)
      .gap(12)
      .items_center()
      .bg(t.popover)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(p.icon ? image(p.icon).w(18).h(18).flex_none() : div().size(8).rounded(4).flex_none().bg(t[DOT[p.level] ?? "accent"]))
      .child(
        v_flex()
          .flex_1()
          .overflow_hidden()
          .child(text(login ? `${login[1]} needs a login: run` : p.title ?? "").font_semibold().text_size(13).text_color(t.foreground))
          .when(!login && Boolean(p.body), (el) => el.child(text(p.body).text_size(12).text_color(t.muted)))
          .when(Boolean(login), (el) => el.child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().tooltip(command).text_size(12).text_color(t.muted).child(command))
            .child(div().id("toast-login-copy").flex_none().px(6).py(3).rounded(4).bg(t.raised)
              .text_size(12).text_color(t.foreground).cursor_pointer().hover(s => s.bg(t.hover))
              .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(command); this.copied = true; cx.notify(); })
              .child(this.copied ? "Copied" : "Copy")))),
      );
  }

  crewToast(t, p, crew) {
    const { done, member, program, terminal } = crew;
    // The payout vice-crew booked for this agent's job, if it just did.
    const last = shared("vice.cash")?.last;
    const paid = done && last && last.agent === terminal && last.amount > 0 && Date.now() - last.at < 20000 ? last : null;
    const who = member ? crew().names[member] : program;
    const badge = done
      ? image(sprite("badge-cash")).size(20)
      : div().relative().size(20)
        .child(image(sprite("badge-siren-red")).size(20).loop("opacity", { from: 7, to: -6, period: 500, easing: "linear" }))
        .child(image(sprite("badge-siren-blue")).absolute().top(0).left(0).size(20).loop("opacity", { from: -6, to: 7, period: 500, easing: "linear" }));
    return h_flex().id("toast").size_full().relative().overflow_hidden().bg(t.popover).cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      // The poster edge: sunset for a paid job, red to blue for a wanted one.
      .child(div().relative().w(6).h_full().flex_none().child(done ? paint("#ff4f9a", "#ff9447", 180) : paint("#ff3b4f", "#3b7bff", 180)))
      .child(h_flex().flex_1().min_w(0).h_full().pl(12).pr(16).gap(12).items_center()
        .child(div().relative().size(44).flex_none()
          .child(member ? image(picture(member)).size(44).rounded(4) : div().size(44).rounded(4).bg(done ? t.done : t.blocked))
          .child(div().absolute().top(-4).left(-4).child(badge)))
        .child(v_flex().flex_1().min_w(0)
          .child(h_flex().gap(8).items_baseline()
            .child(div().font_family(DISPLAY).text_size(22).line_height("26px").text_color(done ? t.done : t.blocked).child(done ? "Job done" : "Wanted"))
            .when(Boolean(paid), (el) => el.child(div().font_family("Bungee").text_size(15).text_color("#4fd66a")
              .child(`+$${String(Math.round(paid.amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${paid.label}`))))
          .child(div().truncate().text_size(12).text_color(t.muted).child(`${who} · ${program} ${done ? "finished" : "needs you"}`))
          .when(Boolean(p.body), (el) => el.child(div().truncate().text_size(11.5).text_color(t.dim).child(p.body.split(/\r?\n/, 1)[0])))));
  }
}
