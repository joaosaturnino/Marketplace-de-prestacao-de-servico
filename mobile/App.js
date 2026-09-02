import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { api, API_URL } from './src/api';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const roles = { CLIENTE: 'Cliente', PRESTADOR: 'Prestador', ADMIN: 'Administrador' };
const startView = { CLIENTE: 'services', PRESTADOR: 'services', ADMIN: 'overview' };
const nav = {
  CLIENTE: [
    ['services', 'Buscar'],
    ['requests', 'Solicitacoes'],
    ['payments', 'Pagamentos'],
    ['plans', 'Planos'],
    ['profile', 'Perfil']
  ],
  PRESTADOR: [
    ['services', 'Servicos'],
    ['requests', 'Solicitacoes'],
    ['finance', 'Financeiro'],
    ['payouts', 'Saques'],
    ['plans', 'Planos'],
    ['reviews', 'Avaliacoes'],
    ['agenda', 'Agenda'],
    ['profile', 'Perfil']
  ],
  ADMIN: [
    ['overview', 'Resumo'],
    ['finance', 'Financeiro'],
    ['withdrawals', 'Saques'],
    ['plans', 'Planos'],
    ['users', 'Usuarios'],
    ['categories', 'Categorias'],
    ['profile', 'Perfil']
  ]
};

const themeMap = {
  light: {
    bg: '#f3f6f8', surface: '#ffffff', raised: '#ffffff', mutedSurface: '#eef3f6', border: '#d9e1e8', text: '#18212f', muted: '#667587', primary: '#0f766e', primarySoft: '#d8f3ee', danger: '#b42318', success: '#10743f', warning: '#a16207'
  },
  dark: {
    bg: '#0e1117', surface: '#151a23', raised: '#1b2230', mutedSurface: '#202938', border: '#2c3747', text: '#e8edf3', muted: '#a7b2c1', primary: '#2dd4bf', primarySoft: '#143b3a', danger: '#f97066', success: '#4ade80', warning: '#f7c948'
  }
};

function brl(value) {
  return money.format(Number(value || 0));
}

function when(value) {
  if (!value) return 'Nao informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function labelStatus(value) {
  return {
    SOLICITADO: 'Solicitado', ACEITO: 'Aceito', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluido', CANCELADO: 'Cancelado',
    PENDENTE: 'Pendente', PAGO: 'Pago', ESTORNADO: 'Estornado', ATIVO: 'Ativo', PAUSADO: 'Pausado', PROCESSANDO: 'Processando', APROVADO: 'Aprovado', RECUSADO: 'Recusado'
  }[value] || value || 'Nao informado';
}

function payLabel(value) {
  return { PIX: 'PIX', CARTAO_CREDITO: 'Credito', CARTAO_DEBITO: 'Debito', DINHEIRO: 'Dinheiro' }[value] || value || 'Nao informado';
}

function valueOr(value, fallback = 'Nao informado') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

export default function App() {
  const [theme, setTheme] = useState('light');
  const c = themeMap[theme];
  const s = useMemo(() => makeStyles(c), [c]);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('services');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [data, setData] = useState({});
  const [authMode, setAuthMode] = useState('login');
  const [authRole, setAuthRole] = useState('CLIENTE');
  const [auth, setAuth] = useState({ name: '', email: 'cliente@servicos.local', password: 'cliente123', phone: '', city: '', state: '', address: '', document: '', bio: '' });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState(null);
  const [requestForm, setRequestForm] = useState({ scheduledAt: '', address: '', notes: '', paymentMethod: 'PIX', cardNumber: '', cardHolderName: '', cardExpiry: '', cardCvv: '' });
  const [serviceForm, setServiceForm] = useState({ categoryId: '', title: '', description: '', price: '', durationMinutes: '60' });
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', city: '', state: '', address: '', document: '', bio: '' });
  const [payout, setPayout] = useState({ payoutMethod: 'PIX', pixKey: '', bankName: '', agency: '', accountNumber: '', accountType: 'CORRENTE', holderName: '', document: '' });
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    if (!user || !token) return;
    setView(startView[user.role]);
  }, [user, token]);

  useEffect(() => {
    if (user && token) loadData();
  }, [user, token, view]);

  const signed = (path, options) => api(path, token, options);
  const notice = (text) => {
    setMessage(text || '');
    if (text) setTimeout(() => setMessage(''), 3500);
  };

  async function loadData() {
    setLoading(true);
    try {
      if (user.role === 'CLIENTE') {
        const [categories, services, requests, plans] = await Promise.all([signed('/categories'), signed('/services'), signed('/requests/mine'), signed('/plans/mine')]);
        setData({ categories, services, requests, plans });
      } else if (user.role === 'PRESTADOR') {
        const [categories, services, requests, reviews, plans, payouts] = await Promise.all([signed('/categories'), signed('/services/mine'), signed('/requests/mine'), signed('/reviews/mine'), signed('/plans/mine'), signed('/payouts/account')]);
        setData({ categories, services, requests, reviews, plans, payouts });
        const account = payouts.account || {};
        setPayout({ payoutMethod: account.payout_method || 'PIX', pixKey: account.pix_key || '', bankName: account.bank_name || '', agency: account.agency || '', accountNumber: account.account_number || '', accountType: account.account_type || 'CORRENTE', holderName: account.holder_name || '', document: account.document || '' });
      } else {
        const [overview, requests, transactions, withdrawals, planSummary, users, categories] = await Promise.all([signed('/admin/overview'), signed('/admin/requests'), signed('/admin/transactions'), signed('/admin/withdrawals'), signed('/plans/admin/summary'), signed('/admin/users'), signed('/categories')]);
        setData({ overview, requests, transactions, withdrawals, planSummary, users, categories });
      }
      if (view === 'profile') await loadProfile();
    } catch (error) {
      notice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    const row = await signed('/profile');
    setProfile({ name: row.name || '', email: row.email || '', phone: row.profile?.phone || '', city: row.profile?.city || '', state: row.profile?.state || '', address: row.profile?.address || '', document: row.profile?.document || '', bio: row.profile?.bio || '' });
  }

  async function login() {
    setLoading(true);
    setMessage('');
    try {
      const body = authMode === 'login' ? { email: auth.email, password: auth.password } : { ...auth, role: authRole };
      const session = await api(`/auth/${authMode === 'login' ? 'login' : 'register'}`, null, { method: 'POST', body });
      setToken(session.token);
      setUser(session.user);
      setData({});
    } catch (error) {
      notice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function createRequest() {
    if (!selected) return;
    try {
      const result = await signed('/requests', { method: 'POST', body: { serviceId: selected.id, scheduledAt: requestForm.scheduledAt, address: requestForm.address, notes: requestForm.notes, paymentMethod: requestForm.paymentMethod, card: { number: requestForm.cardNumber, holderName: requestForm.cardHolderName, expiry: requestForm.cardExpiry, cvv: requestForm.cardCvv } } });
      setSelected(null);
      setRequestForm({ scheduledAt: '', address: '', notes: '', paymentMethod: 'PIX', cardNumber: '', cardHolderName: '', cardExpiry: '', cardCvv: '' });
      notice(result.message);
      await loadData();
      if (result.payment?.method === 'PIX') Alert.alert('PIX gerado', result.payment.pix_qr_payload || result.payment.pix_code || 'Pagamento PIX pendente.');
    } catch (error) {
      notice(error.message);
    }
  }

  async function patchRequest(id, status) {
    try {
      const result = await signed(`/requests/${id}/status`, { method: 'PATCH', body: { status } });
      notice(result.message);
      await loadData();
    } catch (error) {
      notice(error.message);
    }
  }

  async function confirmPix(id) {
    try {
      const result = await signed(`/requests/${id}/confirm-payment`, { method: 'PATCH' });
      notice(result.message);
      await loadData();
    } catch (error) {
      notice(error.message);
    }
  }

  async function subscribe(planId) {
    try {
      const result = await signed('/plans/subscribe', { method: 'POST', body: { planId } });
      notice(result.message);
      await loadData();
    } catch (error) {
      notice(error.message);
    }
  }

  async function saveService() {
    try {
      const result = await signed('/services', { method: 'POST', body: serviceForm });
      notice(result.message);
      setServiceForm({ categoryId: '', title: '', description: '', price: '', durationMinutes: '60' });
      await loadData();
    } catch (error) {
      notice(error.message);
    }
  }


  async function toggleService(item) {
    try {
      const status = item.status === 'ATIVO' ? 'PAUSADO' : 'ATIVO';
      const result = await signed(`/services/${item.id}/status`, { method: 'PATCH', body: { status } });
      notice(result.message);
      await loadData();
    } catch (error) {
      notice(error.message);
    }
  }

  async function saveProfile() {
    try {
      const result = await signed('/profile', { method: 'PATCH', body: profile });
      setToken(result.token);
      setUser(result.user);
      notice(result.message);
    } catch (error) {
      notice(error.message);
    }
  }

  async function savePayout() {
    try {
      const result = await signed('/payouts/account', { method: 'PATCH', body: payout });
      notice(result.message);
      await loadData();
    } catch (error) {
      notice(error.message);
    }
  }

  async function withdraw() {
    try {
      const result = await signed('/payouts/withdraw', { method: 'POST', body: { amount: withdrawAmount, method: payout.payoutMethod } });
      notice(result.message);
      setWithdrawAmount('');
      await loadData();
    } catch (error) {
      notice(error.message);
    }
  }

  function Button({ children, onPress, variant = 'default', disabled, style }) {
    return (
      <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, s[`button_${variant}`], disabled && s.disabled, pressed && !disabled && s.pressed, style]}>
        <Text style={[s.buttonText, s[`buttonText_${variant}`], disabled && s.disabledText]}>{children}</Text>
      </Pressable>
    );
  }

  function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry }) {
    return (
      <View style={s.field}>
        <Text style={s.label}>{label}</Text>
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.muted} multiline={multiline} keyboardType={keyboardType} secureTextEntry={secureTextEntry} style={[s.input, multiline && s.textarea]} />
      </View>
    );
  }

  function Card({ children, style }) {
    return <View style={[s.card, style]}>{children}</View>;
  }

  function Badge({ children, tone = 'neutral' }) {
    return <View style={[s.badge, s[`badge_${tone}`]]}><Text style={[s.badgeText, s[`badgeText_${tone}`]]}>{children}</Text></View>;
  }

  function Info({ label, value }) {
    return <View style={s.info}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue}>{value}</Text></View>;
  }

  function Title({ title, subtitle }) {
    return <View style={s.titleBox}><Text style={s.title}>{title}</Text>{subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}</View>;
  }

  function Empty({ text }) {
    return <Card><Text style={s.muted}>{text}</Text></Card>;
  }

  function Metric({ label, value, tone }) {
    return <Card style={s.metric}><Text style={s.small}>{label}</Text><Text style={[s.metricValue, tone && s[`tone_${tone}`]]}>{value}</Text></Card>;
  }

  function Message() {
    if (!message) return null;
    const isError = message.toLowerCase().includes('erro') || message.toLowerCase().includes('nao') || message.toLowerCase().includes('inv');
    return <View style={[s.message, isError ? s.messageError : s.messageOk]}><Text style={[s.messageText, isError ? s.messageTextError : s.messageTextOk]}>{message}</Text></View>;
  }

  function Chip({ active, children, onPress }) {
    return <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}><Text style={[s.chipText, active && s.chipTextActive]}>{children}</Text></Pressable>;
  }

  function Login() {
    const update = (field, value) => setAuth((current) => ({ ...current, [field]: value }));
    const demo = (email, password) => {
      setAuthMode('login');
      setAuth((current) => ({ ...current, email, password }));
    };

    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
          <Card style={s.hero}>
            <View style={s.rowBetween}><Badge tone="primary">Marketplace</Badge><Button variant="ghost" onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Claro' : 'Escuro'}</Button></View>
            <Text style={s.heroTitle}>Servicos, agenda e financeiro no celular.</Text>
            <Text style={s.muted}>App nativo para cliente, prestador e administrador, ajustado para a tela do celular.</Text>
          </Card>

          <Card>
            <View style={s.segmented}>
              <Button variant={authMode === 'login' ? 'primary' : 'ghost'} style={s.segmentButton} onPress={() => setAuthMode('login')}>Entrar</Button>
              <Button variant={authMode === 'register' ? 'primary' : 'ghost'} style={s.segmentButton} onPress={() => setAuthMode('register')}>Cadastrar</Button>
            </View>
            {authMode === 'register' ? <View style={s.chips}><Chip active={authRole === 'CLIENTE'} onPress={() => setAuthRole('CLIENTE')}>Cliente</Chip><Chip active={authRole === 'PRESTADOR'} onPress={() => setAuthRole('PRESTADOR')}>Prestador</Chip></View> : null}
            {authMode === 'register' ? <Field label="Nome" value={auth.name} onChangeText={(v) => update('name', v)} /> : null}
            <Field label="Email" value={auth.email} onChangeText={(v) => update('email', v)} keyboardType="email-address" />
            <Field label="Senha" value={auth.password} onChangeText={(v) => update('password', v)} secureTextEntry />
            {authMode === 'register' ? <><Field label="Telefone" value={auth.phone} onChangeText={(v) => update('phone', v)} keyboardType="phone-pad" /><View style={s.twoCols}><Field label="Cidade" value={auth.city} onChangeText={(v) => update('city', v)} /><Field label="UF" value={auth.state} onChangeText={(v) => update('state', v)} /></View>{authRole === 'CLIENTE' ? <Field label="Endereco" value={auth.address} onChangeText={(v) => update('address', v)} /> : null}{authRole === 'PRESTADOR' ? <Field label="Documento" value={auth.document} onChangeText={(v) => update('document', v)} /> : null}{authRole === 'PRESTADOR' ? <Field label="Bio" value={auth.bio} onChangeText={(v) => update('bio', v)} multiline /> : null}</> : null}
            <Button variant="primary" disabled={loading} onPress={login}>{loading ? 'Aguarde...' : authMode === 'login' ? 'Entrar' : 'Criar conta'}</Button>
          </Card>

          <Card><Text style={s.cardTitle}>Contas de teste</Text><View style={s.chips}><Button variant="soft" onPress={() => demo('cliente@servicos.local', 'cliente123')}>Cliente</Button><Button variant="soft" onPress={() => demo('prestador@servicos.local', 'prestador123')}>Prestador</Button><Button variant="soft" onPress={() => demo('admin@servicos.local', 'admin123')}>Admin</Button></View><Text style={s.small}>API: {API_URL}</Text></Card>
          <Message />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function Shell() {
    const items = nav[user.role] || [];
    const activeLabel = items.find(([id]) => id === view)?.[1] || 'Painel';
    return (
      <>
        <View style={s.header}>
          <View style={s.fill}><Text style={s.appName}>ServicosPro</Text><Text style={s.small}>{roles[user.role]} - {activeLabel}</Text></View>
          <View style={s.headerButtons}><Button variant="ghost" onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Claro' : 'Escuro'}</Button><Button variant="danger" onPress={() => { setUser(null); setToken(null); setData({}); }}>Sair</Button></View>
        </View>
        <View style={s.tabsWrap}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>{items.map(([id, title]) => <Chip key={id} active={view === id} onPress={() => setView(id)}>{title}</Chip>)}</ScrollView></View>
        <Message />
        {loading ? <View style={s.loading}><ActivityIndicator color={c.primary} size="large" /><Text style={s.muted}>Carregando dados...</Text></View> : <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>{content()}</ScrollView>}
        <RequestModal />
      </>
    );
  }


  function content() {
    if (user.role === 'CLIENTE') {
      if (view === 'services') return ClientServices();
      if (view === 'requests') return Requests('CLIENTE');
      if (view === 'payments') return Payments();
      if (view === 'plans') return Plans();
      return Profile();
    }
    if (user.role === 'PRESTADOR') {
      if (view === 'services') return ProviderServices();
      if (view === 'requests') return Requests('PRESTADOR');
      if (view === 'finance') return ProviderFinance();
      if (view === 'payouts') return Payouts();
      if (view === 'plans') return Plans();
      if (view === 'reviews') return Reviews();
      if (view === 'agenda') return Agenda();
      return Profile();
    }
    if (view === 'overview') return AdminOverview();
    if (view === 'finance') return AdminFinance();
    if (view === 'withdrawals') return AdminWithdrawals();
    if (view === 'plans') return AdminPlans();
    if (view === 'users') return AdminUsers();
    if (view === 'categories') return AdminCategories();
    return Profile();
  }

  function ClientServices() {
    const services = data.services || [];
    const categories = data.categories || [];
    const filtered = services.filter((item) => {
      const haystack = `${item.title} ${item.description} ${item.provider_name} ${item.category_name}`.toLowerCase();
      return haystack.includes(search.toLowerCase()) && (!category || item.category_name === category);
    });
    return <View style={s.stack}><Title title="Buscar servicos" subtitle="Escolha o profissional, data, endereco e forma de pagamento." /><Field label="Pesquisar" value={search} onChangeText={setSearch} placeholder="Limpeza, eletrica, pintura..." /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}><Chip active={!category} onPress={() => setCategory('')}>Todas</Chip>{categories.map((item) => <Chip key={item.id} active={category === item.name} onPress={() => setCategory(item.name)}>{item.name}</Chip>)}</ScrollView>{filtered.length ? filtered.map((item) => <Card key={item.id}><View style={s.cardHead}><View style={s.fill}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.muted}>{item.provider_name} - {item.category_name}</Text></View><Badge tone="primary">{brl(item.price)}</Badge></View><Text style={s.body}>{item.description}</Text><Info label="Local" value={`${valueOr(item.city)} / ${valueOr(item.state)}`} /><Info label="Duracao" value={`${item.duration_minutes || 60} min`} /><Button variant="primary" onPress={() => setSelected(item)}>Solicitar</Button></Card>) : <Empty text="Nenhum servico encontrado." />}</View>;
  }

  function Requests(role) {
    const rows = data.requests || [];
    return <View style={s.stack}><Title title="Solicitacoes" subtitle={role === 'PRESTADOR' ? 'Nome do cliente, data, horario, endereco e valores.' : 'Acompanhe pagamento e execucao do servico.'} />{rows.length ? rows.map((item) => <Card key={item.id}><View style={s.cardHead}><View style={s.fill}><Text style={s.cardTitle}>{item.service_title}</Text><Text style={s.muted}>{role === 'PRESTADOR' ? `Cliente: ${item.client_name}` : `Prestador: ${item.provider_name}`}</Text></View><Badge tone={item.status === 'CONCLUIDO' ? 'success' : item.status === 'CANCELADO' ? 'danger' : 'neutral'}>{labelStatus(item.status)}</Badge></View><Info label="Data e horario" value={when(item.scheduled_at)} /><Info label="Endereco" value={valueOr(item.address)} /><Info label="Pagamento" value={`${payLabel(item.payment_method)} - ${labelStatus(item.payment_status)}`} /><Info label="Valor" value={brl(item.total_amount)} />{role === 'PRESTADOR' ? <><Info label="Taxa" value={brl(item.platform_fee)} /><Info label="Recebe" value={brl(item.provider_amount)} /></> : null}{item.notes ? <Text style={s.body}>Obs.: {item.notes}</Text> : null}<View style={s.actions}>{role === 'CLIENTE' && item.payment_method === 'PIX' && item.payment_status !== 'PAGO' ? <Button variant="primary" onPress={() => confirmPix(item.id)}>Confirmar PIX teste</Button> : null}{role === 'CLIENTE' && !['CONCLUIDO', 'CANCELADO'].includes(item.status) ? <Button variant="danger" onPress={() => patchRequest(item.id, 'CANCELADO')}>Cancelar</Button> : null}{role === 'PRESTADOR' && item.status === 'SOLICITADO' ? <Button variant="primary" onPress={() => patchRequest(item.id, 'ACEITO')}>Aceitar</Button> : null}{role === 'PRESTADOR' && item.status === 'ACEITO' ? <Button variant="primary" onPress={() => patchRequest(item.id, 'EM_ANDAMENTO')}>Iniciar</Button> : null}{role === 'PRESTADOR' && item.status === 'EM_ANDAMENTO' ? <Button variant="primary" onPress={() => patchRequest(item.id, 'CONCLUIDO')}>Finalizar</Button> : null}</View></Card>) : <Empty text="Nenhuma solicitacao encontrada." />}</View>;
  }

  function Payments() {
    const rows = data.requests || [];
    return <View style={s.stack}><Title title="Pagamentos" subtitle="PIX, cartao e dinheiro direto com o prestador." />{rows.map((item) => <Card key={item.id}><View style={s.cardHead}><Text style={s.cardTitle}>{item.service_title}</Text><Badge tone={item.payment_status === 'PAGO' ? 'success' : 'neutral'}>{labelStatus(item.payment_status)}</Badge></View><Info label="Forma" value={payLabel(item.payment_method)} /><Info label="Valor" value={brl(item.total_amount)} />{item.pix_qr_payload && item.payment_status !== 'PAGO' ? <View style={s.pixBox}><View style={s.qr}><Text style={s.qrText}>PIX</Text><Text style={s.qrText}>####</Text><Text style={s.qrText}>####</Text></View><Text style={s.small}>PIX copia e cola</Text><Text style={s.body}>{item.pix_qr_payload}</Text></View> : null}</Card>)}{!rows.length ? <Empty text="Nenhum pagamento encontrado." /> : null}</View>;
  }

  function Plans() {
    const info = data.plans || { plans: [], subscription: null, usage: {} };
    const active = info.subscription?.id;
    const used = user.role === 'CLIENTE' ? info.usage?.requests_count : info.usage?.services_count;
    return <View style={s.stack}><Title title="Planos" subtitle="Inclui plano gratuito e planos pagos para cliente ou prestador." />{info.subscription ? <Card><Text style={s.cardTitle}>Atual: {info.subscription.name}</Text><Text style={s.body}>{info.subscription.description}</Text><Text style={s.small}>Uso atual: {Number(used || 0)}</Text></Card> : null}{(info.plans || []).map((item) => <Card key={item.id}><View style={s.cardHead}><View style={s.fill}><Text style={s.cardTitle}>{item.name}</Text><Text style={s.muted}>{item.description}</Text></View><Badge tone={Number(item.monthly_price || 0) === 0 ? 'success' : 'primary'}>{Number(item.monthly_price || 0) === 0 ? 'Gratis' : brl(item.monthly_price)}</Badge></View><Info label="Comissao" value={`${Number(item.commission_rate || 0).toFixed(1)}%`} />{item.max_services !== null ? <Info label="Limite servicos" value={String(item.max_services)} /> : null}{item.max_requests_per_month !== null ? <Info label="Solicitacoes/mes" value={String(item.max_requests_per_month)} /> : null}<Button variant={active === item.id ? 'soft' : 'primary'} disabled={active === item.id} onPress={() => subscribe(item.id)}>{active === item.id ? 'Plano ativo' : 'Assinar'}</Button></Card>)}</View>;
  }

  function ProviderServices() {
    const rows = data.services || [];
    const cats = data.categories || [];
    const set = (field, value) => setServiceForm((cur) => ({ ...cur, [field]: value }));
    return <View style={s.stack}><Title title="Meus servicos" subtitle="Cadastre, pause e acompanhe seus servicos." /><Card><Text style={s.cardTitle}>Novo servico</Text><Field label="Categoria ID" value={serviceForm.categoryId} onChangeText={(v) => set('categoryId', v)} placeholder={cats[0] ? `${cats[0].id} - ${cats[0].name}` : 'ID'} keyboardType="numeric" /><Field label="Titulo" value={serviceForm.title} onChangeText={(v) => set('title', v)} /><Field label="Descricao" value={serviceForm.description} onChangeText={(v) => set('description', v)} multiline /><View style={s.twoCols}><Field label="Preco" value={serviceForm.price} onChangeText={(v) => set('price', v)} keyboardType="decimal-pad" /><Field label="Minutos" value={serviceForm.durationMinutes} onChangeText={(v) => set('durationMinutes', v)} keyboardType="numeric" /></View><Text style={s.small}>Categorias: {cats.map((item) => `${item.id}-${item.name}`).join(', ')}</Text><Button variant="primary" onPress={saveService}>Cadastrar</Button></Card>{rows.map((item) => <Card key={item.id}><View style={s.cardHead}><View style={s.fill}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.muted}>{item.category_name}</Text></View><Badge tone={item.status === 'ATIVO' ? 'success' : 'neutral'}>{labelStatus(item.status)}</Badge></View><Text style={s.body}>{item.description}</Text><Info label="Preco" value={brl(item.price)} /><Button variant="soft" onPress={() => toggleService(item)}>{item.status === 'ATIVO' ? 'Pausar' : 'Ativar'}</Button></Card>)}</View>;
  }

  function ProviderFinance() {
    const rows = data.requests || [];
    const balance = data.payouts?.balance || {};
    const gross = rows.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
    const fees = rows.reduce((sum, item) => sum + Number(item.platform_fee || 0), 0);
    const net = rows.reduce((sum, item) => sum + Number(item.provider_amount || 0), 0);
    return <View style={s.stack}><Title title="Financeiro" subtitle="Saldo disponivel, taxas e repasses do prestador." /><View style={s.metricGrid}><Metric label="Disponivel" value={brl(balance.available_amount)} tone="success" /><Metric label="Taxa pendente" value={brl(balance.pending_fee_amount)} tone="warning" /><Metric label="Liquido" value={brl(net)} /><Metric label="Taxas" value={brl(fees)} /></View><Card><Text style={s.cardTitle}>Resumo</Text><Info label="Volume bruto" value={brl(gross)} /><Info label="Repasse" value={brl(net)} /><Info label="Taxa plataforma" value={brl(fees)} /></Card>{rows.map((item) => <Card key={item.id}><Text style={s.cardTitle}>{item.service_title}</Text><Info label="Cliente" value={item.client_name} /><Info label="Pagamento" value={`${payLabel(item.payment_method)} - ${labelStatus(item.payment_status)}`} /><Info label="Taxa" value={brl(item.platform_fee)} /><Info label="Voce recebe" value={brl(item.provider_amount)} /></Card>)}</View>;
  }


  function Payouts() {
    const rows = data.payouts?.withdrawals || [];
    const set = (field, value) => setPayout((cur) => ({ ...cur, [field]: value }));
    return <View style={s.stack}><Title title="Saques" subtitle="Cadastre PIX ou conta bancaria e solicite retirada." /><Card><Text style={s.cardTitle}>Conta de saque</Text><View style={s.chips}><Chip active={payout.payoutMethod === 'PIX'} onPress={() => set('payoutMethod', 'PIX')}>PIX</Chip><Chip active={payout.payoutMethod === 'CONTA_BANCARIA'} onPress={() => set('payoutMethod', 'CONTA_BANCARIA')}>Conta</Chip></View>{payout.payoutMethod === 'PIX' ? <Field label="Chave PIX" value={payout.pixKey} onChangeText={(v) => set('pixKey', v)} /> : <><Field label="Banco" value={payout.bankName} onChangeText={(v) => set('bankName', v)} /><View style={s.twoCols}><Field label="Agencia" value={payout.agency} onChangeText={(v) => set('agency', v)} /><Field label="Conta" value={payout.accountNumber} onChangeText={(v) => set('accountNumber', v)} /></View></>}<Field label="Titular" value={payout.holderName} onChangeText={(v) => set('holderName', v)} /><Field label="Documento" value={payout.document} onChangeText={(v) => set('document', v)} /><Button variant="primary" onPress={savePayout}>Salvar conta</Button></Card><Card><Text style={s.cardTitle}>Solicitar saque</Text><Field label="Valor" value={withdrawAmount} onChangeText={setWithdrawAmount} keyboardType="decimal-pad" /><Button variant="primary" onPress={withdraw}>Sacar</Button></Card>{rows.map((item) => <Card key={item.id}><View style={s.cardHead}><Text style={s.cardTitle}>{brl(item.amount)}</Text><Badge>{labelStatus(item.status)}</Badge></View><Info label="Metodo" value={item.method === 'PIX' ? 'PIX' : 'Conta bancaria'} /><Info label="Solicitado" value={when(item.created_at)} /></Card>)}</View>;
  }

  function Reviews() {
    const rows = data.reviews || [];
    return <View style={s.stack}><Title title="Avaliacoes" subtitle="Feedbacks recebidos dos clientes." />{rows.length ? rows.map((item) => <Card key={item.id}><Text style={s.cardTitle}>{`Nota ${Number(item.rating || 0).toFixed(1)}/5`}</Text><Text style={s.body}>{valueOr(item.comment, 'Sem comentario')}</Text><Text style={s.small}>{item.client_name} - {item.service_title}</Text></Card>) : <Empty text="Ainda nao ha avaliacoes." />}</View>;
  }

  function Agenda() {
    const rows = (data.requests || []).filter((item) => item.status !== 'CANCELADO');
    return <View style={s.stack}><Title title="Agenda" subtitle="Servicos programados por data e endereco." />{rows.length ? rows.map((item) => <Card key={item.id}><Text style={s.cardTitle}>{item.service_title}</Text><Info label="Cliente" value={item.client_name} /><Info label="Quando" value={when(item.scheduled_at)} /><Info label="Endereco" value={valueOr(item.address)} /><Badge>{labelStatus(item.status)}</Badge></Card>) : <Empty text="Agenda vazia." />}</View>;
  }

  function Profile() {
    const set = (field, value) => setProfile((cur) => ({ ...cur, [field]: value }));
    return <View style={s.stack}><Title title="Meu perfil" subtitle="Edite seus dados pelo app." /><Card><Field label="Nome" value={profile.name} onChangeText={(v) => set('name', v)} /><Field label="Email" value={profile.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" /><Field label="Telefone" value={profile.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" /><View style={s.twoCols}><Field label="Cidade" value={profile.city} onChangeText={(v) => set('city', v)} /><Field label="UF" value={profile.state} onChangeText={(v) => set('state', v)} /></View>{user.role === 'CLIENTE' ? <Field label="Endereco" value={profile.address} onChangeText={(v) => set('address', v)} /> : null}{user.role === 'PRESTADOR' ? <Field label="Documento" value={profile.document} onChangeText={(v) => set('document', v)} /> : null}{user.role === 'PRESTADOR' ? <Field label="Bio" value={profile.bio} onChangeText={(v) => set('bio', v)} multiline /> : null}<Button variant="primary" onPress={saveProfile}>Salvar perfil</Button></Card></View>;
  }

  function AdminOverview() {
    const o = data.overview || {};
    return <View style={s.stack}><Title title="Visao geral" subtitle="Indicadores principais da plataforma." /><View style={s.metricGrid}><Metric label="Usuarios" value={String(o.users || o.total_users || 0)} /><Metric label="Prestadores" value={String(o.providers || o.total_providers || 0)} /><Metric label="Solicitacoes" value={String(o.requests || o.total_requests || 0)} /><Metric label="Receita" value={brl(o.platform_revenue || o.total_platform_fee)} tone="success" /></View></View>;
  }

  function AdminFinance() {
    const rows = data.transactions || [];
    const requests = data.requests || [];
    const gross = requests.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
    const fees = requests.reduce((sum, item) => sum + Number(item.platform_fee || 0), 0);
    return <View style={s.stack}><Title title="Financeiro" subtitle="Pagamentos, taxas, repasses e transacoes." /><View style={s.metricGrid}><Metric label="Volume" value={brl(gross)} /><Metric label="Taxas" value={brl(fees)} tone="success" /></View>{rows.length ? rows.map((item) => <Card key={item.id}><Text style={s.cardTitle}>{item.type}</Text><Info label="Valor" value={brl(item.amount)} /><Info label="Descricao" value={valueOr(item.description)} /><Info label="Data" value={when(item.created_at)} /></Card>) : <Empty text="Nenhuma transacao financeira." />}</View>;
  }

  function AdminWithdrawals() {
    const rows = data.withdrawals || [];
    return <View style={s.stack}><Title title="Saques" subtitle="Retiradas solicitadas pelos prestadores." />{rows.length ? rows.map((item) => <Card key={item.id}><View style={s.cardHead}><View style={s.fill}><Text style={s.cardTitle}>{item.provider_name}</Text><Text style={s.muted}>{item.method}</Text></View><Badge>{labelStatus(item.status)}</Badge></View><Info label="Valor" value={brl(item.amount)} /><Info label="Solicitado" value={when(item.created_at)} /></Card>) : <Empty text="Nenhum saque solicitado." />}</View>;
  }

  function AdminPlans() {
    const summary = data.planSummary || { plans: [], totals: {} };
    return <View style={s.stack}><Title title="Planos" subtitle="Planos de cliente e prestador." /><View style={s.metricGrid}><Metric label="Assinaturas" value={String(summary.totals?.active_subscriptions || 0)} /><Metric label="Receita mensal" value={brl(summary.totals?.monthly_recurring_revenue)} tone="success" /></View>{(summary.plans || []).map((item) => <Card key={item.id}><Text style={s.cardTitle}>{item.name}</Text><Info label="Publico" value={roles[item.target_role] || item.target_role} /><Info label="Mensalidade" value={brl(item.monthly_price)} /><Info label="Comissao" value={`${Number(item.commission_rate || 0).toFixed(1)}%`} /><Info label="Assinantes" value={String(item.active_subscriptions || 0)} /></Card>)}</View>;
  }

  function AdminUsers() {
    const rows = data.users || [];
    return <View style={s.stack}><Title title="Usuarios" subtitle="Clientes, prestadores e administradores." />{rows.map((item) => <Card key={item.id}><View style={s.cardHead}><View style={s.fill}><Text style={s.cardTitle}>{item.name}</Text><Text style={s.muted}>{item.email}</Text></View><Badge>{roles[item.role] || item.role}</Badge></View><Info label="Cidade" value={`${valueOr(item.city)} / ${valueOr(item.state)}`} /><Info label="Plano" value={valueOr(item.plan_name)} /><Info label="Status" value={labelStatus(item.status)} /></Card>)}</View>;
  }

  function AdminCategories() {
    const rows = data.categories || [];
    return <View style={s.stack}><Title title="Categorias" subtitle="Areas disponiveis para os servicos." />{rows.map((item) => <Card key={item.id}><Text style={s.cardTitle}>{item.name}</Text><Text style={s.body}>{valueOr(item.description, 'Sem descricao')}</Text></Card>)}</View>;
  }

  function RequestModal() {
    if (!selected) return null;
    const set = (field, value) => setRequestForm((cur) => ({ ...cur, [field]: value }));
    return <Modal visible transparent animationType="slide" onRequestClose={() => setSelected(null)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBack}><View style={s.modal}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><Text style={s.title}>Solicitar servico</Text><Text style={s.subtitle}>{selected.title} - {brl(selected.price)}</Text><Field label="Data e horario" value={requestForm.scheduledAt} onChangeText={(v) => set('scheduledAt', v)} placeholder="2026-09-10 14:00" /><Field label="Endereco" value={requestForm.address} onChangeText={(v) => set('address', v)} /><Field label="Observacoes" value={requestForm.notes} onChangeText={(v) => set('notes', v)} multiline /><Text style={s.label}>Forma de pagamento</Text><View style={s.chips}>{['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO'].map((method) => <Chip key={method} active={requestForm.paymentMethod === method} onPress={() => set('paymentMethod', method)}>{payLabel(method)}</Chip>)}</View>{requestForm.paymentMethod.startsWith('CARTAO') ? <><Field label="Nome no cartao" value={requestForm.cardHolderName} onChangeText={(v) => set('cardHolderName', v)} /><Field label="Numero" value={requestForm.cardNumber} onChangeText={(v) => set('cardNumber', v)} keyboardType="number-pad" /><View style={s.twoCols}><Field label="Validade" value={requestForm.cardExpiry} onChangeText={(v) => set('cardExpiry', v)} placeholder="12/30" /><Field label="CVV" value={requestForm.cardCvv} onChangeText={(v) => set('cardCvv', v)} keyboardType="number-pad" /></View></> : null}{requestForm.paymentMethod === 'PIX' ? <Text style={s.small}>Em testes, o pagamento PIX e confirmado manualmente na lista de solicitacoes.</Text> : null}{requestForm.paymentMethod === 'DINHEIRO' ? <Text style={s.small}>O cliente paga direto ao prestador e a taxa entra no financeiro do prestador.</Text> : null}<View style={s.actions}><Button variant="ghost" onPress={() => setSelected(null)}>Fechar</Button><Button variant="primary" onPress={createRequest}>Confirmar</Button></View></ScrollView></View></KeyboardAvoidingView></Modal>;
  }

  return <SafeAreaProvider><SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={[s.safe, { backgroundColor: c.bg }]}><StatusBar translucent={false} backgroundColor={c.bg} barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />{user && token ? <Shell /> : <Login />}</SafeAreaView></SafeAreaProvider>;
}

function makeStyles(c) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: c.bg },
    authScroll: { padding: 14, gap: 12, paddingBottom: 28, backgroundColor: c.bg },
    content: { padding: 14, paddingBottom: 34, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    headerButtons: { flexDirection: 'row', gap: 8 },
    appName: { color: c.text, fontSize: 18, fontWeight: '900' },
    tabsWrap: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    tabs: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
    stack: { gap: 12 },
    hero: { gap: 12 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    fill: { flex: 1, minWidth: 0 },
    heroTitle: { color: c.text, fontSize: 30, lineHeight: 34, fontWeight: '900' },
    titleBox: { gap: 4 },
    title: { color: c.text, fontSize: 24, lineHeight: 29, fontWeight: '900' },
    subtitle: { color: c.muted, fontSize: 14, lineHeight: 20 },
    card: { backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12, shadowColor: '#162233', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    cardTitle: { color: c.text, fontSize: 16, lineHeight: 21, fontWeight: '900' },
    body: { color: c.text, fontSize: 14, lineHeight: 20 },
    muted: { color: c.muted, fontSize: 14, lineHeight: 20 },
    small: { color: c.muted, fontSize: 12, lineHeight: 17 },
    field: { flex: 1, gap: 6 },
    label: { color: c.text, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
    input: { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.raised, color: c.text, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
    textarea: { minHeight: 92, textAlignVertical: 'top' },
    twoCols: { flexDirection: 'row', gap: 10 },
    segmented: { flexDirection: 'row', padding: 4, borderRadius: 8, backgroundColor: c.mutedSurface, gap: 4 },
    segmentButton: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    chipActive: { borderColor: c.primary, backgroundColor: c.primarySoft },
    chipText: { color: c.muted, fontWeight: '800', fontSize: 13 },
    chipTextActive: { color: c.primary },
    button: { minHeight: 42, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    button_default: {},
    button_primary: { backgroundColor: c.primary, borderColor: c.primary },
    button_soft: { backgroundColor: c.primarySoft, borderColor: c.primarySoft },
    button_ghost: { backgroundColor: 'transparent' },
    button_danger: { backgroundColor: themeMap.light.bg, borderColor: c.border },
    buttonText: { color: c.text, fontSize: 13, fontWeight: '900' },
    buttonText_default: { color: c.text },
    buttonText_primary: { color: themeMap.light.surface },
    buttonText_soft: { color: c.primary },
    buttonText_ghost: { color: c.text },
    buttonText_danger: { color: c.danger },
    pressed: { opacity: 0.82 },
    disabled: { opacity: 0.55 },
    disabledText: { color: c.muted },
    badge: { alignSelf: 'flex-start', minHeight: 28, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, justifyContent: 'center', backgroundColor: c.mutedSurface, borderColor: c.border },
    badge_primary: { backgroundColor: c.primarySoft, borderColor: c.primarySoft },
    badge_success: { backgroundColor: c.primarySoft, borderColor: c.primarySoft },
    badge_danger: { backgroundColor: themeMap.light.bg, borderColor: c.border },
    badge_neutral: {},
    badgeText: { color: c.text, fontWeight: '900', fontSize: 12 },
    badgeText_primary: { color: c.primary },
    badgeText_success: { color: c.success },
    badgeText_danger: { color: c.danger },
    badgeText_neutral: { color: c.muted },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metric: { width: '48%', minWidth: 145 },
    metricValue: { color: c.text, fontSize: 21, fontWeight: '900', marginTop: 4 },
    tone_success: { color: c.success },
    tone_warning: { color: c.warning },
    info: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 },
    infoLabel: { color: c.muted, fontSize: 12, fontWeight: '800', flex: 0.42 },
    infoValue: { color: c.text, fontSize: 13, fontWeight: '800', flex: 0.58, textAlign: 'right' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    message: { marginHorizontal: 14, marginTop: 10, borderRadius: 8, borderWidth: 1, padding: 10 },
    messageOk: { backgroundColor: c.primarySoft, borderColor: c.primarySoft },
    messageError: { backgroundColor: themeMap.light.bg, borderColor: c.border },
    messageText: { fontSize: 13, fontWeight: '800' },
    messageTextOk: { color: c.success },
    messageTextError: { color: c.danger },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.bg },
    modalBack: { flex: 1, backgroundColor: 'rgba(10, 15, 25, 0.48)', justifyContent: 'flex-end', padding: 12 },
    modal: { maxHeight: '90%', borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 14 },
    pixBox: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.mutedSurface, gap: 8 },
    qr: { alignSelf: 'center', width: 104, height: 104, backgroundColor: '#fff', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    qrText: { color: '#18212f', fontSize: 14, fontWeight: '900', letterSpacing: 1 }
  });
}
