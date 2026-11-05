// お店の方：PINを入れて、混雑と待ち組数を入力する（タブレット・スマホ向け）
import { CONFIG, LEVELS } from "../config.js";
import { SHOPS, shopById } from "../data.js";
import { allViews, shopView, scoreOf, agoText, freshPoints, minutesUntilFreshDrop } from "../logic.js";
import { classClock, isUnlocked, setUnlocked } from "../settings.js";
import { getState, updateStoreStatus } from "../store.js";
import { startPage, esc, toast } from "../ui.js";
import { dayKey } from "../seed.js";

const STORE_SHOPS = SHOPS.filter((s) => s.source === "store");
const params = new URLSearchParams(location.search);
let shopId = params.get("shop");
let main;

function init(m) {
  main = m;
  main.addEventListener("click", onClick);
  main.addEventListener("submit", onSubmit);
  main.addEventListener("change", onChangeSelect);
}

function render() {
  // 「1組あたりの待ち時間」を選んでいる最中は作り直さない（選択肢が閉じてしまうため）
  const active = document.activeElement;
  if (active && active.tagName === "SELECT" && main.contains(active) && active.dataset.act === "per") return;
  const shop = shopById(shopId);
  if (!shop || shop.source !== "store" || !isUnlocked(shop.id)) {
    renderLogin(shop);
  } else {
    renderPanel(shop);
  }
}

// ---------------- PIN入力 ----------------
function renderLogin(selected) {
  if (main.querySelector("#login")) return; // 入力中は作り直さない
  const options = STORE_SHOPS.map((s) =>
    `<option value="${s.id}"${selected && selected.id === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("");
  main.innerHTML = `
    <h1 class="page-title">お店の方へ</h1>
    <p class="page-lead">お店を選んで4桁のPINを入れると、混雑を入力する画面が開きます。タブレットやスマホのブラウザでそのまま使えます。</p>
    <form class="panel" id="login" style="max-width:460px">
      <label class="field">お店<select name="shop">${options}</select></label>
      <label class="field" style="margin-top:12px">PIN（4桁）<input name="pin" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]*" required></label>
      <p class="report-msg is-error" id="login-msg" role="alert"></p>
      <button class="btn btn-wide" style="margin-top:8px">入力画面を開く</button>
      <p class="note" style="margin-top:10px">デモ用のPINは<a href="demo.html#pins">デモ操作</a>の画面にあります。本番ではFirebase Authenticationでお店ごとにログインする想定です。</p>
    </form>`;
}

// ---------------- 混雑の入力 ----------------
function renderPanel(shop) {
  const now = Date.now();
  const state = getState();
  const v = shopView(shop, state, now);
  const st = (state.status || {})[shop.id] || {};
  const groups = st.waitGroups ?? 0;
  const per = st.minPerGroup ?? shop.minPerGroup;

  // 一覧での順位（おすすめ順・条件なし）
  const clock = classClock();
  const ranked = allViews(state, now)
    .map((x) => ({ id: x.shop.id, total: scoreOf(x, {}, clock).total, wait: x.waitMin ?? 9999 }))
    .sort((a, b) => b.total - a.total || a.wait - b.wait);
  const rank = ranked.findIndex((x) => x.id === shop.id) + 1;
  const fresh = v.stale ? 0 : freshPoints(v.ageMin);
  const drop = v.stale ? null : minutesUntilFreshDrop(v.ageMin);
  const today = st.updateDay === dayKey(now) ? st.updateCount || 0 : 0;

  const tickets = LEVELS.map((L) =>
    `<button type="button" class="ticket ${L.cls}" data-level="${L.id}" aria-pressed="${!v.stale && v.rawLevel === L.id}">${L.label}</button>`).join("");
  const perOptions = [2, 3, 4, 5, 6, 7, 8, 10, 12, 15]
    .map((n) => `<option value="${n}"${n === per ? " selected" : ""}>${n}分</option>`).join("");

  let hint;
  if (v.stale) hint = `最終更新から${CONFIG.staleMinutes}分以上たったため、お客さんの画面では「情報が古い」と表示され、満席として扱われています。いまの状態を押してください。`;
  else if (drop != null && drop <= 10) hint = `あと${drop}分で鮮度点が下がります。こまめに更新すると一覧の上の方に表示されます。`;
  else hint = "こまめに更新するほど、お客さんの一覧で上の方に表示されます。";

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
      <h1 class="page-title">${esc(shop.name)}</h1>
      <button type="button" class="btn btn-ghost" data-act="logout">お店を切り替える</button>
    </div>
    <p class="page-lead">最終更新 ${agoText(v.updatedAt, now)}　ボタンを押すとすぐにお客さんの画面に反映されます。</p>

    <div class="store-grid">
      <section class="panel" aria-labelledby="lv-h">
        <h2 id="lv-h">いまの混雑</h2>
        <div class="ticket-grid">${tickets}</div>

        <h2 style="margin-top:26px">お待ちのお客さん</h2>
        <div class="stepper">
          <button type="button" data-act="minus" aria-label="1組へらす">−</button>
          <span class="stepper-value" aria-live="polite">${groups}</span><span class="stepper-unit">組</span>
          <button type="button" data-act="plus" aria-label="1組ふやす">＋</button>
        </div>
        <div class="inline-form">
          <label class="field">1組あたりの待ち時間<select data-act="per">${perOptions}</select></label>
          <p class="note" style="padding-bottom:10px">お客さんの画面では「待ち 約${groups * per}分」と表示されます</p>
        </div>
      </section>

      <section class="panel" aria-labelledby="dash-h">
        <h2 id="dash-h">お店のダッシュボード</h2>
        <div class="stat-list" style="margin-top:10px">
          <div class="stat"><span class="stat-label">今日の更新回数</span><span class="stat-value">${today}<small>回</small></span></div>
          <div class="stat"><span class="stat-label">一覧での順位（おすすめ順）</span><span class="stat-value">${rank}<small>位 / ${ranked.length}店</small></span></div>
          <div class="stat"><span class="stat-label">いまの鮮度点</span><span class="stat-value">${fresh}<small>点</small></span></div>
        </div>
        <p class="store-hint">${hint}</p>
      </section>
    </div>`;
}

// ---------------- 操作 ----------------
function onSubmit(e) {
  if (e.target.id !== "login") return;
  e.preventDefault();
  const f = e.target.elements;
  const shop = shopById(f.shop.value);
  if (shop && f.pin.value === shop.pin) {
    setUnlocked(shop.id, true);
    shopId = shop.id;
    history.replaceState(null, "", `store.html?shop=${shop.id}`);
    main.innerHTML = "";
    render();
  } else {
    main.querySelector("#login-msg").textContent = "PINが違います。もう一度入力してください。";
    f.pin.select();
  }
}

function onChangeSelect(e) {
  if (e.target.matches('select[data-act="per"]')) {
    updateStoreStatus(shopId, { minPerGroup: Number(e.target.value) }).then(() => toast("1組あたりの待ち時間を変更しました"));
  }
}

async function onClick(e) {
  const btn = e.target.closest("button");
  if (!btn || !main.contains(btn)) return;
  const st = (getState().status || {})[shopId] || {};
  const groups = st.waitGroups ?? 0;

  if (btn.dataset.level != null) {
    const level = Number(btn.dataset.level);
    // 「空き」にしたときは待ち組数を0にする
    await updateStoreStatus(shopId, level === 0 ? { level, waitGroups: 0 } : { level });
    toast(`「${LEVELS[level].label}」で更新しました`);
  } else if (btn.dataset.act === "plus") {
    await updateStoreStatus(shopId, { waitGroups: groups + 1 });
  } else if (btn.dataset.act === "minus") {
    await updateStoreStatus(shopId, { waitGroups: Math.max(0, groups - 1) });
  } else if (btn.dataset.act === "logout") {
    setUnlocked(shopId, false);
    main.innerHTML = "";
    render();
  }
}

startPage("store", { init, render });
