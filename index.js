const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 3000;

const USER_ID = "1eb6f083-598d-462c-bd8d-1cbe80b551bc";  // UUID خودت

const camouflageHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OK</title></head><body style="text-align:center;margin-top:100px;"><h1>✅ سرویس فعال است</h1></body></html>`;

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(camouflageHTML);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('New client connected');

    let targetSocket = null;

    ws.on('message', (data) => {
        try {
            const buffer = new Uint8Array(data);

            if (buffer[0] !== 0) return ws.close();

            // UUID validation
            const uuidBytes = buffer.slice(1, 17);
            const expected = new Uint8Array(USER_ID.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)));
            if (uuidBytes.some((b, i) => b !== expected[i])) {
                console.log("UUID mismatch");
                return ws.close();
            }

            // Parse command, port, address
            const optLen = buffer[17];
            const command = buffer[18 + optLen];
            const portIndex = 18 + optLen + 1;
            const port = (buffer[portIndex] << 8) | buffer[portIndex + 1];

            let idx = portIndex + 2;
            const addrType = buffer[idx++];
            let host = "";

            if (addrType === 1) { // IPv4
                host = Array.from(buffer.slice(idx, idx + 4)).join('.');
            } else if (addrType === 2) { // Domain
                const len = buffer[idx++];
                host = new TextDecoder().decode(buffer.slice(idx, idx + len));
            } else {
                return ws.close();
            }

            if (command !== 1) return ws.close();

            // Connect to target
            targetSocket = net.connect(port, host, () => {
                ws.send(new Uint8Array([0, 0])); // Success
                console.log(`Connected to ${host}:${port}`);
            });

            targetSocket.on('data', chunk => {
                if (ws.readyState === ws.OPEN) ws.send(chunk);
            });

            targetSocket.on('close', () => ws.close());
            ws.on('message', msg => targetSocket.write(msg));
            ws.on('close', () => targetSocket?.destroy());

        } catch (e) {
            console.error(e);
            ws.close();
        }
    });
});

server.listen(PORT, () => console.log(`Server running on ${PORT}`));
