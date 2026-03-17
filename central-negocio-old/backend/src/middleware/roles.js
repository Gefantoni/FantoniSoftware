// Middleware de controle de acesso por role
function exigirRole(...rolesPermitidas) {
  return (req, res, next) => {
    const { perfil } = req;
    if (!perfil || !rolesPermitidas.includes(perfil.role)) {
      return res.status(403).json({
        erro: `Acesso negado. Requer: ${rolesPermitidas.join(' ou ')}`
      });
    }
    next();
  };
}

// Atalhos prontos
const apenasAdmin       = exigirRole('admin');
const adminOuSuporte    = exigirRole('admin', 'suporte');
const adminOuFinanceiro = exigirRole('admin', 'financeiro');
const adminOuComercial  = exigirRole('admin', 'comercial');
const apenasCliente     = exigirRole('cliente');
const equipeInterna     = exigirRole('admin', 'suporte', 'financeiro', 'comercial');

module.exports = {
  exigirRole,
  apenasAdmin,
  adminOuSuporte,
  adminOuFinanceiro,
  adminOuComercial,
  apenasCliente,
  equipeInterna
};
