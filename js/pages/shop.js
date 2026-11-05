// 店舗詳細：混雑・待ち時間・席の状況・授業に間に合うか・メニュー・利用者の投稿
import { CONFIG } from "../config.js";
import { shopById } from "../data.js";
import { shopView, scoreOf, classFit, agoText, distanceMeters, MIN } from "../logic.js";
import { classClock, getGeoSkip, getMySeat } from "../settings.js";
import { getState, addReport } from "../store.js";
import { startPage, esc, yen, levelPill, waitBoard, levelClass, shopMetaHtml, sourceTag, toast, ICON } from "../ui.js";

const shop = shopById(new URLSearchParams(location.search).get("id"));
let els = {};

function init(main) {
  if (!shop) {
    main.innerHTML = `
      <a class="back" href="index.html">${ICON.back}一覧にもどる</a>
      <p class="empty">お店が見つかりません。一覧からもう一度選んでください。</p>`;
    return;
  }
  document.title = `MASSH｜${shop.name}`;
  const flags = [
    shop.area === "学内" ? "学内" : "学外",
    shop.reservable ? "予約できる" : "",
    shop.night ? "夜も営業" : "昼のみ",
    shop.cafe ? "カフェメニューあり" : "",
  ].filter(Boolean).map((t) => `<span class="tag">${t}</span>`).join("");

  main.innerHTML = `
    <a class="back" href="index.html">${ICON.back}一覧にもどる</a>
    <h1 class="shop-title">${esc(shop.name)}</h1>
    <div class="shop-meta">${shopMetaHtml(shop)}</div>
    <div class="shop-flags">${flags}</div>
    ${shop.note ? `<p class="note" style="margin-top:6px">${esc(shop.note)}</p>` : ""}

    <section class="status" id="status" aria-live="polite"></section>
    <div id="fit"></div>
    ${shop.coupon ? `<div class="coupon">お得情報：${esc(shop.coupon)}</div>` : ""}
    <div id="seats"></div>

    <h2 class="sec-title">メニュー</h2>
    <div class="panel"><ul class="menu-list">${menuItems()}</ul></div>

    <h2 class="sec-title">いまの様子を教える</h2>
    <div class="panel">
      <p class="note">お店の近く（${CONFIG.reportRadiusMeters}m以内）にいる人だけが投稿できます。お店の情報が古いときに、参考として表示されます。</p>
      <div class="report-btns">
        <button type="button" class="report-btn empty" data-kind="empty">空いてた</button>
        <button type="button" class="report-btn crowded" data-kind="crowded">混んでた</button>
      </div>
      <p class="report-msg" id="report-msg" role="status"></p>
      <ul class="report-list" id="report-list"></ul>
    </div>

    <h2 class="sec-title">おすすめ点数</h2>
    <div class="panel" id="score"></div>
    ${shop.source === "store" ? `<p class="note" style="margin-top:14px">このお店の方は <a href="store.html?shop=${shop.id}">お店の方のページ</a> から混雑を入力できます。</p>` : ""}
  `;
  els = {
    status: main.querySelector("#status"),
    fit: main.querySelector("#fit"),
    seats: main.querySelector("#seats"),
    score: main.querySelector("#score"),
    msg: main.querySelector("#report-msg"),
    reports: main.querySelector("#report-list"),
  };
  main.querySelectorAll(".report-btn").forEach((b) => b.addEventListener("click", () => postReport(b.dataset.kind)));
}

function menuItems() {
  const menus = [...shop.menus].sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0) || b.popularity - a.popularity);
  return menus.map((m) => `
    <li class="menu-item">
      <span class="menu-name">${esc(m.name)}</span>
      <span class="menu-price">${m.price.toLocaleString("ja-JP")}<small>円</small></span>
      <span class="menu-sub">
        ${m.recommended ? '<span class="tag tag-rec">お店のおすすめ</span>' : ""}
        ${m.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        <span>提供まで約${m.serveMin}分</span>
      </span>
    </li>`).join("");
}

function render() {
  if (!shop) return;
  const now = Date.now();
  const state = getState();
  const v = shopView(shop, state, now);
  const clock = classClock();

  // 混雑と待ち時間
  let explain = "";
  if (v.stale && v.reference) {
    explain = `お店の情報が${CONFIG.staleMinutes}分以上更新されていないため、利用者の投稿（${agoText(v.reference.at, now)}・${v.reference.kind === "empty" ? "空いてた" : "混んでた"}）を参考に表示しています。`;
  } else if (v.stale) {
    explain = `最終更新から${CONFIG.staleMinutes}分以上たっているため、満席として扱っています。`;
  } else {
    explain = esc(v.detail);
  }
  els.status.dataset.level = levelClass(v);
  els.status.innerHTML = `
    <div class="status-top">
      <div class="status-left">
        ${levelPill(v, "lg")}
        <span class="status-updated">最終更新 ${agoText(v.updatedAt, now)}</span>
        ${sourceTag(v)}
      </div>
      ${waitBoard(v)}
    </div>
    <div class="status-detail">${explain}</div>`;

  // 次の授業に間に合うか
  const fit = classFit(v, clock);
  els.fit.innerHTML = fit ? `
    <div class="fit ${fit.ok ? "is-ok" : ""}">
      <p class="fit-title">${!fit.ok ? `${fit.className}（${fit.start}）に間に合わないかもしれません` : fit.spare < 5 ? `${fit.className}（${fit.start}）にぎりぎり間に合います` : `${fit.className}（${fit.start}）に間に合います`}</p>
      <p class="fit-calc">往復の徒歩 ${fit.walk * 2}分 ＋ 待ち ${fit.wait}分${fit.assumedWait ? "（不明のため仮定）" : ""} ＋ 提供 ${fit.serve}分 ＋ 食事 ${fit.eat}分 ＝ ${fit.need}分。
      授業まであと${fit.inMin}分${fit.ok ? `なので、${fit.spare}分の余裕があります。` : "です。"}</p>
    </div>` : "";

  // 学食の席（QRチェックイン）
  if (shop.source === "qr") {
    const mine = getMySeat();
    const cells = v.seats.map((s) => {
      const cls = `seat${s.occupied ? " is-used" : ""}${mine === s.id && s.occupied ? " is-mine" : ""}`;
      const label = `${s.label} ${s.occupied ? `使用中（${agoText(s.since, now).replace("前", "前から")}）` : "空席"}`;
      return `<a class="${cls}" href="checkin.html?seat=${encodeURIComponent(s.id)}" title="${label}" aria-label="${label}">${s.label}</a>`;
    }).join("");
    els.seats.innerHTML = `
      <h2 class="sec-title">席の状況（空き ${v.freeSeats}席 / ${v.totalSeats}席）</h2>
      <div class="panel">
        <div class="seatmap" style="grid-template-columns: repeat(${shop.seats.cols}, 1fr)">${cells}</div>
        <div class="seat-legend"><span>空席</span><span class="used">使用中</span></div>
        <p class="note" style="margin-top:10px">各テーブルのQRコードを読むとチェックインできます。退席を押し忘れても${CONFIG.seatAutoReleaseMinutes}分で自動的に空席に戻ります。デモでは席を押すとチェックインの画面が開きます。</p>
      </div>`;
  } else if (shop.source === "ble") {
    els.seats.innerHTML = `
      <h2 class="sec-title">人数の推定</h2>
      <div class="panel">
        <p>店内に置いたPCが、周りにあるBluetooth機器の数を数えています。</p>
        <p class="note" style="margin-top:6px">${esc(v.detail)}。機器の識別番号は保存せず、台数だけを送っています。1人が複数の機器を持っていたり、Bluetoothを切っている人もいるため、正確な人数ではなく目安です。</p>
        <p class="note" style="margin-top:6px">いまの台数の出どころ：${v.bleBy === "sensor" ? "Pythonのセンサー（sensor/ble_counter.py）" : "デモ操作の画面"}</p>
      </div>`;
  }

  // 利用者の投稿（直近2時間）
  const recent = (state.reports || []).filter((r) => r.shopId === shop.id && now - r.at <= 120 * MIN).slice(0, 5);
  els.reports.innerHTML = recent.map((r) =>
    `<li><span>${r.kind === "empty" ? "空いてた" : "混んでた"}</span><span class="muted">${agoText(r.at, now)}</span></li>`
  ).join("");

  // おすすめ点数
  const sc = scoreOf(v, {}, clock);
  els.score.innerHTML = `
    <div class="score-line">
      <span class="score-total">${sc.total}点</span>
      <span>＝ ${sc.parts.map((p) => `${p.label} ${p.points}`).join(" ＋ ")}</span>
    </div>
    <p class="note" style="margin-top:8px">鮮度点は最終更新が${CONFIG.score.fresh.map((f) => `${f.within}分以内なら${f.points}点`).join("、")}。こまめに更新するお店ほど一覧の上に出ます。</p>`;
}

function setMsg(text, kind) {
  els.msg.textContent = text;
  els.msg.className = `report-msg ${kind === "error" ? "is-error" : kind === "ok" ? "is-ok" : ""}`;
}

async function postReport(kind) {
  const word = kind === "empty" ? "空いてた" : "混んでた";
  if (getGeoSkip()) {
    await addReport(shop.id, kind, true);
    setMsg(`「${word}」を投稿しました（デモ設定で位置の確認を省略しています）。`, "ok");
    toast("投稿しました");
    return;
  }
  if (!window.isSecureContext || !("geolocation" in navigator)) {
    setMsg("この開き方では位置情報が使えません。PCでは http://localhost:8000 で開くか、デモ操作の画面で「位置の確認を省略する」をオンにしてください。", "error");
    return;
  }
  setMsg("位置情報を確認しています…");
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const d = distanceMeters(pos.coords.latitude, pos.coords.longitude, shop.lat, shop.lng);
    if (d <= CONFIG.reportRadiusMeters) {
      await addReport(shop.id, kind, true);
      setMsg(`「${word}」を投稿しました。ありがとうございます。`, "ok");
      toast("投稿しました");
    } else {
      setMsg(`お店から約${Math.round(d).toLocaleString("ja-JP")}m離れているため投稿できません（${CONFIG.reportRadiusMeters}m以内で投稿できます）。いたずら投稿を防ぐための確認です。`, "error");
    }
  }, () => {
    setMsg("位置情報を取得できませんでした。ブラウザで位置情報の利用を許可するか、デモ操作の画面で「位置の確認を省略する」をオンにしてください。", "error");
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

startPage("home", { init, render });
