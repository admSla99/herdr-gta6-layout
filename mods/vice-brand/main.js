// Vice City layout's sidebar head: a sunset band with "Leonida", the island clock,
// search and the sidebar fold. Clicking the name picks the backdrop:
// beach (the default, light and dark) -> neon -> VI -> beach.

import { View, div, svg, PathBuilder, Background } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { run, layout, settings, shared, setShared, window as appWindow } from "herdr";

const DISPLAY = "Anton";
const INK = "#1a0f2e";
const SUNSET = ["#ff4f9a", "#ff9447"];
const BACKDROPS = {
  beach: { label: "Beach", image: "backgrounds/vice/beach.jpg" },
  neon: { label: "Neon", image: "backgrounds/vice/neon.jpg" },
  vi: { label: "VI", image: "backgrounds/vice/vi.jpg" },
};
const ORDER = ["beach", "neon", "vi"];
const BG_KEY = "vice.backdrop";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : appWindow()?.platform === "macos" ? 76 : 44 });
}

const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const sunset = (angle = 100) =>
  window.paint_path(RECT(), Background.linear_gradient(angle, SUNSET[0], SUNSET[1])).absolute().top(0).left(0).size_full();

const choice = () => (ORDER.includes(shared(BG_KEY)) ? shared(BG_KEY) : "beach");
const wanted = () => {
  return BACKDROPS[choice()].image;
};

const clock = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default class ViceBrand extends View {
  init(_props, cx) {
    // The clock shows minutes: a redraw every 20 s is plenty.
    cx.timer.every(20000, (cx) => {
      if (appWindow()?.visible === false) return;
      cx.notify();
    });
  }

  // The backdrop follows the choice and the light: only while this layout shows an image.
  syncBackdrop(cx) {
    const root = layout();
    const image = root?.background?.image;
    const want = wanted();
    if (!image || image === want || this.pending === want) return;
    this.pending = want;
    cx.spawn(async () => {
      run("layout.set", { layout: { ...layout(), background: { image: want, fit: "cover" } } });
      this.pending = null;
    });
  }

  button(id, icon, tip, action) {
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(4)
      .bg(INK + "26").text_color(INK).hover((s) => s.bg(INK + "4d")).tooltip(tip)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action)
      .child(svg(`mods/workspace-chrome/${icon}.svg`).size(15));
  }

  render(cx) {
    this.syncBackdrop(cx);
    const collapsed = narrow();
    const w = appWindow();
    const c = choice();
    const next = ORDER[(ORDER.indexOf(c) + 1) % ORDER.length];
    const label = (k) => BACKDROPS[k].label;
    const band = div().relative().size_full().overflow_hidden().child(sunset())
      .child(svg("mods/vice-brand/palm.svg").absolute().right(-10).top(-6).size(70).text_color(INK + "40"))
      .child(svg("mods/vice-brand/palm.svg").absolute().right(34).top(10).size(46).text_color(INK + "2b"));
    if (collapsed) {
      return band.child(h_flex().absolute().size_full().items_center().justify_center()
        .child(div().id("brand-fold").font_family(DISPLAY).text_size(22).text_color(INK).cursor_pointer()
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(toggleSidebar).tooltip("Open sidebar").child("L")));
    }
    return band.child(
      h_flex().absolute().size_full().pl(14).pr(10).gap(6).items_center()
        .when(w?.platform === "macos" && !w?.fullscreen, (el) => el.pl(76))
        .child(v_flex().flex_1().min_w(0)
          .child(div().id("brand-name").flex_none().font_family(DISPLAY).text_size(26).line_height("30px").text_color(INK).cursor_pointer()
            .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
            .on_click(() => setShared(BG_KEY, next))
            .tooltip(`Backdrop: ${label(c)}. Click for ${label(next)}.`)
            .child("Leonida"))
          .child(div().text_size(11).text_color(INK + "b3").child(`Vice City · ${clock()}`)))
        .child(this.button("search", "search", "Find a space or tab", () => run("mod.open", { name: "picker" })))
        .child(this.button("sidebar-toggle", "sidebar", "Fold sidebar", toggleSidebar)),
    );
  }
}
