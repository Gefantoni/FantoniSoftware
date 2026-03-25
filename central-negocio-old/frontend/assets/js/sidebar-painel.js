// Sidebar dinâmica para o portal do cliente com controle de permissões por tela
// Injeção Dinâmica de Layout (Sidebar + Header) - Versão Modern Dark
(function injetarLayoutPainel() {
  const sidebarEl = document.getElementById('sidebar');
  const topbarEl = document.getElementById('topbar-saas'); // Usando novo ID para evitar conflitos
  const headerEl = document.querySelector('.app-header'); // Alternativa

  if (!sidebarEl && !headerEl) return;

  // Definição das telas do portal do cliente (Usando Phosphor Icons)
  const TELAS = [
    { tela: 'dashboard',       href: '/painel/',                     icone: 'ph ph-squares-four',   label: 'Dashboard',          secao: 'Principal' },
    { tela: 'videoaulas',       href: '/painel/videoaulas.html',      icone: 'ph ph-graduation-cap', label: 'EAD Fantoni',         secao: 'Operação' },
    { tela: 'agente_ia',        href: '/painel/agente-ia.html',       icone: 'ph ph-robot',          label: 'Agente IA',            secao: 'Operação' },
    { tela: 'empreendedorismo', href: '/painel/empreendedorismo.html', icone: 'ph ph-fork-knife',     label: 'Bares & Restaurantes', secao: 'Negócio' },
    { tela: 'cardapio_ia',      href: '/painel/cardapio-ia.html',     icone: 'ph ph-sparkle',        label: 'IA para Cardápio',     secao: 'Negócio' },
    { tela: 'tickets',          href: '/painel/tickets.html',         icone: 'ph ph-headset',        label: 'Atendimento',          secao: 'Suporte' },
    { tela: 'financeiro',       href: '/painel/financeiro.html',      icone: 'ph ph-credit-card',    label: 'Financeiro',           secao: 'Conta' },
  ];

  const ORDEM_SECOES = ['Principal', 'Operação', 'Negócio', 'Suporte', 'Conta'];

  // 1. INJEÇÃO DA SIDEBAR
  if (sidebarEl) {
    const visiveis = typeof temPermissao === 'function' ? TELAS.filter(t => temPermissao(t.tela)) : TELAS;
    let secoesHTML = '';
    
    for (const secao of ORDEM_SECOES) {
      const itens = visiveis.filter(t => t.secao === secao);
      if (!itens.length) continue;
      
      const links = itens.map(t => {
        const isActive = (window.location.pathname === t.href || (t.href === '/painel/' && window.location.pathname === '/painel/index.html'));
        return `<a href="${t.href}" class="nav-item ${isActive ? 'active' : ''}">
          <i class="${t.icone} i-md"></i>
          <span>${t.label}</span>
        </a>`;
      }).join('');

      if (secao !== 'Principal') {
        secoesHTML += `<div class="nav-group"><span class="nav-label">${secao}</span>${links}</div>`;
      } else {
        secoesHTML += links; // Itens principais sem group label
      }
    }

    const iniciais = JSON.parse(localStorage.getItem('fantoni_usuario'))?.nome?.charAt(0) || '?';
    const nome = JSON.parse(localStorage.getItem('fantoni_usuario'))?.nome?.split(' ')[0] || 'Usuário';

    sidebarEl.innerHTML = `
      <div class="sidebar-logo p-8 mb-4">
        <img src="/assets/logo.png" alt="Fantoni" class="h-10 mb-2">
        <div>
          <h2 class="text-white text-lg">Central do <span class="text-primaria">Negócio</span></h2>
          <p class="text-[10px] text-suave uppercase tracking-widest opacity-50">Portal do Cliente</p>
        </div>
      </div>
      <nav class="sidebar-nav px-4">
        ${secoesHTML}
      </nav>
      <div class="sidebar-footer p-6 mt-auto">
        <div class="user-info bg-white/5 p-4 rounded-xl border border-white/10 mb-4 transition-all hover:bg-white/10">
          <div class="user-avatar bg-primaria text-white w-10 h-10 flex items-center justify-center rounded-lg fw-700 shadow-lg shadow-primaria/20">${iniciais}</div>
          <div class="user-details ml-3">
            <span class="user-name text-sm text-white fw-600">${nome}</span>
            <span class="user-role text-[10px] uppercase text-suave tracking-wider">Cliente VIP</span>
          </div>
        </div>
        <button class="btn btn-outline btn-sm w-full gap-2 hover:bg-erro/10 hover:text-erro hover:border-erro/30" id="btn-logout-sidebar">
          <i class="ph ph-sign-out"></i> Encerrar Sessão
        </button>
      </div>
    `;

    document.getElementById('btn-logout-sidebar')?.addEventListener('click', () => {
      if (typeof fazerLogout === 'function') fazerLogout();
      else { localStorage.removeItem('fantoni_token'); window.location.href = '/'; }
    });
  }

  // 2. HEADER DA PÁGINA
  const topHeader = document.querySelector('.app-header');
  if (topHeader) {
    const pagina = TELAS.find(t => t.href === window.location.pathname) || { label: 'Dashboard' };
    topHeader.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px">
        <button class="mobile-toggle" id="mobile-toggle-btn">
          <i class="ph ph-list"></i>
        </button>
        <div class="page-title">
          <h1>${pagina.label}</h1>
        </div>
      </div>
      <div class="header-actions">
        <!-- Espaço para notificações ou outras ações -->
      </div>
    `;

    document.getElementById('mobile-toggle-btn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('active');
    });
  }
})();
