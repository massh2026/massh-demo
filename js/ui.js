// =====================================================================
//  画面の共通部品（ヘッダー・下のタブ・混雑の表示・お知らせ）
// =====================================================================
import { LEVELS, SOURCE_LABELS } from "./config.js";
import { priceRange } from "./data.js";
import { agoText } from "./logic.js";
import { getDemoClock, onSettingsChange } from "./settings.js";
import { initStore, onChange, getMode, getInitError } from "./store.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export const yen = (n) => `${Number(n).toLocaleString("ja-JP")}円`;

const ICON = {
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
  bowl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/></svg>',
  store: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v10h16V10"/><path d="M2.5 10 5 4h14l2.5 6Z"/><path d="M10 20v-5h4v5"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>',
};
export { ICON };

const NAV = [
  { id: "home", href: "index.html", label: "さがす", icon: ICON.search },
  { id: "menu", href: "menu.html", label: "メニュー", icon: ICON.bowl },
  { id: "store", href: "store.html", label: "お店の方", icon: ICON.store },
  { id: "demo", href: "demo.html", label: "デモ操作", icon: ICON.sliders },
];

/** ヘッダーと下のタブを作り、中身を入れる <main> を返す */
export function renderShell(active) {
  const app = document.getElementById("app");
  const links = NAV.map((n) =>
    `<a href="${n.href}"${n.id === active ? ' aria-current="page"' : ""}>${n.icon}<span>${n.label}</span></a>`
  ).join("");
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="index.html" aria-label="MASSH ホーム">
        <span class="brand-mark">MASSH</span>
        <span class="brand-sub">野田キャンパスの「いま空いてる？」</span>
      </a>
      <nav class="topnav" aria-label="メインメニュー">${links}</nav>
      <div class="topbar-status">
        <a class="chip chip-clock" href="demo.html#clock" hidden></a>
        <span class="chip chip-mode" data-mode="loading">読み込み中</span>
      </div>
    </header>
    <div class="shell-banner" id="shell-banner" role="alert" hidden></div>
    <main id="main" class="main"></main>
    <nav class="tabbar" aria-label="メインメニュー">${links}</nav>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `;
  updateClockChip();
  onSettingsChange(updateClockChip);
  return document.getElementById("main");
}

function updateClockChip() {
  const chip = document.querySelector(".chip-clock");
  if (!chip) return;
  const v = getDemoClock();
  chip.hidden = !v;
  chip.textContent = v ? `デモ時刻 ${v}` : "";
}

export function setShellStatus(mode, error) {
  const chip = document.querySelector(".chip-mode");
  if (chip) {
    chip.dataset.mode = mode;
    chip.textContent = mode === "firebase" ? "Firebase 共有中" : "ローカル";
    chip.title = mode === "firebase"
      ? "Firestore でスマホ・PC・タブレットの画面がリアルタイムに揃います"
      : "このPCのブラウザの中だけで保存しています";
  }
  const banner = document.getElementById("shell-banner");
  if (banner) {
    banner.hidden = !error;
    banner.textContent = error || "";
  }
}

// ---------------------------------------------------------------------
//  混雑の表示部品
// ---------------------------------------------------------------------
export function levelClass(v) {
  if (v.stale && !v.reference) return "stale";
  return LEVELS[v.level].cls;
}

export function levelPill(v, size = "") {
  const cls = size ? ` pill-${size}` : "";
  if (v.stale && !v.reference) return `<span class="pill stale${cls}"><i aria-hidden="true"></i>情報が古い</span>`;
  const L = LEVELS[v.level];
  return `<span class="pill ${L.cls}${cls}"><i aria-hidden="true"></i>${L.label}${v.reference ? "（投稿より）" : ""}</span>`;
}

/** 待ち時間の大きな数字 */
export function waitBoard(v) {
  if (v.waitMin == null) {
    return `<div class="board board-unknown"><span class="board-num">--</span><span class="board-cap">待ち時間不明</span></div>`;
  }
  const cap = v.waitMin === 0 ? `${v.waitKind}なし` : v.waitKind;
  return `<div class="board"><span class="board-num">${v.waitMin}</span><span class="board-unit">分</span><span class="board-cap">${cap}</span></div>`;
}

export function sourceTag(v) {
  if (v.reference) return `<span class="tag">利用者の投稿 ${agoText(v.reference.at, Date.now())}</span>`;
  return `<span class="tag">${SOURCE_LABELS[v.source]}</span>`;
}

export function fitTag(fit) {
  if (!fit) return "";
  if (fit.ok && fit.spare < 5) return `<span class="tag tag-tight">${fit.className}にぎりぎり間に合う</span>`;
  if (fit.ok) return `<span class="tag tag-ok">${fit.className}に間に合う（${fit.spare}分の余裕）</span>`;
  return `<span class="tag tag-ng">${fit.className}に間に合わないかも</span>`;
}

export function shopMetaHtml(shop) {
  const pr = priceRange(shop);
  const group = shop.maxGroupSize > 0 ? `${shop.maxGroupSize}人まで` : "イートインなし";
  return `<span>${esc(shop.genre)}</span><span>徒歩${shop.walkMin}分</span><span>${pr.min}〜${pr.max}円</span><span>${group}</span>`;
}

/** 一覧の1行 */
export function shopRow(v, { fit = null, now = Date.now() } = {}) {
  const s = v.shop;
  const seatsInfo = s.source === "qr" ? `<span class="tag">空き席 ${v.freeSeats}/${v.totalSeats}</span>` : "";
  return `
    <a class="row" href="shop.html?id=${encodeURIComponent(s.id)}" data-level="${levelClass(v)}">
      <div class="row-body">
        <div class="row-head">
          <span class="row-name">${esc(s.name)}</span>
          ${levelPill(v)}
        </div>
        <div class="row-meta">${shopMetaHtml(s)}</div>
        <div class="row-tags">
          ${fitTag(fit)}
          ${seatsInfo}
          ${sourceTag(v)}
          ${s.coupon ? '<span class="tag tag-coupon">お得情報あり</span>' : ""}
        </div>
        <div class="row-updated">最終更新 ${agoText(v.updatedAt, now)}</div>
      </div>
      ${waitBoard(v)}
    </a>`;
}

// ---------------------------------------------------------------------
//  お知らせ（画面下に数秒だけ出るメッセージ）
// ---------------------------------------------------------------------
let toastTimer = null;
export function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-on"), 2600);
}

/** ページ共通の起動処理：データの準備ができたら render を呼び、変化があるたびに呼び直す */
export async function startPage(active, { init, render, intervalMs = 15000 }) {
  const main = renderShell(active);
  if (init) init(main);
  await initStore();
  setShellStatus(getMode(), getInitError());
  render();
  onChange(() => { setShellStatus(getMode(), getInitError()); render(); });
  onSettingsChange(render);
  setInterval(render, intervalMs);
  return main;
}
