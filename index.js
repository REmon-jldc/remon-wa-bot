const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const ATTENDANCE_GROUP = '120363312348014308@g.us';
const CLOUD_URL = 'https://remon1810.pythonanywhere.com';

let isScanned = false;
let isReady   = false;
let qrCodeHtml = `
<html>
    <head><meta http-equiv="refresh" content="5"></head>
    <body style="text-align:center;margin-top:50px;font-family:sans-serif;background:#0a0f1e;color:white;">
        <h2>⏳ Server Starting... 🚀</h2>
        <p style="color:#64748b">QR Code சில நொடிகளில் வரும்</p>
    </body>
</html>`;

const client = new Client({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 60000,
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote'
        ]
    }
});

// QR Code
client.on('qr', (qr) => {
    if (isScanned) return;
    console.log('🔗 New QR Code Ready!');
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?margin=20&size=400x400&data='
                  + encodeURIComponent(qr);
    qrCodeHtml = `
    <html>
        <head><meta http-equiv="refresh" content="55"></head>
        <body style="text-align:center;margin-top:50px;font-family:sans-serif;background:#0a0f1e;color:white;">
            <h2>📱 WhatsApp QR Code</h2>
            <p style="color:#94a3b8">WhatsApp → Linked Devices → Scan</p>
            <img src="${qrUrl}" style="border:4px solid #10b981;padding:10px;border-radius:12px;width:300px;" />
            <p style="color:#64748b;font-size:12px">Auto refresh in 55 seconds</p>
        </body>
    </html>`;
});

// Authenticated
client.on('authenticated', () => {
    isScanned  = true;
    qrCodeHtml = `
    <html>
        <head><meta http-equiv="refresh" content="5"></head>
        <body style="text-align:center;margin-top:50px;font-family:sans-serif;background:#0a0f1e;color:white;">
            <h2>⏳ Connecting to WhatsApp...</h2>
            <p style="color:#64748b">Please wait... (auto refresh)</p>
        </body>
    </html>`;
    console.log('✅ Authenticated!');
});

// Ready
client.on('ready', () => {
    isReady    = true;
    isScanned  = true;
    qrCodeHtml = `
    <html>
        <body style="text-align:center;margin-top:50px;font-family:sans-serif;background:#0a0f1e;color:white;">
            <h1 style="color:#10b981">✅ REmon WhatsApp Bot</h1>
            <h2>Connected & Running!</h2>
            <p style="color:#94a3b8">Attendance Group: Active</p>
            <p style="color:#64748b">Messages are being processed automatically.</p>
        </body>
    </html>`;
    console.log('✅ WhatsApp Bot Ready!');
});

// Disconnected
client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
    isReady   = false;
    isScanned = false;
    qrCodeHtml = `
    <html>
        <head><meta http-equiv="refresh" content="10"></head>
        <body style="text-align:center;margin-top:50px;font-family:sans-serif;background:#0a0f1e;color:white;">
            <h2 style="color:#f43f5e">❌ Disconnected!</h2>
            <p style="color:#64748b">Reconnecting... (auto refresh)</p>
        </body>
    </html>`;
});

// Message Handler
client.on('message', async msg => {
    if (msg.from !== ATTENDANCE_GROUP) return;
    if (!['image', 'chat'].includes(msg.type)) return;

    console.log(`📩 Group msg from: ${msg.author || msg.from}`);
    console.log(`   Caption: ${msg.body}`);

    let mediaCaption = msg.body || '';
    let mediaUrl     = null;

    if (msg.type === 'image') {
        try {
            const media  = await msg.downloadMedia();
            mediaUrl     = `data:${media.mimetype};base64,${media.data.substring(0, 100)}`;
        } catch(e) {
            console.log('Media download skip:', e.message);
        }
    }

    const payload = {
        typeWebhook: 'incomingMessageReceived',
        senderData: {
            chatId:     msg.from,
            sender:     msg.author || msg.from,
            senderName: msg._data?.notifyName || ''
        },
        messageData: {
            typeMessage: msg.type === 'image' ? 'imageMessage' : 'textMessage',
            textMessageData: {
                textMessage: mediaCaption
            },
            fileMessageData: {
                caption:     mediaCaption,
                downloadUrl: mediaUrl || ''
            }
        },
        timestamp: msg.timestamp,
        idMessage: msg.id.id
    };

    try {
        await axios.post(`${CLOUD_URL}/webhook/whatsapp`, payload);
        console.log('✅ Forwarded to PythonAnywhere!');
    } catch(err) {
        console.error('❌ Forward error:', err.message);
    }
});

client.initialize();

app.get('/', (req, res) => {
    res.send(qrCodeHtml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    console.log(`Cloud URL: ${CLOUD_URL}`);
    console.log(`Group: ${ATTENDANCE_GROUP}`);
});
