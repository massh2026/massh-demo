#!/usr/bin/env python3
"""
学食の席ごとのQRコード画像を作るツール

ブラウザの「席のQRコード」画面（qr.html）でも同じものを表示・印刷できます。
画像ファイルとして欲しいとき（スライドに貼る、別のソフトで印刷するなど）に使います。

準備（はじめの1回だけ）:
    pip install "qrcode[pil]"

使い方:
    python tools/make_qr.py http://192.168.1.23:8000
        → qr_output/canal-A1.png … と、まとめて印刷できる qr_output/index.html を作ります
    （URLは serve.py の画面に出る「スマホ・タブレットで」のアドレス、または公開したURL）
"""
import html
import os
import sys

# js/data.js の学食の席と同じにしておく（席を増やしたらここも変える）
SEATS = {
    "canal": ("学食 カナル", ["A", "B", "C", "D"], 4),
    "akarenga": ("学食 赤レンガ", ["A", "B", "C"], 4),
}


def main():
    if len(sys.argv) < 2:
        print("使い方: python tools/make_qr.py http://PCのIPアドレス:8000")
        sys.exit(1)
    try:
        import qrcode
    except ImportError:
        print('qrcode が入っていません。先に pip install "qrcode[pil]" を実行してください。')
        sys.exit(1)

    base = sys.argv[1].rstrip("/")
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "qr_output")
    os.makedirs(out_dir, exist_ok=True)

    cards = []
    for shop_id, (name, rows, cols) in SEATS.items():
        for row in rows:
            for c in range(1, cols + 1):
                seat = f"{row}{c}"
                url = f"{base}/checkin.html?seat={shop_id}-{seat}"
                img = qrcode.make(url, box_size=10, border=2)
                filename = f"{shop_id}-{seat}.png"
                img.save(os.path.join(out_dir, filename))
                cards.append(
                    f'<div class="card"><p>{html.escape(name)}</p><b>{seat}</b>'
                    f'<img src="{filename}" alt="{html.escape(name)} {seat}"><small>{html.escape(url)}</small></div>'
                )

    page = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>席のQRコード</title>
<style>
body {{ font-family: sans-serif; margin: 16px; }}
.grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }}
.card {{ border: 1px dashed #999; padding: 8px; text-align: center; break-inside: avoid; }}
.card p {{ margin: 0; font-size: 12px; color: #555; }}
.card b {{ font-size: 26px; }}
.card img {{ width: 100%; }}
.card small {{ display: block; font-size: 9px; color: #777; word-break: break-all; }}
</style></head><body><div class="grid">{''.join(cards)}</div></body></html>"""
    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(page)
    print(f"{len(cards)}枚のQRコードを作りました → {os.path.normpath(out_dir)}")


if __name__ == "__main__":
    main()
