const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// WhatsApp Bot Setup
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
    console.log('கீழே உள்ள QR Code-ஐ உங்கள் WhatsApp-ல் ஸ்கேன் செய்யவும்:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot Ready! கிளவுடுடன் இணைந்துவிட்டது.');
});

// Incoming Message -> PythonAnywhere-க்கு அனுப்புதல்
client.on('message', async msg => {
    const groupId = '120363312348014308@g.us';
    
    if (msg.from === groupId) {
        console.log('New Message in Group:', msg.body);
        
        // Green API போலவே JSON தயார் செய்தல்
        const payload = {
            typeWebhook: "incomingMessageReceived",
            senderData: {
                chatId: msg.from,
                sender: msg.author || msg.from,
            },
            messageData: {
                typeMessage: msg.hasMedia ? "imageMessage" : "textMessage",
                textMessageData: { textMessage: msg.body }
            },
            timestamp: msg.timestamp,
            idMessage: msg.id.id
        };

        try {
            await axios.post('https://remon1810.pythonanywhere.com/webhook/whatsapp', payload);
            console.log('✅ Message forwarded to PythonAnywhere successfully!');
        } catch (err) {
            console.error('❌ Error forwarding:', err.message);
        }
    }
});

client.initialize();

// Local Poller-ல் இருந்து Reply அனுப்ப ஒரு API
app.post('/send', async (req, res) => {
    const { chatId, message } = req.body;
    try {
        await client.sendMessage(chatId, message);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Server Awake (cron-job.org-க்காக)
app.get('/', (req, res) => res.send('REmon WhatsApp Bot is Running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
