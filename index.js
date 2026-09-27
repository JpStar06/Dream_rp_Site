const express = require('express');
const path = require('path');
const app = express();

// 1. Carrega o dotenv usando require (Padrão CommonJS)
require('dotenv').config();

const WEBHOOK_URL = process.env.WEBHOOK_URL;
console.log("Variável WEBHOOK_URL carregada:", WEBHOOK_URL);

// Permite que o Express entenda JSON enviado pelo HTML
app.use(express.json());

// Serve o seu arquivo index.html na raiz do projeto
app.use(express.static(path.join(__dirname, '.')));

// 2. Rota unificada para receber os dados e enviar a Embed organizada ao Discord
app.post('/enviar-webhook', async (req, res) => {
    try {
        const ficha = req.body;

        // Monta o visual organizado com os dados idênticos ao formulário do HTML
        const mensagemDiscord = {
            embeds: [{
                title: `👑 Nova Ficha Criada: ${ficha.nome}`,
                color: 0x00ff00, // Verde
                fields: [
                    { name: "👤 Nick/ID", value: ficha.nick || "Não informado", inline: true },
                    { name: "🧬 Gênero", value: ficha.genero || "Não informado", inline: true },
                    { name: "🧬 Raça", value: ficha.raca || "Não informado", inline: true },
                    { name: "🌍 Origem / Vive em", value: `${ficha.origem || "Não informado"} / ${ficha.local || "Não informado"}`, inline: false },
                    { name: "💼 Profissão / Função", value: ficha.funcao || "Não informado", inline: true },
                    { name: "⏳ Idade", value: ficha.idade || "Não informado", inline: true },
                    { name: "🎭 Personalidade", value: ficha.personalidade || "Não informado", inline: false },
                    { name: "✨ Aparência", value: ficha.aparencia || "Não informado", inline: false },
                    { name: "⚔️ Habilidades", value: ficha.habilidades || "Nenhuma", inline: false },
                    { name: "🎒 Equipamentos", value: ficha.equipamentos || "Nenhum", inline: false },
                    { name: "📖 Lore", value: ficha.lore || "Sem lore adicionada", inline: false },
                    { name: "💬 Frase Marcante", value: ficha.frase ? `"${ficha.frase}"` : "Nenhuma", inline: false }
                ],
                footer: { text: "Dream • Sistema de Fichas" },
                timestamp: new Date()
            }]
        };

        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mensagemDiscord)
        });

        res.status(200).json({ sucesso: true });
    } catch (erro) {
        console.error("Erro interno no servidor:", erro);
        res.status(500).json({ erro: 'Falha ao disparar o webhook' });
    }
});

// Fixa a porta exigida pela Discloud
const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
