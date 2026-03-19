// Sidebar dinâmica para o painel admin — Central do Negócio
// Inclua este script APÓS api.js e auth.js em todas as páginas admin
(function injetarSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <img src="/assets/logo.png" alt="Fantoni Software" style="height:36px;width:auto;object-fit:contain;margin-bottom:6px;display:block;">
      <h2>Central do Negócio</h2>
      <span>Painel Admin</span>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-title">Geral</div>
      <a href="/admin/" class="nav-item">🏠 Dashboard</a>
      <a href="/admin/clientes.html" class="nav-item">👥 Clientes</a>

      <div class="nav-section-title">Conteúdo</div>
      <a href="/admin/modulos.html" class="nav-item">🎬 Módulos e Aulas</a>

      <div class="nav-section-title">Atendimento</div>
      <a href="/admin/tickets.html" class="nav-item">🎫 Tickets</a>

      <div class="nav-section-title">Financeiro</div>
      <a href="/admin/financeiro.html" class="nav-item">💰 Financeiro</a>

      <div class="nav-section-title">Comercial</div>
      <a href="/admin/comercial/" class="nav-item">📊 Dashboard</a>
      <a href="/admin/comercial/leads.html" class="nav-item">👤 Leads</a>
      <a href="/admin/comercial/disparos.html" class="nav-item">🚀 Disparos em Massa</a>
      <a href="/admin/comercial/conversas.html" class="nav-item">💬 Conversas</a>
      <a href="/admin/comercial/kanban.html" class="nav-item">📋 Kanban</a>
      <a href="/admin/comercial/calendario.html" class="nav-item">📅 Calendário</a>
      <a href="/admin/comercial/relatorios.html" class="nav-item">📈 Relatórios</a>
      <a href="/admin/comercial/ia.html" class="nav-item">🤖 IA Comercial</a>
      <a href="/admin/comercial/configuracoes.html" class="nav-item">⚙️ Configurações</a>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-usuario">
        <strong id="usuario-nome">—</strong>
        <span id="usuario-role">Admin</span>
      </div>
      <button class="btn-logout">Sair</button>
    </div>
  `;
})();
