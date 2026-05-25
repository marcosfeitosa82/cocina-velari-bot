const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ URL DO SEU TÚNEL BORE (já configurada)
const URL_TERMUX = 'https://placeholder.ngrok-free.app/imprimir';

let qrDataUrl = '';

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', async qr => {
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
    const textoResposta = data.answer;

    // Envia a resposta da IA para o cliente
    client.sendMessage(msg.from, textoResposta);

    // Verifica se é uma confirmação de pedido (a IA vai incluir a tag [PEDIDO_CONFIRMADO])
    if (textoResposta.includes('[PEDIDO_CONFIRMADO]')) {
      console.log('Pedido confirmado detectado. Enviando para impressão...');
      const pedido = extrairDadosPedido(textoResposta);
      if (pedido) {
        await enviarPedidoParaImpressao(pedido);
      }
    }
  } catch (error) {
    console.error('Erro ao chamar Dify:', error);
  }
});

client.initialize();

// Rota para exibir o QR Code
app.get('/qr', (req, res) => {
  if (!qrDataUrl) {
    return res.send('QR Code ainda não gerado. Aguarde alguns segundos e recarregue.');
  }
  const html = `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#000"><img src="${qrDataUrl}" style="max-width:90vw;max-height:90vh;"/></body></html>`;
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// ======================================================
// FUNÇÃO DE IMPRESSÃO
// ======================================================
async function enviarPedidoParaImpressao(pedido) {
  try {
    const resposta = await fetch(URL_TERMUX, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido)
    });
    if (resposta.ok) {
      console.log('✅ Pedido enviado para o Termux com sucesso.');
    } else {
      console.error('❌ Erro ao enviar para o Termux:', resposta.status);
    }
  } catch (erro) {
    console.error('❌ Falha de conexão com o Termux:', erro);
  }
}

// ======================================================
// EXTRAI DADOS DO PEDIDO DA RESPOSTA DA IA
// ======================================================
function extrairDadosPedido(texto) {
  try {
    const nome = texto.match(/Nome:\s*(.+)/)?.[1]?.trim();
    const whatsapp = texto.match(/WhatsApp:\s*(.+)/)?.[1]?.trim();
    const itens = texto.match(/Itens:\s*(.+)/)?.[1]?.trim().split(',').map(i => i.trim());
    const total = texto.match(/Total:\s*(.+)/)?.[1]?.trim();
    const endereco = texto.match(/Endereço:\s*(.+)/)?.[1]?.trim();
    const bairro = texto.match(/Bairro:\s*(.+)/)?.[1]?.trim();
    const cidade = texto.match(/Cidade:\s*(.+)/)?.[1]?.trim();

    if (nome && itens && total) {
      return { 
        nome, 
        whatsapp: whatsapp || 'N/I', 
        itens, 
        total, 
        endereco: endereco || 'N/I', 
        bairro: bairro || 'N/I', 
        cidade: cidade || 'N/I' 
      };
    }
    return null;
  } catch (e) {
    console.error('Erro ao extrair dados do pedido:', e);
    return null;
  }
}
