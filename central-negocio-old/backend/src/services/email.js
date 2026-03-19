// Serviço de envio de email via Resend
const { Resend } = require('resend');

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'contato@fantonisoftware.com.br';
const FROM_NAME  = process.env.RESEND_FROM_NAME  || 'Douglas Fantoni — Fantoni Software';

// Template HTML do email de prospecção
function gerarTemplateEmail({ nomeFantasia, razaoSocial, municipio, estado, segmento, mensagemIA }) {
  const nome = nomeFantasia || razaoSocial || 'Prezado(a)';
  const local = municipio ? `${municipio}${estado ? '/' + estado : ''}` : 'sua cidade';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fantoni PDV — Sistema de Gestão</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:32px;text-align:center;">
          <h1 style="color:#fff;font-size:24px;margin:0;font-weight:800;">Fantoni <span style="color:#3b82f6;">Software</span></h1>
          <p style="color:#94a3b8;font-size:13px;margin:6px 0 0;">Sistema PDV completo para o seu negócio</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#fff;padding:36px 32px;">
          <p style="color:#0f172a;font-size:16px;margin:0 0 20px;">Olá, <strong>${nome}</strong>!</p>

          <div style="background:#f8fafc;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;font-size:15px;color:#334155;line-height:1.7;">
            ${mensagemIA ? mensagemIA.replace(/\n/g, '<br>') : `Encontrei o ${nome} em ${local} e gostaria de apresentar uma solução que pode transformar a gestão do seu negócio.`}
          </div>

          <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px;">
            O <strong>Fantoni PDV</strong> é um sistema completo de ponto de venda desenvolvido especialmente para
            ${segmento ? segmento.toLowerCase() : 'estabelecimentos como o seu'}. Funciona <strong>100% offline</strong>,
            em qualquer dispositivo — celular, tablet ou computador.
          </p>

          <!-- Features -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td width="50%" style="padding:0 8px 12px 0;vertical-align:top;">
                <div style="background:#eff6ff;border-radius:10px;padding:14px;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#1d4ed8;">✓ Emissão de NFC-e / NF-e</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Com contingência offline</p>
                </div>
              </td>
              <td width="50%" style="padding:0 0 12px 8px;vertical-align:top;">
                <div style="background:#eff6ff;border-radius:10px;padding:14px;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#1d4ed8;">✓ Controle de Estoque</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Automático e em tempo real</p>
                </div>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
                <div style="background:#eff6ff;border-radius:10px;padding:14px;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#1d4ed8;">✓ Relatórios e Financeiro</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Vendas, margem e fluxo de caixa</p>
                </div>
              </td>
              <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
                <div style="background:#eff6ff;border-radius:10px;padding:14px;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#1d4ed8;">✓ Multi-dispositivo</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Celular, tablet e computador</p>
                </div>
              </td>
            </tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 24px;">
              <a href="https://wa.me/5551996034862?text=Ol%C3%A1%2C+recebi+seu+email+e+gostaria+de+saber+mais+sobre+o+Fantoni+PDV"
                 style="display:inline-block;background:#25D366;color:#fff;font-weight:700;font-size:15px;text-decoration:none;border-radius:10px;padding:14px 32px;">
                💬 Quero saber mais pelo WhatsApp
              </a>
            </td></tr>
          </table>

          <p style="color:#64748b;font-size:13px;text-align:center;margin:0;">
            Ou acesse: <a href="https://fantonisoftware.com.br" style="color:#3b82f6;">fantonisoftware.com.br</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0f172a;border-radius:0 0 16px 16px;padding:24px 32px;text-align:center;">
          <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">
            <strong style="color:#fff;">Douglas Fantoni</strong> — Fundador &amp; Consultor
          </p>
          <p style="color:#64748b;font-size:11px;margin:0;">
            Fantoni Software · CNPJ 60.388.739/0001-44 · fantonisoftware@gmail.com
          </p>
          <p style="color:#475569;font-size:11px;margin:12px 0 0;">
            Você recebeu este email pois seu estabelecimento está em nossa base pública de dados do CNPJ.
            Para não receber mais, responda com "remover".
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function enviarEmail({ para, nomeFantasia, razaoSocial, municipio, estado, segmento, mensagemIA, assunto }) {
  const resend = getResend();
  const nome = nomeFantasia || razaoSocial || 'Estabelecimento';
  const emailAssunto = assunto || `${nome} — Sistema PDV para o seu negócio | Fantoni Software`;

  const html = gerarTemplateEmail({ nomeFantasia, razaoSocial, municipio, estado, segmento, mensagemIA });

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [para],
    subject: emailAssunto,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

module.exports = { enviarEmail, gerarTemplateEmail };
