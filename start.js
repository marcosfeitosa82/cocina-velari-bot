const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('QR Code gerado. Escaneie com o WhatsApp.');
});

client.on('ready', () => console.log('WhatsApp conectado!'));

client.on('message', async msg => {
  if (msg.fromMe || msg.isGroupMsg) return;
  try {
    const resposta = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.DIFY_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: {}, query: msg.body, response_mode: 'blocking', user: msg.from })
    });
    const data = await resposta.json();
    client.sendMessage(msg.from, data.answer);
  } catch (error) {
    console.error('Erro ao chamar Dify:', error);
  }
});

client.initialize();
