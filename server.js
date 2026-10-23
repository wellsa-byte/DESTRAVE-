require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (_req, res) => {
  res.json({ aiConfigured: Boolean(process.env.AI_API_KEY && process.env.AI_MODEL) });
});

app.post('/api/ideas', async (req, res) => {
  const { prompt = '', mode = 'destravar' } = req.body || {};
  if (typeof prompt !== 'string' || prompt.length > 6000) {
    return res.status(400).json({ error: 'Envie uma ideia de até 6000 caracteres.' });
  }
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!key || !model) return res.status(503).json({ error: 'IA online não configurada. Use o modo local ou configure a chave no backend.' });

  const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const system = `Você é DESTRAVE, parceiro criativo de composição musical brasileira. Seja perspicaz, conciso e natural; não imite nem reproduza letras existentes. Ajude a encontrar ângulos originais, imagens, histórias, frases, rimas e caminhos. Evite clichês e gírias forçadas. Entregue no máximo: uma sacada principal, três caminhos curtos e um exercício prático. Mantenha a voz do compositor.`;
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Modo: ${mode}\nIdeia do compositor: ${prompt || 'Estou sem ideias. Surpreenda-me com um ponto de partida original.'}` }
        ],
        temperature: 0.9
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ error: data.error?.message || 'O provedor de IA não respondeu. Confira a configuração da API.' });
    res.json({ text: data.choices?.[0]?.message?.content || 'Não consegui gerar uma resposta desta vez.', source: 'ai' });
  } catch (_e) {
    res.status(502).json({ error: 'Não foi possível conectar ao provedor de IA.' });
  }
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => console.log(`DESTRAVE disponível em http://${host}:${port}`));
