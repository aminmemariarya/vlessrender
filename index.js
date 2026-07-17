const { WebSocketServer } = require('ws');
const http = require('http');
const net = require('net');

const USER_ID = "1eb6f083-598d-462c-bd8d-1cbe80b551bc";
const cleanUUID = USER_ID.replace(/-/g, '');

const camouflageHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OK</title></head><body style="text-align:center;margin-top:100px;background:#111;color:#0f0;"><h1>✅ VLESS Render Node Active</h1></body></html>`;

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(camouflageHTML);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (data) => {
        try {
            const buffer = new Uint8Array(data);
            if (buffer.length < 18 || buffer[0] !== 0) {
                // console.log("Invalid header - ignoring");
                return;
            }

            const uuidHex = Array.from(buffer.slice(1, 17))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            if (uuidHex !== cleanUUID) {
                console.log("UUID mismatch");
                return;
            }

            console.log("✅ UUID OK");

            const optLen = buffer[17];
            const command = buffer[18 + optLen];
            const portIndex = 18 + optLen + 1;
            const port = (buffer[portIndex] << 8) | buffer[portIndex + 1];

            let idx = portIndex + 2;
            const addrType = buffer[idx++];
            let host = "";

            if (addrType === 1) {
                host = Array.from(buffer.slice(idx, idx+4)).join('.');
            } else if (addrType === 2) {
                const len = buffer[idx++];
                host = new TextDecoder().decode(buffer.slice(idx, idx + len));
            } else {
                return;
            }

            if (command !== 1) return;

            const target = net.connect(port, host, () => {
                ws.send(new Uint8Array([0, 0]));
                console.log(`Connected to ${host}:${port}`);
            });

            target.on('data', chunk => ws.send(chunk));
            ws.on('message', msg => target.write(msg));

            target.on('close', () => ws.close());
            ws.on('close', () => target.destroy());

        } catch (e) {
            // silent
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
