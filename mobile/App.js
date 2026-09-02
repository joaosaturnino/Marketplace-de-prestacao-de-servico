import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, API_URL } from './src/api';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const roles = { CLIENTE: 'Cliente', PRESTADOR: 'Prestador', ADMIN: 'Admin' };
const tabs = { CLIENTE: ['Servicos', 'Pedidos', 'Pagamentos', 'Planos'], PRESTADOR: ['Servicos', 'Pedidos', 'Financeiro', 'Saques', 'Planos'], ADMIN: ['Resumo', 'Operacao', 'Financeiro', 'Saques'] };
const initialData = { services: [], categories: [], requests: [], plans: { plans: [], subscription: null, usage: {} }, payout: { account: null, balance: {}, withdrawals: [] }, admin: { overview: null, requests: [], transactions: [], withdrawals: [] } };

export default function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('Servicos');
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [requestModal, setRequestModal] = useState(null);
  const [chat, setChat] = useState(null);

  useEffect(() => {
    if (session) {
      setTab(tabs[session.user.role][0]);
      load(session).catch(showError);
    }
  }, [session?.user?.role]);

  function showError(error) {
    setToast(error.message || 'Nao foi possivel concluir a acao.');
  }

  async function load(currentSession = session) {
    if (!currentSession) return;
    setLoading(true);
    try {
      const token = currentSession.token;
      if (currentSession.user.role === 'CLIENTE') {
        const [services, categories, requests, plans] = await Promise.all([api('/services', token), api('/categories', token), api('/requests/mine', token), api('/plans/mine', token)]);
        setData((old) => ({ ...old, services, categories, requests: unique(requests), plans }));
      }
      if (currentSession.user.role === 'PRESTADOR') {
        const [categories, services, requests, plans, payout] = await Promise.all([api('/categories', token), api('/services/mine', token), api('/requests/mine', token), api('/plans/mine', token), api('/payouts/account', token)]);
        setData((old) => ({ ...old, categories, services, requests: unique(requests), plans, payout }));
      }
      if (currentSession.user.role === 'ADMIN') {
        const [overview, requests, transactions, withdrawals] = await Promise.all([api('/admin/overview', token), api('/admin/requests', token), api('/admin/transactions', token), api('/admin/withdrawals', token)]);
        setData((old) => ({ ...old, admin: { overview, requests: unique(requests), transactions, withdrawals } }));
      }
      setToast('');
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function login(payload) {
    const result = await api(`/auth/${payload.mode}`, null, { method: 'POST', body: payload.body });
    setSession(result);
  }

  async function mutate(path, body, method = 'POST') {
    try {
      const result = await api(path, session.token, { method, body });
      setToast(result.message || 'Atualizado com sucesso.');
      await load();
      return result;
    } catch (error) {
      showError(error);
      return null;
    }
  }

  async function openChat(request) {
    try {
      const messages = await api(`/messages/${request.id}`, session.token);
      setChat({ request, messages, text: '' });
    } catch (error) {
      showError(error);
    }
  }

  async function sendMessage() {
    if (!chat?.text?.trim()) return;
    await mutate(`/messages/${chat.request.id}`, { message: chat.text.trim() });
    const messages = await api(`/messages/${chat.request.id}`, session.token);
    setChat((old) => ({ ...old, messages, text: '' }));
  }

  if (!session) return <AuthScreen onSubmit={login} />;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><View><Text style={styles.kicker}>ServicosPro Mobile</Text><Text style={styles.title}>{roles[session.user.role]}</Text><Text style={styles.muted}>{session.user.name}</Text></View><Pressable style={styles.outlineButton} onPress={() => setSession(null)}><Text style={styles.outlineText}>Sair</Text></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabContent}>{tabs[session.user.role].map((item) => <Pressable key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    {toast ? <Text style={styles.toast}>{toast}</Text> : null}
    <ScrollView style={styles.body} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} contentContainerStyle={styles.bodyContent}>{loading && <ActivityIndicator color="#0f766e" />}{session.user.role === 'CLIENTE' && <ClientArea tab={tab} data={data} mutate={mutate} openRequest={setRequestModal} openChat={openChat} />}{session.user.role === 'PRESTADOR' && <ProviderArea tab={tab} data={data} mutate={mutate} openChat={openChat} />}{session.user.role === 'ADMIN' && <AdminArea tab={tab} data={data.admin} mutate={mutate} />}</ScrollView>
    <RequestModal service={requestModal} onClose={() => setRequestModal(null)} onCreated={async (payload) => { const result = await mutate('/requests', payload); if (result?.payment?.method === 'PIX') Alert.alert('PIX gerado', `${result.payment.pix_code}\n\nConfirme o pagamento na aba Pagamentos.`); setRequestModal(null); }} />
    <ChatModal chat={chat} role={session.user.role} setChat={setChat} onSend={sendMessage} />
  </SafeAreaView>;
}

function AuthScreen({ onSubmit }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('CLIENTE');
  const [form, setForm] = useState({ name: '', email: 'cliente@servicos.local', password: 'cliente123', phone: '', city: '', state: '', address: '', document: '', bio: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() { setBusy(true); setError(''); try { await onSubmit({ mode, body: mode === 'login' ? { email: form.email, password: form.password } : { ...form, role } }); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  function demo(email, password) { setMode('login'); setForm((old) => ({ ...old, email, password })); }
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.auth}><Text style={styles.hero}>Marketplace de servicos no celular.</Text><Text style={styles.heroText}>Use a mesma API do sistema web para testar cliente, prestador e administracao no Expo Go.</Text><Text style={styles.apiText}>API: {API_URL}</Text><View style={styles.card}><View style={styles.segmented}><Pressable style={[styles.segment, mode === 'login' && styles.segmentActive]} onPress={() => setMode('login')}><Text>Entrar</Text></Pressable><Pressable style={[styles.segment, mode === 'register' && styles.segmentActive]} onPress={() => setMode('register')}><Text>Cadastrar</Text></Pressable></View>{mode === 'register' && <View style={styles.segmented}>{['CLIENTE', 'PRESTADOR'].map((item) => <Pressable key={item} style={[styles.segment, role === item && styles.segmentActive]} onPress={() => setRole(item)}><Text>{roles[item]}</Text></Pressable>)}</View>}{mode === 'register' && <Field label="Nome" value={form.name} onChangeText={(v) => setForm((o) => ({ ...o, name: v }))} />}<Field label="Email" autoCapitalize="none" value={form.email} onChangeText={(v) => setForm((o) => ({ ...o, email: v }))} /><Field label="Senha" secureTextEntry value={form.password} onChangeText={(v) => setForm((o) => ({ ...o, password: v }))} />{mode === 'register' && <Field label="Telefone" value={form.phone} onChangeText={(v) => setForm((o) => ({ ...o, phone: v }))} />}{mode === 'register' && <Field label="Cidade" value={form.city} onChangeText={(v) => setForm((o) => ({ ...o, city: v }))} />}{mode === 'register' && <Field label="UF" value={form.state} onChangeText={(v) => setForm((o) => ({ ...o, state: v }))} />}{mode === 'register' && role === 'CLIENTE' && <Field label="Endereco" value={form.address} onChangeText={(v) => setForm((o) => ({ ...o, address: v }))} />}{mode === 'register' && role === 'PRESTADOR' && <Field label="Documento" value={form.document} onChangeText={(v) => setForm((o) => ({ ...o, document: v }))} />}{mode === 'register' && role === 'PRESTADOR' && <Field label="Bio" multiline value={form.bio} onChangeText={(v) => setForm((o) => ({ ...o, bio: v }))} />}{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton title={busy ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'} onPress={submit} disabled={busy} /></View><View style={styles.demoGrid}><SmallButton title="Cliente demo" onPress={() => demo('cliente@servicos.local', 'cliente123')} /><SmallButton title="Prestador demo" onPress={() => demo('prestador@servicos.local', 'prestador123')} /><SmallButton title="Admin demo" onPress={() => demo('admin@servicos.local', 'admin123')} /></View></ScrollView></SafeAreaView>;
}
function ClientArea({ tab, data, mutate, openRequest, openChat }) {
  if (tab === 'Servicos') return <ServicesList services={data.services} categories={data.categories} openRequest={openRequest} />;
  if (tab === 'Pedidos') return <RequestList requests={data.requests} openChat={openChat} mutate={mutate} canCancel />;
  if (tab === 'Pagamentos') return <Payments requests={data.requests} mutate={mutate} />;
  return <Plans plans={data.plans} mutate={mutate} />;
}

function ProviderArea({ tab, data, mutate, openChat }) {
  const totals = useMemo(() => financeTotals(data.requests), [data.requests]);
  if (tab === 'Servicos') return <ProviderServices services={data.services} categories={data.categories} mutate={mutate} />;
  if (tab === 'Pedidos') return <RequestList requests={data.requests} openChat={openChat} mutate={mutate} provider />;
  if (tab === 'Financeiro') return <Finance totals={totals} requests={data.requests} />;
  if (tab === 'Saques') return <Payouts payout={data.payout} mutate={mutate} />;
  return <Plans plans={data.plans} mutate={mutate} />;
}

function AdminArea({ tab, data, mutate }) {
  if (tab === 'Resumo') { const o = data.overview; return <View>{o ? <MetricGrid items={[['Clientes', o.users.clients], ['Prestadores', o.users.providers], ['Volume', money.format(o.requests.gross_volume || 0)], ['Receita', money.format(o.requests.platform_revenue || 0)], ['Pendentes', o.payments.pending]]} /> : null}<RequestList requests={data.requests.slice(0, 6)} admin /></View>; }
  if (tab === 'Operacao') return <RequestList requests={data.requests} admin mutate={mutate} />;
  if (tab === 'Saques') return <AdminWithdrawals withdrawals={data.withdrawals} mutate={mutate} />;
  return <AdminFinance requests={data.requests} transactions={data.transactions} mutate={mutate} />;
}

function ServicesList({ services, categories, openRequest }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const visible = services.filter((item) => { const text = `${item.title} ${item.description} ${item.provider_name}`.toLowerCase(); return (!search || text.includes(search.toLowerCase())) && (!category || String(item.category_name) === category); });
  return <View><Field label="Buscar" value={search} onChangeText={setSearch} /><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>{['', ...categories.map((c) => c.name)].map((c) => <Pressable key={c || 'Todas'} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}><Text>{c || 'Todas'}</Text></Pressable>)}</ScrollView>{visible.map((service) => <View key={service.id} style={styles.card}><Text style={styles.kicker}>{service.category_name}</Text><Text style={styles.cardTitle}>{service.title}</Text><Text style={styles.muted}>{service.description}</Text><Text style={styles.price}>{money.format(service.price || 0)}</Text><Text style={styles.muted}>{service.provider_name} - {service.city || 'Cidade nao informada'} {service.state || ''}</Text><PrimaryButton title="Solicitar servico" onPress={() => openRequest(service)} /></View>)}{!visible.length && <Empty text="Nenhum servico encontrado." />}</View>;
}

function RequestList({ requests, openChat, mutate, provider, canCancel, admin }) {
  return <View>{requests.map((request) => <View key={request.id} style={styles.card}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{request.service_title}</Text><Badge value={request.status} /></View><Text style={styles.muted}>{provider ? `Cliente: ${request.client_name}` : `Prestador: ${request.provider_name || '-'}`}</Text><Text style={styles.muted}>Data: {date(request.scheduled_at)} as {time(request.scheduled_at)}</Text><Text style={styles.muted}>Endereco: {request.address || 'Nao informado'}</Text><Text style={styles.price}>{money.format(request.total_amount || 0)}</Text><View style={styles.rowWrap}><Badge value={request.payment_status || 'PENDENTE'} /><Text style={styles.muted}>{payment(request.payment_method)}</Text></View>{openChat && <SmallButton title="Conversar" onPress={() => openChat(request)} />}{canCancel && !['CONCLUIDO', 'CANCELADO'].includes(request.status) && <SmallButton title="Cancelar" onPress={() => mutate(`/requests/${request.id}/status`, { status: 'CANCELADO' }, 'PATCH')} />}{provider && <View style={styles.rowWrap}><SmallButton title="Aceitar" onPress={() => mutate(`/requests/${request.id}/status`, { status: 'ACEITO' }, 'PATCH')} /><SmallButton title="Concluir" onPress={() => mutate(`/requests/${request.id}/status`, { status: 'CONCLUIDO' }, 'PATCH')} /></View>}{admin && mutate && request.payment_status !== 'PAGO' && <SmallButton title="Confirmar pagamento" onPress={() => mutate(`/requests/${request.id}/pay`, {}, 'PATCH')} />}</View>)}{!requests.length && <Empty text="Nenhuma solicitacao encontrada." />}</View>;
}

function Payments({ requests, mutate }) {
  return <View>{requests.map((r) => <View key={r.id} style={styles.card}><Text style={styles.cardTitle}>{r.service_title}</Text><Text style={styles.price}>{money.format(r.total_amount || 0)}</Text><View style={styles.rowWrap}><Badge value={r.payment_status || 'PENDENTE'} /><Text style={styles.muted}>{payment(r.payment_method)}</Text></View>{r.pix_code ? <Text style={styles.pix}>PIX: {r.pix_code}</Text> : null}{r.payment_method === 'PIX' && r.payment_status !== 'PAGO' && <PrimaryButton title="Ja paguei o PIX" onPress={() => mutate(`/requests/${r.id}/confirm-payment`, {}, 'PATCH')} />}</View>)}</View>;
}

function ProviderServices({ services, categories, mutate }) {
  const empty = { categoryId: '', title: '', description: '', price: '', durationMinutes: '60' };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  async function save() { const path = editing ? `/services/${editing}` : '/services'; const method = editing ? 'PATCH' : 'POST'; const result = await mutate(path, form, method); if (result) { setForm(empty); setEditing(null); } }
  function edit(s) { setEditing(s.id); setForm({ categoryId: String(s.category_id), title: s.title, description: s.description, price: String(s.price), durationMinutes: String(s.duration_minutes) }); }
  return <View><View style={styles.card}><Text style={styles.cardTitle}>{editing ? 'Editar servico' : 'Novo servico'}</Text><Field label="Categoria ID" value={String(form.categoryId)} onChangeText={(v) => setForm((o) => ({ ...o, categoryId: v }))} /><Text style={styles.muted}>Categorias: {categories.map((c) => `${c.id}-${c.name}`).join(', ')}</Text><Field label="Titulo" value={form.title} onChangeText={(v) => setForm((o) => ({ ...o, title: v }))} /><Field label="Descricao" multiline value={form.description} onChangeText={(v) => setForm((o) => ({ ...o, description: v }))} /><Field label="Preco" keyboardType="numeric" value={form.price} onChangeText={(v) => setForm((o) => ({ ...o, price: v }))} /><Field label="Duracao em minutos" keyboardType="numeric" value={form.durationMinutes} onChangeText={(v) => setForm((o) => ({ ...o, durationMinutes: v }))} /><PrimaryButton title={editing ? 'Salvar alteracoes' : 'Cadastrar'} onPress={save} />{editing && <SmallButton title="Cancelar edicao" onPress={() => { setEditing(null); setForm(empty); }} />}</View>{services.map((s) => <View key={s.id} style={styles.card}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{s.title}</Text><Badge value={s.status} /></View><Text style={styles.muted}>{s.category_name} - {money.format(s.price || 0)}</Text><View style={styles.rowWrap}><SmallButton title="Editar" onPress={() => edit(s)} /><SmallButton title={s.status === 'ATIVO' ? 'Pausar' : 'Ativar'} onPress={() => mutate(`/services/${s.id}/status`, { status: s.status === 'ATIVO' ? 'PAUSADO' : 'ATIVO' }, 'PATCH')} /></View></View>)}</View>;
}

function Finance({ totals, requests }) {
  return <View><MetricGrid items={[['Bruto', money.format(totals.gross)], ['Taxas', money.format(totals.fees)], ['Liquido', money.format(totals.net)], ['Pago', money.format(totals.paidNet)]]} />{requests.map((r) => <View key={r.id} style={styles.card}><Text style={styles.cardTitle}>{r.service_title}</Text><Text style={styles.muted}>Cliente: {r.client_name}</Text><Text>Bruto: {money.format(r.total_amount || 0)}</Text><Text>Taxa: {money.format(r.platform_fee || 0)}</Text><Text style={styles.price}>Repasse: {money.format(r.provider_amount || 0)}</Text><Badge value={r.payment_status || 'PENDENTE'} /></View>)}</View>;
}
function Payouts({ payout, mutate }) {
  const [account, setAccount] = useState({ payoutMethod: payout.account?.payout_method || 'PIX', pixKey: payout.account?.pix_key || '', holderName: payout.account?.holder_name || '', document: payout.account?.document || '', bankName: payout.account?.bank_name || '', agency: payout.account?.agency || '', accountNumber: payout.account?.account_number || '' });
  const [amount, setAmount] = useState('');
  return <View><MetricGrid items={[['Disponivel', money.format(payout.balance?.available_amount || 0)], ['Taxa pendente', money.format(payout.balance?.pending_fee_amount || 0)], ['Saques', payout.withdrawals?.length || 0]]} /><View style={styles.card}><Text style={styles.cardTitle}>Conta de saque</Text><Field label="Metodo PIX ou CONTA_BANCARIA" value={account.payoutMethod} onChangeText={(v) => setAccount((o) => ({ ...o, payoutMethod: v }))} /><Field label="Chave PIX" value={account.pixKey} onChangeText={(v) => setAccount((o) => ({ ...o, pixKey: v }))} /><Field label="Banco" value={account.bankName} onChangeText={(v) => setAccount((o) => ({ ...o, bankName: v }))} /><Field label="Agencia" value={account.agency} onChangeText={(v) => setAccount((o) => ({ ...o, agency: v }))} /><Field label="Conta" value={account.accountNumber} onChangeText={(v) => setAccount((o) => ({ ...o, accountNumber: v }))} /><Field label="Titular" value={account.holderName} onChangeText={(v) => setAccount((o) => ({ ...o, holderName: v }))} /><Field label="Documento" value={account.document} onChangeText={(v) => setAccount((o) => ({ ...o, document: v }))} /><PrimaryButton title="Salvar conta" onPress={() => mutate('/payouts/account', account, 'PATCH')} /></View><View style={styles.card}><Text style={styles.cardTitle}>Solicitar saque</Text><Field label="Valor" keyboardType="numeric" value={amount} onChangeText={setAmount} /><PrimaryButton title="Solicitar" onPress={() => mutate('/payouts/withdraw', { amount, method: account.payoutMethod })} /></View>{payout.withdrawals?.map((w) => <View key={w.id} style={styles.card}><Text style={styles.cardTitle}>{money.format(w.amount || 0)}</Text><Badge value={w.status} /><Text style={styles.muted}>{payment(w.method)} - {date(w.created_at)}</Text></View>)}</View>;
}

function Plans({ plans, mutate }) {
  const current = plans.subscription;
  return <View>{current && <View style={styles.card}><Text style={styles.kicker}>Plano atual</Text><Text style={styles.cardTitle}>{current.name}</Text><Text style={styles.price}>{money.format(current.monthly_price || 0)}</Text><Text style={styles.muted}>{current.description}</Text></View>}{plans.plans?.map((plan) => <View key={plan.id} style={styles.card}><Text style={styles.cardTitle}>{plan.name}</Text><Text style={styles.muted}>{plan.description}</Text><Text style={styles.price}>{money.format(plan.monthly_price || 0)}</Text><Text>Taxa: {Number(plan.commission_rate || 0).toFixed(1)}%</Text><PrimaryButton title={current?.id === plan.id ? 'Selecionado' : 'Assinar'} disabled={current?.id === plan.id} onPress={() => mutate('/plans/subscribe', { planId: plan.id })} /></View>)}</View>;
}

function AdminFinance({ requests, transactions, mutate }) {
  const totals = financeTotals(requests);
  return <View><MetricGrid items={[['Volume', money.format(totals.gross)], ['Taxas', money.format(totals.fees)], ['Repasses', money.format(totals.net)], ['Pendentes', money.format(totals.pendingNet)]]} /><RequestList requests={requests} admin mutate={mutate} />{transactions.slice(0, 20).map((t) => <View key={t.id} style={styles.card}><Text style={styles.cardTitle}>{t.type}</Text><Text>{money.format(t.amount || 0)}</Text><Text style={styles.muted}>{t.description}</Text></View>)}</View>;
}

function AdminWithdrawals({ withdrawals, mutate }) {
  return <View>{withdrawals.map((w) => <View key={w.id} style={styles.card}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{w.provider_name}</Text><Badge value={w.status} /></View><Text style={styles.price}>{money.format(w.amount || 0)}</Text><Text style={styles.muted}>{payment(w.method)} - {w.pix_key || w.account_number || 'sem dados'}</Text><View style={styles.rowWrap}><SmallButton title="Processando" onPress={() => mutate(`/admin/withdrawals/${w.id}/status`, { status: 'PROCESSANDO' }, 'PATCH')} /><SmallButton title="Pago" onPress={() => mutate(`/admin/withdrawals/${w.id}/status`, { status: 'PAGO' }, 'PATCH')} /><SmallButton title="Recusar" onPress={() => mutate(`/admin/withdrawals/${w.id}/status`, { status: 'RECUSADO' }, 'PATCH')} /></View></View>)}{!withdrawals.length && <Empty text="Nenhum saque solicitado." />}</View>;
}

function RequestModal({ service, onClose, onCreated }) {
  const [form, setForm] = useState({ scheduledAt: '', address: '', notes: '', paymentMethod: 'PIX', cardHolderName: '', cardNumber: '', cardExpiry: '', cardCvv: '' });
  if (!service) return null;
  return <Modal visible transparent animationType="slide"><View style={styles.modalBackdrop}><ScrollView contentContainerStyle={styles.modal}><Text style={styles.cardTitle}>Solicitar {service.title}</Text><Field label="Data e hora: 2026-09-10T10:00" value={form.scheduledAt} onChangeText={(v) => setForm((o) => ({ ...o, scheduledAt: v }))} /><Field label="Endereco" value={form.address} onChangeText={(v) => setForm((o) => ({ ...o, address: v }))} /><Field label="Observacoes" multiline value={form.notes} onChangeText={(v) => setForm((o) => ({ ...o, notes: v }))} /><Field label="Pagamento: PIX, CARTAO_CREDITO, CARTAO_DEBITO ou DINHEIRO" value={form.paymentMethod} onChangeText={(v) => setForm((o) => ({ ...o, paymentMethod: v }))} />{form.paymentMethod.startsWith('CARTAO') && <><Field label="Nome no cartao" value={form.cardHolderName} onChangeText={(v) => setForm((o) => ({ ...o, cardHolderName: v }))} /><Field label="Numero" keyboardType="numeric" value={form.cardNumber} onChangeText={(v) => setForm((o) => ({ ...o, cardNumber: v }))} /><Field label="Validade" value={form.cardExpiry} onChangeText={(v) => setForm((o) => ({ ...o, cardExpiry: v }))} /><Field label="CVV" keyboardType="numeric" value={form.cardCvv} onChangeText={(v) => setForm((o) => ({ ...o, cardCvv: v }))} /></>}<View style={styles.rowWrap}><SmallButton title="Fechar" onPress={onClose} /><PrimaryButton title="Confirmar" onPress={() => onCreated({ serviceId: service.id, scheduledAt: form.scheduledAt, address: form.address, notes: form.notes, paymentMethod: form.paymentMethod, card: { holderName: form.cardHolderName, number: form.cardNumber, expiry: form.cardExpiry, cvv: form.cardCvv } })} /></View></ScrollView></View></Modal>;
}

function ChatModal({ chat, role, setChat, onSend }) {
  if (!chat) return null;
  return <Modal visible transparent animationType="slide"><View style={styles.modalBackdrop}><View style={styles.modal}><Text style={styles.cardTitle}>Conversa</Text><Text style={styles.muted}>{chat.request.service_title}</Text><ScrollView style={styles.chatBox}>{chat.messages.map((m) => <View key={m.id} style={[styles.bubble, m.sender_role === role && styles.bubbleOwn]}><Text style={styles.bubbleName}>{m.sender_name}</Text><Text>{m.message}</Text><Text style={styles.bubbleDate}>{date(m.created_at)} {time(m.created_at)}</Text></View>)}</ScrollView><Field label="Mensagem" multiline value={chat.text} onChangeText={(v) => setChat((old) => ({ ...old, text: v }))} /><View style={styles.rowWrap}><SmallButton title="Fechar" onPress={() => setChat(null)} /><PrimaryButton title="Enviar" onPress={onSend} /></View></View></View></Modal>;
}

function Field(props) { return <View style={styles.field}><Text style={styles.label}>{props.label}</Text><TextInput {...props} style={[styles.input, props.multiline && styles.textarea]} placeholderTextColor="#8a97a8" /></View>; }
function PrimaryButton({ title, onPress, disabled }) { return <Pressable disabled={disabled} style={[styles.primaryButton, disabled && styles.disabled]} onPress={onPress}><Text style={styles.primaryText}>{title}</Text></Pressable>; }
function SmallButton({ title, onPress }) { return <Pressable style={styles.smallButton} onPress={onPress}><Text style={styles.smallText}>{title}</Text></Pressable>; }
function Empty({ text }) { return <Text style={styles.empty}>{text}</Text>; }
function Badge({ value }) { return <Text style={styles.badge}>{value || '-'}</Text>; }
function MetricGrid({ items }) { return <View style={styles.metrics}>{items.map(([label, value]) => <View key={label} style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>)}</View>; }
function financeTotals(requests) { return requests.reduce((t, r) => ({ gross: t.gross + Number(r.total_amount || 0), fees: t.fees + Number(r.platform_fee || 0), net: t.net + Number(r.provider_amount || 0), paidNet: t.paidNet + (r.payment_status === 'PAGO' ? Number(r.provider_amount || 0) : 0), pendingNet: t.pendingNet + (r.payment_status !== 'PAGO' ? Number(r.provider_amount || 0) : 0) }), { gross: 0, fees: 0, net: 0, paidNet: 0, pendingNet: 0 }); }
function unique(rows) { return Array.from(new Map(rows.map((r) => [r.id, r])).values()); }
function date(v) { return v ? new Date(v).toLocaleDateString('pt-BR') : 'Nao agendada'; }
function time(v) { return v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'; }
function payment(v) { return ({ PIX: 'PIX', CARTAO_CREDITO: 'Cartao credito', CARTAO_DEBITO: 'Cartao debito', DINHEIRO: 'Dinheiro', CONTA_BANCARIA: 'Conta bancaria' }[v] || v || '-'); }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f6f8' },
  auth: { padding: 22, gap: 16 },
  hero: { fontSize: 34, fontWeight: '900', color: '#16212f', lineHeight: 38 },
  heroText: { color: '#667587', fontSize: 16, lineHeight: 24 },
  apiText: { color: '#0f766e', fontSize: 12, fontWeight: '800' },
  header: { padding: 18, borderBottomWidth: 1, borderColor: '#d9e1e8', backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kicker: { color: '#0f766e', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: '#18212f', fontSize: 26, fontWeight: '900' },
  muted: { color: '#667587', lineHeight: 21 },
  tabBar: { maxHeight: 58, backgroundColor: '#fff' },
  tabContent: { paddingHorizontal: 14, gap: 8, alignItems: 'center' },
  tab: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#eef3f6' },
  tabActive: { backgroundColor: '#0f766e' },
  tabText: { color: '#334155', fontWeight: '800' },
  tabTextActive: { color: '#fff' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 14, paddingBottom: 40 },
  toast: { margin: 14, marginBottom: 0, padding: 12, borderRadius: 8, backgroundColor: '#d8f3ee', color: '#0f766e', fontWeight: '800' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e1e8', borderRadius: 8, padding: 16, gap: 10, marginBottom: 12 },
  cardTitle: { color: '#18212f', fontSize: 18, fontWeight: '900' },
  price: { color: '#0f766e', fontSize: 20, fontWeight: '900' },
  field: { gap: 6, marginBottom: 10 },
  label: { color: '#667587', fontWeight: '800' },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#d9e1e8', borderRadius: 8, paddingHorizontal: 12, color: '#18212f', backgroundColor: '#fff' },
  textarea: { minHeight: 90, paddingTop: 10, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 8, backgroundColor: '#eef3f6' },
  segment: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff' },
  primaryButton: { minHeight: 46, borderRadius: 8, backgroundColor: '#0f766e', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14 },
  primaryText: { color: '#fff', fontWeight: '900' },
  outlineButton: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: '#d9e1e8', justifyContent: 'center', paddingHorizontal: 14 },
  outlineText: { color: '#334155', fontWeight: '800' },
  smallButton: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: '#c5d0da', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#fff' },
  smallText: { color: '#334155', fontWeight: '800' },
  disabled: { opacity: 0.55 },
  demoGrid: { gap: 8 },
  error: { color: '#b42318', fontWeight: '800' },
  chips: { marginVertical: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#eef3f6', marginRight: 8, borderRadius: 8 },
  chipActive: { backgroundColor: '#d8f3ee' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  badge: { overflow: 'hidden', alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: '#eef3f6', color: '#334155', fontSize: 12, fontWeight: '900' },
  pix: { padding: 12, backgroundColor: '#eef3f6', borderRadius: 8, color: '#0f766e', fontWeight: '900' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metric: { flexGrow: 1, minWidth: 145, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e1e8', borderRadius: 8, padding: 14, gap: 4 },
  metricValue: { color: '#18212f', fontSize: 18, fontWeight: '900' },
  empty: { padding: 18, borderRadius: 8, backgroundColor: '#fff', color: '#667587', textAlign: 'center', borderWidth: 1, borderColor: '#d9e1e8' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5, 10, 18, 0.62)', justifyContent: 'flex-end' },
  modal: { maxHeight: '88%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18, gap: 10 },
  chatBox: { maxHeight: 360, backgroundColor: '#eef3f6', borderRadius: 8, padding: 10 },
  bubble: { alignSelf: 'flex-start', maxWidth: '86%', backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 8, gap: 4 },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: '#d8f3ee' },
  bubbleName: { fontWeight: '900', color: '#18212f' },
  bubbleDate: { color: '#667587', fontSize: 11 }
});
