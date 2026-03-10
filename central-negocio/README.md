# Central do Negócio

Plataforma SaaS completa para empresas de software PDV.

## Como rodar

### 1. Instalar dependências
```bash
cd backend
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### 3. Configurar o banco de dados
- Acesse o painel do Supabase → SQL Editor
- Execute o arquivo `database/schema.sql` completo

### 4. Iniciar o servidor
```bash
# Desenvolvimento (com hot-reload)
npm run dev

# Produção
npm start
```

O servidor sobe em `http://localhost:3000`

## Estrutura de rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/login | Login |
| GET | /api/auth/perfil | Perfil do usuário logado |
| GET | /api/clientes | Lista clientes (admin) |
| POST | /api/clientes | Cadastra cliente (admin) |
| GET | /api/videoaulas/modulos | Módulos acessíveis pelo plano |
| POST | /api/videoaulas/progresso | Salva progresso |
| POST | /api/agente-ia/perguntar | Pergunta ao agente IA |
| GET | /api/tickets | Lista tickets |
| POST | /api/tickets | Abre novo ticket |
| PATCH | /api/tickets/:id/aceitar | Aceita ticket (admin) |
| GET | /api/financeiro-cliente | Histórico financeiro do cliente |
| GET | /api/financeiro-admin/dashboard | Dashboard financeiro (admin) |
| POST | /api/asaas/cobranca | Cria cobrança no Asaas |
| POST | /api/asaas/webhook | Webhook Asaas |
| POST | /api/whatsapp/disparar | Disparo em massa |
| POST | /api/whatsapp/webhook | Webhook EvolutionAPI |
| GET | /api/comercial/leads | Lista leads |

## Roles de acesso

- `cliente` → Acessa: dashboard, videoaulas, agente IA, tickets, financeiro pessoal
- `suporte` → Acessa: tickets + chat
- `financeiro` → Acessa: financeiro da empresa + Asaas
- `comercial` → Acessa: comercial + Chatwoot + disparos + leads
- `admin` → Acesso total

## Serviços externos necessários

- **Supabase**: banco de dados, auth e realtime
- **OpenAI**: agente IA (GPT-4o-mini)
- **EvolutionAPI**: WhatsApp
- **Chatwoot**: CRM de atendimento comercial
- **Asaas**: cobranças e pagamentos
