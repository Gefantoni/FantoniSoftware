// Clientes Supabase — um com anon key (para auth) e outro com service key (admin)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Cliente padrão (anon key) — usado para operações com RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Cliente admin (service key) — bypassa RLS, use com cuidado
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = { supabase, supabaseAdmin };
