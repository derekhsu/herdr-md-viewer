// Markdown viewer pane. Open beside a terminal with
//   herdr-app do pane.split '{"direction":"right","mod":"md-viewer","props":{"file":"/abs/path.md"}}'
// Props: { file } (absolute path, or ~/...). Reloads when the file's folder changes.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { props, readTextFile, watchFolder, theme, home, checking } from "herdr";

function resolve(p) {
  if (!p) return null;
  return p.startsWith("~/") ? home() + p.slice(1) : p;
}

export default class MdViewer extends View {
  init(_props, cx) {
    this.file = resolve(props()?.file);
    this.text = null;
    this.error = null;
    this.load(cx);
    if (checking() || !this.file) return;
    const dir = this.file.slice(0, this.file.lastIndexOf("/")) || "/";
    cx.spawn(async (cx) => {
      for (;;) {
        this.watch = watchFolder(dir);
        const changed = await this.watch;
        if (changed.length === 0) break; // cancelled
        if (changed.some((p) => p === this.file || p === dir)) this.load(cx);
      }
    });
  }

  load(cx) {
    if (!this.file) { this.error = "沒有指定檔案（props.file）"; cx.notify(); return; }
    cx.spawn(async (cx) => {
      try {
        const t = await readTextFile(this.file);
        if (t === null) { this.error = `找不到檔案：${this.file}`; this.text = null; }
        else { this.text = t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ""); this.error = null; }
      } catch (e) {
        this.error = `讀取失敗：${e?.message ?? e}`;
      }
      cx.notify();
    });
  }

  async close(_cx) {
    this.watch?.cancel();
  }

  render(_cx) {
    const t = theme();
    const name = this.file ? this.file.slice(this.file.lastIndexOf("/") + 1) : "Markdown";
    const body = this.error
      ? div().p(16).text_color(t.muted).child(this.error)
      : this.text === null
        ? div().p(16).text_color(t.dim).child("讀取中…")
        : TextView.markdown("md", this.text).selectable(true).scrollable(true).size_full().px(20).py(12);
    return v_flex().id("root").size_full().bg(t.surface).text_color(t.foreground)
      .child(h_flex().px(12).py(6).border_b(1).border_color(t.border ?? t.dim).text_size(12).text_color(t.muted).child(div().truncate().child(name)))
      .child(div().flex_1().min_h(0).child(body));
  }
}
