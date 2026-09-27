const express = require('express');
const path = require('path');
const app = express();

// O Express automaticamente procura por um arquivo chamado 'index.html' dentro da pasta informada
app.use(express.static(path.join(__dirname, '.')));

// Fixa a porta exigida pela Discloud
const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
