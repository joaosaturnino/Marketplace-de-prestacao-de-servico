# Sistema de Prestacao de Servicos

Aplicacao full-stack para cadastro de clientes, prestadores de servico, oferta de servicos, solicitacoes, planos comerciais e gestao financeira administrativa.

## Modulos principais

- Cliente: busca de servicos, solicitacoes, cancelamento controlado e acompanhamento de pagamentos.
- Cliente: planos gratuitos/pagos, limite mensal de solicitacoes e historico de pagamentos.
- Cliente: avaliacao de servicos concluidos, com nota e comentario.
- Cliente e prestador: conversa por solicitacao para combinar detalhes do atendimento.
- Prestador: cadastro e edicao de servicos, agenda, financeiro proprio, taxas, valores a receber, conta de saque e retirada de saldo.
- Prestador: painel de reputacao com media de notas e comentarios recebidos.
- Administrador: visao geral, conciliacao financeira, repasses, operacao, gestao de usuarios, saques e gestao de planos.
- Administrador: gestao de categorias do catalogo e indicadores de qualidade da plataforma.
- Planos: mensalidade, publico do plano, taxa por contratacao, limite de servicos, limite de solicitacoes, suporte e assinatura ativa.
- Pagamentos: PIX com codigo/QR, cartao de credito, cartao de debito e dinheiro pago diretamente ao prestador.
- Saques: prestador cadastra chave PIX ou conta bancaria e solicita retirada do saldo disponivel.
- Gestao de saques: administrador acompanha dados de recebimento, marca saques como processando, pagos ou recusados; saques recusados retornam ao saldo do prestador.
- Taxa no dinheiro: quando o cliente paga em dinheiro, a taxa da plataforma e descontada do saldo do prestador ou fica pendente para o proximo repasse.
- Liberacao de repasse: PIX e cartao liberam o atendimento apos confirmacao de pagamento, mas o valor liquido so entra no saldo de saque do prestador quando o servico e marcado como concluido.
- Estorno operacional: cancelamentos antes da conclusao bloqueiam repasse e registram estorno quando o pagamento online ja estava confirmado.
- Governanca: bloqueio/desbloqueio de contas e verificacao de prestadores pelo administrador.

> Ambiente de testes: PIX e cartao estao simulados dentro do proprio sistema. Para producao, conecte um gateway de pagamento ou PSP homologado para gerar QR Code real, tokenizar cartoes, receber webhooks e conciliar pagamentos automaticamente.

## Tecnologias

- React + Vite no frontend
- Node.js + Express no backend
- MySQL como banco de dados
- JWT para autenticacao

## Como executar

1. Instale as dependencias:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
copy server\.env.example server\.env
```

3. Ajuste as credenciais do MySQL em `server/.env`.

4. Crie o banco e as tabelas:

```bash
npm run db:init
```

5. Rode o sistema:

```bash
npm run dev
```

Frontend: `http://localhost:4173`

Backend: `http://localhost:3333`

O comando acima compila o React e abre o preview do Vite, que e mais estavel em pastas sincronizadas pelo OneDrive. Para usar o servidor Vite com hot reload durante desenvolvimento:

```bash
npm run dev:vite --workspace client
```

Para servir o frontend manualmente apos o build:

```bash
npm run preview --workspace client
```

## Banco de dados

O script `npm run db:init` usa os valores abaixo em `server/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=prestacao_servicos
```

Caso o MySQL recuse o acesso, ajuste `DB_USER` e `DB_PASSWORD` para um usuario com permissao de criar banco e tabelas.

## Usuarios de teste

Apos `npm run db:init`, estes usuarios ficam disponiveis:

- Admin: `admin@servicos.local` / `admin123`
- Cliente: `cliente@servicos.local` / `cliente123`
- Prestador: `prestador@servicos.local` / `prestador123`

O cliente de teste inicia no plano Cliente Gratuito e o prestador de teste inicia no plano Profissional para demonstrar limites, taxas, pagamentos e receita recorrente no painel administrativo.

## App mobile com Expo Go

A versao mobile fica na pasta `mobile` e usa a mesma API Node/MySQL do sistema web.

1. Instale as dependencias, incluindo o workspace mobile:

```bash
npm install
```

2. Descubra o IP local do computador na mesma rede do celular:

```bash
ipconfig
```

Use o IPv4 da sua rede Wi-Fi. Exemplo: `192.168.1.25`.

3. Inicie a API:

```bash
npm run start --workspace server
```

4. Em outro terminal, rode o Expo apontando para a API do computador:

```powershell
$env:EXPO_PUBLIC_WEB_URL="http://SEU_IP_LOCAL:4173"
npm run mobile
```

5. Abra o aplicativo Expo Go no celular e escaneie o QR Code exibido no terminal.

No celular fisico, `localhost` nao funciona porque aponta para o proprio celular; use o IP do computador. A versao mobile abre a propria interface web responsiva dentro do Expo Go, entao ela fica fiel ao sistema web.

Observacao: o script mobile usa a porta `8082` para evitar conflito com outros processos que costumam ocupar a `8081`. Se quiser trocar, edite `mobile/package.json` no script `start`.

