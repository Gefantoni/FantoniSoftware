// Rota de upload de arquivos para o chat (imagens e áudios)
const express = require('express');
const multer  = require('multer');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// Multer em memória — arquivo fica em req.file.buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg','image/png','image/gif','image/webp','audio/webm','audio/mp4','audio/ogg'];
    if (permitidos.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido'));
  }
});

// POST /upload/chat — faz upload e salva mensagem
router.post('/chat', autenticar, upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

  const { ticket_id } = req.body;
  if (!ticket_id) return res.status(400).json({ erro: 'ticket_id obrigatório' });

  try {
    // Verifica se o cliente tem acesso ao ticket
    if (req.perfil.role === 'cliente') {
      const { data: ticket } = await supabaseAdmin
        .from('tickets').select('cliente_id').eq('id', parseInt(ticket_id)).single();
      if (!ticket || ticket.cliente_id !== req.perfil.id) {
        return res.status(403).json({ erro: 'Acesso negado' });
      }
    }

    // Define nome único do arquivo
    const ext  = req.file.originalname.split('.').pop();
    const tipo = req.file.mimetype.startsWith('audio') ? 'audio' : 'imagem';
    const nome = `${tipo}/${ticket_id}/${Date.now()}.${ext}`;

    // Faz upload no Supabase Storage
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('chat-arquivos')
      .upload(nome, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (storageError) throw new Error('Erro no upload: ' + storageError.message);

    // Gera URL pública
    const { data: urlData } = supabaseAdmin.storage
      .from('chat-arquivos')
      .getPublicUrl(nome);

    const urlPublica = urlData.publicUrl;

    // Salva mensagem no banco
    const { data: mensagem, error: msgError } = await supabaseAdmin
      .from('mensagens_ticket')
      .insert({
        ticket_id: parseInt(ticket_id),
        autor_id: req.perfil.id,
        tipo,
        conteudo: urlPublica
      })
      .select('*, perfis(nome, role)')
      .single();

    if (msgError) throw new Error('Erro ao salvar mensagem: ' + msgError.message);

    // Atualiza timestamp do ticket
    await supabaseAdmin.from('tickets')
      .update({ atualizado_em: new Date().toISOString(), status: 'em_andamento' })
      .eq('id', parseInt(ticket_id));

    res.json({ mensagem, url: urlPublica, tipo });
  } catch (err) {
    console.error('Erro no upload:', err);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
