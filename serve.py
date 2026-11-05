#!/usr/bin/env python3
"""
MASSH デモ用のかんたんなWebサーバー（Pythonの標準機能だけで動きます。pip install は不要）

使い方:
    python serve.py          → http://localhost:8000 で起動して、ブラウザを開きます
    python serve.py 8080     → ポート番号を変えるとき

できること:
    1. このフォルダの画面（HTML/CSS/JavaScript）をブラウザに届ける
       同じWi-Fiのスマホ・タブレットからも「http://PCのIPアドレス:8000」で開けます
    2. sensor/ble_counter.py が送ってくるBluetoothの台数を受け取り、画面に渡す
"""
import http.server
import json
import os
import socket
import sys
import threading
import time
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
BLE = {}  # { "conv": {"count": 14, "at": 1700000000000} }
LOCK = threading.Lock()
LAN_URL = None


def lan_ip():
    """同じWi-Fiの機器から見たこのPCのIPアドレス（実際には通信しません）"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    # Windowsでは .js が text/plain と判定されて画面が動かないことがあるため、ここで決めておく
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".html": "text/html",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # ファイルを書き換えたらすぐ反映されるように
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/ping":
            return self._json({"ok": True, "server": "massh", "lanUrl": LAN_URL})
        if path == "/api/ble":
            with LOCK:
                return self._json(dict(BLE))
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path != "/api/ble":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            shop = str(body.get("shopId", "conv"))
            count = max(0, int(body.get("count", 0)))
        except (ValueError, json.JSONDecodeError):
            self.send_error(400, "JSON の形が正しくありません")
            return
        with LOCK:
            BLE[shop] = {"count": count, "at": int(time.time() * 1000)}
        print(f"  [センサー] {shop}: Bluetooth {count}台 を受け取りました")
        return self._json({"ok": True})

    def _json(self, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        pass  # アクセスのたびに表示すると見づらいので出さない


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = None
    for p in range(port, port + 10):  # 使用中なら次の番号を試す
        try:
            server = http.server.ThreadingHTTPServer(("0.0.0.0", p), Handler)
            port = p
            break
        except OSError:
            continue
    if server is None:
        print(f"ポート {port}〜{port + 9} がすべて使用中です。別の番号を指定してください（例: python serve.py 8100）")
        sys.exit(1)

    global LAN_URL
    ip = lan_ip()
    LAN_URL = f"http://{ip}:{port}" if ip else None
    local_url = f"http://localhost:{port}"

    print("=" * 60)
    print(" MASSH デモを起動しました")
    print(f"  このPCで開く        : {local_url}/")
    if LAN_URL:
        print(f"  スマホ・タブレットで : {LAN_URL}/  （同じWi-Fiにつなぐ）")
    print(f"  発表用の画面        : {local_url}/presenter.html")
    print("  止めるときは Ctrl + C を押してください")
    print("=" * 60)

    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(f"{local_url}/")).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n終了しました")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
