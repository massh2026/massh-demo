// =====================================================================
//  架空の店舗・メニューデータ
//  学食とコンビニ以外の店名・メニュー・価格・位置はすべて架空です。
//
//  source（混雑の測り方）
//    "qr"    … 席のQRコードでチェックイン（学食）
//    "ble"   … Bluetoothの電波の数から人数を推定（コンビニ）
//    "store" … お店の人がボタンで入力（周辺の飲食店・カフェ）
// =====================================================================

export const SHOPS = [
  // ---------- 学内 ----------
  {
    id: "canal", name: "学食 カナル", genre: "学食", area: "学内", walkMin: 2,
    lat: 35.9179, lng: 139.9086, source: "qr",
    seats: { rows: ["A", "B", "C", "D"], cols: 4 },
    maxGroupSize: 12, reservable: false, lunch: true, night: false, cafe: false,
    coupon: "テスト期間中はご飯の大盛りが無料",
    menus: [
      { name: "日替わり定食", price: 480, serveMin: 3, tags: ["定食"], recommended: true, popularity: 92 },
      { name: "カレーライス", price: 380, serveMin: 2, tags: ["早い"], popularity: 88 },
      { name: "唐揚げ丼", price: 460, serveMin: 3, tags: ["ガッツリ"], popularity: 81 },
      { name: "醤油ラーメン", price: 420, serveMin: 4, tags: ["麺"], popularity: 70 },
      { name: "サラダボウル", price: 350, serveMin: 2, tags: ["ヘルシー"], popularity: 52 },
    ],
  },
  {
    id: "akarenga", name: "学食 赤レンガ", genre: "学食", area: "学内", walkMin: 4,
    lat: 35.9190, lng: 139.9069, source: "qr",
    seats: { rows: ["A", "B", "C"], cols: 4 },
    maxGroupSize: 8, reservable: false, lunch: true, night: false, cafe: true,
    coupon: "",
    menus: [
      { name: "日替わりプレート", price: 600, serveMin: 4, tags: ["定食"], recommended: true, popularity: 84 },
      { name: "オムライス", price: 520, serveMin: 6, tags: ["人気"], popularity: 90 },
      { name: "きのこの和風パスタ", price: 550, serveMin: 6, tags: ["麺"], popularity: 66 },
      { name: "カフェラテとワッフル", price: 380, serveMin: 3, tags: ["甘いもの"], popularity: 61 },
    ],
  },
  {
    id: "conv", name: "学内コンビニ", genre: "コンビニ", area: "学内", walkMin: 3,
    lat: 35.9176, lng: 139.9071, source: "ble",
    note: "セブン-イレブンを想定した架空のデータです。",
    // 人数 = Bluetoothの検出台数 × coef。levels は「空き/やや混み/混雑」の上限人数
    ble: { coef: 0.6, levels: [4, 8, 12], secPerPerson: 30 },
    maxGroupSize: 0, reservable: false, lunch: true, night: true, cafe: false,
    coupon: "",
    menus: [
      { name: "おにぎり2個", price: 300, serveMin: 0, tags: ["早い"], popularity: 86 },
      { name: "サンドイッチ", price: 330, serveMin: 0, tags: ["早い"], popularity: 72 },
      { name: "チキン南蛮弁当", price: 560, serveMin: 2, tags: ["温め"], recommended: true, popularity: 78 },
      { name: "カップ麺", price: 240, serveMin: 4, tags: ["麺"], popularity: 58 },
    ],
  },

  // ---------- 学外（周辺の飲食店・カフェ） ----------
  {
    id: "iroha", name: "いろは食堂", genre: "定食", area: "学外", walkMin: 6,
    lat: 35.9150, lng: 139.9060, source: "store", pin: "1001", minPerGroup: 5,
    maxGroupSize: 10, reservable: true, lunch: true, night: true, cafe: false,
    coupon: "学生証の提示でご飯おかわり無料",
    menus: [
      { name: "生姜焼き定食", price: 750, serveMin: 5, tags: ["定食", "ガッツリ"], recommended: true, popularity: 90 },
      { name: "唐揚げ定食", price: 720, serveMin: 6, tags: ["定食", "ガッツリ"], popularity: 93 },
      { name: "サバ味噌定食", price: 780, serveMin: 4, tags: ["定食", "ヘルシー"], popularity: 68 },
      { name: "日替わり小鉢セット", price: 650, serveMin: 3, tags: ["早い"], popularity: 60 },
    ],
  },
  {
    id: "unga", name: "らーめん 運河屋", genre: "ラーメン", area: "学外", walkMin: 7,
    lat: 35.9143, lng: 139.9049, source: "store", pin: "1002", minPerGroup: 6,
    maxGroupSize: 6, reservable: false, lunch: true, night: true, cafe: false,
    coupon: "",
    menus: [
      { name: "醤油らーめん", price: 800, serveMin: 6, tags: ["麺"], recommended: true, popularity: 95 },
      { name: "つけ麺", price: 900, serveMin: 8, tags: ["麺", "ガッツリ"], popularity: 80 },
      { name: "半チャーハンセット", price: 1000, serveMin: 8, tags: ["ガッツリ"], popularity: 64 },
    ],
  },
  {
    id: "komorebi", name: "カフェ こもれび", genre: "カフェ", area: "学外", walkMin: 5,
    lat: 35.9162, lng: 139.9098, source: "store", pin: "1003", minPerGroup: 4,
    maxGroupSize: 8, reservable: false, lunch: true, night: false, cafe: true,
    coupon: "空きコマ割：14時〜16時はドリンク50円引き",
    menus: [
      { name: "季節のタルトセット", price: 750, serveMin: 3, tags: ["甘いもの"], recommended: true, popularity: 85 },
      { name: "ホットサンド", price: 650, serveMin: 8, tags: ["軽食"], popularity: 70 },
      { name: "ブレンドコーヒー", price: 420, serveMin: 3, tags: ["ドリンク"], popularity: 77 },
    ],
  },
  {
    id: "futaba", name: "珈琲 ふたば", genre: "カフェ", area: "学外", walkMin: 9,
    lat: 35.9131, lng: 139.9072, source: "store", pin: "1004", minPerGroup: 6,
    maxGroupSize: 4, reservable: false, lunch: true, night: false, cafe: true,
    coupon: "",
    menus: [
      { name: "自家焙煎コーヒー", price: 480, serveMin: 4, tags: ["ドリンク"], recommended: true, popularity: 82 },
      { name: "ナポリタン", price: 850, serveMin: 10, tags: ["麺"], popularity: 74 },
      { name: "固めのプリン", price: 380, serveMin: 2, tags: ["甘いもの"], popularity: 88 },
    ],
  },
  {
    id: "akashia", name: "カレー食堂 アカシア", genre: "カレー", area: "学外", walkMin: 8,
    lat: 35.9208, lng: 139.9031, source: "store", pin: "1005", minPerGroup: 4,
    maxGroupSize: 8, reservable: false, lunch: true, night: true, cafe: false,
    coupon: "",
    menus: [
      { name: "チキンカレー", price: 780, serveMin: 3, tags: ["早い"], recommended: true, popularity: 86 },
      { name: "カツカレー", price: 980, serveMin: 5, tags: ["ガッツリ"], popularity: 91 },
      { name: "野菜キーマカレー", price: 820, serveMin: 3, tags: ["ヘルシー"], popularity: 63 },
    ],
  },
  {
    id: "fukurai", name: "中華 福来", genre: "中華", area: "学外", walkMin: 10,
    lat: 35.9136, lng: 139.9031, source: "store", pin: "1006", minPerGroup: 5,
    maxGroupSize: 20, reservable: true, lunch: true, night: true, cafe: false,
    coupon: "10人以上の予約で餃子1皿サービス",
    menus: [
      { name: "麻婆豆腐定食", price: 850, serveMin: 6, tags: ["定食"], recommended: true, popularity: 84 },
      { name: "餃子定食", price: 750, serveMin: 7, tags: ["定食"], popularity: 80 },
      { name: "五目炒飯", price: 700, serveMin: 5, tags: ["早い"], popularity: 75 },
      { name: "大皿コース（1人分）", price: 2500, serveMin: 15, tags: ["大人数"], popularity: 66 },
    ],
  },
  {
    id: "porto", name: "イタリアン ポルト", genre: "イタリアン", area: "学外", walkMin: 12,
    lat: 35.9230, lng: 139.9112, source: "store", pin: "1007", minPerGroup: 8,
    maxGroupSize: 24, reservable: true, lunch: true, night: true, cafe: false,
    coupon: "",
    menus: [
      { name: "マルゲリータ", price: 1200, serveMin: 12, tags: ["大人数"], recommended: true, popularity: 88 },
      { name: "ランチパスタ", price: 1000, serveMin: 10, tags: ["麺"], popularity: 79 },
      { name: "学生パーティープラン", price: 2800, serveMin: 15, tags: ["大人数"], popularity: 70 },
    ],
  },
  {
    id: "engawa", name: "居酒屋 えんがわ", genre: "居酒屋", area: "学外", walkMin: 9,
    lat: 35.9124, lng: 139.9046, source: "store", pin: "1008", minPerGroup: 7,
    maxGroupSize: 30, reservable: true, lunch: false, night: true, cafe: false,
    coupon: "部活・サークルの打ち上げはソフトドリンク飲み放題付き",
    menus: [
      { name: "学生コース", price: 2500, serveMin: 10, tags: ["大人数"], recommended: true, popularity: 83 },
      { name: "唐揚げ盛り合わせ", price: 680, serveMin: 8, tags: ["ガッツリ"], popularity: 76 },
      { name: "焼きおにぎり", price: 380, serveMin: 6, tags: ["軽食"], popularity: 54 },
    ],
  },
  {
    id: "hayate", name: "丼ぶり はやて", genre: "丼", area: "学外", walkMin: 4,
    lat: 35.9168, lng: 139.9058, source: "store", pin: "1009", minPerGroup: 2,
    maxGroupSize: 4, reservable: false, lunch: true, night: true, cafe: false,
    coupon: "",
    menus: [
      { name: "牛丼", price: 450, serveMin: 1, tags: ["早い"], popularity: 90 },
      { name: "親子丼", price: 550, serveMin: 3, tags: ["早い"], recommended: true, popularity: 83 },
      { name: "海鮮丼", price: 900, serveMin: 4, tags: ["ガッツリ"], popularity: 71 },
    ],
  },
];

export const GENRES = [...new Set(SHOPS.map((s) => s.genre))];

export function shopById(id) {
  return SHOPS.find((s) => s.id === id) || null;
}

/** 学食の席ID一覧（例: canal-A1, canal-A2, ...） */
export function seatIdsOf(shop) {
  if (!shop || !shop.seats) return [];
  const ids = [];
  for (const row of shop.seats.rows) {
    for (let c = 1; c <= shop.seats.cols; c++) ids.push(`${shop.id}-${row}${c}`);
  }
  return ids;
}

/** 席ID → { shop, label } */
export function seatInfo(seatId) {
  const m = /^([a-z]+)-([A-Z]\d+)$/.exec(seatId || "");
  if (!m) return null;
  const shop = shopById(m[1]);
  if (!shop || !seatIdsOf(shop).includes(seatId)) return null;
  return { shop, label: m[2] };
}

export function priceRange(shop) {
  const prices = shop.menus.map((m) => m.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
