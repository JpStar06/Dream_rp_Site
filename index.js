const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// A Discloud fica atrás de proxy, então usamos o primeiro proxy
// para que req.ip represente o IP original do cliente.
app.set('trust proxy', 1);

// O backend não deve expor o diretório inteiro como conteúdo estático.
// Isso impediria que arquivos como index.js/package.json fossem baixados
// diretamente pelo navegador.
app.disable('x-powered-by');

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

app.use(express.json({ limit: '32kb' }));

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota simples para verificar se o servidor está saudável.
app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

// ==========================================
// PROTEÇÕES DO ENVIO DE FICHAS
// ==========================================

// Limite de 3 fichas por IP a cada 60 segundos.
// O Map é suficiente para esta aplicação porque existe uma única
// instância do servidor. Entradas antigas são removidas periodicamente.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = 3;
const rateLimitMap = new Map();

setInterval(() => {
    const agora = Date.now();

    for (const [ip, dados] of rateLimitMap) {
        if (agora - dados.inicio >= RATE_WINDOW_MS) {
            rateLimitMap.delete(ip);
        }
    }
}, RATE_WINDOW_MS).unref();

function verificarRateLimit(ip) {
    const agora = Date.now();
    const atual = rateLimitMap.get(ip);

    if (!atual || agora - atual.inicio >= RATE_WINDOW_MS) {
        rateLimitMap.set(ip, {
            inicio: agora,
            quantidade: 1
        });

        return {
            permitido: true,
            restante: RATE_MAX_REQUESTS - 1
        };
    }

    if (atual.quantidade >= RATE_MAX_REQUESTS) {
        return {
            permitido: false,
            restante: 0,
            retryAfter: Math.ceil((RATE_WINDOW_MS - (agora - atual.inicio)) / 1000)
        };
    }

    atual.quantidade += 1;

    return {
        permitido: true,
        restante: RATE_MAX_REQUESTS - atual.quantidade
    };
}

// Limites alinhados aos limites práticos dos campos da embed.
// O Discord permite no máximo 1024 caracteres por value de field.
// O tamanho total da embed é validado separadamente contra o limite de 6000.
const LIMITES = {
    nome: 80,
    nick: 80,
    genero: 40,
    raca: 60,
    origem: 100,
    local: 100,
    funcao: 80,
    idade: 5,
    aparencia: 1000,
    personalidade: 1000,
    habilidades: 1000,
    equipamentos: 1000,
    lore: 1000,
    frase: 200
};

// ==========================================
// SANITIZAÇÃO E VALIDAÇÃO
// ==========================================

function sanitizarTexto(valor, tamanhoMax) {
    if (typeof valor !== 'string') {
        return '';
    }

    let texto = valor.trim().slice(0, tamanhoMax);

    // Neutraliza @everyone e @here mesmo antes do payload chegar ao Discord.
    texto = texto.replace(/@(everyone|here)/gi, '@\u200b$1');

    // Remove referências formatadas a usuários/cargos/canais.
    texto = texto.replace(/<@&?\d+>/g, '[menção removida]');
    texto = texto.replace(/<#\d+>/g, '[canal removido]');

    return texto;
}

function validarEConstruirPersonagem(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error('Corpo da requisição inválido.');
    }

    const personagem = {};

    for (const campo of Object.keys(LIMITES)) {
        personagem[campo] = sanitizarTexto(body[campo], LIMITES[campo]);
    }

    if (!personagem.nome) {
        throw new Error('Campo "nome" é obrigatório.');
    }

    return personagem;
}

function textoOuPadrao(valor, padrao = 'Não informado') {
    return valor || padrao;
}

// ==========================================
// PAYLOAD DO DISCORD
// ==========================================

function montarPayloadDiscord(personagem) {
    return {
        content: null,

        // Defesa principal contra mention injection.
        // O Discord não deve interpretar nenhuma menção.
        allowed_mentions: {
            parse: []
        },

        embeds: [{
            title: `📜 **Nova Ficha Criada: ${personagem.nome}**`,
            color: 0x7657e8,

            fields: [
                {
                    name: '**Nick/ID**',
                    value: textoOuPadrao(personagem.nick),
                    inline: true
                },
                {
                    name: '**Gênero**',
                    value: textoOuPadrao(personagem.genero),
                    inline: true
                },
                {
                    name: '**Raça**',
                    value: textoOuPadrao(personagem.raca),
                    inline: true
                },
                {
                    name: '**Origem / Vive em**',
                    value: textoOuPadrao(
                        `${personagem.origem || 'Não informado'} / ${personagem.local || 'Não informado'}`
                    ),
                    inline: false
                },
                {
                    name: '**Profissão / Função**',
                    value: textoOuPadrao(personagem.funcao),
                    inline: true
                },
                {
                    name: '**Idade**',
                    value: textoOuPadrao(personagem.idade),
                    inline: true
                },
                {
                    name: '**🎭 Personalidade**',
                    value: textoOuPadrao(personagem.personalidade),
                    inline: false
                },
                {
                    name: '**✨ Aparência**',
                    value: textoOuPadrao(personagem.aparencia),
                    inline: false
                },
                {
                    name: '**⚔️ Habilidades**',
                    value: textoOuPadrao(personagem.habilidades),
                    inline: false
                },
                {
                    name: '**🎒 Equipamentos**',
                    value: textoOuPadrao(personagem.equipamentos),
                    inline: false
                },
                {
                    name: '**📖 Lore**',
                    value: textoOuPadrao(personagem.lore),
                    inline: false
                },
                {
                    name: '**💬 Frase Marcante**',
                    value: personagem.frase
                        ? `"${personagem.frase}"`
                        : 'Nenhuma',
                    inline: false
                }
            ],

            footer: {
                text: 'Dream • Sistema de Fichas'
            },

            timestamp: new Date().toISOString()
        }]
    };
}

// O Discord limita cada embed a 6000 caracteres somando título,
// nomes/valores dos fields, footer, descrição etc.
function calcularTamanhoEmbed(embed) {
    let tamanho = 0;

    tamanho += embed.title?.length || 0;
    tamanho += embed.description?.length || 0;
    tamanho += embed.footer?.text?.length || 0;
    tamanho += embed.author?.name?.length || 0;

    for (const field of embed.fields || []) {
        tamanho += field.name?.length || 0;
        tamanho += field.value?.length || 0;
    }

    return tamanho;
}

function validarTamanhoDiscord(payload) {
    const embed = payload.embeds?.[0];

    if (!embed) {
        return true;
    }

    return calcularTamanhoEmbed(embed) <= 6000;
}

// ==========================================
// ENVIO DO WEBHOOK
// ==========================================

app.post('/enviar-webhook', async (req, res) => {
    try {
        if (!WEBHOOK_URL) {
            console.error('WEBHOOK_URL não está configurada.');
            return res.status(500).json({
                sucesso: false,
                erro: 'Webhook não configurado no servidor.'
            });
        }

        const personagem = validarEConstruirPersonagem(req.body);
        const mensagemDiscord = montarPayloadDiscord(personagem);

        if (!validarTamanhoDiscord(mensagemDiscord)) {
            return res.status(400).json({
                sucesso: false,
                erro: 'A ficha é grande demais para ser enviada ao Discord.'
            });
        }

        // Só consome a cota quando a ficha passou pela validação e está pronta
        // para ser enviada. Assim, requisições obviamente inválidas não bloqueiam
        // o usuário legítimo por acidente.
        const ip = req.ip || req.socket.remoteAddress || 'desconhecido';
        const limite = verificarRateLimit(ip);

        if (!limite.permitido) {
            res.set('Retry-After', String(limite.retryAfter));

            console.warn(
                `Rate limit atingido para IP ${ip}. Tente novamente em ${limite.retryAfter}s.`
            );

            return res.status(429).json({
                sucesso: false,
                erro: 'Muitas requisições. Aguarde um pouco antes de tentar novamente.',
                retryAfter: limite.retryAfter
            });
        }

        res.set('X-RateLimit-Remaining', String(limite.restante));

        const respostaDiscord = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mensagemDiscord),

            // Se o Discord não responder em 10 segundos,
            // aborta a requisição para não deixar o servidor preso.
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
                erro: 'O Discord rejeitou o envio da ficha.'
            });
        }

        return res.status(200).json({
            sucesso: true
        });

    } catch (erro) {
        if (erro.name === 'TimeoutError') {
            console.error('Timeout ao enviar a ficha para o Discord.');

            return res.status(504).json({
                sucesso: false,
                erro: 'O Discord demorou demais para responder.'
            });
        }

        if (erro.message === 'Campo "nome" é obrigatório.') {
            return res.status(400).json({
                sucesso: false,
                erro: erro.message
            });
        }

        if (erro.message === 'Corpo da requisição inválido.') {
            return res.status(400).json({
                sucesso: false,
                erro: erro.message
            });
        }

        console.error('Erro interno ao processar /enviar-webhook:', erro);

        return res.status(500).json({
            sucesso: false,
            erro: 'Falha ao processar o envio da ficha.'
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
