// Clientes Supabase com inicialização lazy (evita crash no startup se env vars não estiverem prontas)
const { createClient } = require('@supabase/supabase-js');

function criarClienteLazy(chaveUrl, chaveKey) {
  let cliente = null;
  return new Proxy({}, {
    get(_, prop) {
      if (!cliente) {
        const url = process.env[chaveUrl];
        const key = process.env[chaveKey];
        if (!url || !key) {
          throw new Error(`Variável de ambiente não configurada: ${chaveUrl} ou ${chaveKey}`);
        }
        cliente = createClient(url, key);
      }
      const valor = cliente[prop];
      return typeof valor === 'function' ? valor.bind(cliente) : valor;
    }
  });
}

const supabase = criarClienteLazy('SUPABASE_URL', 'SUPABASE_ANON_KEY');
const supabaseAdmin = criarClienteLazy('SUPABASE_URL', 'SUPABASE_SERVICE_KEY');

module.exports = { supabase, supabaseAdmin };
