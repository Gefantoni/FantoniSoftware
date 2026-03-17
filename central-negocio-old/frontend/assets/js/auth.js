// Lógica de autenticação do frontend
async function fazerLogin(email, senha) {
  const dados = await api.post('/auth/login', { email, senha });
  localStorage.setItem('cn_token', dados.token);
  localStorage.setItem('cn_refresh_token', dados.refresh_token);
  localStorage.setItem('cn_usuario', JSON.stringify(dados.usuario));
  return dados.usuario;
}

function fazerLogout() {
  api.post('/auth/logout').catch(() => { });
  localStorage.clear();
  window.location.href = '/';
}

// Verifica se está logado e redireciona se não estiver
function protegerPagina(rolesPermitidas = []) {
  const usuario = getUsuario();
  if (!usuario || !getToken()) {
    window.location.href = '/';
    return null;
  }
  if (rolesPermitidas.length > 0 && !rolesPermitidas.includes(usuario.role)) {
    const destino = usuario.role === 'cliente' ? '/painel/' : '/admin/';
    window.location.href = destino;
    return null;
  }
  return usuario;
}

// Cria overlay para fechar sidebar no mobile
function criarOverlay() {
  if (document.getElementById('sidebar-overlay')) return;
  const el = document.createElement('div');
  el.id = 'sidebar-overlay';
  el.style.cssText = `position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99;display:none;`;
  document.body.appendChild(el);
  return el;
}

// Inicializa o layout (sidebar, topbar) com dados do usuário
function inicializarLayout() {
  const usuario = getUsuario();
  if (!usuario) return;

  const elNome = document.getElementById('usuario-nome');
  const elRole = document.getElementById('usuario-role');
  if (elNome) elNome.textContent = usuario.nome || usuario.email;
  if (elRole) elRole.textContent = mapearRole(usuario.role);

  // Avatar inicial
  const avatar = document.getElementById('s-avatar');
  if (avatar) avatar.textContent = (usuario.nome || usuario.email).charAt(0).toUpperCase();

  // Marca item ativo na sidebar (suporte às duas classes)
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item, .nav-link').forEach(item => {
    const href = item.getAttribute('href');
    if (href && (href === path || (path.endsWith('/') && href === path) || path === href)) {
      item.classList.add('ativo');
      item.classList.add('active');
    }
  });

  // Botão de logout
  document.querySelectorAll('.btn-logout, .btn-sair').forEach(btn => {
    btn.addEventListener('click', fazerLogout);
  });

  // Toggle sidebar mobile — suporta .sidebar e .app-sidebar
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar') || document.querySelector('.app-sidebar');
  const overlay = criarOverlay();

  const fecharSidebar = () => {
    sidebar?.classList.remove('aberta', 'open');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  };

  const abrirSidebar = () => {
    sidebar?.classList.add('aberta', 'open');
    if (overlay) {
      overlay.style.display = 'block';
      // z-index 150: acima do conteúdo (z-index < 100), abaixo da sidebar (z-index: 200)
      overlay.style.zIndex = '150';
    }
    document.body.style.overflow = 'hidden';
  };

  if (toggle && sidebar) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const estaAberta = sidebar.classList.contains('aberta') || sidebar.classList.contains('open');
      estaAberta ? fecharSidebar() : abrirSidebar();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', fecharSidebar);
  }

  // Fecha ao clicar em link da sidebar (mobile UX)
  if (sidebar) {
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 900) fecharSidebar();
      });
    });
  }
}

function mapearRole(role) {
  const mapa = { cliente: 'Cliente', admin: 'Administrador', suporte: 'Suporte', financeiro: 'Financeiro', comercial: 'Comercial' };
  return mapa[role] || role;
}

// Verifica se o usuário cliente tem permissão para acessar uma tela específica
// Telas: 'videoaulas', 'agente_ia', 'cardapio_ia', 'financeiro', 'tickets', 'empreendedorismo'
// Se permissoes_telas for null/undefined (ex: usuário admin), retorna true por padrão
function temPermissao(tela) {
  const usuario = getUsuario();
  if (!usuario) return false;
  if (usuario.role !== 'cliente') return true; // admins/equipe sempre têm acesso
  if (!usuario.permissoes_telas) return true;  // sem restrições configuradas = tudo liberado
  return usuario.permissoes_telas[tela] !== false;
}

// Redireciona para o dashboard se não tiver permissão para a tela atual
function verificarPermissaoTela(tela) {
  if (!temPermissao(tela)) {
    window.location.href = '/painel/';
    return false;
  }
  return true;
}
