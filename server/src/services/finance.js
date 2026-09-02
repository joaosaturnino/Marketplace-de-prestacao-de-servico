export function generatePixPayload({ requestId, amount, payerName }) {
  const code = `PIX-${String(requestId).padStart(6, '0')}-${Date.now().toString().slice(-6)}`;
  const payload = [
    '000201',
    '26580014BR.GOV.BCB.PIX',
    `520400005303986540${Number(amount).toFixed(2)}`,
    '5802BR',
    `5913SERVICOSPRO`,
    `6009SAO PAULO`,
    `62170513${code}`,
    `6304${String(payerName || 'CLIENTE').slice(0, 4).toUpperCase()}`
  ].join('');

  return { code, payload };
}

export function getCardSummary(card = {}) {
  const digits = String(card.number || '').replace(/\D/g, '');
  const firstDigit = digits[0];
  const brands = {
    3: 'Amex',
    4: 'Visa',
    5: 'Mastercard',
    6: 'Elo'
  };

  return {
    brand: brands[firstDigit] || 'Cartao',
    last4: digits.slice(-4)
  };
}

export async function ensureProviderBalance(connection, providerId) {
  await connection.execute(
    'INSERT IGNORE INTO provider_balances (provider_id, available_amount, pending_fee_amount) VALUES (?, 0, 0)',
    [providerId]
  );
}

export async function applySystemPayment(connection, request) {
  await ensureProviderBalance(connection, request.provider_id);

  const [existingEntries] = await connection.execute(
    "SELECT id FROM financial_transactions WHERE request_id = ? AND type = 'ENTRADA' LIMIT 1",
    [request.id]
  );

  if (existingEntries[0]) {
    return;
  }

  await connection.execute(
    `INSERT INTO financial_transactions (request_id, provider_id, type, amount, description)
    VALUES
      (?, ?, 'ENTRADA', ?, 'Pagamento recebido pelo sistema'),
      (?, ?, 'TAXA_PLATAFORMA', ?, 'Taxa da plataforma')`,
    [
      request.id,
      request.provider_id,
      request.total_amount,
      request.id,
      request.provider_id,
      request.platform_fee
    ]
  );
}

export async function releaseProviderPayout(connection, request) {
  if (request.payment_status !== 'PAGO' || request.payment_method === 'DINHEIRO') {
    return false;
  }

  const [existingPayouts] = await connection.execute(
    "SELECT id FROM financial_transactions WHERE request_id = ? AND type = 'REPASSE_PRESTADOR' LIMIT 1",
    [request.id]
  );

  if (existingPayouts[0]) {
    return false;
  }

  await ensureProviderBalance(connection, request.provider_id);

  await connection.execute(
    `UPDATE provider_balances
    SET available_amount = available_amount + ?
    WHERE provider_id = ?`,
    [request.provider_amount, request.provider_id]
  );

  await connection.execute(
    `INSERT INTO financial_transactions (request_id, provider_id, type, amount, description)
    VALUES (?, ?, 'REPASSE_PRESTADOR', ?, 'Servico finalizado. Valor liquido liberado para saque')`,
    [request.id, request.provider_id, request.provider_amount]
  );

  await settlePendingFees(connection, request.provider_id, request.id);
  return true;
}

export async function applyCashPaymentFee(connection, request) {
  await ensureProviderBalance(connection, request.provider_id);

  const [balances] = await connection.execute(
    'SELECT available_amount, pending_fee_amount FROM provider_balances WHERE provider_id = ? FOR UPDATE',
    [request.provider_id]
  );
  const balance = balances[0];
  const available = Number(balance.available_amount || 0);
  const fee = Number(request.platform_fee || 0);
  const deducted = Number(Math.min(available, fee).toFixed(2));
  const pending = Number((fee - deducted).toFixed(2));

  await connection.execute(
    `UPDATE provider_balances
    SET available_amount = available_amount - ?, pending_fee_amount = pending_fee_amount + ?
    WHERE provider_id = ?`,
    [deducted, pending, request.provider_id]
  );

  if (deducted > 0) {
    await connection.execute(
      `INSERT INTO financial_transactions (request_id, provider_id, type, amount, description)
      VALUES (?, ?, 'TAXA_DINHEIRO_COBRADA', ?, 'Taxa de pagamento em dinheiro descontada do saldo disponivel')`,
      [request.id, request.provider_id, deducted]
    );
  }

  if (pending > 0) {
    await connection.execute(
      `INSERT INTO financial_transactions (request_id, provider_id, type, amount, description)
      VALUES (?, ?, 'TAXA_DINHEIRO_PENDENTE', ?, 'Taxa de pagamento em dinheiro pendente para proximo repasse')`,
      [request.id, request.provider_id, pending]
    );
  }

  return pending > 0 ? 'PENDENTE' : 'DESCONTADA';
}

export async function settlePendingFees(connection, providerId, requestId = null) {
  await ensureProviderBalance(connection, providerId);

  const [balances] = await connection.execute(
    'SELECT available_amount, pending_fee_amount FROM provider_balances WHERE provider_id = ? FOR UPDATE',
    [providerId]
  );
  const balance = balances[0];
  const available = Number(balance.available_amount || 0);
  const pendingFee = Number(balance.pending_fee_amount || 0);
  const deducted = Number(Math.min(available, pendingFee).toFixed(2));

  if (deducted <= 0) {
    return 0;
  }

  await connection.execute(
    `UPDATE provider_balances
    SET available_amount = available_amount - ?, pending_fee_amount = pending_fee_amount - ?
    WHERE provider_id = ?`,
    [deducted, deducted, providerId]
  );

  await connection.execute(
    `INSERT INTO financial_transactions (request_id, provider_id, type, amount, description)
    VALUES (?, ?, 'TAXA_DINHEIRO_COMPENSADA', ?, 'Taxa pendente compensada automaticamente no saldo do prestador')`,
    [requestId, providerId, deducted]
  );

  return deducted;
}
