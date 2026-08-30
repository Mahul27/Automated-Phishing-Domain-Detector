import socket

domain = "whitireiaweltec.ac.nz"

server = "whois.irs.net.nz"
port = 43

try:
    with socket.create_connection((server, port), timeout=15) as sock:

        sock.sendall((domain + "\r\n").encode("utf-8"))

        response = b""

        while True:
            data = sock.recv(4096)

            if not data:
                break

            response += data

    print(response.decode("utf-8", errors="replace"))

except Exception as error:
    print("WHOIS request failed:", error)