from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 8000), SimpleHTTPRequestHandler)
    print("Serving OpenClaw replay showcase at http://127.0.0.1:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
