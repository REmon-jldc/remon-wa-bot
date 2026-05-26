const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const axios   = require('axios');

const app = express();
app.use(express.json());

const ATTENDANCE_GROUP = '120363312348014308@g.us';
const CLOUD_URL        = 'https://remon1810.pythonanywhere.com';

let status  = 'loading';  // loading | qr | authenticated | ready | disconnected
let currentQR = null;

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

client.on('qr', (qr) => {
    if (status === 'authenticated' || status === 'ready') return;
    status    = 'qr';
    currentQR = 'https://api.qrserver.com/v1/create-qr-code/?margin=20&size=400x400&data='
                + encodeURIComponent(qr);
    console.log('🔗 QR Ready!');
});

client.on('authenticated', () => {
    status    = 'authenticated';
    currentQR = null;
    console.log('✅ Authenticated!');
});

client.on('ready', () => {
    status    = 'ready';
    currentQR = null;
    console.log('✅ Bot Ready!');
});

client.on('disconnected', () => {
    status    = 'disconnected';
    currentQR = null;
    console.log('❌ Disconnected!');
});

// Status API
app.get('/status', (req, res) => {
    res.json({ status, qr: currentQR });
});

// Main Page — JS polling
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>REmon WhatsApp Bot</title>
    <style>
        body {
            background:#0a0f1e;
            color:white;
            font-family:Arial,sans-serif;
            text-align:center;
            padding:40px 20px;
        }
        h1 { color:#3b82f6; }
        h2 { color:#10b981; }
        #msg { color:#94a3b8; margin:10px 0; }
        img { border:4px solid #10b981;
              border-radius:12px;
              padding:10px; }
        .dot { 
            display:inline-block;
            width:12px; height:12px;
            border-radius:50%;
            margin-right:8px;
        }
        .green { background:#10b981; }
        .amber { background:#f59e0b; }
        .red   { background:#f43f5e; }
    </style>
</head>
<body>
    <h1>🏭 REmon Attendance Bot</h1>
    <div id="content">
        <p id="msg">⏳ Loading...</p>
    </div>

<script>
function poll() {
    fetch('/status')
    .then(r => r.json())
    .then(data => {
        const c = document.getElementById('content');
        const m = document.getElementById('msg');

        if (data.status === 'ready') {
            c.innerHTML = \`
            <h2><span class="dot green"></span>✅ Connected & Running!</h2>
            <p id="msg" style="color:#94a3b8">
                Attendance Group: Active<br>
                Messages processing automatically.
            </p>\`;
            // Stop polling when ready
            clearInterval(timer);

        } else if (data.status === 'authenticated') {
            c.innerHTML = \`
            <h2><span class="dot amber"></span>⏳ Connecting...</h2>
            <p id="msg" style="color:#94a3b8">
                Authenticated! Syncing WhatsApp data...<br>
                Please wait 30-60 seconds.
            </p>\`;

        } else if (data.status === 'qr' && data.qr) {
            c.innerHTML = \`
            <h2>📱 Scan QR Code</h2>
            <p id="msg" style="color:#94a3b8">
                WhatsApp → Linked Devices → Link a Device
            </p>
            <img src="\${data.qr}" width="280" /><br><br>
            <small style="color:#64748b">Auto-updates every 5 seconds</small>\`;

        } else if (data.status === 'disconnected') {
            c.innerHTML = \`
            <h2 style="color:#f43f5e">
                <span class="dot red"></span>❌ Disconnected
            </h2>
            <p id="msg" style="color:#94a3b8">Reconnecting...</p>\`;

        } else {
            m.textContent = '⏳ Starting server...';
        }
    })
    .catch(() => {
        document.getElementById('msg').textContent = '⏳ Connecting...';
    });
}

poll();
const timer = setInterval(poll, 5000);
</script>
</body>
</html>`);
});

// Message Handler
client.on('message', async msg => {
    if (msg.from !== ATTENDANCE_GROUP) return;
    if (!['image','chat'].includes(msg.type)) return;

    console.log('📩 Msg:', msg.author, '|', msg.body);

    const payload = {
        typeWebhook: 'incomingMessageReceived',
        senderData: {
            chatId:     msg.from,
            sender:     msg.author || msg.from,
            senderName: msg._data?.notifyName || ''
        },
        messageData: {
            typeMessage: msg.type === 'image'
                         ? 'imageMessage' : 'textMessage',
            textMessageData: { textMessage: msg.body },
            fileMessageData: { caption: msg.body, downloadUrl: '' }
        },
        timestamp: msg.timestamp,
        idMessage: msg.id.id
    };

    try {
        await axios.post(`${CLOUD_URL}/webhook/whatsapp`, payload);
        console.log('✅ Forwarded!');
    } catch(e) {
        console.error('❌ Error:', e.message);
    }
});

client.initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
