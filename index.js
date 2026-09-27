const express = require('express');
const path = require('path');
const app = express();

// Serve todos os arquivos da raiz (HTML, CSS, imagens)
app.use(express.static(path.join(__dirname, '.'))); 

// Garante que qualquer rota criada (ex: /criar) mande a pessoa de volta pro index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Porta obrigatória da Discloud
const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});