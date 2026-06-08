const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json());

// --- Config ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ATTENDANCE_GROUP = process.env.ATTENDANCE_GROUP;
const CLOUD_URL = process.env.CLOUD_URL; 
const PORT = process.env.PORT || 3000;

// --- Health Page ---
app.get('/', (req, res) => {
    res.send(`
        <html>
        <body style="background:#0a0f1e;color:white;text-align:center;padding:50px;font-family:Arial;">
            <h1>O&M Telegram Bot 🤖</h1>
            <h2 style="color:#00ff00;">✅ System Running Perfectly!</h2>
        </body>
        </html>
    `);
});

// --- Telegram Webhook Receiver ---
app.post('/telegram', async (req, res) => {
    res.sendStatus(200); // Telegram-க்கு உடனே பதில் சொல்லிவிட வேண்டும்
    
    const update = req.body;

    try {
        const msg = update.message || update.channel_post;
        if (!msg) return;

        const chatId = String(msg.chat.id);
        const senderId = String(msg.from?.id || "");
        const senderName = msg.from?.first_name || "";
        const text = msg.text || msg.caption || "";
        const isPhoto = !!(msg.photo || msg.document);

        // Group filter - நமது குரூப் மெசேஜ் மட்டும் தான் உள்ளே வரும்
        if (chatId !== String(ATTENDANCE_GROUP)) {
            console.log(`SKIP: Other Group or DM - ${chatId}`);
            return;
        }

        console.log(`📩 New msg from: ${senderName} | Text: ${text}`);

        // Forward to PythonAnywhere (பழைய வாட்ஸ்அப் பார்மெட்டிலேயே அனுப்புகிறோம்)
        const payload = {
            typeWebhook: 'incomingMessageReceived',
            senderData: {
                chatId: chatId,
                sender: senderId,
                senderName: senderName
            },
            messageData: {
                typeMessage: isPhoto ? 'imageMessage' : 'textMessage',
                textMessageData: { textMessage: text },
                fileMessageData: { caption: text }
            },
            timestamp: msg.date,
            idMessage: String(msg.message_id)
        };

        // உங்களின் பழைய PythonAnywhere லிங்க்கே அப்படியே வேலை செய்யும்
        await axios.post(`${CLOUD_URL}/webhook/whatsapp`, payload);
        console.log('✅ Forwarded to PythonAnywhere!');

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
});

// --- Set Telegram Webhook ---
async function setWebhook() {
    // Render கொடுக்கும் URL-ஐத் தானாகவே எடுத்துக்கொள்ளும்
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    if (!renderUrl) return;
    
    const webhookUrl = `${renderUrl}/telegram`;
    
    try {
        const resp = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, 
            { url: webhookUrl }
        );
        if (resp.data.ok) {
            console.log(`✅ Telegram Webhook Link Set: ${webhookUrl}`);
        }
    } catch(e) {
        console.error('❌ Webhook failed:', e.message);
    }
}

// --- Start Server ---
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await setWebhook();
});
