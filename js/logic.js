// =====================================================================
//  計算ロジック
//  混雑レベル・待ち時間・おすすめ点数・「次の授業に間に合うか」をここで計算します。
//  （Firebaseの無料プランではサーバー側の処理が使えないため、計算はすべてブラウザで行います）
// =====================================================================
import { CONFIG } from "./config.js";
import { SHOPS, seatIdsOf, priceRange } from "./data.js";

export const MIN = 60 * 1000;

export function agoText(ts, now) {
  if (!ts) return "更新なし";
  const m = Math.floor((now - ts) / MIN);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

function levelFromRatio(ratio) {
  const t = CONFIG.seatRatioLevels;
  return ratio < t[0] ? 0 : ratio < t[1] ? 1 : ratio < t[2] ? 2 : 3;
}

function levelFromPeople(people, th) {
  return people < th[0] ? 0 : people < th[1] ? 1 : people < th[2] ? 2 : 3;
}

/** 席の状態（退席の押し忘れは一定時間で自動的に空席に戻す） */
export function seatState(seat, now) {
  if (!seat) return { occupied: false, since: null, changedAt: null };
  const limit = CONFIG.seatAutoReleaseMinutes * MIN;
  if (seat.occupied && seat.since && now - seat.since >= limit) {
    return { occupied: false, since: null, changedAt: seat.since + limit, autoReleased: true };
  }
  return { occupied: !!seat.occupied, since: seat.since || null, changedAt: seat.changedAt || null };
}

/** 位置情報で確認できた、有効期間内の最新の利用者投稿 */
export function latestReport(shopId, state, now, withinMin = CONFIG.reportValidMinutes) {
  const list = (state.reports || []).filter(
    (r) => r.shopId === shopId && r.verified && now - r.at <= withinMin * MIN
  );
  list.sort((a, b) => b.at - a.at);
  return list[0] || null;
}

/**
 * 1店舗の「いまの状態」をまとめて計算する
 * 戻り値: level(0〜3), waitMin(分 / 不明なら null), updatedAt, stale(情報が古いか), detail(計算の説明) など
 */
export function shopView(shop, state, now) {
  const st = (state.status || {})[shop.id] || {};
  const v = {
    shop, source: shop.source, rawLevel: 3, level: 3, waitMin: null, waitKind: "待ち",
    updatedAt: null, detail: "", stale: false, reference: null,
  };

  if (shop.source === "qr") {
    // 学食：席のQRチェックイン
    const ids = seatIdsOf(shop);
    let occupied = 0;
    let last = 0;
    v.seats = ids.map((id) => {
      const s = seatState((state.seats || {})[id], now);
      if (s.occupied) occupied++;
      const t = s.occupied ? s.since : s.changedAt;
      if (t && t > last) last = t;
      return { id, label: id.split("-")[1], ...s };
    });
    const ratio = ids.length ? occupied / ids.length : 1;
    v.totalSeats = ids.length;
    v.freeSeats = ids.length - occupied;
    v.rawLevel = levelFromRatio(ratio);
    v.waitMin = v.rawLevel === 3 ? 5 : 0;
    v.waitKind = "席待ち";
    v.updatedAt = last || null;
    v.detail = `使用中 ${occupied}席 / 全${ids.length}席（使用率 ${Math.round(ratio * 100)}%）`;
  } else if (shop.source === "ble") {
    // コンビニ：Bluetoothの検出台数から人数を推定
    const b = shop.ble;
    const count = st.bleCount ?? 0;
    const people = Math.round(count * b.coef);
    v.bleCount = count;
    v.bleBy = st.bleBy || "demo";
    v.people = people;
    v.rawLevel = levelFromPeople(people, b.levels);
    v.waitMin = Math.ceil((people * b.secPerPerson) / 60);
    v.waitKind = "レジ待ち";
    v.updatedAt = st.updatedAt || null;
    v.detail = `Bluetooth ${count}台 × 係数${b.coef} ≒ ${people}人 → ${people}人 × ${b.secPerPerson}秒 ≒ 約${v.waitMin}分`;
  } else {
    // 飲食店：お店のボタン入力
    const groups = st.waitGroups ?? 0;
    const per = st.minPerGroup ?? shop.minPerGroup;
    v.rawLevel = st.level ?? 3;
    v.waitGroups = groups;
    v.minPerGroup = per;
    v.waitMin = groups * per;
    v.updatedAt = st.updatedAt || null;
    v.updateCount = st.updateCount || 0;
    v.updateDay = st.updateDay || null;
    v.detail = groups > 0 ? `待ち ${groups}組 × ${per}分 ≒ 約${v.waitMin}分` : "待っているお客さんはいません";
  }

  v.ageMin = v.updatedAt ? (now - v.updatedAt) / MIN : Infinity;
  v.stale = v.ageMin > CONFIG.staleMinutes;
  v.level = v.rawLevel;

  if (v.stale) {
    // 情報が古い → 利用者の投稿があれば参考値、なければ満席扱い
    const r = latestReport(shop.id, state, now);
    v.waitMin = null;
    if (r) {
      v.reference = r;
      v.level = r.kind === "empty" ? 0 : 2;
    } else {
      v.level = 3;
    }
  }
  return v;
}

export function allViews(state, now) {
  return SHOPS.map((shop) => shopView(shop, state, now));
}

// ---------------------------------------------------------------------
//  おすすめ点数（鮮度点 + 空き点 + 条件点）
// ---------------------------------------------------------------------
export function freshPoints(ageMin) {
  for (const f of CONFIG.score.fresh) if (ageMin <= f.within) return f.points;
  return 0;
}

/** 次に鮮度点が下がるまでの分数（お店の画面で使う） */
export function minutesUntilFreshDrop(ageMin) {
  for (const f of CONFIG.score.fresh) if (ageMin <= f.within) return Math.max(0, Math.ceil(f.within - ageMin));
  return null;
}

export function scoreOf(v, filters = {}, clock = null) {
  const parts = [];
  const sc = CONFIG.score;
  if (!v.stale) {
    parts.push({ label: "鮮度", points: freshPoints(v.ageMin) });
    parts.push({ label: "空き", points: sc.vacancy[v.level] });
  } else if (v.reference) {
    parts.push({ label: "利用者の投稿", points: sc.reference });
    parts.push({ label: "空き", points: sc.vacancy[v.level] });
  } else {
    parts.push({ label: "情報が古い", points: 0 });
  }
  if (filters.budget && priceRange(v.shop).min <= filters.budget) parts.push({ label: "予算", points: sc.condition });
  if (filters.people && v.shop.maxGroupSize >= filters.people) parts.push({ label: "人数", points: sc.condition });
  if (filters.scene === "lunch" && clock) {
    const fit = classFit(v, clock);
    if (fit && fit.ok) parts.push({ label: "授業に間に合う", points: sc.condition * 2 });
  }
  if (filters.scene === "night" && v.shop.reservable) parts.push({ label: "予約できる", points: sc.condition });
  const total = parts.reduce((a, p) => a + p.points, 0);
  return { total, parts };
}

// ---------------------------------------------------------------------
//  次の授業に間に合うか
// ---------------------------------------------------------------------
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function nextClass(clock) {
  const nowMin = clock.getHours() * 60 + clock.getMinutes();
  for (const c of CONFIG.classStarts) {
    const t = toMinutes(c.start);
    if (t > nowMin) return { ...c, inMin: t - nowMin };
  }
  return null;
}

/**
 * 往復の徒歩 + 待ち時間 + 一番早いメニューの提供時間 + 食べる時間 で判定
 * 待ち時間が分からない店（情報が古い）は 15分 と仮定
 */
export function classFit(v, clock) {
  const nc = nextClass(clock);
  if (!nc || nc.inMin > CONFIG.classLookaheadMinutes) return null;
  if (!v.shop.lunch) return null; // 昼の営業がない店（居酒屋など）は判定しない
  const serve = Math.min(...v.shop.menus.map((m) => m.serveMin));
  const wait = v.waitMin ?? 15;
  const need = v.shop.walkMin * 2 + wait + serve + CONFIG.eatMinutes;
  const spare = nc.inMin - need;
  return {
    className: nc.name, start: nc.start, inMin: nc.inMin, need, spare, ok: spare >= 0,
    assumedWait: v.waitMin == null, walk: v.shop.walkMin, wait, serve, eat: CONFIG.eatMinutes,
  };
}

// ---------------------------------------------------------------------
//  目的別メニューランキング
// ---------------------------------------------------------------------
export function menuRanking(mode, state, now, budget) {
  const rows = [];
  for (const v of allViews(state, now)) {
    for (const m of v.shop.menus) {
      rows.push({ v, m, total: v.waitMin == null ? null : v.waitMin + m.serveMin });
    }
  }
  const byRecommend = (a, b) =>
    (b.m.recommended ? 1 : 0) - (a.m.recommended ? 1 : 0) || b.m.popularity - a.m.popularity;

  if (mode === "budget") {
    return rows.filter((r) => !budget || r.m.price <= budget).sort((a, b) => byRecommend(a, b) || a.m.price - b.m.price);
  }
  if (mode === "quick") {
    return rows.sort((a, b) => {
      if (a.total == null && b.total == null) return a.m.serveMin - b.m.serveMin;
      if (a.total == null) return 1;
      if (b.total == null) return -1;
      return a.total - b.total || a.m.serveMin - b.m.serveMin;
    });
  }
  return rows.sort(byRecommend);
}

// ---------------------------------------------------------------------
//  2点間の距離（m）… 利用者投稿の位置確認に使う
// ---------------------------------------------------------------------
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
