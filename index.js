const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 3000;

const USER_ID = "1eb6f083-598d-462c-bd8d-1cbe80b551bc";  // ← اینجا UUID جدیدت رو بذار

const camouflageHTML = `
<!DOCTYPE html>
<html lang="fa">
<head><meta charset="UTF-8"><title>Service Status</title></head>
<body style="font-family:Arial;text-align:center;margin-top:100px;background:#f0f0f0;">
    <h1>✅ سرویس فعال است</h1>
    <p>این نود به درستی کار می‌کند.</p>
</body>
</html>`;

// مهم: اول WebSocket رو هندل کنیم
const server = http.createServer((req, res) => {
    // همه درخواست‌های HTTP معمولی → صفحه伪装
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(camouflageHTML);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', async (data) => {
        try {
            const buffer = new Uint8Array(data);
            if (buffer[0] !== 0) return ws.close();

            // UUID Check
            const incoming = buffer.slice(1, 17);
            const expected = new Uint8Array(USER_ID.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)));
            if (incoming.some((b,i) => b !== expected[i])) return ws.close();

            // Parse target
            const optLen = buffer[17];
            const cmd = buffer[18 + optLen];
            const portIdx = 18 + optLen + 1;
            const port = (buffer[portIdx] << 8) | buffer[portIdx + 1];

            let idx = portIdx + 2;
            const type = buffer[idx++];
            let host = "";

            if (type === 1) host = Array.from(buffer.slice(idx, idx+4)).join('.');
            else if (type === 2) {
                const len = buffer[idx++];
                host = new TextDecoder().decode(buffer.slice(idx, idx+len));
            }

            if (cmd !== 1) return ws.close();

            const socket = net.connect(port, host, () => {
                ws.send(new Uint8Array([0, 0])); // VLESS OK
            });

            socket.on('data', chunk => ws.send(chunk));
            ws.on('message', msg => socket.write(msg));

            socket.on('close', () => ws.close());
            ws.on('close', () => socket.destroy());
        } catch (e) {
            ws.close();
        }
    });
});

server.listen(PORT, () => {
    console.log(`VLESS Server running on port ${PORT}`);
});
