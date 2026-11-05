// =====================================================================
//  データの保存と共有
//
//  ・ローカルモード（firebase-config.js が null のとき）
//      このPCのブラウザ（localStorage）に保存します。同じPCで開いている
//      タブや発表用画面どうしは、すぐに同じ内容に揃います。
//  ・Firebaseモード（firebase-config.js に設定を貼ったとき）
//      Firestore に保存し、onSnapshot で全員の画面にリアルタイムで反映します。
//      スマホ・タブレット・PCのどれから更新しても全員の画面が変わります。
//
//  画面側は getState() でデータを読み、onChange() で変化を受け取り、
//  updateStoreStatus() などの関数で書き込みます（どちらのモードでも同じ使い方）。
// =====================================================================
import { firebaseConfig } from "./firebase-config.js";
import { buildSeed, dayKey } from "./seed.js";

const LS_KEY = "massh-demo-data-v1";
const FIREBASE_VERSION = "10.12.2";

let state = { status: {}, seats: {}, reports: [] };
let mode = "local";
let initError = null;
let fb = null;
let initPromise = null;
let serverInfoPromise = null;
const listeners = new Set();

export function getState() { return state; }
export function getMode() { return mode; }
export function getInitError() { return initError; }

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) {
    try { fn(state); } catch (e) { console.error(e); }
  }
}

export function initStore() {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit() {
  const forceLocal = new URLSearchParams(location.search).get("mode") === "local";
  if (firebaseConfig && !forceLocal) {
    try {
      await initFirebase();
      mode = "firebase";
      startSensorRelay();
      return mode;
    } catch (e) {
      console.error(e);
      initError = `Firebaseに接続できなかったため、ローカルモードで動いています（${e.code || e.message}）。firebase-config.js の設定と Firestore のルールを確認してください。`;
    }
  }
  initLocal();
  mode = "local";
  startSensorRelay();
  return mode;
}

// ---------------------------------------------------------------------
//  ローカルモード
// ---------------------------------------------------------------------
function normalize(s) {
  return {
    status: (s && s.status) || {},
    seats: (s && s.seats) || {},
    reports: Array.isArray(s && s.reports) ? s.reports : [],
  };
}
function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function writeLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* 保存できない環境ではメモリ上だけで動く */ }
}
function initLocal() {
  const saved = readLocal();
  if (saved) {
    state = saved;
  } else {
    state = buildSeed(Date.now());
    writeLocal();
  }
  // 別のタブ・発表用画面で書き換えられたら読み直す
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) {
      state = readLocal() || state;
      emit();
    }
  });
}
/** 最新の内容を読み直してから書き換える（複数のタブで同時に操作しても消えないように） */
function mutateLocal(fn) {
  const latest = readLocal();
  if (latest) state = latest;
  fn(state);
  writeLocal();
  emit();
}

// ---------------------------------------------------------------------
//  Firebaseモード
// ---------------------------------------------------------------------
async function initFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const appMod = await import(`${base}/firebase-app.js`);
  const fs = await import(`${base}/firebase-firestore.js`);
  const app = appMod.initializeApp(firebaseConfig);
  const db = fs.getFirestore(app);
  fb = { db, ...fs };

  // はじめて使うとき（データが空のとき）は初期データを入れる
  const first = await fs.getDocs(fs.collection(db, "status"));
  if (first.empty) await resetFirebase(buildSeed(Date.now()));

  // 3つのコレクションをリアルタイムで受け取る。最初の1回が届くまで待つ
  await new Promise((resolve, reject) => {
    let waiting = 3;
    const once = () => { let called = false; return () => { if (!called) { called = true; if (--waiting === 0) resolve(); } }; };
    const loaded = [once(), once(), once()];
    const onError = (err) => {
      console.error(err);
      initError = `Firebaseからの読み込みでエラーが起きました（${err.code || err.message}）。Firestore のルールを確認してください。`;
      emit();
      reject(err);
    };
    fs.onSnapshot(fs.collection(db, "status"), (qs) => {
      const o = {};
      qs.forEach((d) => { o[d.id] = d.data(); });
      state.status = o;
      emit();
      loaded[0]();
    }, onError);
    fs.onSnapshot(fs.collection(db, "seats"), (qs) => {
      const o = {};
      qs.forEach((d) => { o[d.id] = d.data(); });
      state.seats = o;
      emit();
      loaded[1]();
    }, onError);
    fs.onSnapshot(fs.query(fs.collection(db, "reports"), fs.orderBy("at", "desc"), fs.limit(100)), (qs) => {
      state.reports = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
      loaded[2]();
    }, onError);
  });
}

/** Firestore は undefined を保存できないので取り除く */
function clean(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) o[k] = v;
  return o;
}

async function resetFirebase(seed) {
  const { db, writeBatch, doc, collection, getDocs } = fb;
  const batch = writeBatch(db);
  for (const [id, v] of Object.entries(seed.status)) batch.set(doc(db, "status", id), clean(v));
  for (const [id, v] of Object.entries(seed.seats)) batch.set(doc(db, "seats", id), clean(v));
  const old = await getDocs(collection(db, "reports"));
  old.forEach((d) => batch.delete(d.ref));
  for (const r of seed.reports) {
    const { id, ...rest } = r;
    batch.set(doc(db, "reports", id), rest);
  }
  await batch.commit();
}

// ---------------------------------------------------------------------
//  書き込み（画面から呼ぶ関数）
// ---------------------------------------------------------------------
function nextStoreStatus(prev, patch, now) {
  const day = dayKey(now);
  const count = (prev.updateDay === day ? prev.updateCount || 0 : 0) + 1;
  return { ...prev, ...patch, updatedAt: now, lastSource: "store", updateDay: day, updateCount: count };
}

/** お店のボタン入力（level: 0〜3, waitGroups: 待ち組数, minPerGroup: 1組あたりの分数） */
export async function updateStoreStatus(shopId, patch) {
  const now = Date.now();
  if (mode === "firebase") {
    const next = nextStoreStatus(state.status[shopId] || {}, patch, now);
    await fb.setDoc(fb.doc(fb.db, "status", shopId), clean(next));
  } else {
    mutateLocal((s) => { s.status[shopId] = nextStoreStatus(s.status[shopId] || {}, patch, now); });
  }
}

/** 席のQRチェックイン / 退席 */
export async function setSeat(seatId, shopId, occupied) {
  const now = Date.now();
  const seat = { shopId, occupied: !!occupied, since: occupied ? now : null, changedAt: now };
  if (mode === "firebase") {
    await fb.setDoc(fb.doc(fb.db, "seats", seatId), seat);
  } else {
    mutateLocal((s) => { s.seats[seatId] = seat; });
  }
}

/** デモ用：複数の席をまとめて変える（list: [{ seatId, shopId, occupied }]） */
export async function setSeats(list) {
  const now = Date.now();
  const make = (x, i) => ({
    shopId: x.shopId, occupied: !!x.occupied,
    since: x.occupied ? now - i * 37 * 1000 : null, changedAt: now,
  });
  if (mode === "firebase") {
    const batch = fb.writeBatch(fb.db);
    list.forEach((x, i) => batch.set(fb.doc(fb.db, "seats", x.seatId), make(x, i)));
    await batch.commit();
  } else {
    mutateLocal((s) => { list.forEach((x, i) => { s.seats[x.seatId] = make(x, i); }); });
  }
}

/** Bluetoothの検出台数（by: "demo" = デモ操作の画面から / "sensor" = Pythonのセンサーから） */
export async function setBleCount(shopId, count, by = "demo", at = Date.now()) {
  const patch = { bleCount: Math.max(0, Math.round(count)), bleBy: by, updatedAt: at, lastSource: "ble" };
  if (by === "sensor") patch.sensorAt = at;
  if (mode === "firebase") {
    await fb.setDoc(fb.doc(fb.db, "status", shopId), patch, { merge: true });
  } else {
    mutateLocal((s) => { s.status[shopId] = { ...(s.status[shopId] || {}), ...patch }; });
  }
}

/** 利用者の「空いてた / 混んでた」投稿（kind: "empty" | "crowded"） */
export async function addReport(shopId, kind, verified) {
  const r = { shopId, kind, at: Date.now(), verified: !!verified };
  if (mode === "firebase") {
    await fb.addDoc(fb.collection(fb.db, "reports"), r);
  } else {
    mutateLocal((s) => {
      s.reports.unshift({ id: `r${r.at}${Math.random().toString(36).slice(2, 6)}`, ...r });
      s.reports = s.reports.slice(0, 100);
    });
  }
}

/** デモデータを初期状態に戻す（いまの時刻を基準に作り直す） */
export async function resetDemo() {
  const seed = buildSeed(Date.now());
  if (mode === "firebase") {
    await resetFirebase(seed);
  } else {
    mutateLocal((s) => { s.status = seed.status; s.seats = seed.seats; s.reports = seed.reports; });
  }
}

// ---------------------------------------------------------------------
//  serve.py との連携
//  serve.py で開いているときだけ、Pythonのセンサー（sensor/ble_counter.py）が
//  送ってきたBluetoothの台数を受け取り、データに反映します。
// ---------------------------------------------------------------------
export function getServerInfo() {
  if (!serverInfoPromise) {
    serverInfoPromise = fetch("api/ping", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.server === "massh" ? j : null))
      .catch(() => null);
  }
  return serverInfoPromise;
}

async function startSensorRelay() {
  const info = await getServerInfo();
  if (!info) return; // serve.py 以外（GitHub Pages など）で開いているときは何もしない
  const poll = async () => {
    try {
      const res = await fetch("api/ble", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      for (const [shopId, v] of Object.entries(data || {})) {
        const cur = (state.status || {})[shopId] || {};
        if (v && v.at && v.at > (cur.sensorAt || 0)) await setBleCount(shopId, v.count, "sensor", v.at);
      }
    } catch { /* 一時的な失敗は無視して次回また読む */ }
  };
  poll();
  setInterval(poll, 4000);
}
