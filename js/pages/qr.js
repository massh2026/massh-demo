// 席のQRコード一覧（印刷して机に貼る）
import { SHOPS, seatIdsOf } from "../data.js";
import { getServerInfo } from "../store.js";
import { startPage, esc, toast } from "../ui.js";
import { qrSvg } from "../../vendor/qrcode/qrcode.js";

let els = {};

function defaultBase() {
  // いま開いているページと同じ場所（GitHub Pagesでもそのまま使える）
  return location.href.replace(/[^/]*([?#].*)?$/, "").replace(/\/$/, "");
}

function init(main) {
  main.innerHTML = `
    <div class="no-print">
      <h1 class="page-title">席のQRコード</h1>
      <p class="page-lead">印刷して机に貼ると、スマホで読み取ってチェックインできます。</p>
      <form class="panel" id="base-form">
        <label class="field">QRコードに入れるURLの始まり
          <input name="base" required autocomplete="off" spellcheck="false">
        </label>
        <p class="note" style="margin-top:6px" id="base-note"></p>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn">このURLで作り直す</button>
          <button type="button" class="btn btn-ghost" data-act="print">印刷する</button>
        </div>
      </form>
    </div>
    <div id="qr"></div>`;
  els = { form: main.querySelector("#base-form"), note: main.querySelector("#base-note"), qr: main.querySelector("#qr") };
  els.form.elements.base.value = defaultBase();
  els.form.addEventListener("submit", (e) => { e.preventDefault(); draw(); toast("QRコードを作り直しました"); });
  main.querySelector('[data-act="print"]').addEventListener("click", () => window.print());

  getServerInfo().then((info) => {
    const isLocal = /localhost|127\.0\.0\.1/.test(location.host);
    if (info && info.lanUrl && isLocal) {
      els.form.elements.base.value = info.lanUrl;
      els.note.textContent = "serve.py が見つけたこのPCのアドレスを入れています。スマホはPCと同じWi-Fiにつないでください。";
    } else if (isLocal) {
      els.note.textContent = "localhost のままだとスマホから開けません。PCのIPアドレス（serve.py の画面に表示）か、公開したURLに書き換えてください。";
    } else {
      els.note.textContent = "いま開いているURLを入れています。";
    }
    draw();
  });
}

function draw() {
  const base = els.form.elements.base.value.trim().replace(/\/$/, "");
  const cards = [];
  for (const shop of SHOPS.filter((s) => s.source === "qr")) {
    for (const id of seatIdsOf(shop)) {
      const url = `${base}/checkin.html?seat=${id}`;
      const label = id.split("-")[1];
      let svg;
      try { svg = qrSvg(url, { label: `${shop.name} ${label} のQRコード` }); }
      catch { svg = `<p class="note">URLが長すぎてQRコードにできません</p>`; }
      cards.push(`
        <div class="qr-card">
          <p class="qr-shop">${esc(shop.name)}</p>
          <p class="qr-seat">${esc(label)}</p>
          ${svg}
          <p class="qr-help">スマホのカメラで読むとチェックインできます</p>
          <p class="qr-url">${esc(url)}</p>
        </div>`);
    }
  }
  els.qr.innerHTML = `<div class="qr-grid">${cards.join("")}</div>`;
}

startPage("demo", { init, render: () => {} });
