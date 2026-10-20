"""Optional local preview only; Python standard library, never deployed by Pages."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import fnmatch
import mimetypes
import argparse

ROOT = Path(__file__).resolve().parent / 'site'
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('application/manifest+json', '.webmanifest')

class Preview(SimpleHTTPRequestHandler):
    def do_GET(self):
        route = urlsplit(self.path).path
        for rule in (ROOT / '_redirects').read_text().splitlines():
            if not rule.strip() or rule.lstrip().startswith('#'):
                continue
            source, destination, status = rule.split()
            if route == source or ('*' in source and fnmatch.fnmatchcase(route, source)):
                self.send_response(int(status))
                self.send_header('Location', destination)
                self.end_headers()
                return
        return super().do_GET()

    def end_headers(self):
        pattern = ''
        headers = {}
        for line in (ROOT / '_headers').read_text().splitlines():
            if not line or line.lstrip().startswith('#'):
                continue
            if not line[0].isspace():
                pattern = line
            elif pattern.startswith('/') and fnmatch.fnmatch(urlsplit(self.path).path, pattern):
                key, value = line.strip().split(':', 1)
                headers[key] = value.strip()
        for key, value in headers.items():
            self.send_header(key, value)
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code != 404:
            return super().send_error(code, message, explain)
        data = (ROOT / '404.html').read_bytes()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    print(f'Fleet in Pieces preview: http://127.0.0.1:{args.port}/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), partial(Preview, directory=str(ROOT))).serve_forever()
