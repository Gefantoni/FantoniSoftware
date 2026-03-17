require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkInstances() {
  const { data, error } = await supabase
    .from('instancias_whatsapp')
    .select('*');
    
  if (error) {
    console.error('Error fetching instances:', error);
    return;
  }
  
  console.log('Instances found:', JSON.stringify(data, null, 2));
}

checkInstances();
