

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

const USER_ID = "a67c0e13-611c-98f5-afd6-b1eb00000003";   // ← حتما تغییر بده

// صفحه偽装 برای درخواست‌های معمولی
const camouflageHTML = `
<!DOCTYPE html>
<html lang="fa">
<head><meta charset="UTF-8"><title>Service Status</title></head>
<body style="font-family:Arial;text-align:center;margin-top:100px;background:#f0f0f0;">
    <h1>✅ سرویس فعال است</h1>
    <p>این نود به درستی کار می‌کند.</p>
</body>
</html>`;

// WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    console.log('New VLESS connection');

    ws.on('message', async (data) => {
        try {
            const buffer = new Uint8Array(data);
            if (buffer[0] !== 0) {
                ws.close();
                return;
            }

            // UUID validation
            const incomingUUID = buffer.slice(1, 17);
            const expectedUUID = new Uint8Array(USER_ID.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)));
            
            if (incomingUUID.some((byte, i) => byte !== expectedUUID[i])) {
                ws.close();
                return;
            }

            // Parse target address and port (ساده‌سازی شده)
            const optLen = buffer[17];
            const command = buffer[18 + optLen];
            const portIndex = 18 + optLen + 1;
            const targetPort = (buffer[portIndex] << 8) | buffer[portIndex + 1];

            let idx = portIndex + 2;
            const addrType = buffer[idx++];
            let targetHost = "";

            if (addrType === 1) { // IPv4
                targetHost = Array.from(buffer.slice(idx, idx+4)).join('.');
            } else if (addrType === 2) { // Domain
                const len = buffer[idx++];
                targetHost = new TextDecoder().decode(buffer.slice(idx, idx + len));
            }

            if (command === 1) {
                const client = await new Promise((resolve) => {
                    const net = require('net');
                    const conn = net.connect(targetPort, targetHost, () => resolve(conn));
                });

                ws.send(new Uint8Array([0, 0])); // VLESS success

                // دوطرفه انتقال داده
                client.on('data', chunk => ws.send(chunk));
                ws.on('message', msg => client.write(msg));

                client.on('close', () => ws.close());
                ws.on('close', () => client.destroy());
            }
        } catch (e) {
            ws.close();
        }
    });
});

app.get('*', (req, res) => {
    res.send(camouflageHTML);
});

server.listen(PORT, () => {
    console.log(`VLESS WS Server running on port ${PORT}`);
});
