// Helper para requisições autenticadas à API
const API_BASE = '/api';

async function apiFetch(endpoint, opcoes = {}) {
  const token = localStorage.getItem('cn_token');
  const headers = { 'Content-Type': 'application/json', ...opcoes.headers };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const resposta = await fetch(`${API_BASE}${endpoint}`, { ...opcoes, headers });

    // Token expirado — tenta renovar
    if (resposta.status === 401) {
      const renovado = await renovarToken();
      if (renovado) {
        headers['Authorization'] = `Bearer ${localStorage.getItem('cn_token')}`;
        const nova = await fetch(`${API_BASE}${endpoint}`, { ...opcoes, headers });
        return processarResposta(nova);
      }
      // Sem token válido → redireciona para login
      localStorage.clear();
      window.location.href = '/';
      return;
    }

    return processarResposta(resposta);
  } catch (err) {
    console.error(`Erro na requisição ${endpoint}:`, err);
    throw new Error('Erro de conexão com o servidor');
  }
}

async function processarResposta(resposta) {
  const texto = await resposta.text();
  try {
    const json = JSON.parse(texto);
    if (!resposta.ok) throw { status: resposta.status, ...json };
    return json;
  } catch (e) {
    if (!resposta.ok) throw new Error(`Erro ${resposta.status}`);
    return texto;
  }
}

async function renovarToken() {
  const refreshToken = localStorage.getItem('cn_refresh_token');
  if (!refreshToken) return false;

  try {
    const resp = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!resp.ok) return false;
    const dados = await resp.json();
    localStorage.setItem('cn_token', dados.token);
    localStorage.setItem('cn_refresh_token', dados.refresh_token);
    return true;
  } catch { return false; }
}

// Atalhos de métodos HTTP
const api = {
  get:    (url, opcoes = {}) => apiFetch(url, { method: 'GET', ...opcoes }),
  post:   (url, corpo, opcoes = {}) => apiFetch(url, { method: 'POST', body: JSON.stringify(corpo), ...opcoes }),
  put:    (url, corpo, opcoes = {}) => apiFetch(url, { method: 'PUT', body: JSON.stringify(corpo), ...opcoes }),
  patch:  (url, corpo, opcoes = {}) => apiFetch(url, { method: 'PATCH', body: JSON.stringify(corpo), ...opcoes }),
  delete: (url, opcoes = {}) => apiFetch(url, { method: 'DELETE', ...opcoes }),

  // Upload de arquivo (sem Content-Type — deixa o browser definir)
  upload: (url, formData) => {
    const token = localStorage.getItem('cn_token');
    return fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    }).then(processarResposta);
  }
};

// Usuário logado (cache local)
function getUsuario() {
  try { return JSON.parse(localStorage.getItem('cn_usuario')); }
  catch { return null; }
}

function getToken() { return localStorage.getItem('cn_token'); }

// Exibe alerta temporário na tela
function mostrarAlerta(mensagem, tipo = 'sucesso', duracao = 3000) {
  const el = document.createElement('div');
  el.className = `alerta alerta-${tipo}`;
  el.textContent = mensagem;
  el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;min-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.15);';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duracao);
}

// Formata moeda em BRL
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

// Formata data
function formatarData(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(iso));
}
