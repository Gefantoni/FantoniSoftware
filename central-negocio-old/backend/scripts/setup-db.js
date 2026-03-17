// Script de configuração do banco — roda uma vez
require('dotenv').config();
const axios = require('axios');

const REF   = 'xkeqoljarybjgekcwmfw';
const TOKEN = 'sbp_158630cffdf639c6ca7ce581b6034be5aa815d70';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function sql(query) {
  try {
    const { data } = await axios.post(
      `https://api.supabase.com/v1/projects/${REF}/database/query`,
      { query },
      { headers }
    );
    return data;
  } catch (e) {
    throw new Error(JSON.stringify(e.response?.data || e.message));
  }
}

async function criarUsuario(supabase, email, senha) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true
  });
  if (error) {
    if (error.message.includes('already') || error.message.includes('registered')) {
      const { data: lista } = await supabase.auth.admin.listUsers();
      return lista?.users?.find(u => u.email === email)?.id;
    }
    throw new Error(error.message);
  }
  return data.user.id;
}

async function main() {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // 1. Substitui a função do trigger por uma versão que não falha
  console.log('1. Neutralizando trigger temporariamente...');
  await sql(`
    CREATE OR REPLACE FUNCTION public.criar_perfil_usuario()
    RETURNS TRIGGER AS $$
    BEGIN
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  console.log('   OK');

  // 2. Cria usuários
  console.log('2. Criando usuário admin...');
  const adminId = await criarUsuario(supabase, 'admin@central.com', 'Admin@123');
  console.log('   ID:', adminId);

  console.log('3. Criando usuário cliente de teste...');
  const clienteId = await criarUsuario(supabase, 'cliente@teste.com', 'Cliente@123');
  console.log('   ID:', clienteId);

  // 3. Restaura a função do trigger correta com grants
  console.log('4. Restaurando trigger com permissões corretas...');
  await sql(`
    CREATE OR REPLACE FUNCTION public.criar_perfil_usuario()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.perfis (id, nome, email)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email)
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT INSERT ON public.perfis TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.criar_perfil_usuario() TO supabase_auth_admin;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
  `);
  console.log('   OK');

  // 4. Insere perfis via SQL direto
  console.log('5. Inserindo perfis...');
  await sql(`
    INSERT INTO public.perfis (id, nome, email, plano, role, ativo)
    VALUES
      ('${adminId}', 'Administrador', 'admin@central.com', 'premium', 'admin', true),
      ('${clienteId}', 'Cliente Teste', 'cliente@teste.com', 'profissional', 'cliente', true)
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      plano = EXCLUDED.plano,
      nome = EXCLUDED.nome,
      ativo = true;
  `);
  console.log('   Perfis inseridos!');

  // 5. Testa login admin
  console.log('6. Testando login admin...');
  const r1 = await axios.post('http://localhost:3000/api/auth/login', { email: 'admin@central.com', senha: 'Admin@123' });
  console.log('   OK! Role:', r1.data.usuario.role);

  // 6. Testa login cliente
  console.log('7. Testando login cliente...');
  const r2 = await axios.post('http://localhost:3000/api/auth/login', { email: 'cliente@teste.com', senha: 'Cliente@123' });
  console.log('   OK! Role:', r2.data.usuario.role);

  console.log('\n✅ Setup concluído com sucesso!');
  console.log('─────────────────────────────────────────');
  console.log('  Admin:   admin@central.com   / Admin@123');
  console.log('  Cliente: cliente@teste.com   / Cliente@123');
  console.log('  URL:     http://localhost:3000');
  console.log('─────────────────────────────────────────');
}

main().catch(e => {
  console.error('\n❌ Erro:', e.message);
  process.exit(1);
});
