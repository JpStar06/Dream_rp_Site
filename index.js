const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '.')));

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota simples para verificar se o servidor está saudável.
app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

function textoSeguro(valor, limite = 1000) {
    const texto = String(valor ?? '').trim() || 'Não informado';
    return texto.length > limite
        ? texto.slice(0, limite - 3) + '...'
        : texto;
}

app.post('/enviar-webhook', async (req, res) => {
    try {
        if (!WEBHOOK_URL) {
            console.error('WEBHOOK_URL não está configurada.');
            return res.status(500).json({
                sucesso: false,
                erro: 'Webhook não configurado no servidor.'
            });
        }

        const ficha = req.body || {};

        const mensagemDiscord = {
            embeds: [{
                title: `📜 **Nova Ficha Criada: ${textoSeguro(ficha.nome, 256)}**`,
                color: 0x7657e8,
                fields: [
                    { name: '**Nick/ID**', value: textoSeguro(ficha.nick), inline: true },
                    { name: '**Gênero**', value: textoSeguro(ficha.genero), inline: true },
                    { name: '**Raça**', value: textoSeguro(ficha.raca), inline: true },
                    {
                        name: '**Origem / Vive em**',
                        value: textoSeguro(`${ficha.origem || 'Não informado'} / ${ficha.local || 'Não informado'}`),
                        inline: false
                    },
                    { name: '**Profissão / Função**', value: textoSeguro(ficha.funcao), inline: true },
                    { name: '**Idade**', value: textoSeguro(ficha.idade), inline: true },
                    { name: '**Personalidade**', value: textoSeguro(ficha.personalidade), inline: false },
                    { name: '**Aparência**', value: textoSeguro(ficha.aparencia), inline: false },
                    { name: '**Habilidades**', value: textoSeguro(ficha.habilidades), inline: false },
                    { name: '**Equipamentos**', value: textoSeguro(ficha.equipamentos), inline: false },
                    { name: '**Lore**', value: textoSeguro(ficha.lore), inline: false },
                    {
                        name: '**💬 Frase Marcante**',
                        value: ficha.frase ? textoSeguro(`"${ficha.frase}"`) : 'Nenhuma',
                        inline: false
                    }
                ],
                footer: { text: 'Dream • Sistema de Fichas' },
                timestamp: new Date().toISOString()
            }]
        };

        const respostaDiscord = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mensagemDiscord),
            signal: AbortSignal.timeout(10_000)
        });

        if (!respostaDiscord.ok) {
            const detalhe = await respostaDiscord.text().catch(() => '');
            console.error(
                `Discord rejeitou o webhook (HTTP ${respostaDiscord.status}):`,
                detalhe.slice(0, 500)
            );

            return res.status(502).json({
                sucesso: false,
                erro: 'O Discord rejeitou o webhook.'
            });
        }

        return res.status(200).json({ sucesso: true });
    } catch (erro) {
        if (erro.name === 'TimeoutError') {
            console.error('Timeout ao enviar a ficha para o Discord.');

            return res.status(504).json({
                sucesso: false,
                erro: 'O Discord demorou demais para responder.'
            });
        }

        console.error('Erro interno no servidor:', erro);

        return res.status(500).json({
            sucesso: false,
            erro: 'Falha ao disparar o webhook.'
        });
    }
});

const server = app.listen(PORT, HOST, () => {
    console.log(`Servidor rodando com sucesso em ${HOST}:${PORT}`);
});

server.on('error', (erro) => {
    console.error('Erro ao iniciar o servidor:', erro);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM recebido. Encerrando o servidor...');
    server.close(() => process.exit(0));
});
