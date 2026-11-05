// =====================================================================
//  設定ファイル
//  ここの数字を書き換えると、デモ全体の動き（判定のしきい値など）が変わります。
// =====================================================================

export const CONFIG = {
  // 地図の中心（東京理科大学 野田キャンパス）
  campus: { name: "東京理科大学 野田キャンパス", lat: 35.9183, lng: 139.9078 },

  // 授業の開始時刻（仮の値です。正しい時刻に書き換えてください）
  classStarts: [
    { name: "1限", start: "08:50" },
    { name: "2限", start: "10:30" },
    { name: "3限", start: "13:00" },
    { name: "4限", start: "14:40" },
    { name: "5限", start: "16:20" },
    { name: "6限", start: "18:00" },
  ],
  eatMinutes: 15,             // 食べ終わるまでの目安（分）
  classLookaheadMinutes: 120, // 次の授業まで何分以内なら「間に合うか」を表示するか

  staleMinutes: 60,           // 最終更新からこれ以上たった店は「情報が古い」として満席扱い
  reportValidMinutes: 30,     // 利用者の「今空いてた」投稿を参考値として使う時間（分）
  reportRadiusMeters: 100,    // 投稿できるのは、お店から何m以内にいる人か
  seatAutoReleaseMinutes: 40, // 退席を押し忘れたとき、何分で自動的に空席に戻すか

  // 席の使用率 → 混雑レベル（30%未満=空き / 60%未満=やや混み / 80%未満=混雑 / それ以上=満席）
  seatRatioLevels: [0.3, 0.6, 0.8],

  // 並び替えの点数（「おすすめ順」で使う）
  score: {
    fresh: [                  // 鮮度点：最終更新からの時間
      { within: 10, points: 50 },
      { within: 30, points: 30 },
      { within: 60, points: 10 },
    ],
    vacancy: [30, 15, 0, 0],  // 空き点：空き / やや混み / 混雑 / 満席
    reference: 10,            // お店の情報が古く、利用者の投稿だけがある場合
    condition: 10,            // 予算・人数の条件に合うごとに加点
  },
};

export const LEVELS = [
  { id: 0, label: "空き", cls: "lv0" },
  { id: 1, label: "やや混み", cls: "lv1" },
  { id: 2, label: "混雑", cls: "lv2" },
  { id: 3, label: "満席", cls: "lv3" },
];

export const SOURCE_LABELS = {
  qr: "席のQRチェックイン",
  ble: "Bluetooth人数推定",
  store: "お店の入力",
};
