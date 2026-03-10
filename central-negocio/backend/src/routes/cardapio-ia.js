// Rotas do Assistente de Cardápio com IA
const express = require('express');
const { autenticar } = require('../middleware/auth');
const { gerarDescricaoCardapio, gerarUrlImagem } = require('../services/openai');

const router = express.Router();

// POST /api/cardapio-ia/gerar
// Gera nome profissional, descrição e prompt de imagem para um item do cardápio
router.post('/gerar', autenticar, async (req, res) => {
    const { nomePrato, ingredientes, estilo, plataforma, imagemBase64, instrucoes } = req.body;

    if (!nomePrato || !ingredientes) {
        return res.status(400).json({ erro: 'Nome do prato e ingredientes são obrigatórios.' });
    }

    try {
        const resultado = await gerarDescricaoCardapio({ nomePrato, ingredientes, estilo, plataforma, imagemBase64, instrucoes });
        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: err.message });
    }
});

// POST /api/cardapio-ia/gerar-imagem
// Solicita ao DALL-E 3 a criação de uma imagem fotorealista do prato baseada no prompt
router.post('/gerar-imagem', autenticar, async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ erro: 'O prompt é obrigatório.' });

    try {
        const url = await gerarUrlImagem(prompt);
        res.json({ url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: err.message });
    }
});

module.exports = router;
