# Sistema corrigido

Principais alteracoes aplicadas:

- Persistencia da tela ativa por perfil usando localStorage (`activeView:CLIENTE`, `activeView:PRESTADOR`, `activeView:ADMIN`).
- Separacao visual e logica entre plano ativo, plano apenas selecionado e plano com boleto pendente.
- Assinaturas vencidas (`ends_at <= NOW()`) deixam de ser tratadas como ativas.
- Consultas de limite de plano para cliente/prestador passam a considerar a validade da assinatura.
- Sessao expirada (HTTP 401) encerra a sessao no frontend imediatamente.
- Leitura da API mais robusta para JSON, texto e respostas 204.
- Remocao de credenciais reais/default sensiveis do codigo de configuracao.
- `JWT_SECRET` passa a ser obrigatorio em producao.
- Pool MySQL com keep-alive, configuracao de tamanho por ambiente e decimalNumbers.
- Health check valida tambem a conexao com o banco.
- Limite de payload JSON e headers basicos de seguranca.
- Normalizacao de email/nome e validacao minima de senha no cadastro.
- Limite de tamanho para mensagens.
- `index.html` ajustado para apontar para `/src/main.jsx` em projeto Vite, em vez de assets de build com hash.

## Estrutura

- `frontend/src`: App.jsx, api.js, main.jsx, styles.css
- `backend/src/routes`: rotas da API
- `backend/src/middleware`: autenticacao/autorizacao
- `backend/src/services`: financeiro
- `backend/.env.example`: exemplo de configuracao sem segredos

Antes de iniciar o backend, copie `.env.example` para `.env` e preencha as credenciais corretas.


## Correcao adicional: plano Premium indevido
O backend agora cancela automaticamente plano pago ativo sem cobranca PAGA, cancela boletos vencidos e elimina duplicidade de assinaturas ativas. Para sanear dados antigos de uma vez, execute `backend/corrigir_planos_clientes.sql`.
