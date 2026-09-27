const express = require('express');
const path = require('path');
const app = express();

// Serve os arquivos da raiz
app.use(express.static(path.join(__dirname, '.'))); 

// Rota corrigida para a versão atual do Express
app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Força o Express a escutar na porta correta exigida pela Discloud
const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
