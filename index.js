const express = require('express');
const path = require('path');
const app = express();

// Serve todos os arquivos estáticos da raiz (HTML, CSS, imagens)
app.use(express.static(path.join(__dirname, '.'))); 

// CORREÇÃO: O Express mais recente exige um nome após o asterisco (ex: *splat)
app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Porta obrigatória exigida pela Discloud
const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});