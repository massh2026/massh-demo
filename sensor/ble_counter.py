#!/usr/bin/env python3
"""
学内コンビニの混雑を、周りにある Bluetooth 機器の数から推定して送るプログラム

  ・機器の識別番号（アドレス）は保存も送信もしません。数えた「台数」だけを送ります。
  ・人数への換算（台数 × 係数）と混雑レベルの判定は、画面側（js/logic.js）で行います。

準備（はじめの1回だけ）:
    pip install bleak

使い方:
    python sensor/ble_counter.py              → 周りのBluetoothを数えて serve.py に送る（ローカルモード）
    python sensor/ble_counter.py --simulate   → Bluetoothを使わず、それらしい台数を作って送る（練習用）
    python sensor/ble_counter.py --firebase-project massh-demo-xxxxx
                                              → serve.py を使わず、Firestore に直接送る（Firebaseモード）

オプション:
    --interval 10     何秒ごとに送るか（初期値 10秒）
    --scan 5          1回に何秒間 Bluetooth を探すか（初期値 5秒）
    --rssi -80        これより電波が弱い（遠い）機器は数えない（初期値 -80 dBm）
    --shop conv       どのお店のデータとして送るか（初期値 conv = 学内コンビニ）
    --server URL      serve.py のアドレス（初期値 http://localhost:8000）
    --api-key KEY     Firebaseモードで使う apiKey（firebase-config.js と同じもの。なくても動きます）
"""
import argparse
import asyncio
import json
import random
import sys
import time
import urllib.error
import urllib.request


def parse_args():
    p = argparse.ArgumentParser(description="Bluetoothの台数から混雑を推定して送ります")
    p.add_argument("--interval", type=float, default=10)
    p.add_argument("--scan", type=float, default=5)
    p.add_argument("--rssi", type=int, default=-80)
    p.add_argument("--shop", default="conv")
    p.add_argument("--server", default="http://localhost:8000")
    p.add_argument("--simulate", action="store_true", help="Bluetoothを使わずに台数を作る")
    p.add_argument("--firebase-project", help="Firestore に直接送るときのプロジェクトID")
    p.add_argument("--api-key", default="", help="Firebase の apiKey（任意）")
    return p.parse_args()


# ---------------------------------------------------------------------
#  台数を数える
# ---------------------------------------------------------------------
async def count_devices(scan_seconds, rssi_min):
    """周りで電波を出している Bluetooth 機器を数える（アドレスは数えるためだけに使い、残さない）"""
    from bleak import BleakScanner  # pip install bleak

    found = await BleakScanner.discover(timeout=scan_seconds, return_adv=True)
    return sum(1 for _device, adv in found.values() if adv.rssi is not None and adv.rssi >= rssi_min)


def simulated_count(prev):
    """昼休みっぽく、ゆっくり増えたり減ったりする台数"""
    if prev is None:
        return random.randint(8, 16)
    return max(0, min(40, prev + random.choice([-3, -2, -1, 0, 1, 2, 3])))


# ---------------------------------------------------------------------
#  送る
# ---------------------------------------------------------------------
def send_to_server(server, shop, count):
    """serve.py に送る（画面がそれを受け取ってデータに反映する）"""
    data = json.dumps({"shopId": shop, "count": count}).encode("utf-8")
    req = urllib.request.Request(
        server.rstrip("/") + "/api/ble", data=data, method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=5) as res:
        res.read()


def send_to_firestore(project, api_key, shop, count):
    """Firestore の REST API で status/<shop> を更新する（ルールで書き込みを許可している場合）"""
    now_ms = int(time.time() * 1000)
    fields = ["bleCount", "bleBy", "updatedAt", "lastSource", "sensorAt"]
    query = "&".join(f"updateMask.fieldPaths={f}" for f in fields)
    if api_key:
        query += f"&key={api_key}"
    url = (f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)"
           f"/documents/status/{shop}?{query}")
    body = {
        "fields": {
            "bleCount": {"integerValue": str(count)},
            "bleBy": {"stringValue": "sensor"},
            "updatedAt": {"integerValue": str(now_ms)},
            "lastSource": {"stringValue": "ble"},
            "sensorAt": {"integerValue": str(now_ms)},
        }
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"), method="PATCH",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        res.read()


async def main():
    args = parse_args()
    if not args.simulate:
        try:
            import bleak  # noqa: F401
        except ImportError:
            print("bleak が入っていません。先に「pip install bleak」を実行してください。")
            print("Bluetoothなしで試すときは --simulate を付けて実行します。")
            sys.exit(1)

    target = f"Firestore（{args.firebase_project}）" if args.firebase_project else f"serve.py（{args.server}）"
    mode = "シミュレーション" if args.simulate else f"Bluetoothを{args.scan:g}秒ずつ探す（{args.rssi} dBm以上）"
    print(f"送り先: {target}\n方法  : {mode}\n間隔  : {args.interval:g}秒ごと\n止めるときは Ctrl + C\n")

    prev = None
    while True:
        started = time.time()
        try:
            count = simulated_count(prev) if args.simulate else await count_devices(args.scan, args.rssi)
            prev = count
            if args.firebase_project:
                send_to_firestore(args.firebase_project, args.api_key, args.shop, count)
            else:
                send_to_server(args.server, args.shop, count)
            print(f"{time.strftime('%H:%M:%S')}  検出 {count:2d}台 → 送信しました", flush=True)
        except urllib.error.HTTPError as e:
            print(f"{time.strftime('%H:%M:%S')}  送信できませんでした（HTTP {e.code}）。Firestore のルールやプロジェクトIDを確認してください。")
        except urllib.error.URLError as e:
            print(f"{time.strftime('%H:%M:%S')}  送信できませんでした（{e.reason}）。serve.py が起動しているか確認してください。")
        except Exception as e:  # Bluetoothがオフ・使えないなど
            print(f"{time.strftime('%H:%M:%S')}  エラー: {e}")
        await asyncio.sleep(max(0.5, args.interval - (time.time() - started)))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n終了しました")
