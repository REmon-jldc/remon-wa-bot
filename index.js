const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const axios = require('axios');
const pino = require('pino');

const app = express();
app.use(express.json());

const ATTENDANCE_GROUP = '120363312348014308@g.us';
const CLOUD_URL        = 'https://remon1810.pythonanywhere.com';

let status  = 'loading';  // loading | qr | authenticated | ready | disconnected
let currentQR = null;

async function connectToWhatsApp() {
    // Session data-வை சேமிக்க
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }) // தேவையற்ற லாக்ஸை மறைக்க
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            status = 'qr';
            currentQR = 'https://api.qrserver.com/v1/create-qr-code/?margin=20&size=400x400&data=' 
                        + encodeURIComponent(qr);
            console.log('🔗 QR Ready!');
        }

        if (connection === 'connecting') {
            status = 'authenticated';
            console.log('⏳ Connecting...');
        }

        if (connection === 'open') {
            status = 'ready';
            currentQR = null;
            console.log('✅ Bot Ready!');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Disconnected! Reconnecting:', shouldReconnect);
            status = 'disconnected';
            
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            } else {
                console.log('Logged out. Please delete auth_info_baileys folder and restart.');
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Message Handler
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        if (from !== ATTENDANCE_GROUP) return;

        const messageType = Object.keys(msg.message)[0];
        let text = '';
        let type = 'textMessage';

        // Message வகை சரிபார்ப்பு
        if (messageType === 'conversation') {
            text = msg.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            text = msg.message.extendedTextMessage.text;
        } else if (messageType === 'imageMessage') {
            text = msg.message.imageMessage.caption || '';
            type = 'imageMessage';
        } else {
            return; 
        }

        console.log('📩 Msg from:', msg.pushName, '|', text);

        const payload = {
            typeWebhook: 'incomingMessageReceived',
            senderData: {
                chatId:     from,
                sender:     msg.key.participant || from,
                senderName: msg.pushName || ''
            },
            messageData: {
                typeMessage: type,
                textMessageData: { textMessage: text },
                fileMessageData: { caption: text, downloadUrl: '' }
            },
            timestamp: msg.messageTimestamp,
            idMessage: msg.key.id
        };

        try {
            await axios.post(`${CLOUD_URL}/webhook/whatsapp`, payload);
            console.log('✅ Forwarded!');
        } catch(e) {
            console.error('❌ Error:', e.message);
        }
    });
}

connectToWhatsApp();

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
