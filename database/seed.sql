USE prestacao_servicos;

INSERT IGNORE INTO users (id, name, email, password_hash, role, status) VALUES
  (1, 'Administrador', 'admin@servicos.local', '$2a$10$5syVCEBTcwN5MjXqsUFB0eiIO6qPiJvSOgFZNOmPzZ/9SUz1NHk1y', 'ADMIN', 'ATIVO'),
  (2, 'Cliente Exemplo', 'cliente@servicos.local', '$2a$10$lMkjiJxCrooq3PYrwXv/qOGKqW243NMX3vSW.l1JRJQ3iS0hrW.Yy', 'CLIENTE', 'ATIVO'),
  (3, 'Prestador Exemplo', 'prestador@servicos.local', '$2a$10$51Ul6lEQzSPVikt8Ho2pTOqeFcSRmxpBXJUeGMyOlfTN8MKE0tS0.', 'PRESTADOR', 'ATIVO');

INSERT IGNORE INTO client_profiles (user_id, phone, city, state, address) VALUES
  (2, '(11) 99999-0000', 'Sao Paulo', 'SP', 'Rua das Flores, 100');

INSERT IGNORE INTO provider_profiles (user_id, phone, document, city, state, bio, rating, is_verified) VALUES
  (3, '(11) 98888-0000', '12345678901', 'Sao Paulo', 'SP', 'Atendimento profissional com foco em qualidade e pontualidade.', 4.8, TRUE);

INSERT IGNORE INTO plans (id, name, description, target_role, monthly_price, commission_rate, max_services, max_requests_per_month, support_level, is_active) VALUES
  (1, 'Essencial', 'Para prestadores que estao comecando e querem validar seus primeiros atendimentos.', 'PRESTADOR', 29.90, 15.00, 3, NULL, 'Suporte por email', TRUE),
  (2, 'Profissional', 'Plano recomendado para profissionais com agenda recorrente e maior exposicao na plataforma.', 'PRESTADOR', 79.90, 12.00, 15, NULL, 'Suporte prioritario', TRUE),
  (3, 'Premium', 'Para equipes e prestadores com alto volume, com menor taxa e limite ampliado.', 'PRESTADOR', 149.90, 8.00, 50, NULL, 'Atendimento consultivo', TRUE),
  (4, 'Gratuito Prestador', 'Plano gratuito para comecar a vender com limite reduzido e taxa maior por contratacao.', 'PRESTADOR', 0.00, 18.00, 1, NULL, 'Central de ajuda', TRUE),
  (5, 'Cliente Gratuito', 'Plano gratuito para contratar servicos essenciais pela plataforma.', 'CLIENTE', 0.00, 0.00, NULL, 3, 'Central de ajuda', TRUE),
  (6, 'Cliente Plus', 'Plano para clientes recorrentes com mais solicitacoes mensais e prioridade no suporte.', 'CLIENTE', 19.90, 0.00, NULL, 20, 'Suporte prioritario', TRUE),
  (7, 'Cliente Premium', 'Plano para clientes que contratam com frequencia e querem limite ampliado.', 'CLIENTE', 49.90, 0.00, NULL, NULL, 'Atendimento consultivo', TRUE);

INSERT IGNORE INTO provider_subscriptions (id, provider_id, plan_id, status, starts_at, ends_at) VALUES
  (1, 3, 2, 'ATIVA', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY));

INSERT IGNORE INTO client_subscriptions (id, client_id, plan_id, status, starts_at, ends_at) VALUES
  (1, 2, 5, 'ATIVA', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY));

INSERT IGNORE INTO provider_balances (provider_id, available_amount, pending_fee_amount) VALUES
  (3, 0.00, 0.00);

INSERT IGNORE INTO provider_payout_accounts (provider_id, payout_method, pix_key, holder_name, document) VALUES
  (3, 'PIX', 'prestador@servicos.local', 'Prestador Exemplo', '12345678901');

INSERT IGNORE INTO services (id, provider_id, category_id, title, description, price, duration_minutes, status) VALUES
  (1, 3, 1, 'Limpeza residencial completa', 'Limpeza geral de apartamento ou casa, incluindo cozinha, banheiros e areas comuns.', 180.00, 240, 'ATIVO'),
  (2, 3, 5, 'Configuracao de internet e dispositivos', 'Instalacao e configuracao de roteadores, impressoras, smart TVs e aplicativos.', 120.00, 90, 'ATIVO');
