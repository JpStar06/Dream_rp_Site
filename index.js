const express = require('express');
const path = require('path');
const app = express();

// Substitua 'public' pelo nome da pasta onde está seu index.html (ex: '.', 'src', etc.)
app.use(express.static(path.join(__dirname, 'index.html'))); 

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
