// ホーム：いま入れるお店・場面からさがす・一覧／地図
import { CONFIG, LEVELS } from "../config.js";
import { GENRES, priceRange } from "../data.js";
import { allViews, scoreOf, classFit } from "../logic.js";
import { classClock } from "../settings.js";
import { getState, resetDemo } from "../store.js";
import { startPage, esc, shopRow, levelClass, toast } from "../ui.js";

// 場面ごとの絞り込み（ボタンを押したときの初期値もここで決める）
const SCENES = {
  "": { label: "すべて" },
  lunch: { label: "1時間の昼休み", help: "徒歩10分以内で、次の授業に間に合う店を上に出します。" },
  cafe: { label: "空きコマのカフェ", help: "カフェ・カフェメニューがある店だけを出します。" },
  budget: { label: "予算が決まったランチ", help: "一番安いメニューが予算以内の店だけを出します。", budget: 700 },
  night: { label: "部活後の夜ご飯", help: "夜も営業していて、人数が入れる店だけを出します。予約できる店は加点します。", people: 8 },
};

let scene = "";
let view = "list";
let map = null;
let markerLayer = null;
let els = {};

function init(main) {
  const genreOptions = GENRES.map((g) => `<option>${esc(g)}</option>`).join("");
  const sceneButtons = Object.entries(SCENES)
    .map(([id, s]) => `<button type="button" class="scene" data-scene="${id}" aria-pressed="${id === scene}">${s.label}</button>`)
    .join("");
  main.innerHTML = `
    <section class="depart" aria-labelledby="depart-title">
      <div class="depart-head">
        <h1 class="depart-title" id="depart-title">いま入れるお店</h1>
        <span class="depart-time" id="depart-time"></span>
      </div>
      <p class="depart-lead">空いている・やや混みのお店を、おすすめ順に並べています。</p>
      <div id="depart-strip"></div>
    </section>

    <h2 class="sec-title">場面からさがす</h2>
    <div class="scenes" role="group" aria-label="場面">${sceneButtons}</div>
    <p class="note" id="scene-help" hidden></p>

    <form class="filters" id="filters" onsubmit="return false">
      <label class="field">予算（円以内）<input type="number" name="budget" inputmode="numeric" min="0" step="50" placeholder="指定なし"></label>
      <label class="field">人数<input type="number" name="people" inputmode="numeric" min="1" max="60" placeholder="指定なし"></label>
      <label class="field">ジャンル<select name="genre"><option value="">すべて</option>${genreOptions}</select></label>
      <label class="field">場所<select name="area"><option value="">学内・学外</option><option>学内</option><option>学外</option></select></label>
      <label class="field field-wide">並び順
        <select name="sort">
          <option value="score">おすすめ順</option>
          <option value="vacancy">空いている順</option>
          <option value="wait">待ち時間が短い順</option>
          <option value="walk">近い順</option>
          <option value="fresh">更新が新しい順</option>
        </select>
      </label>
    </form>

    <div class="viewbar">
      <div class="seg" role="tablist" aria-label="表示の切り替え">
        <button type="button" role="tab" data-view="list" aria-selected="true">一覧</button>
        <button type="button" role="tab" data-view="map" aria-selected="false">地図</button>
      </div>
      <p class="count" id="count" aria-live="polite"></p>
    </div>
    <div id="stale-note"></div>
    <div id="list" class="list"></div>
    <div id="map" class="map" hidden></div>
    <p class="note" style="margin-top:12px">おすすめ順は「鮮度点（こまめに更新している店ほど高い）＋ 空き点 ＋ 条件点」の合計です。点数の内訳は各お店のページで見られます。</p>
  `;
  els = {
    strip: main.querySelector("#depart-strip"),
    time: main.querySelector("#depart-time"),
    form: main.querySelector("#filters"),
    help: main.querySelector("#scene-help"),
    count: main.querySelector("#count"),
    list: main.querySelector("#list"),
    map: main.querySelector("#map"),
    staleNote: main.querySelector("#stale-note"),
  };

  main.querySelectorAll(".scene").forEach((btn) => btn.addEventListener("click", () => selectScene(btn.dataset.scene)));
  els.form.addEventListener("input", render);
  main.querySelectorAll(".seg button").forEach((btn) => btn.addEventListener("click", () => {
    view = btn.dataset.view;
    main.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    render();
  }));
  els.staleNote.addEventListener("click", async (e) => {
    if (e.target.closest("[data-reset]")) {
      await resetDemo();
      toast("デモデータを初期状態に戻しました");
    }
  });
}

function selectScene(id) {
  scene = id;
  document.querySelectorAll(".scene").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scene === id)));
  const s = SCENES[id];
  const f = els.form.elements;
  f.budget.value = s.budget ?? "";
  f.people.value = s.people ?? "";
  f.sort.value = "score";
  els.help.hidden = !s.help;
  els.help.textContent = s.help || "";
  render();
}

function readFilters() {
  const f = els.form.elements;
  return {
    scene,
    budget: Number(f.budget.value) || 0,
    people: Number(f.people.value) || 0,
    genre: f.genre.value,
    area: f.area.value,
    sort: f.sort.value,
  };
}

function matches(v, f) {
  const s = v.shop;
  if (f.scene === "lunch" && !(s.lunch && s.walkMin <= 10)) return false;
  if (f.scene === "cafe" && !s.cafe) return false;
  if (f.scene === "budget" && !s.lunch) return false;
  if (f.scene === "night" && !s.night) return false;
  if (f.budget && priceRange(s).min > f.budget) return false;
  if (f.people && s.maxGroupSize < f.people) return false;
  if (f.genre && s.genre !== f.genre) return false;
  if (f.area && s.area !== f.area) return false;
  return true;
}

const waitKey = (v) => (v.waitMin == null ? 9999 : v.waitMin);

function sortItems(items, how) {
  const by = {
    score: (a, b) => b.score.total - a.score.total || waitKey(a.v) - waitKey(b.v),
    vacancy: (a, b) => a.v.level - b.v.level || waitKey(a.v) - waitKey(b.v),
    wait: (a, b) => waitKey(a.v) - waitKey(b.v) || a.v.level - b.v.level,
    walk: (a, b) => a.v.shop.walkMin - b.v.shop.walkMin,
    fresh: (a, b) => (b.v.updatedAt || 0) - (a.v.updatedAt || 0),
  }[how];
  return items.sort(by);
}

function render() {
  const now = Date.now();
  const clock = classClock();
  const f = readFilters();
  const views = allViews(getState(), now);
  const items = views.map((v) => ({ v, score: scoreOf(v, f, clock), fit: classFit(v, clock) }));

  // いま入れるお店（発車標）
  els.time.textContent = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const open = sortItems(items.filter((x) => x.v.level <= 1 && (!x.v.stale || x.v.reference)), "score").slice(0, 6);
  els.strip.innerHTML = open.length
    ? `<div class="depart-strip">${open.map(({ v }) => departTile(v)).join("")}</div>`
    : `<p class="depart-empty">いますぐ入れるお店はありません。混雑が少ない順に一覧を見てください。</p>`;

  // 情報が古いお店が多いとき（前の日のデータのまま開いたときなど）
  const staleCount = views.filter((v) => v.stale).length;
  els.staleNote.innerHTML = staleCount >= Math.ceil(views.length * 0.7)
    ? `<div class="stale-note"><span>${staleCount}店の情報が${CONFIG.staleMinutes}分以上前のままです。発表の前にデモデータを作り直してください。</span>
         <button type="button" class="btn btn-ghost" data-reset>デモデータを初期状態に戻す</button></div>`
    : "";

  // 一覧・地図
  const shown = sortItems(items.filter((x) => matches(x.v, f)), f.sort);
  els.count.textContent = `${shown.length}件`;
  els.list.hidden = view !== "list";
  els.map.hidden = view !== "map";
  if (view === "list") {
    els.list.innerHTML = shown.length
      ? shown.map(({ v, fit }) => shopRow(v, { fit, now })).join("")
      : `<p class="empty">条件に合うお店がありません。予算や人数を変えてみてください。</p>`;
  } else {
    drawMap(shown);
  }
}

function departTile(v) {
  const L = LEVELS[v.level];
  const wait = v.waitMin == null ? "--" : v.waitMin;
  const cap = v.waitMin === 0 ? `${v.waitKind}なし` : v.waitKind;
  return `
    <a class="depart-tile" data-level="${L.cls}" href="shop.html?id=${encodeURIComponent(v.shop.id)}">
      <span class="depart-name">${esc(v.shop.name)}</span>
      <span class="depart-sub">${L.label}　徒歩${v.shop.walkMin}分${v.reference ? "　投稿より" : ""}</span>
      <span class="depart-wait"><span class="depart-num">${wait}</span><span class="depart-unit">分</span><span class="depart-cap">${cap}</span></span>
    </a>`;
}

// ---------------- 地図 ----------------
const LEVEL_COLORS = { lv0: "#1c9a5b", lv1: "#e2ad00", lv2: "#e8721f", lv3: "#d33b3b", stale: "#8b979c" };

function ensureMap() {
  if (map) return true;
  if (!window.L) {
    els.map.innerHTML = `<p class="empty">地図を読み込めませんでした。インターネットにつながっているか確認してください（一覧はそのまま使えます）。</p>`;
    return false;
  }
  const L = window.L;
  map = L.map(els.map, { scrollWheelZoom: false }).setView([CONFIG.campus.lat, CONFIG.campus.lng], 15);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  L.circle([CONFIG.campus.lat, CONFIG.campus.lng], {
    radius: 230, color: "#0d5c75", weight: 1.5, dashArray: "5 5", fillColor: "#0d5c75", fillOpacity: 0.06,
  }).addTo(map).bindTooltip(CONFIG.campus.name);
  markerLayer = L.layerGroup().addTo(map);
  return true;
}

function drawMap(shown) {
  if (!ensureMap()) return;
  setTimeout(() => map.invalidateSize(), 0);
  markerLayer.clearLayers();
  for (const { v } of shown) {
    const cls = levelClass(v);
    const label = v.stale && !v.reference ? "情報が古い" : LEVELS[v.level].label;
    const wait = v.waitMin == null ? "待ち時間不明" : v.waitMin === 0 ? `${v.waitKind}なし` : `${v.waitKind} 約${v.waitMin}分`;
    window.L.circleMarker([v.shop.lat, v.shop.lng], {
      radius: 11, color: "#ffffff", weight: 2.5, fillColor: LEVEL_COLORS[cls], fillOpacity: 1,
    })
      .bindPopup(`<div class="map-pop"><b>${esc(v.shop.name)}</b><br>${label}　${wait}<br><a href="shop.html?id=${encodeURIComponent(v.shop.id)}">くわしく見る</a></div>`)
      .bindTooltip(esc(v.shop.name))
      .addTo(markerLayer);
  }
}

startPage("home", { init, render });
