"""
Desktop launcher for the Holtrop-Mennen simulator.

Serves the same page as the website from a local port, runs holtrop.py in this
native Python process (no internet needed), and shows the page in its own window.
PyInstaller turns this into a Windows .exe; see HoltropMennen.spec.

    python desktop_app.py            # open the app window
    python desktop_app.py --serve    # serve only; open the printed URL yourself
"""

import argparse
import json
import platform
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import runner

TITLE = "Holtrop-Mennen Resistance Simulator"
WEB_FILES = {"index.html", "app.js", "style.css", "runner.html", "holtrop.py", "runner.py"}


def resource_dir():
    """Folder holding the web files: the PyInstaller unpack dir, or next to this script."""
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


class Handler(SimpleHTTPRequestHandler):
    # Fixed types: Windows reads these from the registry, which can serve CSS as text/plain.
    extensions_map = {
        ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8", ".py": "text/plain; charset=utf-8",
        ".woff2": "font/woff2", "": "application/octet-stream",
    }

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/ping":
            return self.send_json({"version": runner.version(), "platform": platform.system()})
        if path == "/":
            self.path = path = "/index.html"
        name = path.lstrip("/")
        if name not in WEB_FILES and not (name.startswith("vendor/") and ".." not in name):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/run":
            return self.send_error(404)
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            data = runner.run(json.dumps(body["ship"]), float(body["knots"]),
                              float(body["vmin"]), float(body["vmax"]))
            payload = '{"ok": true, "data": ' + data + "}"
        except Exception as e:  # shown in the app's Python console, like a traceback's last line
            payload = json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"})
        self.send_text(payload, "application/json")

    def send_json(self, obj):
        self.send_text(json.dumps(obj), "application/json")

    def send_text(self, text, content_type):
        data = text.encode()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass  # a windowed .exe has no stderr to write to


def start_server(port=0):
    handler = partial(Handler, directory=str(resource_dir()))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/"


def open_window(url):
    """Native window through pywebview (Edge WebView2 on Windows). False if unavailable."""
    try:
        import webview
    except ImportError:
        return False
    try:
        webview.create_window(TITLE, url, width=1440, height=920, min_size=(900, 640))
        webview.start(gui="edgechromium" if sys.platform == "win32" else None)
        return True
    except Exception:
        return False


def browser_fallback(url):
    """Open the default browser and keep a small window that stops the app when closed."""
    webbrowser.open(url)
    try:
        import tkinter as tk
    except ImportError:
        print(f"{TITLE} is running at {url}. Press Ctrl+C to stop.")
        threading.Event().wait()
        return
    root = tk.Tk()
    root.title(TITLE)
    root.resizable(False, False)
    tk.Label(root, text=f"{TITLE}\nis running at {url}", padx=24, pady=16, justify="center").pack()
    tk.Button(root, text="Open in browser", command=lambda: webbrowser.open(url)).pack(pady=(0, 8))
    tk.Label(root, text="Close this window to stop the app.", fg="#555", pady=8).pack()
    root.mainloop()


def selftest(url):
    """Check the bundled files and the worked example through the local server (exit code 0 = pass)."""
    from urllib.request import Request, urlopen
    import holtrop

    for name in sorted(WEB_FILES) + ["vendor/chart.umd.min.js", "vendor/fonts.css"]:
        with urlopen(url + name) as r:
            assert r.status == 200 and r.read(), name
    body = json.dumps({"ship": holtrop.default_ship(), "knots": 25, "vmin": 15, "vmax": 29}).encode()
    with urlopen(Request(url + "api/run", body, {"Content-Type": "application/json"})) as r:
        out = json.load(r)
    rt = out["data"]["point"]["RT"] / 1000
    print(f"selftest: RT at 25 kn = {rt:.1f} kN (expected 1791.6)", flush=True)
    return abs(rt - 1791.6) < 0.1


def main():
    parser = argparse.ArgumentParser(description=TITLE)
    parser.add_argument("--serve", action="store_true", help="serve only and print the URL")
    parser.add_argument("--browser", action="store_true", help="use the default browser, not a window")
    parser.add_argument("--selftest", action="store_true", help="check the bundle and exit")
    parser.add_argument("--port", type=int, default=0, help="fixed port (default: any free port)")
    args = parser.parse_args()

    server, url = start_server(args.port)
    try:
        if args.selftest:
            ok = False
            try:
                ok = selftest(url)
            except Exception as e:
                print(f"selftest failed: {type(e).__name__}: {e}", flush=True)
            sys.exit(0 if ok else 1)
        if args.serve:
            print(f"Serving {resource_dir()} at {url}  (Ctrl+C to stop)", flush=True)
            threading.Event().wait()
        elif args.browser or not open_window(url):
            browser_fallback(url)
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
