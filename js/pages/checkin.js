// 席のQRチェックイン：テーブルのQRコードを読むと開くページ（checkin.html?seat=canal-A1）
import { CONFIG } from "../config.js";
import { seatInfo } from "../data.js";
import { shopView, seatState, agoText, MIN } from "../logic.js";
import { getMySeat, setMySeat } from "../settings.js";
import { getState, setSeat } from "../store.js";
import { startPage, esc, toast, ICON } from "../ui.js";

const seatId = new URLSearchParams(location.search).get("seat");
const info = seatInfo(seatId);
let box;

function init(main) {
  if (!info) {
    main.innerHTML = `
      <h1 class="page-title">席のチェックイン</h1>
      <p class="empty">このQRコードの席が見つかりません。テーブルのQRコードをもう一度読み取ってください。</p>`;
    return;
  }
  main.innerHTML = `
    <a class="back" href="shop.html?id=${info.shop.id}">${ICON.back}${esc(info.shop.name)}のページへ</a>
    <section class="panel checkin" id="box" aria-live="polite"></section>
    <p class="note" style="margin-top:14px">チェックインすると、この席が「使用中」として学食の混雑に反映されます。退席を押し忘れても${CONFIG.seatAutoReleaseMinutes}分で自動的に空席に戻ります。名前などの個人情報は送りません。</p>`;
  box = main.querySelector("#box");
  box.addEventListener("click", onClick);
}

function render() {
  if (!info) return;
  const now = Date.now();
  const state = getState();
  const seat = seatState((state.seats || {})[seatId], now);
  const mine = getMySeat() === seatId && seat.occupied;
  const v = shopView(info.shop, state, now);

  let stateText;
  let action;
  if (mine) {
    const left = Math.max(0, Math.ceil((seat.since + CONFIG.seatAutoReleaseMinutes * MIN - now) / MIN));
    stateText = `あなたがチェックイン中です（${agoText(seat.since, now)}から）。<br>あと${left}分で自動的に空席に戻ります。`;
    action = `<button type="button" class="btn btn-wide" data-act="leave">退席する</button>`;
  } else if (seat.occupied) {
    stateText = `この席は使用中になっています（${agoText(seat.since, now)}から）。<br>前の人が退席を押し忘れた可能性があります。`;
    action = `<button type="button" class="btn btn-wide" data-act="sit">いま座ったのでチェックインする</button>`;
  } else {
    stateText = "この席は空いています。";
    action = `<button type="button" class="btn btn-wide" data-act="sit">この席にチェックイン</button>`;
  }

  box.innerHTML = `
    <p class="checkin-shop">${esc(info.shop.name)}</p>
    <p class="checkin-seat">${esc(info.label)}</p>
    <p class="checkin-state">${stateText}</p>
    ${action}
    <p class="checkin-free">いまの${esc(info.shop.name)}：空き ${v.freeSeats}席 / ${v.totalSeats}席</p>`;
}

async function onClick(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  btn.disabled = true;
  if (btn.dataset.act === "sit") {
    // 別の席にチェックインしたままなら、そちらは退席にする
    const prev = getMySeat();
    if (prev && prev !== seatId) {
      const p = seatInfo(prev);
      if (p) await setSeat(prev, p.shop.id, false);
    }
    await setSeat(seatId, info.shop.id, true);
    setMySeat(seatId);
    toast(`${info.label}にチェックインしました`);
  } else {
    await setSeat(seatId, info.shop.id, false);
    setMySeat(null);
    toast("退席しました。ありがとうございました");
  }
  render();
}

startPage("home", { init, render, intervalMs: 10000 });
