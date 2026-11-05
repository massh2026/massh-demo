// =====================================================================
//  このブラウザだけの設定（デモ時刻・位置確認の省略・自分の席・PIN入力済みの店）
//  ブラウザの保存領域が使えない場合（シークレットウィンドウなど）は保存せずに動きます。
// =====================================================================

const KEYS = {
  clock: "massh-demo-clock",
  geoSkip: "massh-geo-skip",
  mySeat: "massh-my-seat",
  unlocked: "massh-store-unlocked",
};

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* 保存できない環境では何もしない */ }
}

/** デモ時刻（"12:10" の形）。未設定なら null */
export function getDemoClock() {
  const v = read(KEYS.clock);
  return v && /^\d{1,2}:\d{2}$/.test(v) ? v : null;
}
export function setDemoClock(hhmm) { write(KEYS.clock, hhmm || null); }

/** 「次の授業に間に合うか」の計算に使う時刻（デモ時刻があればそれを使う） */
export function classClock() {
  const d = new Date();
  const v = getDemoClock();
  if (v) {
    const [h, m] = v.split(":").map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

export function getGeoSkip() { return read(KEYS.geoSkip) === "1"; }
export function setGeoSkip(on) { write(KEYS.geoSkip, on ? "1" : null); }

export function getMySeat() { return read(KEYS.mySeat); }
export function setMySeat(seatId) { write(KEYS.mySeat, seatId || null); }

export function isUnlocked(shopId) {
  try { return JSON.parse(read(KEYS.unlocked) || "[]").includes(shopId); } catch { return false; }
}
export function setUnlocked(shopId, on) {
  let list = [];
  try { list = JSON.parse(read(KEYS.unlocked) || "[]"); } catch { list = []; }
  list = list.filter((id) => id !== shopId);
  if (on) list.push(shopId);
  write(KEYS.unlocked, JSON.stringify(list));
}

/** 設定が変わったら（別のタブで変えた場合も）呼ばれる */
export function onSettingsChange(fn) {
  window.addEventListener("storage", (e) => {
    if (e.key && Object.values(KEYS).includes(e.key)) fn();
  });
  window.addEventListener("massh-settings", fn);
}
export function notifySettingsChanged() {
  window.dispatchEvent(new Event("massh-settings"));
}
