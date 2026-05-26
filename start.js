const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Armazena o QR Code mais recente como string (data URL)
let qrDataUrl = '';

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', async qr => {
  // Gera uma imagem PNG do QR Code em base64
  qrDataUrl = await qrcode.toDataURL(qr);
  console.log('QR Code gerado! Acesse /qr para escanear.');
});

client.on('ready', () => {
  console.log('WhatsApp conectado!');
});

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

// Rota para exibir o QR Code como imagem
app.get('/qr', (req, res) => {
  if (!qrDataUrl) {
    return res.send('QR Code ainda não gerado. Aguarde alguns segundos e recarregue.');
  }
  // Extrai a parte base64 e renderiza como HTML
  const html = `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#000"><img src="${qrDataUrl}" style="max-width:90vw;max-height:90vh;"/></body></html>`;
  res.send(html);
});

// Inicia o servidor Express na porta definida
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
