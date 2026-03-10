// Serviço de integração com a API Asaas
const axios = require('axios');

const BASE_URL = process.env.ASAAS_ENVIRONMENT === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

const headers = {
  'access_token': process.env.ASAAS_API_KEY,
  'Content-Type': 'application/json'
};

// Cria uma cobrança no Asaas
async function criarCobranca({ customer, billingType, value, dueDate, description }) {
  try {
    const { data } = await axios.post(`${BASE_URL}/payments`, {
      customer, billingType, value, dueDate, description
    }, { headers });
    return data;
  } catch (err) {
    console.error('Asaas criarCobranca:', err.response?.data || err.message);
    throw new Error(err.response?.data?.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas');
  }
}

// Lista cobranças (com filtros opcionais)
async function listarCobrancas(filtros = {}) {
  try {
    const { data } = await axios.get(`${BASE_URL}/payments`, { headers, params: filtros });
    return data;
  } catch (err) {
    console.error('Asaas listarCobrancas:', err.response?.data || err.message);
    throw new Error('Erro ao buscar cobranças no Asaas');
  }
}

// Busca uma cobrança pelo ID
async function buscarCobranca(id) {
  try {
    const { data } = await axios.get(`${BASE_URL}/payments/${id}`, { headers });
    return data;
  } catch (err) {
    throw new Error('Cobrança não encontrada no Asaas');
  }
}

// Confirma pagamento manual (dar baixa)
async function darBaixa(id, { paymentDate, value }) {
  try {
    const { data } = await axios.post(`${BASE_URL}/payments/${id}/receiveInCash`, {
      paymentDate, value
    }, { headers });
    return data;
  } catch (err) {
    console.error('Asaas darBaixa:', err.response?.data || err.message);
    throw new Error('Erro ao dar baixa no Asaas');
  }
}

// Busca ou cria cliente no Asaas
async function buscarOuCriarCliente({ nome, cpfCnpj, email, mobilePhone }) {
  try {
    // Tenta buscar por email
    const { data: lista } = await axios.get(`${BASE_URL}/customers`, {
      headers, params: { email }
    });

    if (lista.data && lista.data.length > 0) return lista.data[0];

    // Cria novo cliente
    const { data } = await axios.post(`${BASE_URL}/customers`, {
      name: nome, cpfCnpj, email, mobilePhone
    }, { headers });
    return data;
  } catch (err) {
    console.error('Asaas buscarOuCriarCliente:', err.response?.data || err.message);
    throw new Error('Erro ao buscar/criar cliente no Asaas');
  }
}

module.exports = { criarCobranca, listarCobrancas, buscarCobranca, darBaixa, buscarOuCriarCliente };
