import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Moon,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Save,
  Star,
  Sun,
  Tags,
  XCircle,
  ReceiptText,
  UserCog,
  UserRoundPlus,
  UsersRound,
  WalletCards
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const roles = {
  CLIENTE: 'Cliente',
  PRESTADOR: 'Prestador',
  ADMIN: 'Administrador'
};
const defaultViews = {
  CLIENTE: 'services',
  PRESTADOR: 'services',
  ADMIN: 'overview'
};
const navItems = {
  CLIENTE: [
    { id: 'services', label: 'Buscar servicos', icon: Search },
    { id: 'requests', label: 'Minhas solicitacoes', icon: ClipboardList },
    { id: 'payments', label: 'Pagamentos', icon: CreditCard },
    { id: 'plans', label: 'Planos', icon: ShieldCheck },
    { id: 'profile', label: 'Meu perfil', icon: UserCog }
  ],
  PRESTADOR: [
    { id: 'services', label: 'Meus servicos', icon: BriefcaseBusiness },
    { id: 'requests', label: 'Solicitacoes', icon: ClipboardList },
    { id: 'finance', label: 'Financeiro', icon: WalletCards },
    { id: 'payouts', label: 'Saques', icon: Banknote },
    { id: 'plans', label: 'Planos', icon: ShieldCheck },
    { id: 'reviews', label: 'Avaliacoes', icon: Star },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    { id: 'profile', label: 'Meu perfil', icon: UserCog }
  ],
  ADMIN: [
    { id: 'overview', label: 'Visao geral', icon: LayoutDashboard },
    { id: 'finance', label: 'Financeiro', icon: WalletCards },
    { id: 'withdrawals', label: 'Saques', icon: Banknote },
    { id: 'plans', label: 'Planos', icon: ShieldCheck },
    { id: 'users', label: 'Usuarios', icon: UsersRound },
    { id: 'categories', label: 'Categorias', icon: Tags },
    { id: 'operations', label: 'Operacao', icon: ClipboardList },
    { id: 'profile', label: 'Meu perfil', icon: UserCog }
  ]
};
const columnLabels = {
  service_title: 'Servico',
  provider_name: 'Prestador',
  client_name: 'Cliente',
  name: 'Nome',
  email: 'Email',
  role: 'Perfil',
  phone: 'Telefone',
  city: 'Cidade',
  state: 'UF',
  plan_name: 'Plano',
  services_count: 'Servicos',
  requests_count: 'Solicitacoes',
  gross_volume: 'Volume',
  status: 'Status',
  payment_status: 'Pagamento',
  payment_method: 'Metodo',
  total_amount: 'Valor',
  platform_fee: 'Taxa',
  provider_amount: 'Repasse',
  monthly_price: 'Mensalidade',
  commission_rate: 'Taxa',
  max_services: 'Limite',
  support_level: 'Suporte',
  target_role: 'Publico',
  max_requests_per_month: 'Solicitacoes',
  active_subscriptions: 'Assinantes',
  provider_fee_status: 'Taxa dinheiro',
  card_brand: 'Bandeira',
  card_last4: 'Final',
  review_rating: 'Avaliacao',
  monthly_recurring_revenue: 'Receita mensal',
  request_id: 'Solicitacao',
  type: 'Tipo',
  description: 'Descricao',
  amount: 'Valor',
  created_at: 'Criado em',
  paid_at: 'Pago em'
};

function useAuth() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  function saveSession(session) {
    localStorage.setItem('token', session.token);
    localStorage.setItem('user', JSON.stringify(session.user));
    setUser(session.user);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  return { user, saveSession, logout };
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';

  return (
    <button className="theme-toggle" type="button" onClick={onToggle} title={isDark ? 'Usar modo claro' : 'Usar modo escuro'}>
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{isDark ? 'Claro' : 'Escuro'}</span>
    </button>
  );
}

function LoginScreen({ onLogin, theme, onToggleTheme }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('CLIENTE');
  const [form, setForm] = useState({
    name: '',
    email: 'cliente@servicos.local',
    password: 'cliente123',
    phone: '',
    city: '',
    state: '',
    address: '',
    document: '',
    bio: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload =
        mode === 'login'
          ? { email: form.email, password: form.password }
          : { ...form, role };
      const session = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      onLogin(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function useDemo(email, password) {
    setMode('login');
    setForm((current) => ({ ...current, email, password }));
  }

  return (
    <main className="auth-shell">
      <div className="auth-theme">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <section className="auth-panel">
        <div>
          <span className="eyebrow"><Sparkles size={16} /> Plataforma de servicos</span>
          <h1>Operacao completa para servicos, agenda e financeiro.</h1>
          <p>
            Clientes encontram profissionais, prestadores gerenciam ofertas e a administracao acompanha
            pagamentos, taxas e repasses com visao centralizada.
          </p>
        </div>

        <div className="auth-proof">
          <div>
            <strong>3</strong>
            <span>perfis de acesso</span>
          </div>
          <div>
            <strong>3</strong>
            <span>planos comerciais</span>
          </div>
          <div>
            <strong>JWT</strong>
            <span>sessao protegida</span>
          </div>
        </div>
      </section>

      <form className="auth-card" onSubmit={submit}>
        <div>
          <span className="form-kicker">{mode === 'login' ? 'Acesso ao painel' : 'Novo cadastro'}</span>
          <h2>{mode === 'login' ? 'Entrar na conta' : 'Criar conta'}</h2>
        </div>

        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Entrar
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Cadastrar
          </button>
        </div>

        {mode === 'register' && (
          <>
            <label>
              Tipo de cadastro
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="CLIENTE">Cliente</option>
                <option value="PRESTADOR">Prestador</option>
              </select>
            </label>
            <label>
              Nome
              <input value={form.name} onChange={(event) => update('name', event.target.value)} />
            </label>
          </>
        )}

        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} />
        </label>

        {mode === 'register' && (
          <>
            <div className="form-grid">
              <label>
                Telefone
                <input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
              </label>
              <label>
                UF
                <input maxLength="2" value={form.state} onChange={(event) => update('state', event.target.value.toUpperCase())} />
              </label>
            </div>
            <label>
              Cidade
              <input value={form.city} onChange={(event) => update('city', event.target.value)} />
            </label>
            {role === 'CLIENTE' ? (
              <label>
                Endereco
                <input value={form.address} onChange={(event) => update('address', event.target.value)} />
              </label>
            ) : (
              <>
                <label>
                  CPF/CNPJ
                  <input value={form.document} onChange={(event) => update('document', event.target.value)} />
                </label>
                <label>
                  Apresentacao
                  <textarea value={form.bio} onChange={(event) => update('bio', event.target.value)} />
                </label>
              </>
            )}
          </>
        )}

        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Enviando...' : mode === 'login' ? 'Entrar no sistema' : 'Criar cadastro'}
        </button>

        <div className="demo-block">
          <span>Contas de demonstracao</span>
          <div className="demo-row">
            <button type="button" onClick={() => useDemo('cliente@servicos.local', 'cliente123')}>
              Cliente
            </button>
            <button type="button" onClick={() => useDemo('prestador@servicos.local', 'prestador123')}>
              Prestador
            </button>
            <button type="button" onClick={() => useDemo('admin@servicos.local', 'admin123')}>
              Admin
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

function AppShell({ user, theme, activeView, onNavigate, onToggleTheme, onLogout, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BriefcaseBusiness />
          <div>
            <strong>ServicosPro</strong>
            <span>gestao operacional</span>
          </div>
        </div>
        <nav className="nav-stack" aria-label="Navegacao principal">
          {navItems[user.role].map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeView === item.id ? 'active' : ''}
                type="button"
                key={item.id}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </nav>
        <nav className="mobile-tabs" aria-label="Navegacao secundaria">
          {navItems[user.role].map((item) => (
            <button
              className={activeView === item.id ? 'active' : ''}
              type="button"
              key={item.id}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button className={`user-box ${activeView === 'profile' ? 'active' : ''}`} type="button" onClick={() => onNavigate('profile')}>
          <span>{roles[user.role]}</span>
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </button>
        <div className="sidebar-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="ghost" type="button" onClick={onLogout}>
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>
      <section className="content">
        <div className="topbar">
          <div>
            <span>Workspace</span>
            <strong>{roles[user.role]}</strong>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        {children}
      </section>
    </div>
  );
}

function StatusBadge({ value }) {
  return <span className={`badge badge-${String(value).toLowerCase()}`}>{value}</span>;
}

function ProfilePanel({ user, onSessionUpdate }) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: '',
    city: '',
    state: '',
    address: '',
    document: '',
    bio: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setMessage('');

      try {
        const data = await api('/profile');
        setForm({
          name: data.name || '',
          email: data.email || '',
          phone: data.profile?.phone || '',
          city: data.profile?.city || '',
          state: data.profile?.state || '',
          address: data.profile?.address || '',
          document: data.profile?.document || '',
          bio: data.profile?.bio || ''
        });
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user.id]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const session = await api('/profile', {
        method: 'PATCH',
        body: JSON.stringify(form)
      });
      onSessionUpdate(session);
      setMessage(session.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow"><UserCog size={16} /> Meu perfil</span>
          <h2>Dados da conta</h2>
          <p>Atualize suas informacoes de contato e os dados usados na operacao da plataforma.</p>
        </div>
      </header>

      {message && <div className={message.includes('sucesso') ? 'notice' : 'error'}>{message}</div>}

      <form className="profile-layout" onSubmit={submit} autoComplete="off">
        <section className="panel">
          <div className="panel-title">
            <h3>Identificacao</h3>
            <UserCog size={18} />
          </div>
          <label>
            Nome
            <input
              autoComplete="off"
              disabled={loading}
              name="profile-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
            />
          </label>
          <label>
            Email
            <input
              autoComplete="off"
              disabled={loading}
              name="profile-email"
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </label>
          <label>
            Tipo de acesso
            <input disabled value={roles[user.role]} />
          </label>
        </section>

        <section className="panel">
          <div className="panel-title">
            <h3>Contato e operacao</h3>
            <Save size={18} />
          </div>

          {user.role !== 'ADMIN' && (
            <>
              <div className="form-grid">
                <label>
                  Telefone
                  <input autoComplete="off" disabled={loading} name="profile-phone" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
                </label>
                <label>
                  UF
                  <input autoComplete="off" disabled={loading} maxLength="2" name="profile-state" value={form.state} onChange={(event) => update('state', event.target.value.toUpperCase())} />
                </label>
              </div>
              <label>
                Cidade
                <input autoComplete="off" disabled={loading} name="profile-city" value={form.city} onChange={(event) => update('city', event.target.value)} />
              </label>
            </>
          )}

          {user.role === 'CLIENTE' && (
            <label>
              Endereco
              <input autoComplete="off" disabled={loading} name="profile-address" value={form.address} onChange={(event) => update('address', event.target.value)} />
            </label>
          )}

          {user.role === 'PRESTADOR' && (
            <>
              <label>
                CPF/CNPJ
                <input autoComplete="off" disabled={loading} name="profile-document" value={form.document} onChange={(event) => update('document', event.target.value)} />
              </label>
              <label>
                Apresentacao
                <textarea disabled={loading} value={form.bio} onChange={(event) => update('bio', event.target.value)} />
              </label>
            </>
          )}

          {user.role === 'ADMIN' && (
            <div className="empty compact">Administradores editam nome e email da conta nesta versao.</div>
          )}

          <button className="primary" type="submit" disabled={loading || saving}>
            <Save size={18} /> {saving ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </section>
      </form>
    </>
  );
}

function ClientDashboard({ view }) {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [requests, setRequests] = useState([]);
  const [planInfo, setPlanInfo] = useState({ plans: [], subscription: null, usage: { requests_count: 0 } });
  const [filters, setFilters] = useState({ search: '', categoryId: '' });
  const [selected, setSelected] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [conversation, setConversation] = useState({ request: null, messages: [], text: '', loading: false });
  const [requesting, setRequesting] = useState(false);
  const [requestForm, setRequestForm] = useState({
    scheduledAt: '',
    address: '',
    notes: '',
    paymentMethod: 'PIX',
    cardHolderName: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: ''
  });
  const [message, setMessage] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    const [serviceRows, categoryRows, requestRows, planRows] = await Promise.all([
      api(`/services?${params.toString()}`),
      api('/categories'),
      api('/requests/mine'),
      api('/plans/mine')
    ]);
    setServices(serviceRows);
    setCategories(categoryRows);
    setRequests(uniqueById(requestRows));
    setPlanInfo(planRows);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function search(event) {
    event.preventDefault();
    await load();
  }

  async function createRequest(event) {
    event.preventDefault();
    if (requesting) return;

    setMessage('');
    setRequesting(true);

    try {
      const result = await api('/requests', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selected.id,
          scheduledAt: requestForm.scheduledAt,
          address: requestForm.address,
          notes: requestForm.notes,
          paymentMethod: requestForm.paymentMethod,
          card: {
            holderName: requestForm.cardHolderName,
            number: requestForm.cardNumber,
            expiry: requestForm.cardExpiry,
            cvv: requestForm.cardCvv
          }
        })
      });
      setPaymentResult(result.payment ? { requestId: result.id, ...result.payment } : null);
      setMessage(result.message || 'Solicitacao enviada ao prestador.');
      if (requestForm.paymentMethod !== 'PIX') {
        setSelected(null);
        resetRequestForm();
      }
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setRequesting(false);
    }
  }

  function resetRequestForm() {
    setRequestForm({
      scheduledAt: '',
      address: '',
      notes: '',
      paymentMethod: 'PIX',
      cardHolderName: '',
      cardNumber: '',
      cardExpiry: '',
      cardCvv: ''
    });
    setPaymentResult(null);
  }

  async function confirmPixPayment(requestId) {
    setMessage('');

    try {
      const result = await api(`/requests/${requestId}/confirm-payment`, { method: 'PATCH' });
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function confirmPixFromModal() {
    if (!paymentResult?.requestId) return;

    setMessage('');

    try {
      const result = await api(`/requests/${paymentResult.requestId}/confirm-payment`, { method: 'PATCH' });
      setMessage(result.message);
      setSelected(null);
      resetRequestForm();
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshPlans() {
    const planRows = await api('/plans/mine');
    setPlanInfo(planRows);
    await load();
  }

  async function submitReview(requestId, rating, comment) {
    setMessage('');

    try {
      const result = await api('/reviews', {
        method: 'POST',
        body: JSON.stringify({ requestId, rating, comment })
      });
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function cancelRequest(id) {
    setMessage('');

    try {
      const result = await api(`/requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELADO' })
      });
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function openConversation(request) {
    setConversation({ request, messages: [], text: '', loading: true });

    try {
      const messages = await api(`/messages/${request.id}`);
      setConversation({ request, messages, text: '', loading: false });
    } catch (error) {
      setMessage(error.message);
      setConversation({ request: null, messages: [], text: '', loading: false });
    }
  }

  async function sendConversationMessage(event) {
    event.preventDefault();
    if (!conversation.request || !conversation.text.trim()) return;

    const text = conversation.text;
    setConversation((current) => ({ ...current, text: '', loading: true }));

    try {
      await api(`/messages/${conversation.request.id}`, {
        method: 'POST',
        body: JSON.stringify({ message: text })
      });
      const messages = await api(`/messages/${conversation.request.id}`);
      setConversation((current) => ({ ...current, messages, loading: false }));
    } catch (error) {
      setMessage(error.message);
      setConversation((current) => ({ ...current, text, loading: false }));
    }
  }

  const metrics = [
    { label: 'Servicos ativos', value: services.length, icon: BriefcaseBusiness },
    { label: 'Minhas solicitacoes', value: requests.length, icon: ClipboardList },
    { label: 'Plano atual', value: planInfo.subscription?.name || 'Cliente Gratuito', icon: ShieldCheck },
    {
      label: 'Em andamento',
      value: requests.filter((request) => ['SOLICITADO', 'ACEITO', 'EM_ANDAMENTO'].includes(request.status)).length,
      icon: CalendarDays
    }
  ];
  const headers = {
    services: {
      eyebrow: 'Buscar servico',
      title: 'Encontre um profissional disponivel',
      description: 'Filtre por categoria, compare prestadores e acompanhe cada contratacao pelo painel.',
      icon: Search
    },
    requests: {
      eyebrow: 'Minhas solicitacoes',
      title: 'Acompanhe seus pedidos',
      description: 'Veja o status de cada servico solicitado, prestador responsavel e valor contratado.',
      icon: ClipboardList
    },
    payments: {
      eyebrow: 'Pagamentos',
      title: 'Historico financeiro',
      description: 'Consulte valores, formas de pagamento e situacao financeira das suas contratacoes.',
      icon: CreditCard
    },
    plans: {
      eyebrow: 'Planos do cliente',
      title: 'Escolha como quer contratar',
      description: 'O plano do cliente controla o limite mensal de solicitacoes e o nivel de atendimento.',
      icon: ShieldCheck
    }
  };
  const header = headers[view] || headers.services;
  const HeaderIcon = header.icon;

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow"><HeaderIcon size={16} /> {header.eyebrow}</span>
          <h2>{header.title}</h2>
          <p>{header.description}</p>
        </div>
      </header>

      <MetricGrid metrics={metrics} />

      {message && <div className="notice">{message}</div>}

      {view === 'services' && (
        <>
          <form className="toolbar" onSubmit={search}>
            <input
              placeholder="Buscar por servico, descricao ou prestador"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
            <select
              value={filters.categoryId}
              onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <button className="primary" type="submit">Buscar</button>
          </form>

          <section className="grid cards">
            {services.map((service) => (
              <article className="card" key={service.id}>
                <div className="card-top">
                  <span>{service.category_name}</span>
                  <div className="card-badges">
                    {Number(service.rating || 0) > 0 && <span className="rating-pill"><Star size={15} /> {Number(service.rating).toFixed(1)}</span>}
                    {service.is_verified ? <span className="verified"><ShieldCheck size={16} /> Verificado</span> : null}
                  </div>
                </div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <div className="meta">
                  <strong>{currency.format(service.price)}</strong>
                  <span>{service.provider_name} - {service.city || 'Cidade nao informada'} {service.state || ''}</span>
                </div>
                <button className="card-action" type="button" onClick={() => setSelected(service)}>Solicitar</button>
              </article>
            ))}
          </section>
        </>
      )}

      {view === 'requests' && (
        <ClientRequestsDashboard
          requests={requests}
          onSubmitReview={submitReview}
          onCancelRequest={cancelRequest}
          onOpenConversation={openConversation}
        />
      )}

      {view === 'payments' && (
        <ClientPaymentsDashboard requests={requests} onConfirmPix={confirmPixPayment} />
      )}

      {view === 'plans' && (
        <ClientPlansDashboard planInfo={planInfo} onChanged={refreshPlans} />
      )}

      {selected && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={createRequest}>
            <h3>Solicitar {selected.title}</h3>
            <label>
              Data e horario
              <input
                type="datetime-local"
                value={requestForm.scheduledAt}
                onChange={(event) => setRequestForm((current) => ({ ...current, scheduledAt: event.target.value }))}
              />
            </label>
            <label>
              Endereco
              <input
                value={requestForm.address}
                onChange={(event) => setRequestForm((current) => ({ ...current, address: event.target.value }))}
              />
            </label>
            <label>
              Observacoes
              <textarea
                value={requestForm.notes}
                onChange={(event) => setRequestForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <label>
              Pagamento
              <select
                value={requestForm.paymentMethod}
                onChange={(event) => setRequestForm((current) => ({ ...current, paymentMethod: event.target.value }))}
              >
                <option value="PIX">PIX</option>
                <option value="CARTAO_CREDITO">Cartao de credito</option>
                <option value="CARTAO_DEBITO">Cartao de debito</option>
                <option value="DINHEIRO">Dinheiro</option>
              </select>
            </label>
            {requestForm.paymentMethod === 'PIX' && (
              <div className="payment-method-note">
                <strong>Pagamento por PIX</strong>
                <span>Ao confirmar, o sistema gera um QR Code para o cliente pagar e liberar o repasse ao prestador.</span>
              </div>
            )}
            {requestForm.paymentMethod.startsWith('CARTAO') && (
              <div className="card-payment-fields">
                <label>
                  Nome no cartao
                  <input value={requestForm.cardHolderName} onChange={(event) => setRequestForm((current) => ({ ...current, cardHolderName: event.target.value }))} />
                </label>
                <label>
                  Numero do cartao
                  <input inputMode="numeric" value={requestForm.cardNumber} onChange={(event) => setRequestForm((current) => ({ ...current, cardNumber: event.target.value }))} />
                </label>
                <div className="form-grid">
                  <label>
                    Validade
                    <input placeholder="MM/AA" value={requestForm.cardExpiry} onChange={(event) => setRequestForm((current) => ({ ...current, cardExpiry: event.target.value }))} />
                  </label>
                  <label>
                    CVV
                    <input inputMode="numeric" value={requestForm.cardCvv} onChange={(event) => setRequestForm((current) => ({ ...current, cardCvv: event.target.value }))} />
                  </label>
                </div>
              </div>
            )}
            {requestForm.paymentMethod === 'DINHEIRO' && (
              <div className="payment-method-note">
                <strong>Dinheiro direto ao prestador</strong>
                <span>A taxa da plataforma sera descontada do saldo do prestador. Se nao houver saldo, fica pendente para o proximo repasse.</span>
              </div>
            )}
            {paymentResult?.pix_qr_payload && (
              <div className="pix-box">
                <div className="pix-qr" aria-label="QR Code PIX simulado">
                  {paymentResult.pix_code}
                </div>
                <div>
                  <strong>PIX gerado</strong>
                  <span>{paymentResult.pix_qr_payload}</span>
                  <small>O pedido fica aguardando pagamento ate voce confirmar o PIX neste ambiente de teste.</small>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => { setSelected(null); resetRequestForm(); }}>Cancelar</button>
              {paymentResult?.pix_qr_payload ? (
                <button className="primary" type="button" onClick={confirmPixFromModal}>Ja paguei, finalizar</button>
              ) : (
                <button className="primary" type="submit" disabled={requesting}>
                  {requesting ? 'Processando...' : 'Confirmar'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {conversation.request && (
        <ConversationModal
          conversation={conversation}
          setConversation={setConversation}
          onSubmit={sendConversationMessage}
          currentRole="CLIENTE"
        />
      )}
    </>
  );
}

function ClientRequestsDashboard({ requests, onSubmitReview, onCancelRequest, onOpenConversation }) {
  const [reviewForm, setReviewForm] = useState({ requestId: null, rating: 5, comment: '' });

  function startReview(request) {
    setReviewForm({ requestId: request.id, rating: 5, comment: '' });
  }

  async function submit(event) {
    event.preventDefault();
    await onSubmitReview(reviewForm.requestId, Number(reviewForm.rating), reviewForm.comment);
    setReviewForm({ requestId: null, rating: 5, comment: '' });
  }

  return (
    <section className="section active-section">
      <div className="section-heading">
        <div>
          <h2>Minhas solicitacoes</h2>
          <p>Acompanhe atendimento, pagamento e avalie servicos concluidos.</p>
        </div>
      </div>

      <div className="finance-table">
        {requests.length === 0 ? (
          <div className="empty">Nenhuma solicitacao encontrada.</div>
        ) : (
          requests.map((request) => (
            <article className="finance-row request-history-row" key={request.id}>
              <div className="finance-row-main">
                <strong>{request.service_title}</strong>
                <span>{request.provider_name} - {formatCell('scheduled_at', request.scheduled_at)}</span>
              </div>
              <div className="finance-values">
                <div>
                  <span>Status</span>
                  <strong>{request.status}</strong>
                </div>
                <div>
                  <span>Pagamento</span>
                  <strong>{request.payment_status || 'PENDENTE'}</strong>
                </div>
                <div>
                  <span>Valor</span>
                  <strong>{currency.format(request.total_amount || 0)}</strong>
                </div>
              </div>
              <div className="finance-actions">
                <button type="button" onClick={() => onOpenConversation(request)}>
                  <MessageSquareText size={16} /> Conversar
                </button>
                {!['CONCLUIDO', 'CANCELADO'].includes(request.status) && (
                  <button type="button" onClick={() => onCancelRequest(request.id)}>
                    <XCircle size={16} /> Cancelar
                  </button>
                )}
                {request.review_rating ? (
                  <span className="rating-pill"><Star size={15} /> {request.review_rating}/5</span>
                ) : request.status === 'CONCLUIDO' && request.payment_status === 'PAGO' ? (
                  <button type="button" onClick={() => startReview(request)}>Avaliar</button>
                ) : (
                  <small>Avaliacao apos conclusao</small>
                )}
              </div>
              {reviewForm.requestId === request.id && (
                <form className="review-form" onSubmit={submit}>
                  <label>
                    Nota
                    <select value={reviewForm.rating} onChange={(event) => setReviewForm((current) => ({ ...current, rating: event.target.value }))}>
                      <option value="5">5 - Excelente</option>
                      <option value="4">4 - Muito bom</option>
                      <option value="3">3 - Bom</option>
                      <option value="2">2 - Regular</option>
                      <option value="1">1 - Ruim</option>
                    </select>
                  </label>
                  <label>
                    Comentario
                    <textarea value={reviewForm.comment} onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} />
                  </label>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setReviewForm({ requestId: null, rating: 5, comment: '' })}>Cancelar</button>
                    <button className="primary" type="submit">Enviar avaliacao</button>
                  </div>
                </form>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ConversationModal({ conversation, setConversation, onSubmit, currentRole }) {
  const request = conversation.request;

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal conversation-modal" onSubmit={onSubmit}>
        <div className="modal-head">
          <div>
            <span className="eyebrow"><MessageSquareText size={16} /> Conversa da solicitacao</span>
            <h3>{request.service_title}</h3>
            <p>{request.client_name ? `Cliente: ${request.client_name}` : `Prestador: ${request.provider_name}`}</p>
          </div>
          <StatusBadge value={request.status} />
        </div>

        <div className="conversation-log">
          {conversation.loading && conversation.messages.length === 0 ? (
            <div className="empty compact">Carregando conversa...</div>
          ) : conversation.messages.length === 0 ? (
            <div className="empty compact">Nenhuma mensagem ainda.</div>
          ) : (
            conversation.messages.map((message) => {
              const isOwn = message.sender_role === currentRole;

              return (
                <div className={`message-bubble ${isOwn ? 'own' : ''}`} key={message.id}>
                  <div>
                    <strong>{message.sender_name}</strong>
                    <small>{formatCell('created_at', message.created_at)}</small>
                  </div>
                  <p>{message.message}</p>
                </div>
              );
            })
          )}
        </div>

        <label>
          Mensagem
          <textarea
            value={conversation.text}
            onChange={(event) => setConversation((current) => ({ ...current, text: event.target.value }))}
            placeholder="Combine detalhes do atendimento, acesso ao local ou observacoes finais"
          />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={() => setConversation({ request: null, messages: [], text: '', loading: false })}>Fechar</button>
          <button className="primary" type="submit" disabled={conversation.loading || !conversation.text.trim()}>
            {conversation.loading ? 'Enviando...' : 'Enviar mensagem'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ClientPaymentsDashboard({ requests, onConfirmPix }) {
  return (
    <section className="section active-section">
      <div className="section-heading">
        <div>
          <h2>Pagamentos dos servicos</h2>
          <p>Acompanhe PIX, cartao e dinheiro, incluindo pagamentos pendentes e comprovacao interna.</p>
        </div>
      </div>

      <div className="finance-table">
        {requests.length === 0 ? (
          <div className="empty">Nenhum pagamento encontrado.</div>
        ) : (
          requests.map((request) => (
            <article className="finance-row payment-row" key={request.id}>
              <div className="finance-row-main">
                <strong>{request.service_title}</strong>
                <span>{request.provider_name} - {formatPaymentMethod(request.payment_method)}</span>
              </div>
              <div className="finance-values">
                <div>
                  <span>Total</span>
                  <strong>{currency.format(request.total_amount || 0)}</strong>
                </div>
                <div>
                  <span>Pagamento</span>
                  <strong>{request.payment_status || 'PENDENTE'}</strong>
                </div>
                <div>
                  <span>Referencia</span>
                  <strong>{request.pix_code || request.card_last4 || '-'}</strong>
                </div>
              </div>
              <div className="finance-actions">
                <StatusBadge value={request.payment_status || 'PENDENTE'} />
                {request.payment_method === 'PIX' && request.payment_status !== 'PAGO' ? (
                  <button type="button" onClick={() => onConfirmPix(request.id)}>Confirmar PIX</button>
                ) : (
                  <small>{request.paid_at ? `Pago em ${formatCell('paid_at', request.paid_at)}` : 'Aguardando'}</small>
                )}
              </div>
              {request.pix_qr_payload && request.payment_status !== 'PAGO' && (
                <div className="pix-box compact-pix">
                  <div className="pix-qr">{request.pix_code}</div>
                  <span>{request.pix_qr_payload}</span>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ClientPlansDashboard({ planInfo, onChanged }) {
  const [message, setMessage] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(null);
  const subscription = planInfo.subscription;
  const used = Number(planInfo.usage?.requests_count || 0);
  const limit = subscription?.max_requests_per_month;

  async function subscribe(planId) {
    setMessage('');
    setLoadingPlan(planId);

    try {
      const result = await api('/plans/subscribe', {
        method: 'POST',
        body: JSON.stringify({ planId })
      });
      setMessage(result.message);
      await onChanged();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <>
      {message && <div className={message.includes('sucesso') ? 'notice' : 'error'}>{message}</div>}

      <section className="plans-overview">
        <article className="plan-current">
          <span className="eyebrow"><ShieldCheck size={16} /> Plano do cliente</span>
          <h3>{subscription?.name || 'Cliente Gratuito'}</h3>
          <p>
            {subscription
              ? `${currency.format(subscription.monthly_price)} por mes com ${formatRequestLimit(limit)}.`
              : 'O cliente inicia no plano gratuito para contratar servicos pela plataforma.'}
          </p>
          <div className="plan-current-grid">
            <div>
              <span>Uso no mes</span>
              <strong>{limit === null || limit === undefined ? `${used} solicitacoes` : `${used} de ${limit}`}</strong>
            </div>
            <div>
              <span>Suporte</span>
              <strong>{subscription?.support_level || 'Central de ajuda'}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h3>Beneficios para contratar</h3>
            <CreditCard size={18} />
          </div>
          <div className="stack">
            <div className="list-item">
              <div>
                <strong>Mais solicitacoes</strong>
                <span>Planos pagos ampliam o volume mensal de contratacoes.</span>
              </div>
            </div>
            <div className="list-item">
              <div>
                <strong>Pagamentos no sistema</strong>
                <span>PIX, credito, debito e dinheiro ficam registrados no historico.</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="section active-section">
        <div className="section-heading">
          <div>
            <h2>Planos para clientes</h2>
            <p>Escolha o limite mensal adequado para sua rotina de contratacao.</p>
          </div>
        </div>

        <div className="plans-grid">
          {planInfo.plans.map((plan) => {
            const isCurrent = subscription?.id === plan.id;
            return (
              <article className={`plan-card ${isCurrent ? 'selected' : ''}`} key={plan.id}>
                <div className="plan-card-head">
                  <span>{isCurrent ? 'Plano atual' : 'Disponivel'}</span>
                  <StatusBadge value={plan.is_active ? 'ATIVO' : 'PAUSADO'} />
                </div>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <div className="plan-price">
                  <strong>{currency.format(plan.monthly_price)}</strong>
                  <span>/ mes</span>
                </div>
                <div className="plan-features">
                  <span><ClipboardList size={16} /> {formatRequestLimit(plan.max_requests_per_month)}</span>
                  <span><CreditCard size={16} /> PIX, credito, debito e dinheiro</span>
                  <span><ShieldCheck size={16} /> {plan.support_level}</span>
                </div>
                <button className={isCurrent ? 'ghost' : 'primary'} type="button" disabled={isCurrent || loadingPlan === plan.id} onClick={() => subscribe(plan.id)}>
                  {loadingPlan === plan.id ? 'Atualizando...' : isCurrent ? 'Plano selecionado' : 'Assinar plano'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function ProviderDashboard({ view }) {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [planInfo, setPlanInfo] = useState({ plans: [], subscription: null, usage: { services_count: 0 } });
  const [payoutInfo, setPayoutInfo] = useState({ account: null, balance: { available_amount: 0, pending_fee_amount: 0 }, withdrawals: [] });
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ categoryId: '', title: '', description: '', price: '', durationMinutes: 60 });
  const [editingService, setEditingService] = useState(null);
  const [conversation, setConversation] = useState({ request: null, messages: [], text: '', loading: false });

  async function load() {
    const [categoryRows, serviceRows, requestRows, reviewRows, planRows, payoutRows] = await Promise.all([
      api('/categories'),
      api('/services/mine'),
      api('/requests/mine'),
      api('/reviews/mine'),
      api('/plans/mine'),
      api('/payouts/account')
    ]);
    setCategories(categoryRows);
    setServices(serviceRows);
    setRequests(uniqueById(requestRows));
    setReviews(reviewRows);
    setPlanInfo(planRows);
    setPayoutInfo(payoutRows);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  function resetServiceForm() {
    setEditingService(null);
    setForm({ categoryId: '', title: '', description: '', price: '', durationMinutes: 60 });
  }

  function startServiceEdit(service) {
    setEditingService(service);
    setForm({
      categoryId: service.category_id,
      title: service.title,
      description: service.description,
      price: service.price,
      durationMinutes: service.duration_minutes
    });
  }

  async function saveService(event) {
    event.preventDefault();
    setMessage('');

    try {
      const path = editingService ? `/services/${editingService.id}` : '/services';
      const method = editingService ? 'PATCH' : 'POST';
      const result = await api(path, { method, body: JSON.stringify(form) });
      resetServiceForm();
      setMessage(result.message || (editingService ? 'Servico atualizado.' : 'Servico cadastrado.'));
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateRequest(id, status) {
    await api(`/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await load();
  }

  async function updateServiceStatus(id, status) {
    setMessage('');

    try {
      const result = await api(`/services/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function openConversation(request) {
    setConversation({ request, messages: [], text: '', loading: true });

    try {
      const messages = await api(`/messages/${request.id}`);
      setConversation({ request, messages, text: '', loading: false });
    } catch (error) {
      setMessage(error.message);
      setConversation({ request: null, messages: [], text: '', loading: false });
    }
  }

  async function sendConversationMessage(event) {
    event.preventDefault();
    if (!conversation.request || !conversation.text.trim()) return;

    const text = conversation.text;
    setConversation((current) => ({ ...current, text: '', loading: true }));

    try {
      await api(`/messages/${conversation.request.id}`, {
        method: 'POST',
        body: JSON.stringify({ message: text })
      });
      const messages = await api(`/messages/${conversation.request.id}`);
      setConversation((current) => ({ ...current, messages, loading: false }));
    } catch (error) {
      setMessage(error.message);
      setConversation((current) => ({ ...current, text, loading: false }));
    }
  }

  async function refreshPlans() {
    const planRows = await api('/plans/mine');
    setPlanInfo(planRows);
    await load();
  }

  const metrics = [
    { label: 'Servicos cadastrados', value: services.length, icon: BriefcaseBusiness },
    { label: 'Solicitacoes recebidas', value: requests.length, icon: ClipboardList },
    { label: 'Avaliacao media', value: formatRatingAverage(reviews), icon: Star },
    { label: 'Plano atual', value: planInfo.subscription?.name || 'Sem plano', icon: ShieldCheck },
    { label: 'Saldo disponivel', value: currency.format(payoutInfo.balance?.available_amount || 0), icon: Banknote },
    { label: 'A receber liquido', value: currency.format(requests.reduce((total, item) => total + Number(item.provider_amount || 0), 0)), icon: WalletCards }
  ];
  const financeTotals = useMemo(() => {
    const gross = requests.reduce((total, request) => total + Number(request.total_amount || 0), 0);
    const fees = requests.reduce((total, request) => total + Number(request.platform_fee || 0), 0);
    const net = requests.reduce((total, request) => total + Number(request.provider_amount || 0), 0);
    const paidNet = requests
      .filter((request) => request.payment_status === 'PAGO')
      .reduce((total, request) => total + Number(request.provider_amount || 0), 0);
    const pendingNet = requests
      .filter((request) => request.payment_status !== 'PAGO')
      .reduce((total, request) => total + Number(request.provider_amount || 0), 0);

    return {
      gross,
      fees,
      net,
      paidNet,
      pendingNet,
      paidCount: requests.filter((request) => request.payment_status === 'PAGO').length,
      pendingCount: requests.filter((request) => request.payment_status !== 'PAGO').length
    };
  }, [requests]);
  const hasActivePlan = Boolean(planInfo.subscription);
  const planLimit = planInfo.subscription?.max_services;
  const hasServiceSlots = hasActivePlan && (planLimit === null || planLimit === undefined || services.length < Number(planLimit));
  const headers = {
    services: {
      eyebrow: 'Area do prestador',
      title: 'Publique servicos e acompanhe sua oferta',
      description: 'Cadastre sua oferta, ajuste precos e mantenha seus servicos disponiveis para clientes.',
      icon: UserRoundPlus
    },
    requests: {
      eyebrow: 'Solicitacoes',
      title: 'Gerencie pedidos recebidos',
      description: 'Aceite atendimentos, conclua servicos e acompanhe os valores relacionados.',
      icon: ClipboardList
    },
    agenda: {
      eyebrow: 'Agenda',
      title: 'Proximos atendimentos',
      description: 'Veja solicitacoes em aberto e organize sua operacao diaria.',
      icon: CalendarDays
    },
    finance: {
      eyebrow: 'Financeiro do prestador',
      title: 'Valores a receber e taxas',
      description: 'Acompanhe o bruto contratado, as taxas da plataforma e o valor liquido de cada servico.',
      icon: WalletCards
    },
    payouts: {
      eyebrow: 'Saques e conta',
      title: 'Saldo disponivel e retirada',
      description: 'Cadastre PIX ou conta bancaria, acompanhe taxas pendentes e solicite saque.',
      icon: Banknote
    },
    plans: {
      eyebrow: 'Planos e assinatura',
      title: 'Defina sua capacidade comercial',
      description: 'Escolha o plano que controla limite de servicos, taxa da plataforma e nivel de suporte.',
      icon: ShieldCheck
    },
    reviews: {
      eyebrow: 'Reputacao',
      title: 'Avaliacoes dos clientes',
      description: 'Acompanhe notas, comentarios e qualidade percebida nos atendimentos concluidos.',
      icon: Star
    }
  };
  const header = headers[view] || headers.services;
  const HeaderIcon = header.icon;

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow"><HeaderIcon size={16} /> {header.eyebrow}</span>
          <h2>{header.title}</h2>
          <p>{header.description}</p>
        </div>
      </header>

      {message && <div className="notice">{message}</div>}
      <MetricGrid metrics={metrics} />

      {view === 'services' && (
        <section className="split">
          <form className="panel" onSubmit={saveService}>
            <div className="panel-title">
              <h3>{editingService ? 'Editar servico' : 'Novo servico'}</h3>
              {editingService ? <Pencil size={18} /> : <Plus size={18} />}
            </div>
            <div className={hasServiceSlots ? 'form-note' : 'form-note warning'}>
              <strong>{hasActivePlan ? `Plano ${planInfo.subscription.name}` : 'Plano necessario'}</strong>
              <span>
                {hasActivePlan
                  ? `${formatPlanLimit(planLimit)} permitidos. Voce usa ${services.length}.`
                  : 'Assine um plano para publicar servicos na plataforma.'}
              </span>
            </div>
            <label>
              Categoria
              <select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                <option value="">Selecione</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              Titulo
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              Descricao
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="form-grid">
              <label>
                Preco
                <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
              </label>
              <label>
                Minutos
                <input type="number" min="15" value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
              </label>
            </div>
            <button className="primary" type="submit" disabled={!editingService && !hasServiceSlots}>
              {editingService ? 'Salvar alteracoes' : hasServiceSlots ? 'Cadastrar servico' : hasActivePlan ? 'Limite do plano atingido' : 'Escolha um plano'}
            </button>
            {editingService && (
              <button type="button" onClick={resetServiceForm}>Cancelar edicao</button>
            )}
          </form>

          <section className="panel">
            <h3>Meus servicos</h3>
            <div className="stack">
              {services.length === 0 ? (
                <div className="empty compact">Nenhum servico cadastrado.</div>
              ) : (
                services.map((service) => (
                  <div className="list-item service-management-row" key={service.id}>
                    <div>
                      <strong>{service.title}</strong>
                      <span>{service.category_name} - {currency.format(service.price)} - {service.duration_minutes} min</span>
                    </div>
                    <div className="row-actions">
                      <StatusBadge value={service.status} />
                      <button type="button" onClick={() => startServiceEdit(service)}>
                        <Pencil size={16} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => updateServiceStatus(service.id, service.status === 'ATIVO' ? 'PAUSADO' : 'ATIVO')}
                      >
                        {service.status === 'ATIVO' ? 'Pausar' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}

      {(view === 'requests' || view === 'agenda') && (
      <section className="section active-section">
        <div className="stack">
          {requests.map((request) => (
            <article className="request-row" key={request.id}>
              <div className="request-main">
                <strong>{request.service_title}</strong>
                <span>Cliente: {request.client_name}</span>
              </div>
              <div className="request-details-grid">
                <div>
                  <span>Data</span>
                  <strong>{formatDateOnly(request.scheduled_at)}</strong>
                </div>
                <div>
                  <span>Horario</span>
                  <strong>{formatTimeOnly(request.scheduled_at)}</strong>
                </div>
                <div>
                  <span>Endereco</span>
                  <strong>{request.address || 'Nao informado'}</strong>
                </div>
                <div>
                  <span>Pagamento</span>
                  <strong>{formatPaymentMethod(request.payment_method)}</strong>
                </div>
              </div>
              {request.notes && (
                <div className="request-note">
                  <span>Observacoes</span>
                  <strong>{request.notes}</strong>
                </div>
              )}
              <div className="request-value">
                <span>Valor liquido</span>
                <strong>{currency.format(request.provider_amount || 0)}</strong>
              </div>
              <StatusBadge value={request.status} />
              <StatusBadge value={request.payment_status || 'PENDENTE'} />
              <div className="actions">
                <button type="button" onClick={() => openConversation(request)}>
                  <MessageSquareText size={16} /> Conversar
                </button>
                <button type="button" disabled={request.payment_status !== 'PAGO'} onClick={() => updateRequest(request.id, 'ACEITO')}>Aceitar</button>
                <button type="button" disabled={request.payment_status !== 'PAGO'} onClick={() => updateRequest(request.id, 'CONCLUIDO')}>Concluir</button>
              </div>
              {request.payment_status !== 'PAGO' && (
                <small className="row-warning">Aguardando pagamento para liberar o atendimento.</small>
              )}
            </article>
          ))}
        </div>
      </section>
      )}

      {view === 'finance' && (
        <ProviderFinanceDashboard requests={requests} totals={financeTotals} subscription={planInfo.subscription} />
      )}

      {view === 'plans' && (
        <ProviderPlansDashboard planInfo={planInfo} onChanged={refreshPlans} />
      )}

      {view === 'payouts' && (
        <ProviderPayoutDashboard payoutInfo={payoutInfo} onChanged={load} />
      )}

      {view === 'reviews' && (
        <ProviderReviewsDashboard reviews={reviews} />
      )}

      {conversation.request && (
        <ConversationModal
          conversation={conversation}
          setConversation={setConversation}
          onSubmit={sendConversationMessage}
          currentRole="PRESTADOR"
        />
      )}
    </>
  );
}

function ProviderFinanceDashboard({ requests, totals, subscription }) {
  const commissionLabel = subscription ? `${Number(subscription.commission_rate).toFixed(1)}%` : 'Sem plano';
  const statusRows = [
    { label: 'Total liquido a receber', value: requests.length, amount: totals.net, icon: WalletCards },
    { label: 'Taxas da plataforma', value: commissionLabel, amount: totals.fees, icon: Banknote },
    { label: 'Ja confirmado', value: totals.paidCount, amount: totals.paidNet, icon: CheckCircle2 },
    { label: 'Pendente de pagamento', value: totals.pendingCount, amount: totals.pendingNet, icon: Clock3 }
  ];

  return (
    <>
      <section className="finance-grid">
        <article className="finance-hero provider-finance-hero">
          <span className="eyebrow"><WalletCards size={16} /> Meu financeiro</span>
          <h3>{currency.format(totals.net)}</h3>
          <p>Valor liquido estimado apos desconto das taxas da plataforma.</p>
          <div className="finance-split">
            <div>
              <span>Bruto contratado</span>
              <strong>{currency.format(totals.gross)}</strong>
            </div>
            <div>
              <span>Taxas</span>
              <strong>{currency.format(totals.fees)}</strong>
            </div>
          </div>
        </article>

        <section className="finance-status">
          {statusRows.map((item) => {
            const Icon = item.icon;
            return (
              <article className="finance-status-item" key={item.label}>
                <span className="metric-icon"><Icon size={20} /></span>
                <div>
                  <span>{item.label}</span>
                  <strong>{currency.format(item.amount)}</strong>
                  <small>{item.value}</small>
                </div>
              </article>
            );
          })}
        </section>
      </section>

      <section className="section active-section">
        <div className="section-heading">
          <div>
            <h2>Extrato por servico</h2>
            <p>Veja quanto o cliente pagou, quanto ficou como taxa e quanto sera repassado para voce.</p>
          </div>
        </div>

        <div className="finance-table">
          {requests.length === 0 ? (
            <div className="empty">Nenhum valor financeiro encontrado.</div>
          ) : (
            requests.map((request) => (
              <article className="finance-row" key={request.id}>
                <div className="finance-row-main">
                  <strong>{request.service_title}</strong>
                  <span>{request.client_name} - {request.status}</span>
                </div>
                <div className="finance-values">
                  <div>
                    <span>Valor bruto</span>
                    <strong>{currency.format(request.total_amount || 0)}</strong>
                  </div>
                  <div>
                    <span>Taxa plataforma</span>
                    <strong>{currency.format(request.platform_fee || 0)}</strong>
                  </div>
                  <div>
                    <span>Seu repasse</span>
                    <strong>{currency.format(request.provider_amount || 0)}</strong>
                  </div>
                </div>
                <div className="finance-actions">
                  <StatusBadge value={request.payment_status || 'PENDENTE'} />
                  <small>{formatPaymentMethod(request.payment_method)}</small>
                  {request.provider_fee_status && request.provider_fee_status !== 'NAO_APLICA' && (
                    <small>Taxa: {formatFeeStatus(request.provider_fee_status)}</small>
                  )}
                  <small>{request.paid_at ? `Pago em ${formatCell('paid_at', request.paid_at)}` : 'Aguardando pagamento'}</small>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function ProviderPlansDashboard({ planInfo, onChanged }) {
  const [message, setMessage] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(null);
  const subscription = planInfo.subscription;
  const usageCount = Number(planInfo.usage?.services_count || 0);
  const usageLimit = subscription?.max_services;
  const usageLabel = usageLimit === null || usageLimit === undefined ? `${usageCount} publicados` : `${usageCount} de ${usageLimit} servicos`;

  async function subscribe(planId) {
    setMessage('');
    setLoadingPlan(planId);

    try {
      const result = await api('/plans/subscribe', {
        method: 'POST',
        body: JSON.stringify({ planId })
      });
      setMessage(result.message);
      await onChanged();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <>
      {message && <div className={message.includes('sucesso') ? 'notice' : 'error'}>{message}</div>}

      <section className="plans-overview">
        <article className="plan-current">
          <span className="eyebrow"><ShieldCheck size={16} /> Assinatura ativa</span>
          <h3>{subscription?.name || 'Nenhum plano ativo'}</h3>
          <p>
            {subscription
              ? `${currency.format(subscription.monthly_price)} por mes com taxa de ${Number(subscription.commission_rate).toFixed(1)}% por contratacao.`
              : 'Escolha um plano para publicar servicos e liberar a operacao financeira.'}
          </p>
          <div className="plan-current-grid">
            <div>
              <span>Uso atual</span>
              <strong>{usageLabel}</strong>
            </div>
            <div>
              <span>Suporte</span>
              <strong>{subscription?.support_level || '-'}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h3>Como o plano afeta o financeiro</h3>
            <Banknote size={18} />
          </div>
          <div className="stack">
            <div className="list-item">
              <div>
                <strong>Taxa por servico</strong>
                <span>Aplicada automaticamente quando o cliente contrata um servico.</span>
              </div>
              <strong>{subscription ? `${Number(subscription.commission_rate).toFixed(1)}%` : '-'}</strong>
            </div>
            <div className="list-item">
              <div>
                <strong>Limite de publicacao</strong>
                <span>Controla quantos servicos o prestador pode manter cadastrados.</span>
              </div>
              <strong>{usageLimit ?? 'Ilimitado'}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="section active-section">
        <div className="section-heading">
          <div>
            <h2>Planos disponiveis</h2>
            <p>Compare mensalidade, taxa da plataforma, limite de servicos e suporte.</p>
          </div>
        </div>

        <div className="plans-grid">
          {planInfo.plans.map((plan) => {
            const isCurrent = subscription?.id === plan.id;
            return (
              <article className={`plan-card ${isCurrent ? 'selected' : ''}`} key={plan.id}>
                <div className="plan-card-head">
                  <span>{isCurrent ? 'Plano atual' : 'Disponivel'}</span>
                  <StatusBadge value={plan.is_active ? 'ATIVO' : 'PAUSADO'} />
                </div>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <div className="plan-price">
                  <strong>{currency.format(plan.monthly_price)}</strong>
                  <span>/ mes</span>
                </div>
                <div className="plan-features">
                  <span><Banknote size={16} /> {Number(plan.commission_rate).toFixed(1)}% de taxa</span>
                  <span><BriefcaseBusiness size={16} /> {formatPlanLimit(plan.max_services)}</span>
                  <span><ShieldCheck size={16} /> {plan.support_level}</span>
                </div>
                <button className={isCurrent ? 'ghost' : 'primary'} type="button" disabled={isCurrent || loadingPlan === plan.id} onClick={() => subscribe(plan.id)}>
                  {loadingPlan === plan.id ? 'Atualizando...' : isCurrent ? 'Plano selecionado' : 'Assinar plano'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function ProviderPayoutDashboard({ payoutInfo, onChanged }) {
  const [accountForm, setAccountForm] = useState(() => ({
    payoutMethod: payoutInfo.account?.payout_method || 'PIX',
    pixKey: payoutInfo.account?.pix_key || '',
    bankName: payoutInfo.account?.bank_name || '',
    agency: payoutInfo.account?.agency || '',
    accountNumber: payoutInfo.account?.account_number || '',
    accountType: payoutInfo.account?.account_type || 'CORRENTE',
    holderName: payoutInfo.account?.holder_name || '',
    document: payoutInfo.account?.document || ''
  }));
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', method: 'PIX' });
  const [message, setMessage] = useState('');
  const balance = payoutInfo.balance || { available_amount: 0, pending_fee_amount: 0 };

  useEffect(() => {
    setAccountForm({
      payoutMethod: payoutInfo.account?.payout_method || 'PIX',
      pixKey: payoutInfo.account?.pix_key || '',
      bankName: payoutInfo.account?.bank_name || '',
      agency: payoutInfo.account?.agency || '',
      accountNumber: payoutInfo.account?.account_number || '',
      accountType: payoutInfo.account?.account_type || 'CORRENTE',
      holderName: payoutInfo.account?.holder_name || '',
      document: payoutInfo.account?.document || ''
    });
  }, [payoutInfo.account]);

  function updateAccount(field, value) {
    setAccountForm((current) => ({ ...current, [field]: value }));
  }

  async function saveAccount(event) {
    event.preventDefault();
    setMessage('');

    try {
      const result = await api('/payouts/account', {
        method: 'PATCH',
        body: JSON.stringify(accountForm)
      });
      setMessage(result.message);
      await onChanged();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function withdraw(event) {
    event.preventDefault();
    setMessage('');

    try {
      const result = await api('/payouts/withdraw', {
        method: 'POST',
        body: JSON.stringify(withdrawForm)
      });
      setMessage(result.message);
      setWithdrawForm({ amount: '', method: withdrawForm.method });
      await onChanged();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      {message && <div className={message.includes('sucesso') || message.includes('salvos') ? 'notice' : 'error'}>{message}</div>}

      <section className="finance-grid">
        <article className="finance-hero provider-finance-hero">
          <span className="eyebrow"><Banknote size={16} /> Saldo do prestador</span>
          <h3>{currency.format(balance.available_amount || 0)}</h3>
          <p>Valor disponivel para saque apos pagamentos feitos pelo sistema e compensacao de taxas pendentes.</p>
          <div className="finance-split">
            <div>
              <span>Taxa pendente</span>
              <strong>{currency.format(balance.pending_fee_amount || 0)}</strong>
            </div>
            <div>
              <span>Saques solicitados</span>
              <strong>{payoutInfo.withdrawals?.length || 0}</strong>
            </div>
          </div>
        </article>

        <form className="panel" onSubmit={withdraw}>
          <div className="panel-title">
            <h3>Solicitar saque</h3>
            <WalletCards size={18} />
          </div>
          <div className="form-grid">
            <label>
              Valor
              <input type="number" min="1" step="0.01" value={withdrawForm.amount} onChange={(event) => setWithdrawForm((current) => ({ ...current, amount: event.target.value }))} />
            </label>
            <label>
              Metodo
              <select value={withdrawForm.method} onChange={(event) => setWithdrawForm((current) => ({ ...current, method: event.target.value }))}>
                <option value="PIX">PIX</option>
                <option value="CONTA_BANCARIA">Conta bancaria</option>
              </select>
            </label>
          </div>
          <div className="form-note">
            <strong>Regra do dinheiro</strong>
            <span>Quando o cliente paga em dinheiro, a plataforma desconta a taxa do saldo disponivel. Se nao houver saldo, a taxa fica pendente para o proximo repasse.</span>
          </div>
          <button className="primary" type="submit">Solicitar retirada</button>
        </form>
      </section>

      <section className="split">
        <form className="panel" onSubmit={saveAccount}>
          <div className="panel-title">
            <h3>Conta para recebimento</h3>
            <Save size={18} />
          </div>
          <label>
            Tipo de saque
            <select value={accountForm.payoutMethod} onChange={(event) => updateAccount('payoutMethod', event.target.value)}>
              <option value="PIX">PIX</option>
              <option value="CONTA_BANCARIA">Conta bancaria</option>
            </select>
          </label>
          {accountForm.payoutMethod === 'PIX' ? (
            <label>
              Chave PIX
              <input value={accountForm.pixKey} onChange={(event) => updateAccount('pixKey', event.target.value)} />
            </label>
          ) : (
            <>
              <label>
                Banco
                <input value={accountForm.bankName} onChange={(event) => updateAccount('bankName', event.target.value)} />
              </label>
              <div className="form-grid">
                <label>
                  Agencia
                  <input value={accountForm.agency} onChange={(event) => updateAccount('agency', event.target.value)} />
                </label>
                <label>
                  Conta
                  <input value={accountForm.accountNumber} onChange={(event) => updateAccount('accountNumber', event.target.value)} />
                </label>
              </div>
              <label>
                Tipo de conta
                <select value={accountForm.accountType} onChange={(event) => updateAccount('accountType', event.target.value)}>
                  <option value="CORRENTE">Corrente</option>
                  <option value="POUPANCA">Poupanca</option>
                </select>
              </label>
            </>
          )}
          <div className="form-grid">
            <label>
              Titular
              <input value={accountForm.holderName} onChange={(event) => updateAccount('holderName', event.target.value)} />
            </label>
            <label>
              CPF/CNPJ
              <input value={accountForm.document} onChange={(event) => updateAccount('document', event.target.value)} />
            </label>
          </div>
          <button className="primary" type="submit">Salvar conta</button>
        </form>

        <section className="panel">
          <div className="panel-title">
            <h3>Historico de saques</h3>
            <ReceiptText size={18} />
          </div>
          <div className="stack">
            {payoutInfo.withdrawals?.length ? (
              payoutInfo.withdrawals.map((withdrawal) => (
                <div className="list-item" key={withdrawal.id}>
                  <div>
                    <strong>{currency.format(withdrawal.amount || 0)}</strong>
                    <span>{formatPaymentMethod(withdrawal.method)} - {formatCell('created_at', withdrawal.created_at)}</span>
                  </div>
                  <StatusBadge value={withdrawal.status} />
                </div>
              ))
            ) : (
              <div className="empty compact">Nenhum saque solicitado.</div>
            )}
          </div>
        </section>
      </section>
    </>
  );
}

function ProviderReviewsDashboard({ reviews }) {
  const average = reviews.length
    ? reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length
    : 0;

  return (
    <>
      <section className="metrics">
        <article className="metric">
          <span className="metric-icon"><Star size={21} /></span>
          <span>Media geral</span>
          <strong>{average ? average.toFixed(1) : '-'}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon"><ClipboardList size={21} /></span>
          <span>Avaliacoes recebidas</span>
          <strong>{reviews.length}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon"><ShieldCheck size={21} /></span>
          <span>Notas 4 ou 5</span>
          <strong>{reviews.filter((review) => Number(review.rating) >= 4).length}</strong>
        </article>
      </section>

      <section className="section active-section">
        <div className="section-heading">
          <div>
            <h2>Comentarios recentes</h2>
            <p>Use o feedback dos clientes para melhorar atendimento, pontualidade e descricao dos servicos.</p>
          </div>
        </div>

        <div className="review-grid">
          {reviews.length === 0 ? (
            <div className="empty">Nenhuma avaliacao recebida ainda.</div>
          ) : (
            reviews.map((review) => (
              <article className="review-card" key={review.id}>
                <div className="review-head">
                  <span className="rating-pill"><Star size={15} /> {review.rating}/5</span>
                  <small>{formatCell('created_at', review.created_at)}</small>
                </div>
                <h3>{review.service_title}</h3>
                <p>{review.comment || 'Cliente nao deixou comentario.'}</p>
                <span>{review.client_name}</span>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function AdminDashboard({ view }) {
  const [overview, setOverview] = useState(null);
  const [requests, setRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [planSummary, setPlanSummary] = useState({ plans: [], totals: { active_subscriptions: 0, monthly_recurring_revenue: 0, active_plans: 0 } });
  const [message, setMessage] = useState('');

  async function load() {
    const [overviewData, requestRows, transactionRows, withdrawalRows, planRows, userRows, categoryRows] = await Promise.all([
      api('/admin/overview'),
      api('/admin/requests'),
      api('/admin/transactions'),
      api('/admin/withdrawals'),
      api('/plans/admin/summary'),
      api('/admin/users'),
      api('/categories')
    ]);
    setOverview(overviewData);
    setRequests(uniqueById(requestRows));
    setTransactions(transactionRows);
    setWithdrawals(withdrawalRows);
    setPlanSummary(planRows);
    setUsers(userRows);
    setCategories(categoryRows);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function confirmPayment(id) {
    await api(`/requests/${id}/pay`, { method: 'PATCH' });
    await load();
  }

  async function updateUserStatus(id, status) {
    await api(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await load();
  }

  async function updateProviderVerification(id, isVerified) {
    await api(`/admin/providers/${id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ isVerified })
    });
    await load();
  }

  async function updateWithdrawalStatus(id, status) {
    await api(`/admin/withdrawals/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await load();
  }

  const metrics = useMemo(() => {
    if (!overview) return [];
    return [
      { label: 'Clientes', value: overview.users.clients || 0, icon: UsersRound },
      { label: 'Prestadores', value: overview.users.providers || 0, icon: BriefcaseBusiness },
      { label: 'Volume bruto', value: currency.format(overview.requests.gross_volume || 0), icon: Banknote },
      { label: 'Receita plataforma', value: currency.format(overview.requests.platform_revenue || 0), icon: CheckCircle2 },
      { label: 'Receita mensal planos', value: currency.format(planSummary.totals.monthly_recurring_revenue || 0), icon: ShieldCheck },
      { label: 'Avaliacao media', value: overview.quality?.average_rating ? Number(overview.quality.average_rating).toFixed(1) : '-', icon: Star },
      { label: 'Pagamentos pendentes', value: overview.payments.pending || 0, icon: CreditCard },
      { label: 'Saques em aberto', value: withdrawals.filter((item) => ['SOLICITADO', 'PROCESSANDO'].includes(item.status)).length, icon: Banknote }
    ];
  }, [overview, planSummary, withdrawals]);
  const financeTotals = useMemo(() => {
    const gross = requests.reduce((total, request) => total + Number(request.total_amount || 0), 0);
    const platform = requests.reduce((total, request) => total + Number(request.platform_fee || 0), 0);
    const payable = requests.reduce((total, request) => total + Number(request.provider_amount || 0), 0);
    const paid = requests
      .filter((request) => request.payment_status === 'PAGO')
      .reduce((total, request) => total + Number(request.total_amount || 0), 0);
    const pending = requests
      .filter((request) => request.payment_status !== 'PAGO')
      .reduce((total, request) => total + Number(request.total_amount || 0), 0);

    return {
      gross,
      platform,
      payable,
      paid,
      pending,
      paidCount: requests.filter((request) => request.payment_status === 'PAGO').length,
      pendingCount: requests.filter((request) => request.payment_status !== 'PAGO').length
    };
  }, [requests]);
  const headers = {
    overview: {
      eyebrow: 'Administracao',
      title: 'Visao geral do sistema',
      description: 'Acompanhe usuarios, demanda, pagamentos pendentes e desempenho financeiro.',
      icon: LayoutDashboard
    },
    finance: {
      eyebrow: 'Financeiro',
      title: 'Pagamentos, taxas e repasses',
      description: 'Controle entradas, taxa da plataforma e valores a repassar aos prestadores.',
      icon: WalletCards
    },
    withdrawals: {
      eyebrow: 'Saques',
      title: 'Aprovacao e acompanhamento de saques',
      description: 'Valide contas de recebimento, acompanhe valores solicitados e finalize repasses aos prestadores.',
      icon: Banknote
    },
    operations: {
      eyebrow: 'Operacao',
      title: 'Solicitacoes da plataforma',
      description: 'Monitore contratacoes, clientes, prestadores e status operacional dos servicos.',
      icon: ClipboardList
    },
    users: {
      eyebrow: 'Usuarios e prestadores',
      title: 'Controle de acesso e verificacao',
      description: 'Gerencie clientes, prestadores, bloqueios, verificacao profissional e indicadores por usuario.',
      icon: UsersRound
    },
    categories: {
      eyebrow: 'Catalogo',
      title: 'Categorias de servicos',
      description: 'Organize o catalogo para facilitar busca, cadastro e operacao comercial.',
      icon: Tags
    },
    plans: {
      eyebrow: 'Planos comerciais',
      title: 'Planos, assinaturas e receita recorrente',
      description: 'Gerencie os planos do marketplace, acompanhe assinantes ativos e receita mensal prevista.',
      icon: ShieldCheck
    }
  };
  const header = headers[view] || headers.overview;
  const HeaderIcon = header.icon;

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow"><HeaderIcon size={16} /> {header.eyebrow}</span>
          <h2>{header.title}</h2>
          <p>{header.description}</p>
        </div>
      </header>

      {message && <div className="notice">{message}</div>}

      <MetricGrid metrics={metrics} />

      {view === 'overview' && (
        <section className="section active-section">
          <DataTable rows={requests.slice(0, 6)} columns={['service_title', 'client_name', 'provider_name', 'status', 'payment_status', 'total_amount']} />
        </section>
      )}

      {view === 'finance' && (
        <FinanceDashboard
          requests={requests}
          transactions={transactions}
          totals={financeTotals}
          onConfirmPayment={confirmPayment}
        />
      )}

      {view === 'withdrawals' && (
        <AdminWithdrawalsDashboard withdrawals={withdrawals} onStatusChange={updateWithdrawalStatus} />
      )}

      {view === 'operations' && (
        <section className="section active-section">
          <DataTable rows={requests} columns={['service_title', 'client_name', 'provider_name', 'status', 'payment_status', 'total_amount']} />
        </section>
      )}

      {view === 'plans' && (
        <AdminPlansDashboard planSummary={planSummary} onChanged={load} />
      )}

      {view === 'users' && (
        <AdminUsersDashboard
          users={users}
          onStatusChange={updateUserStatus}
          onVerificationChange={updateProviderVerification}
        />
      )}

      {view === 'categories' && (
        <AdminCategoriesDashboard categories={categories} onChanged={load} />
      )}
    </>
  );
}

function AdminWithdrawalsDashboard({ withdrawals, onStatusChange }) {
  const totals = {
    processing: withdrawals
      .filter((item) => ['SOLICITADO', 'PROCESSANDO'].includes(item.status))
      .reduce((total, item) => total + Number(item.amount || 0), 0),
    paid: withdrawals
      .filter((item) => item.status === 'PAGO')
      .reduce((total, item) => total + Number(item.amount || 0), 0),
    refused: withdrawals.filter((item) => item.status === 'RECUSADO').length
  };

  return (
    <>
      <section className="metrics">
        <article className="metric">
          <span className="metric-icon"><Clock3 size={21} /></span>
          <span>Em processamento</span>
          <strong>{currency.format(totals.processing)}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon"><CheckCircle2 size={21} /></span>
          <span>Ja pagos</span>
          <strong>{currency.format(totals.paid)}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon"><XCircle size={21} /></span>
          <span>Recusados</span>
          <strong>{totals.refused}</strong>
        </article>
      </section>

      <section className="section active-section">
        <div className="section-heading">
          <div>
            <h2>Solicitacoes de saque</h2>
            <p>Confira o metodo cadastrado antes de finalizar o repasse ao prestador.</p>
          </div>
        </div>

        <div className="withdrawal-grid">
          {withdrawals.length === 0 ? (
            <div className="empty">Nenhum saque solicitado.</div>
          ) : (
            withdrawals.map((withdrawal) => (
              <article className="withdrawal-card" key={withdrawal.id}>
                <div className="user-card-head">
                  <div>
                    <strong>{withdrawal.provider_name}</strong>
                    <span>{withdrawal.provider_email}</span>
                  </div>
                  <StatusBadge value={withdrawal.status} />
                </div>

                <div className="user-card-stats">
                  <div>
                    <span>Valor</span>
                    <strong>{currency.format(withdrawal.amount || 0)}</strong>
                  </div>
                  <div>
                    <span>Metodo</span>
                    <strong>{formatPayoutMethod(withdrawal.method)}</strong>
                  </div>
                  <div>
                    <span>Solicitado</span>
                    <strong>{formatCell('created_at', withdrawal.created_at)}</strong>
                  </div>
                </div>

                <div className="provider-control-strip">
                  {withdrawal.method === 'PIX' ? (
                    <span>PIX: <strong>{withdrawal.pix_key || 'Nao informado'}</strong></span>
                  ) : (
                    <>
                      <span>Banco: <strong>{withdrawal.bank_name || '-'}</strong></span>
                      <span>Agencia: <strong>{withdrawal.agency || '-'}</strong></span>
                      <span>Conta: <strong>{withdrawal.account_number || '-'}</strong></span>
                    </>
                  )}
                  <span>Titular: <strong>{withdrawal.holder_name || '-'}</strong></span>
                  <span>Documento: <strong>{withdrawal.document || '-'}</strong></span>
                </div>

                <div className="card-actions">
                  <button
                    type="button"
                    disabled={withdrawal.status === 'PAGO' || withdrawal.status === 'RECUSADO'}
                    onClick={() => onStatusChange(withdrawal.id, 'PROCESSANDO')}
                  >
                    Processando
                  </button>
                  <button
                    className="primary"
                    type="button"
                    disabled={withdrawal.status === 'PAGO' || withdrawal.status === 'RECUSADO'}
                    onClick={() => onStatusChange(withdrawal.id, 'PAGO')}
                  >
                    Marcar pago
                  </button>
                  <button
                    type="button"
                    disabled={withdrawal.status === 'PAGO' || withdrawal.status === 'RECUSADO'}
                    onClick={() => onStatusChange(withdrawal.id, 'RECUSADO')}
                  >
                    Recusar
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function AdminUsersDashboard({ users, onStatusChange, onVerificationChange }) {
  const [filter, setFilter] = useState('TODOS');
  const [message, setMessage] = useState('');
  const filteredUsers = users.filter((user) => filter === 'TODOS' || user.role === filter);
  const totals = {
    active: users.filter((user) => user.status === 'ATIVO').length,
    blocked: users.filter((user) => user.status === 'BLOQUEADO').length,
    verified: users.filter((user) => user.role === 'PRESTADOR' && Boolean(user.is_verified)).length,
    providers: users.filter((user) => user.role === 'PRESTADOR').length
  };

  async function changeStatus(user) {
    setMessage('');

    try {
      await onStatusChange(user.id, user.status === 'ATIVO' ? 'BLOQUEADO' : 'ATIVO');
      setMessage('Status do usuario atualizado.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function changeVerification(user) {
    setMessage('');

    try {
      await onVerificationChange(user.id, !Boolean(user.is_verified));
      setMessage('Verificacao do prestador atualizada.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      {message && <div className={message.includes('atualizada') ? 'notice' : 'error'}>{message}</div>}

      <section className="metrics">
        <article className="metric">
          <span className="metric-icon"><UsersRound size={21} /></span>
          <span>Usuarios ativos</span>
          <strong>{totals.active}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon"><ShieldCheck size={21} /></span>
          <span>Prestadores verificados</span>
          <strong>{totals.verified} de {totals.providers}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon"><Clock3 size={21} /></span>
          <span>Contas bloqueadas</span>
          <strong>{totals.blocked}</strong>
        </article>
      </section>

      <section className="section active-section">
        <div className="section-heading">
          <div>
            <h2>Diretorio de usuarios</h2>
            <p>Analise perfil, status, plano, volume e a situacao comercial de cada conta.</p>
          </div>
          <div className="segmented inline-segmented">
            {['TODOS', 'CLIENTE', 'PRESTADOR', 'ADMIN'].map((role) => (
              <button
                className={filter === role ? 'active' : ''}
                type="button"
                key={role}
                onClick={() => setFilter(role)}
              >
                {role === 'TODOS' ? 'Todos' : roles[role]}
              </button>
            ))}
          </div>
        </div>

        <div className="user-management-grid">
          {filteredUsers.length === 0 ? (
            <div className="empty">Nenhum usuario encontrado.</div>
          ) : (
            filteredUsers.map((user) => (
              <article className="user-management-card" key={user.id}>
                <div className="user-card-head">
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <StatusBadge value={user.status} />
                </div>

                <div className="user-card-meta">
                  <span>{roles[user.role]}</span>
                  <span>{user.city || '-'}{user.state ? `, ${user.state}` : ''}</span>
                  <span>{user.phone || 'Sem telefone'}</span>
                </div>

                <div className="user-card-stats">
                  <div>
                    <span>Solicitacoes</span>
                    <strong>{user.requests_count || 0}</strong>
                  </div>
                  <div>
                    <span>Volume</span>
                    <strong>{currency.format(user.gross_volume || 0)}</strong>
                  </div>
                  <div>
                    <span>Servicos</span>
                    <strong>{user.services_count || 0}</strong>
                  </div>
                </div>

                {user.role === 'PRESTADOR' && (
                  <div className="provider-control-strip">
                    <span>Plano: <strong>{user.plan_name || 'Sem plano'}</strong></span>
                    <span>Taxa: <strong>{user.commission_rate ? `${Number(user.commission_rate).toFixed(1)}%` : '-'}</strong></span>
                    <span>Verificacao: <strong>{user.is_verified ? 'Aprovado' : 'Pendente'}</strong></span>
                  </div>
                )}

                <div className="card-actions">
                  <button type="button" onClick={() => changeStatus(user)}>
                    {user.status === 'ATIVO' ? 'Bloquear' : 'Desbloquear'}
                  </button>
                  {user.role === 'PRESTADOR' && (
                    <button type="button" onClick={() => changeVerification(user)}>
                      {user.is_verified ? 'Remover verificacao' : 'Verificar prestador'}
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function AdminCategoriesDashboard({ categories, onChanged }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');

  function startEdit(category) {
    setEditing(category.id);
    setForm({ name: category.name, description: category.description || '' });
  }

  function reset() {
    setEditing(null);
    setForm({ name: '', description: '' });
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('');

    try {
      const result = await api(editing ? `/categories/${editing}` : '/categories', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form)
      });
      setMessage(result.message);
      reset();
      await onChanged();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="split">
      <form className="panel" onSubmit={submit}>
        <div className="panel-title">
          <h3>{editing ? 'Editar categoria' : 'Nova categoria'}</h3>
          <Tags size={18} />
        </div>
        {message && <div className={message.includes('sucesso') ? 'notice' : 'error'}>{message}</div>}
        <label>
          Nome
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label>
          Descricao
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </label>
        <div className="modal-actions">
          {editing && <button type="button" onClick={reset}>Cancelar edicao</button>}
          <button className="primary" type="submit">{editing ? 'Salvar categoria' : 'Criar categoria'}</button>
        </div>
      </form>

      <section className="panel">
        <div className="panel-title">
          <h3>Categorias cadastradas</h3>
          <span className="rating-pill">{categories.length}</span>
        </div>
        <div className="stack">
          {categories.map((category) => (
            <div className="list-item service-management-row" key={category.id}>
              <div>
                <strong>{category.name}</strong>
                <span>{category.description || 'Sem descricao'}</span>
              </div>
              <button type="button" onClick={() => startEdit(category)}>Editar</button>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function AdminPlansDashboard({ planSummary, onChanged }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    targetRole: 'PRESTADOR',
    monthlyPrice: '',
    commissionRate: '',
    maxServices: '',
    maxRequestsPerMonth: '',
    supportLevel: ''
  });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const totals = planSummary.totals || {};

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createPlan(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const result = await api('/plans', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setMessage(result.message);
      setForm({
        name: '',
        description: '',
        targetRole: form.targetRole,
        monthlyPrice: '',
        commissionRate: '',
        maxServices: '',
        maxRequestsPerMonth: '',
        supportLevel: ''
      });
      await onChanged();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePlan(plan) {
    setMessage('');

    try {
      const result = await api(`/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !plan.is_active })
      });
      setMessage(result.message);
      await onChanged();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      {message && <div className={message.includes('sucesso') ? 'notice' : 'error'}>{message}</div>}

      <section className="finance-grid">
        <article className="finance-hero plans-hero">
          <span className="eyebrow"><ShieldCheck size={16} /> Receita de planos</span>
          <h3>{currency.format(totals.monthly_recurring_revenue || 0)}</h3>
          <p>Receita mensal prevista considerando apenas assinaturas ativas dos prestadores.</p>
          <div className="finance-split">
            <div>
              <span>Assinaturas ativas</span>
              <strong>{totals.active_subscriptions || 0}</strong>
            </div>
            <div>
              <span>Planos ativos</span>
              <strong>{totals.active_plans || 0}</strong>
            </div>
          </div>
          <div className="finance-split">
            <div>
              <span>Planos prestador</span>
              <strong>{totals.provider_plans || 0}</strong>
            </div>
            <div>
              <span>Planos cliente</span>
              <strong>{totals.client_plans || 0}</strong>
            </div>
          </div>
        </article>

        <form className="panel plan-form" onSubmit={createPlan}>
          <div className="panel-title">
            <h3>Novo plano</h3>
            <Plus size={18} />
          </div>
          <div className="form-grid">
            <label>
              Nome
              <input value={form.name} onChange={(event) => update('name', event.target.value)} />
            </label>
            <label>
              Publico
              <select value={form.targetRole} onChange={(event) => update('targetRole', event.target.value)}>
                <option value="PRESTADOR">Prestador</option>
                <option value="CLIENTE">Cliente</option>
              </select>
            </label>
          </div>
          <label>
            Mensalidade
            <input type="number" min="0" step="0.01" value={form.monthlyPrice} onChange={(event) => update('monthlyPrice', event.target.value)} />
          </label>
          <label>
            Descricao
            <input value={form.description} onChange={(event) => update('description', event.target.value)} />
          </label>
          <div className="form-grid">
            <label>
              Taxa prestador %
              <input type="number" min="0" max="100" step="0.01" value={form.commissionRate} onChange={(event) => update('commissionRate', event.target.value)} disabled={form.targetRole === 'CLIENTE'} />
            </label>
            <label>
              Limite servicos
              <input type="number" min="1" value={form.maxServices} onChange={(event) => update('maxServices', event.target.value)} placeholder="Ilimitado" disabled={form.targetRole === 'CLIENTE'} />
            </label>
          </div>
          <label>
            Limite solicitacoes mensais
            <input type="number" min="1" value={form.maxRequestsPerMonth} onChange={(event) => update('maxRequestsPerMonth', event.target.value)} placeholder="Ilimitado" disabled={form.targetRole === 'PRESTADOR'} />
          </label>
          <label>
            Nivel de suporte
            <input value={form.supportLevel} onChange={(event) => update('supportLevel', event.target.value)} />
          </label>
          <button className="primary" type="submit" disabled={saving}>
            {saving ? 'Criando...' : 'Criar plano'}
          </button>
        </form>
      </section>

      <section className="section active-section">
        <div className="section-heading">
          <div>
            <h2>Carteira de planos</h2>
            <p>Controle comercial para prestadores, incluindo mensalidade, comissao, limite e adesao.</p>
          </div>
        </div>

        <div className="plans-grid admin-plans-grid">
          {planSummary.plans.map((plan) => (
            <article className={`plan-card ${plan.is_active ? '' : 'muted'}`} key={plan.id}>
              <div className="plan-card-head">
                <span>{plan.target_role === 'CLIENTE' ? 'Cliente' : 'Prestador'} - {plan.active_subscriptions} assinantes</span>
                <StatusBadge value={plan.is_active ? 'ATIVO' : 'PAUSADO'} />
              </div>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="plan-price">
                <strong>{currency.format(plan.monthly_price)}</strong>
                <span>/ mes</span>
              </div>
              <div className="plan-features">
                <span><Banknote size={16} /> {Number(plan.commission_rate).toFixed(1)}% por servico</span>
                <span><BriefcaseBusiness size={16} /> {formatPlanLimit(plan.max_services)}</span>
                <span><ClipboardList size={16} /> {formatRequestLimit(plan.max_requests_per_month)}</span>
                <span><ReceiptText size={16} /> {currency.format(plan.monthly_recurring_revenue || 0)} mensais</span>
                <span><ShieldCheck size={16} /> {plan.support_level}</span>
              </div>
              <button type="button" onClick={() => togglePlan(plan)}>
                {plan.is_active ? 'Pausar plano' : 'Ativar plano'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function FinanceDashboard({ requests, transactions, totals, onConfirmPayment }) {
  const statusRows = [
    { label: 'Pagamentos confirmados', value: totals.paidCount, amount: totals.paid, icon: CheckCircle2 },
    { label: 'Aguardando confirmacao', value: totals.pendingCount, amount: totals.pending, icon: Clock3 },
    { label: 'Receita da plataforma', value: 'taxas variaveis', amount: totals.platform, icon: Banknote },
    { label: 'Repasse a prestadores', value: requests.length, amount: totals.payable, icon: WalletCards }
  ];

  return (
    <>
      <section className="finance-grid">
        <article className="finance-hero">
          <span className="eyebrow"><ReceiptText size={16} /> Resumo financeiro</span>
          <h3>{currency.format(totals.gross)}</h3>
          <p>Volume bruto registrado nas solicitacoes da plataforma.</p>
          <div className="finance-split">
            <div>
              <span>Pago</span>
              <strong>{currency.format(totals.paid)}</strong>
            </div>
            <div>
              <span>Pendente</span>
              <strong>{currency.format(totals.pending)}</strong>
            </div>
          </div>
        </article>

        <section className="finance-status">
          {statusRows.map((item) => {
            const Icon = item.icon;
            return (
              <article className="finance-status-item" key={item.label}>
                <span className="metric-icon"><Icon size={20} /></span>
                <div>
                  <span>{item.label}</span>
                  <strong>{currency.format(item.amount)}</strong>
                  <small>{item.value}</small>
                </div>
              </article>
            );
          })}
        </section>
      </section>

      <section className="section active-section">
        <div className="section-heading">
          <div>
            <h2>Conciliacao de pagamentos</h2>
            <p>Confira o valor pago pelo cliente, a taxa da plataforma e o repasse do prestador.</p>
          </div>
        </div>

        <div className="finance-table">
          {requests.length === 0 ? (
            <div className="empty">Nenhum pagamento encontrado.</div>
          ) : (
            requests.map((request) => (
              <article className="finance-row" key={request.id}>
                <div className="finance-row-main">
                  <strong>{request.service_title}</strong>
                  <span>{request.client_name} para {request.provider_name}</span>
                </div>
                <div className="finance-values">
                  <div>
                    <span>Cliente</span>
                    <strong>{currency.format(request.total_amount || 0)}</strong>
                  </div>
                  <div>
                    <span>Taxa</span>
                    <strong>{currency.format(request.platform_fee || 0)}</strong>
                  </div>
                  <div>
                    <span>Repasse</span>
                    <strong>{currency.format(request.provider_amount || 0)}</strong>
                  </div>
                </div>
                <div className="finance-actions">
                  <StatusBadge value={request.payment_status || 'PENDENTE'} />
                  <small>{request.paid_at ? `Pago em ${formatCell('paid_at', request.paid_at)}` : formatPaymentMethod(request.payment_method || 'PIX')}</small>
                  {request.provider_fee_status && request.provider_fee_status !== 'NAO_APLICA' && (
                    <small>Taxa dinheiro: {formatFeeStatus(request.provider_fee_status)}</small>
                  )}
                  <button type="button" disabled={request.payment_status === 'PAGO'} onClick={() => onConfirmPayment(request.id)}>
                    {request.payment_status === 'PAGO' ? 'Confirmado' : 'Confirmar'}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2>Livro de transacoes</h2>
            <p>Lancamentos gerados automaticamente quando um pagamento e confirmado.</p>
          </div>
        </div>
        <DataTable rows={transactions} columns={['request_id', 'type', 'description', 'amount', 'created_at']} />
      </section>
    </>
  );
}

function DataTable({ rows, columns }) {
  if (!rows.length) {
    return <div className="empty">Nenhum registro encontrado.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{columnLabels[column] || column.replaceAll('_', ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => {
                const value = row[column];
                const content = formatCell(column, value);
                return <td key={column}>{column.includes('status') ? <StatusBadge value={content} /> : content}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricGrid({ metrics }) {
  return (
    <section className="metrics">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <article className="metric" key={metric.label}>
            <span className="metric-icon"><Icon size={21} /></span>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        );
      })}
    </section>
  );
}

function formatCell(column, value) {
  if (column === 'monthly_price' || column === 'monthly_recurring_revenue') return currency.format(value || 0);
  if (column === 'commission_rate') return `${Number(value || 0).toFixed(1)}%`;
  if (column === 'max_services') return value ?? 'Ilimitado';
  if (column === 'max_requests_per_month') return formatRequestLimit(value);
  if (column === 'gross_volume') return currency.format(value || 0);
  if (column === 'payment_method') return formatPaymentMethod(value);
  if (column === 'provider_fee_status') return formatFeeStatus(value);
  if (column.includes('amount')) return currency.format(value || 0);
  if (column.endsWith('_at') && value) return new Date(value).toLocaleString('pt-BR');
  return value || '-';
}

function formatPlanLimit(value) {
  return value === null || value === undefined ? 'Servicos ilimitados' : `${value} servicos`;
}

function formatRequestLimit(value) {
  return value === null || value === undefined ? 'Solicitacoes ilimitadas' : `${value} solicitacoes por mes`;
}

function formatRatingAverage(reviews) {
  if (!reviews.length) return '-';
  const average = reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length;
  return average.toFixed(1);
}

function formatDateOnly(value) {
  if (!value) return 'Nao agendada';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatTimeOnly(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatPaymentMethod(value) {
  const labels = {
    PIX: 'PIX',
    CARTAO_CREDITO: 'Cartao de credito',
    CARTAO_DEBITO: 'Cartao de debito',
    DINHEIRO: 'Dinheiro',
    CONTA_BANCARIA: 'Conta bancaria'
  };

  return labels[value] || value || '-';
}

function formatPayoutMethod(value) {
  const labels = {
    PIX: 'PIX',
    CONTA_BANCARIA: 'Conta bancaria'
  };

  return labels[value] || value || '-';
}

function formatFeeStatus(value) {
  const labels = {
    NAO_APLICA: 'Nao aplica',
    DESCONTADA: 'Descontada',
    PENDENTE: 'Pendente'
  };

  return labels[value] || value || '-';
}

function uniqueById(rows) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

export default function App() {
  const auth = useAuth();
  const theme = useTheme();
  const [activeView, setActiveView] = useState(defaultViews.CLIENTE);

  useEffect(() => {
    if (auth.user) {
      setActiveView(defaultViews[auth.user.role]);
    }
  }, [auth.user?.role]);

  if (!auth.user) {
    return <LoginScreen onLogin={auth.saveSession} theme={theme.theme} onToggleTheme={theme.toggleTheme} />;
  }

  return (
    <AppShell
      user={auth.user}
      theme={theme.theme}
      activeView={activeView}
      onNavigate={setActiveView}
      onToggleTheme={theme.toggleTheme}
      onLogout={auth.logout}
    >
      {activeView === 'profile' && <ProfilePanel user={auth.user} onSessionUpdate={auth.saveSession} />}
      {activeView !== 'profile' && auth.user.role === 'CLIENTE' && <ClientDashboard view={activeView} />}
      {activeView !== 'profile' && auth.user.role === 'PRESTADOR' && <ProviderDashboard view={activeView} />}
      {activeView !== 'profile' && auth.user.role === 'ADMIN' && <AdminDashboard view={activeView} />}
    </AppShell>
  );
}
