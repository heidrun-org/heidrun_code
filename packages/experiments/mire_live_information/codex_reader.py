"""Read-only JSON requests over the real shared Codex server's local WebSocket."""

import base64
import hashlib
import json
import os
import socket
import struct


class CodexReader:
    """A bounded local transport; this client never starts or resumes a chat."""

    MAX_BYTES = 16 * 1024 * 1024

    def __init__(self, path):
        self.socket = socket.socket(socket.AF_UNIX)
        self.socket.settimeout(5)
        self.buffer = b""
        self.request_id = 0
        try:
            self.socket.connect(str(path))
            key = base64.b64encode(os.urandom(16)).decode()
            self.socket.sendall((
                "GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n"
                "Connection: Upgrade\r\nSec-WebSocket-Key: " + key +
                "\r\nSec-WebSocket-Version: 13\r\n\r\n"
            ).encode())
            while b"\r\n\r\n" not in self.buffer:
                self._receive_bytes()
                if len(self.buffer) > 65536:
                    raise ValueError("Oversized Codex handshake")
            header, self.buffer = self.buffer.split(b"\r\n\r\n", 1)
            expected = base64.b64encode(hashlib.sha1(
                (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()
            ).digest()).decode()
            lines = header.decode().split("\r\n")
            fields = {key.lower(): value.strip() for key, value in (
                line.split(":", 1) for line in lines[1:] if ":" in line
            )}
            if not lines[0].startswith("HTTP/1.1 101 ") or fields.get(
                "sec-websocket-accept", ""
            ) != expected:
                raise ValueError("Invalid Codex WebSocket handshake")
            self.request("initialize", {
                "clientInfo": {"name": "heidrun_mire_observer", "version": "0.1.0"},
                "capabilities": {"experimentalApi": True},
            })
            self._send({"method": "initialized"})
        except Exception:
            self.close()
            raise

    def close(self):
        self.socket.close()

    def request(self, method, params):
        if method not in {
            "initialize", "thread/read", "thread/list", "thread/items/list",
        }:
            raise ValueError("The Mire observer permits read-only methods only")
        self.request_id += 1
        self._send({"id": self.request_id, "method": method, "params": params})
        while True:
            response = self._receive_message()
            if response.get("id") == self.request_id and "method" not in response:
                if "error" in response:
                    raise RuntimeError(response["error"].get("message", "Codex request failed"))
                return response["result"]

    def _receive_bytes(self):
        data = self.socket.recv(65536)
        if not data:
            raise ConnectionError("Codex observation socket closed")
        self.buffer += data

    def _exact(self, count):
        while len(self.buffer) < count:
            self._receive_bytes()
        result, self.buffer = self.buffer[:count], self.buffer[count:]
        return result

    def _send(self, value, opcode=1):
        data = json.dumps(value).encode() if opcode == 1 else value
        length = len(data)
        mask = os.urandom(4)
        header = bytes([128 | opcode, 128 | (length if length < 126 else 126 if length < 65536 else 127)])
        if length >= 126:
            header += struct.pack("!H" if length < 65536 else "!Q", length)
        self.socket.sendall(header + mask + bytes(value ^ mask[index % 4] for index, value in enumerate(data)))

    def _receive_message(self):
        parts = bytearray()
        while True:
            first, second = self._exact(2)
            opcode = first & 15
            length = second & 127
            if length == 126:
                length = struct.unpack("!H", self._exact(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", self._exact(8))[0]
            if length + len(parts) > self.MAX_BYTES:
                raise ValueError("Oversized Codex observation message")
            mask = self._exact(4) if second & 128 else None
            data = self._exact(length)
            if mask is not None:
                data = bytes(value ^ mask[index % 4] for index, value in enumerate(data))
            if opcode == 8:
                raise ConnectionError("Codex observation socket closed")
            if opcode == 9:
                self._send(data, 10)
                continue
            if opcode in (0, 1):
                parts.extend(data)
                if first & 128:
                    return json.loads(parts)
