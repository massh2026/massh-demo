// 目的別メニューランキング：予算重視 / 値段を気にしない / さっと食べたい
import { menuRanking } from "../logic.js";
import { getState } from "../store.js";
import { startPage, esc, levelPill } from "../ui.js";

const MODES = {
  budget: { label: "予算重視", help: "予算以内のメニューを、お店のおすすめ・人気の順に並べます。" },
  any: { label: "値段を気にしない", help: "値段に関係なく、お店のおすすめ・人気の順に並べます。" },
  quick: { label: "さっと食べたい", help: "「いまの待ち時間 ＋ 提供までの時間」が短い順に並べます。待ち時間が分からないお店は最後に出します。" },
};

let mode = "budget";
let els = {};

function init(main) {
  const tabs = Object.entries(MODES)
    .map(([id, m]) => `<button type="button" class="tab" role="tab" data-mode="${id}" aria-selected="${id === mode}">${m.label}</button>`)
    .join("");
  main.innerHTML = `
    <h1 class="page-title">メニューランキング</h1>
    <p class="page-lead">いまの混雑と組み合わせて、目的に合うメニューを探せます。</p>
    <div class="tabs" role="tablist" aria-label="ランキングの種類">${tabs}</div>
    <p class="tab-help" id="help"></p>
    <form class="filters" id="budget-form" onsubmit="return false" style="grid-template-columns: minmax(0, 220px); margin: 0 0 14px">
      <label class="field">予算（円以内）<input type="number" name="budget" inputmode="numeric" min="0" step="50" value="700"></label>
    </form>
    <div class="list" id="list"></div>
  `;
  els = {
    help: main.querySelector("#help"),
    form: main.querySelector("#budget-form"),
    list: main.querySelector("#list"),
  };
  main.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    mode = t.dataset.mode;
    main.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    render();
  }));
  els.form.addEventListener("input", render);
}

function render() {
  const now = Date.now();
  els.help.textContent = MODES[mode].help;
  els.form.hidden = mode !== "budget";
  const budget = Number(els.form.elements.budget.value) || 0;
  const rows = menuRanking(mode, getState(), now, budget).slice(0, 15);
  els.list.innerHTML = rows.length ? rows.map((r, i) => {
    const time = r.total == null ? "待ち時間不明" : `待ち${r.v.waitMin}分＋提供${r.m.serveMin}分`;
    return `
      <a class="rank" href="shop.html?id=${encodeURIComponent(r.v.shop.id)}">
        <span class="rank-no">${i + 1}</span>
        <span class="rank-main">
          <span class="rank-name">${esc(r.m.name)}${r.m.recommended ? '<span class="tag tag-rec">おすすめ</span>' : ""}</span>
          <span class="rank-shop">${esc(r.v.shop.name)} ${levelPill(r.v)}</span>
        </span>
        <span class="rank-side">
          <span class="menu-price">${r.m.price.toLocaleString("ja-JP")}<small>円</small></span>
          <span class="rank-time">${time}</span>
        </span>
      </a>`;
  }).join("") : `<p class="empty">予算以内のメニューがありません。予算を上げてみてください。</p>`;
}

startPage("menu", { init, render });
