// Sidebar dinâmica para o portal do cliente com controle de permissões por tela
// Inclua APÓS api.js e auth.js em todas as páginas do painel cliente
// Portal do Cliente — Injeção Dinâmica de Layout (Sidebar + Header)
// Inclua APÓS api.js e auth.js em todas as páginas do painel cliente
(function injetarLayoutPainel() {
  const sidebarEl = document.getElementById('sidebar');
  const topbarEl = document.getElementById('topbar');
  if (!sidebarEl && !topbarEl) return;

  // Definição das telas do portal do cliente
  const TELAS = [
    { tela: 'videoaulas',       href: '/painel/videoaulas.html',      icone: 'ph ph-graduation-cap', label: 'Sistema PDV',          secao: 'Operação' },
    { tela: 'agente_ia',        href: '/painel/agente-ia.html',       icone: 'ph ph-robot',          label: 'Agente IA',            secao: 'Operação' },
    { tela: 'empreendedorismo', href: '/painel/empreendedorismo.html', icone: 'ph ph-fork-knife',     label: 'Bares & Restaurantes', secao: 'Negócio' },
    { tela: 'cardapio_ia',      href: '/painel/cardapio-ia.html',     icone: 'ph ph-sparkle',        label: 'IA para Cardápio',     secao: 'Negócio' },
    { tela: 'tickets',          href: '/painel/tickets.html',         icone: 'ph ph-ticket',         label: 'Meus Chamados',        secao: 'Suporte' },
    { tela: 'financeiro',       href: '/painel/financeiro.html',      icone: 'ph ph-chart-bar',      label: 'Financeiro',           secao: 'Conta' },
  ];

  const ORDEM_SECOES = ['Operação', 'Negócio', 'Suporte', 'Conta'];

  // 1. INJEÇÃO DA SIDEBAR
  if (sidebarEl) {
    const visiveis = typeof temPermissao === 'function' ? TELAS.filter(t => temPermissao(t.tela)) : TELAS;
    let secoesHTML = '';
    
    for (const secao of ORDEM_SECOES) {
      const itens = visiveis.filter(t => t.secao === secao);
      if (!itens.length) continue;
      const links = itens.map(t =>
        `<a href="${t.href}" class="nav-item"><i class="${t.icone} nav-icon"></i> ${t.label}</a>`
      ).join('');
      secoesHTML += `<div class="nav-group"><span class="nav-group-label">${secao}</span>${links}</div>`;
    }

    sidebarEl.innerHTML = `
      <div class="sidebar-logo">
        <div class="logo-wrap">
          <img src="/assets/logo.png" alt="Fantoni Software" style="height:36px;width:auto;object-fit:contain;flex-shrink:0;">
          <div><h2>Central do Negócio</h2><span>Portal do Cliente</span></div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-group">
          <a href="/painel/" class="nav-item"><i class="ph ph-squares-four nav-icon"></i> Dashboard</a>
        </div>
        ${secoesHTML}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-usuario">
          <div class="s-avatar" id="s-avatar">?</div>
          <div><strong id="usuario-nome">—</strong><span id="usuario-role">Cliente</span></div>
        </div>
        <button class="btn-logout"><i class="ph ph-sign-out"></i> Sair</button>
      </div>
    `;

    // Marca link ativo
    const path = window.location.pathname;
    sidebarEl.querySelectorAll('.nav-item').forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href === path || (path.endsWith('/') && href === path))) {
        link.classList.add('active');
      }
    });
  }

  // 2. INJEÇÃO DA TOPBAR (HEADER)
  if (topbarEl) {
    // Pega o título da página atual baseado no TELAS ou usa "Dashboard"
    const paginaAtual = TELAS.find(t => t.href === window.location.pathname) || { label: 'Dashboard' };
    
    topbarEl.innerHTML = `
      <div class="header-left">
        <button class="sidebar-toggle" id="sidebar-toggle">
          <i class="ph ph-list"></i>
        </button>
        <div class="topbar-titulo" id="topbar-titulo">${paginaAtual.label}</div>
      </div>
      <div class="header-right">
        <div id="topbar-info" style="display:flex;align-items:center;gap:12px">
          <div style="text-align:right;display:none;@media (min-width:769px){display:block}">
            <div id="topbar-saudacao" style="font-size:13px;font-weight:600">Olá!</div>
            <div id="topbar-data" style="font-size:11px;color:var(--saas-muted)">—</div>
          </div>
          <div class="s-avatar" id="avatar-inicial" style="width:32px;height:32px;background:var(--saas-blue);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">?</div>
        </div>
      </div>
    `;
  }
})();
