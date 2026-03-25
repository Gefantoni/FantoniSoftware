// Sidebar dinâmica para o painel admin — Central do Negócio
// Injeção de Layout Moderno em Dark Mode (Admin)
(function injetarSidebarAdmin() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const MENU = [
    { label: 'Geral', items: [
      { href: '/admin/', icone: 'ph ph-chart-line-up', label: 'Dashboard' },
      { href: '/admin/clientes.html', icone: 'ph ph-users', label: 'Clientes' }
    ]},
    { label: 'Operacional', items: [
      { href: '/admin/modulos.html', icone: 'ph ph-play-circle', label: 'Cursos e Aulas' },
      { href: '/admin/tickets.html', icone: 'ph ph-ticket', label: 'Gestão de Tickets' }
    ]},
    { label: 'Financeiro', items: [
      { href: '/admin/financeiro.html', icone: 'ph ph-bank', label: 'Controle Financeiro' }
    ]},
    { label: 'Crescimento', items: [
      { href: '/admin/comercial/leads.html', icone: 'ph ph-user-focus', label: 'Leads CRM' },
      { href: '/admin/comercial/landing-leads.html', icone: 'ph ph-globe', label: 'Leads do Site' },
      { href: '/admin/comercial/disparos.html', icone: 'ph ph-rocket-launch', label: 'Automação Zap' },
      { href: '/admin/comercial/kanban.html', icone: 'ph ph-layout', label: 'Kanban Vendas' },
      { href: '/admin/comercial/relatorios.html', icone: 'ph ph-presentation-chart', label: 'Relatórios' }
    ]}
  ];

  let menuHTML = '';
  MENU.forEach(secao => {
    const links = secao.items.map(item => {
      const isActive = window.location.pathname === item.href;
      return `<a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}">
        <i class="${item.icone} i-md"></i>
        <span>${item.label}</span>
      </a>`;
    }).join('');
    menuHTML += `<div class="nav-group"><span class="nav-label">${secao.label}</span>${links}</div>`;
  });

  const iniciais = JSON.parse(localStorage.getItem('fantoni_usuario'))?.nome?.charAt(0) || 'A';

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <img src="/assets/logo.png" alt="Fantoni">
      <div>
        <h2>Admin Fantoni</h2>
        <p style="font-size:10px; color:var(--texto-muted); text-transform:uppercase;">Central do Negócio</p>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${menuHTML}
    </nav>
    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar" style="background:var(--texto-muted)">${iniciais}</div>
        <div class="user-details">
          <span class="user-name" id="admin-nome">Administrador</span>
          <span class="user-role">Super Admin</span>
        </div>
      </div>
      <button class="btn btn-outline btn-sm w-100" id="btn-logout-admin">
        <i class="ph ph-sign-out"></i> Logout
      </button>
    </div>
  `;

  document.getElementById('btn-logout-admin')?.addEventListener('click', () => {
    localStorage.removeItem('fantoni_token');
    window.location.href = '/';
  });

  // Atualiza nome do admin se disponível
  const user = JSON.parse(localStorage.getItem('fantoni_usuario'));
  if (user && user.nome) document.getElementById('admin-nome').textContent = user.nome.split(' ')[0];
})();
