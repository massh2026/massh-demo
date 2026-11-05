// =====================================================================
//  デモ用の初期データ
//  「デモデータを初期状態に戻す」を押すと、いまの時刻を基準にこの状態になります。
// =====================================================================
import { SHOPS, seatIdsOf } from "./data.js";

const MIN = 60 * 1000;

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 学食で「使用中」にしておく席と、何分前に座ったか
const OCCUPIED = {
  canal: { A1: 4, A2: 4, A4: 12, B1: 21, B3: 7, C2: 2, C3: 15, D1: 9, D4: 26 }, // 16席中9席 → やや混み
  akarenga: { A1: 3, A2: 3, A3: 18, A4: 6, B1: 11, B2: 11, B4: 24, C1: 8, C2: 5, C4: 14 }, // 12席中10席 → 満席
};

export function buildSeed(now = Date.now()) {
  const day = dayKey(now);
  const s = (level, waitGroups, minutesAgo, updateCount) => ({
    level, waitGroups, updatedAt: now - minutesAgo * MIN, updateDay: day, updateCount, lastSource: "store",
  });

  const status = {
    conv: { bleCount: 14, bleBy: "demo", updatedAt: now - 1 * MIN, lastSource: "ble" },
    iroha: s(2, 3, 4, 9),
    unga: s(3, 5, 2, 12),
    komorebi: s(0, 0, 7, 6),
    futaba: s(1, 0, 95, 2),   // 更新が止まっている → 利用者の投稿で補う例
    akashia: s(1, 1, 22, 5),
    fukurai: s(0, 0, 12, 4),
    porto: s(1, 2, 45, 3),
    engawa: s(0, 0, 150, 1),  // 更新が止まっていて投稿もない → 「情報が古い」の例
    hayate: s(1, 1, 3, 15),
  };

  const seats = {};
  for (const shop of SHOPS.filter((x) => x.source === "qr")) {
    for (const id of seatIdsOf(shop)) {
      const label = id.split("-")[1];
      const ago = OCCUPIED[shop.id]?.[label];
      seats[id] = ago != null
        ? { shopId: shop.id, occupied: true, since: now - ago * MIN, changedAt: now - ago * MIN }
        : { shopId: shop.id, occupied: false, since: null, changedAt: now - 30 * MIN };
    }
  }

  const reports = [
    { id: "seed-1", shopId: "futaba", kind: "empty", at: now - 6 * MIN, verified: true },
    { id: "seed-2", shopId: "unga", kind: "crowded", at: now - 9 * MIN, verified: true },
  ];

  return { status, seats, reports };
}
