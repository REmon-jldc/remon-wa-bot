const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// வெப்சைட்டில் காட்ட வேண்டிய HTML டிசைன்
let qrCodeHtml = `
<html>
    <head><meta http-equiv="refresh" content="10"></head>
    <body style="text-align: center; margin-top: 50px; font-family: sans-serif;">
        <h2>சர்வர் ஸ்டார்ட் ஆகிறது... 🚀</h2>
        <p>QR Code இன்னும் சில வினாடிகளில் இங்கே வரும். (இந்த பேஜ் தானாகவே Refresh ஆகும்)</p>
    </body>
</html>
`;

// WhatsApp Bot Setup
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

// புது QR Code வரும்போது வெப்சைட்டை அப்டேட் செய்தல்
client.on('qr', (qr) => {
    console.log('🔗 புதிய QR Code ரெடி!');
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?margin=20&size=400x400&data=' + encodeURIComponent(qr);
    
    qrCodeHtml = `
    <html>
        <head><meta http-equiv="refresh" content="15"></head>
        <body style="text-align: center; margin-top: 50px; font-family: sans-serif;">
            <h2>WhatsApp QR Code 📱</h2>
            <p>உங்க மொபைலில் WhatsApp-ஐ திறந்து இதை ஸ்கேன் செய்யவும்.</p>
            <p style="color: red;">(இந்த பேஜ் தானாகவே 15 வினாடிகளுக்கு ஒருமுறை Refresh ஆகும்)</p>
            <img src="${qrUrl}" alt="QR Code" style="border: 2px solid black; padding: 10px; border-radius: 10px; width: 300px; height: 300px;" />
        </body>
    </html>
    `;
});

// ஸ்கேன் செய்த பிறகு வெப்சைட்டை மாற்றுதல்
client.on('ready', () => {
    console.log('✅ WhatsApp Bot Ready! கிளவுடுடன் இணைந்துவிட்டது.');
    qrCodeHtml = `
    <html>
        <body style="text-align: center; margin-top: 50px; font-family: sans-serif;">
            <h2 style="color: green;">✅ WhatsApp Bot Ready!</h2>
            <p>கிளவுடுடன் வெற்றிகரமாக இணைந்துவிட்டது. இனிமேல் WhatsApp மெசேஜ்கள் வேலை செய்யும்!</p>
        </body>
    </html>
    `;
});

// Incoming Message -> PythonAnywhere-க்கு அனுப்புதல்
client.on('message', async msg => {
    const groupId = '120363312348014308@g.us';
    
    if (msg.from === groupId) {
        console.log('New Message in Group:', msg.body);
        
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

// பிரவுசரில் வெப்சைட்டை ஓபன் செய்யும்போது காட்டுவதற்கான API
app.get('/', (req, res) => {
    res.send(qrCodeHtml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server started on port ' + PORT));
