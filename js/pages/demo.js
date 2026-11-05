// デモ操作：発表の準備と、センサー・QRの代わりになる操作をまとめた画面（本番のサービスにはないページ）
import { CONFIG, LEVELS } from "../config.js";
import { SHOPS, shopById, seatIdsOf } from "../data.js";
import { shopView, agoText } from "../logic.js";
import { getDemoClock, setDemoClock, getGeoSkip, setGeoSkip, notifySettingsChanged } from "../settings.js";
import { getState, getMode, resetDemo, setBleCount, setSeats, getServerInfo } from "../store.js";
import { startPage, esc, toast, levelPill } from "../ui.js";

const conv = shopById("conv");
const QR_SHOPS = SHOPS.filter((s) => s.source === "qr");
let els = {};
let lanUrl = null;

function init(main) {
  const pinRows = SHOPS.filter((s) => s.source === "store").map((s) => `
    <tr><td>${esc(s.name)}</td><td class="pin">${s.pin}</td>
    <td><a href="store.html?shop=${s.id}">入力画面</a></td></tr>`).join("");
  const seatPanels = QR_SHOPS.map((s) => `
    <div class="seat-sim" data-shop="${s.id}">
      <h3>${esc(s.name)} <span data-seat-state></span></h3>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-seat="in">1席チェックイン</button>
        <button type="button" class="btn btn-ghost" data-seat="out">1席退席</button>
        <button type="button" class="btn btn-ghost" data-seat="full">ほぼ満席にする</button>
        <button type="button" class="btn btn-ghost" data-seat="empty">ほぼ空にする</button>
      </div>
    </div>`).join("");

  main.innerHTML = `
    <h1 class="page-title">デモ操作</h1>
    <p class="page-lead">発表で使う操作をまとめた画面です。本番のサービスにはない、デモ専用のページです。</p>

    <div class="demo-grid two">
      <section class="panel">
        <h2>いまの動作モード</h2>
        <div id="mode"></div>
      </section>
      <section class="panel">
        <h2>スマホ・タブレットから開くURL</h2>
        <div id="urls"></div>
      </section>
    </div>

    <h2 class="sec-title">発表の前に</h2>
    <div class="demo-grid two">
      <section class="panel">
        <h2>デモデータを作り直す</h2>
        <p class="note">いまの時刻を基準に、混雑・席・投稿を初期状態に戻します。発表の直前に押してください。</p>
        <button type="button" class="btn btn-danger" data-act="reset" style="margin-top:10px">デモデータを初期状態に戻す</button>
      </section>
      <section class="panel" id="clock">
        <h2>デモ時刻</h2>
        <p class="note">「次の授業に間に合うか」の計算に使う時刻です。夜に練習するときも、12:10などに設定すると昼休みの様子を見せられます。</p>
        <form class="inline-form" id="clock-form">
          <label class="field">時刻<input type="time" name="clock" required></label>
          <button class="btn">設定する</button>
          <button type="button" class="btn btn-ghost" data-act="clock-clear">いまの時刻に戻す</button>
        </form>
        <p class="note" style="margin-top:8px">授業の開始時刻（仮）：${CONFIG.classStarts.map((c) => `${c.name} ${c.start}`).join("、")}。js/config.js で変更できます。</p>
      </section>
    </div>

    <h2 class="sec-title">センサーとQRの代わり</h2>
    <div class="demo-grid two">
      <section class="panel">
        <h2>${esc(conv.name)}（Bluetooth人数推定）</h2>
        <p class="note">周りで見つかったBluetooth機器の台数を変えると、推定人数と混雑が変わります。Pythonの sensor/ble_counter.py を動かしているときは、そちらの値で上書きされます。</p>
        <div class="range-row">
          <input type="range" id="ble" min="0" max="40" step="1" aria-label="Bluetoothの検出台数">
          <span class="range-value" id="ble-value"></span><span>台</span>
        </div>
        <p id="ble-preview" style="margin-top:6px"></p>
        <p class="note" id="ble-source" style="margin-top:4px"></p>
      </section>
      <section class="panel">
        <h2>学食の席（QRチェックイン）</h2>
        <p class="note">本当はテーブルのQRコードをスマホで読みます。ここではまとめて席の状態を変えられます。</p>
        ${seatPanels}
        <p style="margin-top:12px"><a href="qr.html">席のQRコードを表示・印刷する</a></p>
      </section>
    </div>

    <div class="demo-grid two" style="margin-top:12px">
      <section class="panel">
        <h2>利用者の投稿の位置確認</h2>
        <p class="note">本番では、お店から${CONFIG.reportRadiusMeters}m以内にいる人だけが「空いてた／混んでた」を投稿できます。教室で発表するときは確認を省略してください（このブラウザだけの設定です）。</p>
        <label class="check"><input type="checkbox" id="geo-skip"> 位置の確認を省略する（デモ用）</label>
      </section>
      <section class="panel">
        <h2>発表用の画面</h2>
        <p class="note">スマホの画面とお店のタブレットの画面を、1つの画面に並べて表示します。プロジェクターに映すときに使います。</p>
        <a class="btn" href="presenter.html" style="margin-top:10px">発表用の画面を開く</a>
      </section>
    </div>

    <h2 class="sec-title" id="pins">お店のPIN（デモ用）</h2>
    <div class="panel">
      <table class="table">
        <thead><tr><th>お店</th><th>PIN</th><th></th></tr></thead>
        <tbody>${pinRows}</tbody>
      </table>
    </div>

    <h2 class="sec-title">デモの台本（約3分）</h2>
    <div class="panel">
      <ol class="script">
        <li>発表用の画面を開き、スマホ側で「いま入れるお店」と一覧を見せる。色・待ち時間・最終更新・「3限に間に合う」を説明する。</li>
        <li>タブレット側で らーめん 運河屋（PIN 1002）を開き「空き」を押す。数秒でスマホ側の色が変わり、順位が上がる。</li>
        <li>学食 カナルのページで席を押してチェックイン（またはスマホで机のQRコードを読む）。空き席の数が減る。</li>
        <li>このページで学内コンビニのBluetooth台数を増やす（実機では sensor/ble_counter.py が自動で送る）。混雑とレジ待ち時間が変わる。</li>
        <li>更新が止まっている 珈琲 ふたば のページで、利用者の投稿で補っている様子を見せる。</li>
        <li>場面から「部活後の夜ご飯」を選び人数を12人にする。メニューランキングで「さっと食べたい」を見せる。</li>
      </ol>
    </div>
  `;

  els = {
    mode: main.querySelector("#mode"),
    urls: main.querySelector("#urls"),
    ble: main.querySelector("#ble"),
    bleValue: main.querySelector("#ble-value"),
    blePreview: main.querySelector("#ble-preview"),
    bleSource: main.querySelector("#ble-source"),
    geo: main.querySelector("#geo-skip"),
    clockForm: main.querySelector("#clock-form"),
  };

  els.clockForm.elements.clock.value = getDemoClock() || "12:10";
  els.geo.checked = getGeoSkip();

  main.addEventListener("click", onClick);
  els.clockForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setDemoClock(els.clockForm.elements.clock.value);
    notifySettingsChanged();
    toast(`デモ時刻を ${els.clockForm.elements.clock.value} にしました`);
  });
  els.geo.addEventListener("change", () => {
    setGeoSkip(els.geo.checked);
    toast(els.geo.checked ? "位置の確認を省略します" : "位置の確認をします");
  });
  // スライダーを動かしている間は見た目だけ変え、離したときに保存する
  els.ble.addEventListener("input", () => previewBle(Number(els.ble.value)));
  els.ble.addEventListener("change", async () => {
    await setBleCount("conv", Number(els.ble.value), "demo");
    toast(`Bluetoothの台数を ${els.ble.value}台 にしました`);
  });

  getServerInfo().then((info) => {
    lanUrl = info && info.lanUrl ? info.lanUrl : null;
    renderUrls();
  });
}

function renderUrls() {
  const base = lanUrl || location.origin;
  const isLocalhost = /localhost|127\.0\.0\.1/.test(base);
  els.urls.innerHTML = `
    <p class="url">${esc(base)}/</p>
    <dl class="kv">
      <dt>お客さんの画面</dt><dd>${esc(base)}/index.html</dd>
      <dt>お店の入力画面</dt><dd>${esc(base)}/store.html</dd>
    </dl>
    <p class="note" style="margin-top:8px">${isLocalhost
      ? "このPCの外からは開けないURLです。serve.py で起動すると、同じWi-Fiのスマホから開けるURLが表示されます。"
      : "PCと同じWi-Fiにつないだスマホ・タブレットで開きます。開けないときは、Windowsのファイアウォールで Python の通信を許可してください。"}
    ${getMode() === "local" ? "<br>ローカルモードでは、スマホとPCのデータは別々です（共有するにはFirebaseモードにします）。" : ""}</p>`;
}

function previewBle(count) {
  els.bleValue.textContent = count;
  const fake = { status: { conv: { bleCount: count, updatedAt: Date.now() } } };
  const v = shopView(conv, fake, Date.now());
  els.blePreview.innerHTML = `≒ ${v.people}人　${levelPill(v)}　レジ待ち 約${v.waitMin}分`;
}

function render() {
  const now = Date.now();
  const state = getState();
  const mode = getMode();
  els.mode.innerHTML = mode === "firebase"
    ? `<p><b>Firebaseモード</b></p><p class="note">Firestoreにデータを保存しています。スマホ・タブレット・PCのどれで操作しても、全員の画面がリアルタイムで変わります。</p>`
    : `<p><b>ローカルモード</b></p><p class="note">このPCのブラウザの中にデータを保存しています。同じPCで開いたタブや発表用の画面どうしはすぐに揃います。スマホとつなぐ方法は README.md の「スマホとつなぐ（Firebaseモード）」を見てください。</p>`;

  const st = (state.status || {}).conv || {};
  if (document.activeElement !== els.ble) {
    els.ble.value = st.bleCount ?? 0;
    previewBle(Number(els.ble.value));
  }
  els.bleSource.textContent = `最終更新 ${agoText(st.updatedAt, now)}（${st.bleBy === "sensor" ? "Pythonのセンサーから" : "デモ操作から"}）`;

  for (const panel of document.querySelectorAll(".seat-sim")) {
    const v = shopView(shopById(panel.dataset.shop), state, now);
    panel.querySelector("[data-seat-state]").innerHTML = `空き ${v.freeSeats}/${v.totalSeats}席 ${levelPill(v)}`;
  }
}

async function onClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.act === "reset") {
    btn.disabled = true;
    await resetDemo();
    btn.disabled = false;
    toast("デモデータを初期状態に戻しました");
  } else if (btn.dataset.act === "clock-clear") {
    setDemoClock(null);
    notifySettingsChanged();
    toast("いまの時刻で計算します");
  } else if (btn.dataset.seat) {
    await changeSeats(btn.closest(".seat-sim").dataset.shop, btn.dataset.seat);
  }
}

async function changeSeats(shopId, how) {
  const shop = shopById(shopId);
  const v = shopView(shop, getState(), Date.now());
  const free = v.seats.filter((s) => !s.occupied).map((s) => s.id);
  const used = v.seats.filter((s) => s.occupied).map((s) => s.id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let list = [];
  if (how === "in" && free.length) list = [{ seatId: pick(free), shopId, occupied: true }];
  if (how === "out" && used.length) list = [{ seatId: pick(used), shopId, occupied: false }];
  if (how === "full" || how === "empty") {
    const ids = seatIdsOf(shop);
    const target = Math.round(ids.length * (how === "full" ? 0.9 : 0.15));
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    list = shuffled.map((id, i) => ({ seatId: id, shopId, occupied: i < target }));
  }
  if (!list.length) { toast("変えられる席がありません"); return; }
  await setSeats(list);
  const after = shopView(shop, getState(), Date.now());
  toast(`${shop.name}：空き ${after.freeSeats}/${after.totalSeats}席（${LEVELS[after.level].label}）`);
}

startPage("demo", { init, render });
