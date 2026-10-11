import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Boxes,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Command,
  DollarSign,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  UserCircle2,
  Users,
  Warehouse,
  X
} from 'lucide-react';
import { getDashboardSummary } from './api/dashboard';
import { getProducts, createProduct, toggleProductStatus } from './api/products';
import { getCustomers, createCustomer } from './api/customers';
import { getInventory, getLowStock, restockProduct, adjustProduct, getProductHistory } from './api/inventory';
import { getOrders, createOrder, updateOrderStatus, cancelOrder, getOrder } from './api/orders';
import { getCurrentUser, login, logout } from './api/auth';
import { createUser, getUsers, updateUser } from './api/users';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const NotificationContext = createContext(() => {});
const AuthContext = createContext(null);
const ORDER_FORM_PAGE_SIZE = 100;

const getAllPages = async (fetchPage, filters = {}) => {
  const firstPage = await fetchPage({ ...filters, page: 1, limit: ORDER_FORM_PAGE_SIZE });
  const items = [...(firstPage.items || [])];
  const totalPages = firstPage.pagination?.totalPages || 1;
  for (let page = 2; page <= totalPages; page += 5) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(5, totalPages - page + 1) }, (_, index) =>
        fetchPage({ ...filters, page: page + index, limit: ORDER_FORM_PAGE_SIZE })
      )
    );
    pages.forEach((result) => items.push(...(result.items || [])));
  }
  return items;
};

function useNotify() {
  return useContext(NotificationContext);
}

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('stockflow.accessToken'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    getCurrentUser()
      .then((currentUser) => { if (active) setUser(currentUser); })
      .catch(() => { if (active) { localStorage.removeItem('stockflow.accessToken'); setToken(null); setUser(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      setLoading(false);
    };
    window.addEventListener('stockflow:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('stockflow:unauthorized', handleUnauthorized);
  }, []);

  const signIn = async (credentials) => {
    const result = await login(credentials);
    localStorage.setItem('stockflow.accessToken', result.accessToken);
    setUser(result.user);
    setToken(result.accessToken);
    return result.user;
  };

  const signOut = async () => {
    try {
      if (localStorage.getItem('stockflow.accessToken')) await logout();
    } finally {
      localStorage.removeItem('stockflow.accessToken');
      setToken(null);
      setUser(null);
    }
  };

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function App() {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);
  const notify = useCallback((message, type = 'success') => {
    window.clearTimeout(timeoutRef.current);
    setToast({ message, type });
    timeoutRef.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return (
    <NotificationContext.Provider value={notify}>
      <AuthProvider>
        <BrowserRouter>
          <AuthenticatedApp toast={toast} />
        </BrowserRouter>
      </AuthProvider>
    </NotificationContext.Provider>
  );
}

function AuthenticatedApp({ toast }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading">Restoring your secure workspace…</div>;
  return user ? <AppShell toast={toast} /> : <LoginPage />;
}

function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn({ email, password });
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><Boxes className="h-5 w-5" /></span><span><strong>StockFlow</strong><small>OPERATIONS WORKSPACE</small></span></div>
        <div className="auth-heading"><p className="panel-overline">WELCOME BACK</p><h1>Sign in to your<br /><em>workspace.</em></h1><p>Manage the moving parts of your business, all in one place.</p></div>
        <form className="auth-form" onSubmit={submit}>
          <label>Email address<input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>
          <label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
          {error && <div role="alert" className="auth-error">{error}</div>}
          <button type="submit" disabled={submitting} className="auth-submit">{submitting ? 'Signing in…' : 'Sign in'} <ArrowUpRight className="h-4 w-4" /></button>
        </form>
        <div className="auth-footnote"><span className="auth-lock">◈</span><span>Secure access for your operations team.<br />New workspace? Ask your administrator to create your account.</span></div>
      </div>
      <aside className="auth-aside"><div className="auth-aside-art"><div className="auth-aside-ring ring-a" /><div className="auth-aside-ring ring-b" /><div className="auth-aside-content"><span className="auth-aside-kicker">STOCKFLOW · INVENTORY HUB</span><h2>Keep every<br />detail in<br /><em>good order.</em></h2><p>Thoughtful tools for the people who keep things moving.</p></div><div className="auth-aside-index">01 — OPERATIONS</div></div></aside>
    </div>
  );
}

function AppShell({ toast }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState(null);
  const [notificationError, setNotificationError] = useState('');
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [shortcutHelp, setShortcutHelp] = useState(false);
  const searchRef = useRef(null);
  const searchSequence = useRef(0);
  const [notificationRefresh, setNotificationRefresh] = useState(0);
  const unreadCount = notificationsRead ? 0 : (notifications?.lowStock?.length || 0) + Number(notifications?.pending_order_count || 0);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        setNotificationsOpen(false);
        setProfileOpen(false);
      } else if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
        setShortcutHelp(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const term = searchTerm.trim();
    const sequence = ++searchSequence.current;
    const timeout = window.setTimeout(async () => {
      if (term.length < 2) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      try {
        const [products, customers, orders] = await Promise.all([
          getProducts({ search: term }),
          getCustomers({ search: term }),
          getOrders({ search: term })
        ]);
        if (sequence !== searchSequence.current) return;
        setSearchResults([
          ...(products?.items || []).slice(0, 4).map((item) => ({ type: 'Product', label: item.name, detail: item.sku, to: `/products?search=${encodeURIComponent(term)}`, icon: Package })),
          ...(orders?.items || []).slice(0, 4).map((item) => ({ type: 'Order', label: item.order_number, detail: item.customer_name, to: `/orders/${item.id}`, icon: ClipboardList })),
          ...(customers?.items || []).slice(0, 4).map((item) => ({ type: 'Customer', label: item.name, detail: item.email, to: `/customers?search=${encodeURIComponent(term)}`, icon: Users }))
        ]);
      } catch (error) {
        if (sequence === searchSequence.current) setSearchError(error.message || 'Search is unavailable right now.');
      } finally {
        if (sequence === searchSequence.current) setSearchLoading(false);
      }
    }, term.length < 2 ? 0 : 220);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    getDashboardSummary()
      .then((data) => {
        if (active) {
          setNotifications(data);
          setNotificationError('');
          setNotificationsRead(false);
        }
      })
      .catch((error) => {
        if (active) setNotificationError(error.message || 'Could not load notifications.');
      });
    return () => { active = false; };
  }, [notificationRefresh]);

  const goToSearchResult = (path) => {
    setSearchOpen(false);
    setSearchTerm('');
    navigate(path);
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/products', label: 'Products', icon: Package },
    { to: '/inventory', label: 'Inventory', icon: Warehouse },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/orders', label: 'Orders', icon: ClipboardList },
    { to: '/place-order', label: 'Place Order', icon: ShoppingCart },
    ...(user.role === 'ADMIN' ? [{ to: '/team', label: 'Team & access', icon: Users }] : [])
  ];

  return (
    <div className="app-frame min-h-screen text-slate-900">
      <div className="flex min-h-screen">
        <aside className="app-sidebar hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
            <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl">
              <Boxes className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-lg font-semibold">StockFlow</div>
              <div className="text-xs text-slate-500">Inventory Hub</div>
            </div>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `app-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-[#edf2ec] text-[#24483d] shadow-sm ring-1 ring-[#e0e9df]' : 'text-slate-600 hover:bg-[#f3f4ef]'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="app-header border-b border-slate-200 bg-white/90 backdrop-blur-sm">
            <div className="flex items-center justify-between px-4 py-3.5 sm:px-7">
              <div className="flex items-center gap-3">
                <div className="lg:hidden">
                  <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl">
                    <Boxes className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <div className="app-header-eyebrow text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Operations workspace</div>
                  <div className="text-[15px] font-semibold tracking-tight text-slate-800">StockFlow</div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="header-control-wrap relative">
                  <div className={`header-search ${searchOpen ? 'header-search-open' : ''}`}>
                    <button type="button" className="header-search-trigger" aria-label="Open search" title="Search (Ctrl K)" onClick={() => { setSearchOpen(true); setNotificationsOpen(false); setProfileOpen(false); }}>
                      <Search className="h-4 w-4 shrink-0" />
                    </button>
                    <input
                      ref={searchRef}
                      value={searchTerm}
                      onFocus={() => setSearchOpen(true)}
                      onChange={(event) => { setSearchError(''); setSearchTerm(event.target.value); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && searchResults[0]) goToSearchResult(searchResults[0].to);
                      }}
                      placeholder="Search anything"
                      aria-label="Search products, orders, and customers"
                    />
                    {searchTerm ? (
                      <button type="button" aria-label="Clear search" onClick={() => setSearchTerm('')} className="header-icon-quiet"><X className="h-3.5 w-3.5" /></button>
                    ) : <kbd><Command className="h-3 w-3" /> K</kbd>}
                  </div>
                  {searchOpen && searchTerm.trim().length >= 2 && (
                    <div className="header-popover search-popover">
                      <div className="popover-eyebrow">Search results</div>
                      {searchLoading && <p className="px-4 py-3 text-sm text-slate-500">Searching your workspace…</p>}
                      {!searchLoading && searchError && <p role="alert" className="px-4 py-3 text-sm text-rose-700">{searchError}</p>}
                      {!searchLoading && !searchError && searchResults.map((result, index) => {
                        const Icon = result.icon;
                        return (
                          <button type="button" key={`${result.type}-${index}`} onClick={() => goToSearchResult(result.to)} className="search-result">
                            <span className="search-result-icon"><Icon className="h-4 w-4" /></span>
                            <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium text-slate-800">{result.label}</span><span className="block truncate text-xs text-slate-500">{result.detail}</span></span>
                            <span className="search-result-type">{result.type}</span>
                          </button>
                        );
                      })}
                      {!searchLoading && !searchError && !searchResults.length && <p className="px-4 py-4 text-sm text-slate-500">No matching records found.</p>}
                    </div>
                  )}
                </div>

                <div className="header-control-wrap relative">
                  <button
                    type="button"
                    className={`header-icon-button ${notificationsOpen ? 'is-open' : ''}`}
                    aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                    aria-expanded={notificationsOpen}
                    onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); setSearchOpen(false); }}
                  >
                    <Bell className="h-[17px] w-[17px]" strokeWidth={1.8} />
                    {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                  </button>
                  {notificationsOpen && (
                    <div className="header-popover notification-popover">
                      <div className="popover-heading">
                        <div><p className="text-sm font-semibold text-slate-900">Inbox</p><p className="mt-0.5 text-xs text-slate-500">Stock and order attention</p></div>
                        <button type="button" onClick={() => setNotificationRefresh((value) => value + 1)} className="header-icon-quiet" aria-label="Refresh notifications"><RefreshCw className="h-4 w-4" /></button>
                      </div>
                      {notificationError && <p role="alert" className="px-4 py-3 text-sm text-rose-700">{notificationError}</p>}
                      {notifications && !notificationError && (
                        <>
                          {!notificationsRead && Number(notifications.pending_order_count) > 0 && (
                            <button type="button" className="notification-row" onClick={() => { setNotificationsOpen(false); navigate('/orders?status=PENDING'); }}>
                              <span className="notification-dot dot-gold" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">{notifications.pending_order_count} pending {Number(notifications.pending_order_count) === 1 ? 'order' : 'orders'}</span><span className="block text-xs text-slate-500">Review orders awaiting confirmation</span></span><ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" />
                            </button>
                          )}
                          {!notificationsRead && (notifications.lowStock || []).slice(0, 5).map((item) => (
                            <button type="button" key={item.id} className="notification-row" onClick={() => { setNotificationsOpen(false); navigate('/inventory'); }}>
                              <span className="notification-dot dot-rose" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{item.name} is running low</span><span className="block text-xs text-slate-500">{item.quantity_on_hand} on hand · reorder at {item.reorder_level}</span></span><ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" />
                            </button>
                          ))}
                          {(!unreadCount || notificationsRead) && <div className="px-4 py-8 text-center"><CheckCheck className="mx-auto h-5 w-5 text-emerald-600" /><p className="mt-2 text-sm font-medium text-slate-700">You’re all caught up</p><p className="mt-1 text-xs text-slate-500">No unread stock or order alerts.</p></div>}
                          {unreadCount > 0 && !notificationsRead && <button type="button" onClick={() => setNotificationsRead(true)} className="notification-footer"><CheckCheck className="h-4 w-4" /> Mark all as read</button>}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="header-control-wrap relative">
                  <button type="button" className={`admin-trigger ${profileOpen ? 'is-open' : ''}`} aria-expanded={profileOpen} onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); setSearchOpen(false); }}>
                    <span className="admin-avatar"><UserCircle2 className="h-[18px] w-[18px]" strokeWidth={1.7} /></span>
                    <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{user.displayName}</span>
                    <ChevronDown className={`hidden h-3.5 w-3.5 text-slate-400 transition sm:block ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {profileOpen && (
                    <div className="header-popover admin-popover">
                      <div className="admin-card">
                        <span className="admin-avatar admin-avatar-large"><UserCircle2 className="h-5 w-5" /></span>
                        <div>                        <p className="text-sm font-semibold text-slate-900">{user.displayName}</p><p className="text-xs text-slate-500">{user.email} · {user.role}</p></div>
                      </div>
                      {user.role === 'ADMIN' && <button type="button" className="admin-menu-item" onClick={() => { setProfileOpen(false); navigate('/team'); }}><Users className="h-4 w-4" /> Team & access</button>}
                      <button type="button" className="admin-menu-item" onClick={() => setShortcutHelp(!shortcutHelp)}><HelpCircle className="h-4 w-4" /> Keyboard shortcuts <span className="ml-auto text-xs text-slate-400">Ctrl K</span></button>
                      {shortcutHelp && <div className="shortcut-note">Press <kbd>Ctrl</kbd> + <kbd>K</kbd> from anywhere to search products, customers, and orders. Press <kbd>Esc</kbd> to close menus.</div>}
                      <button type="button" className="admin-menu-item admin-signout" onClick={async () => { setProfileOpen(false); await signOut(); }}><LogOut className="h-4 w-4" /> Sign out</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <nav aria-label="Main navigation" className="mobile-nav grid grid-cols-4 gap-1.5 border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-center text-[11px] font-medium leading-tight ${
                    isActive ? 'bg-[#edf2ec] text-[#24483d]' : 'text-slate-600 hover:bg-[#f3f4ef]'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="w-full break-words">{label}</span>
              </NavLink>
            ))}
          </nav>

          <main className="app-main flex-1 p-4 sm:p-7">
            {toast && (
              <div
                role={toast.type === 'error' ? 'alert' : 'status'}
                className={`fixed right-4 top-4 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${
                  toast.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {toast.message}
              </div>
            )}
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/place-order" element={<PlaceOrderPage />} />
              <Route path="/team" element={user.role === 'ADMIN' ? <UserManagementPage /> : <Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

function UserManagementPage() {
  const notify = useNotify();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const hasLoadedRef = useRef(false);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', displayName: '', password: '', role: 'STAFF' });

  const loadUsers = useCallback(async () => {
    setLoading(!hasLoadedRef.current);
    try {
      const result = await getUsers({ search, role, status, page, limit });
      setUsers(result.items || []);
      setPagination(result.pagination || { total: 0, totalPages: 0 });
      setError('');
      hasLoadedRef.current = true;
    } catch (loadError) {
      setError(loadError.message || 'Unable to load team accounts.');
    } finally {
      setLoading(false);
    }
  }, [search, role, status, page, limit]);

  // Load accounts when a server-side filter or page changes.
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createUser(form);
      setForm({ email: '', displayName: '', password: '', role: 'STAFF' });
      setPage(1);
      notify('Team account created');
      if (page === 1) await loadUsers();
    } catch (createError) {
      setError(createError.message || 'Unable to create account.');
    } finally {
      setSaving(false);
    }
  };

  const changeUser = async (target, updates) => {
    try {
      await updateUser(target.id, updates);
      await loadUsers();
      notify(`${target.display_name}’s access was updated`);
    } catch (updateError) {
      notify(updateError.message || 'Unable to update account', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Team & access" subtitle="Admin-only account and role management" />
      <div className="team-intro"><div className="team-intro-icon"><Users className="h-5 w-5" /></div><div><strong>People who keep things moving.</strong><p>Admins manage access. Admins and Staff can both work with products, stock, customers, and orders.</p></div><span className="team-total">{pagination.total} accounts</span></div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.75fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Workspace accounts</h2><div className="flex flex-wrap gap-2">
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search people" aria-label="Search user accounts" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} aria-label="Filter account role" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><option value="all">All roles</option><option value="ADMIN">Admin</option><option value="STAFF">Staff</option></select>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter account status" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><option value="all">All access</option><option value="active">Active</option><option value="inactive">Deactivated</option></select>
          </div></div>
          {loading ? <div className="p-8 text-slate-500">Loading accounts…</div> : (
            <div className="mobile-card-table-wrap overflow-x-auto rounded-xl border border-slate-200">
              <table className="mobile-card-table min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Person</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Access</th><th className="px-3 py-3">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {users.map((account) => {
                    const isSelf = Number(account.id) === Number(currentUser.id);
                    return <tr key={account.id} className="hover:bg-slate-50"><td data-label="Person" className="px-3 py-3"><div className="min-w-0"><p className="text-sm font-medium text-slate-800">{account.display_name}{isSelf && <span className="ml-2 text-xs text-slate-400">You</span>}</p><p className="text-xs text-slate-500">{account.email}</p></div></td>
                      <td data-label="Role" className="px-3 py-3"><select value={account.role} disabled={isSelf} onChange={(event) => changeUser(account, { role: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:opacity-50"><option value="ADMIN">Admin</option><option value="STAFF">Staff</option></select></td>
                      <td data-label="Access" className="px-3 py-3"><StatusBadge status={account.is_active ? 'active' : 'inactive'} /></td>
                      <td data-label="Actions" className="px-3 py-3"><button type="button" disabled={isSelf} onClick={() => changeUser(account, { isActive: !account.is_active })} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{account.is_active ? 'Deactivate' : 'Reactivate'}</button></td></tr>;
                  })}
                  {!users.length && <tr><td colSpan="4" className="px-3 py-8 text-center text-sm text-slate-500">No matching accounts.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {!loading && <Pagination page={page} total={pagination.total} totalPages={pagination.totalPages} limit={limit} onPageChange={setPage} onLimitChange={(size) => { setLimit(size); setPage(1); }} />}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="panel-overline">INVITE A COLLEAGUE</p><h2 className="text-lg font-semibold">Add team member</h2><p className="mt-1 text-xs leading-5 text-slate-500">Create secure sign-in credentials. Share the temporary password with the new user privately.</p>
          <form className="mt-4 space-y-3" onSubmit={submit}>
            <label className="team-form-label">Name<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} minLength="2" maxLength="120" autoComplete="name" required /></label>
            <label className="team-form-label">Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" required /></label>
            <label className="team-form-label">Temporary password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength="12" maxLength="128" autoComplete="new-password" required /><small>Use at least 12 characters.</small></label>
            <label className="team-form-label">Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></label>
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#315b48] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#26493e] disabled:opacity-60">{saving ? 'Creating account…' : 'Create account'}</button>
          </form>
        </section>
      </div>
    </div>
  );
}

function Pagination({ page, total, totalPages, limit, onPageChange, onLimitChange }) {
  const pageCount = Math.max(1, totalPages || Math.ceil(total / limit));
  return (
    <div className="pagination-layout flex items-center justify-between gap-3 px-1 pt-3 text-sm text-slate-500">
      <div className="flex items-center gap-3">
        <span>{total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : '0 records'}</span>
        <label className="flex items-center gap-1.5">Rows
          <select value={limit} onChange={(event) => onLimitChange(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div className="pagination-controls flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Previous</button>
        <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <div className="page-header mb-6 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#527567]">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
      </div>
      <div className="text-sm text-slate-500">{subtitle}</div>
    </div>
  );
}

function KpiCard({ title, value, detail, accent, icon: Icon }) {
  return (
    <div className="dashboard-kpi">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-[27px] font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`dashboard-kpi-icon ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const palette = {
    PENDING: 'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    SHIPPED: 'bg-[#edf3ed] text-[#466d57]',
    DELIVERED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    INACTIVE: 'bg-slate-200 text-slate-700',
    LOW: 'bg-amber-100 text-amber-700'
  };

  const normalized = String(status).toUpperCase();
  const className = palette[normalized] || 'bg-slate-100 text-slate-700';

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{normalized}</span>;
}

function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await getDashboardSummary();
        if (isMounted) setSummary(data);
      } catch (err) {
        if (isMounted) setError(err.message || 'Unable to load dashboard');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">Loading dashboard…</div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;

  const lowStockCount = Number(summary?.low_stock_products || 0);
  const revenue = Number(summary?.revenue || 0);
  const trendByDate = new Map((summary?.salesTrend || []).map((row) => [row.date, row]));
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const row = trendByDate.get(key);
    return { key, label: date.toLocaleDateString('en-US', { weekday: 'short' }), revenue: Number(row?.revenue || 0), orders: Number(row?.order_count || 0) };
  });
  const totalWeekRevenue = trend.reduce((total, day) => total + day.revenue, 0);
  const peakRevenue = Math.max(...trend.map((day) => day.revenue), 1);
  const chartPoints = trend.map((day, index) => ({
    ...day,
    x: 42 + (index * 536) / 6,
    y: 186 - (day.revenue / peakRevenue) * 148
  }));
  const linePath = chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L 578 198 L 42 198 Z`;
  const statusColors = {
    PENDING: '#cc8a43',
    CONFIRMED: '#60796e',
    SHIPPED: '#7f8e7d',
    DELIVERED: '#aac0a9',
    CANCELLED: '#d78976'
  };
  const statusRows = summary?.orderStatusBreakdown || [];
  const totalOrders = statusRows.reduce((total, row) => total + Number(row.count || 0), 0);
  let runningPercent = 0;
  const statusGradient = totalOrders
    ? statusRows.map((row) => {
      const start = runningPercent;
      runningPercent += (Number(row.count) / totalOrders) * 100;
      return `${statusColors[row.status] || '#d7ddd5'} ${start}% ${runningPercent}%`;
    }).join(', ')
    : '#e7e9e4 0% 100%';
  const today = new Date();

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <p className="dashboard-eyebrow"><span className="live-indicator" /> YOUR OPERATIONS, AT A GLANCE</p>
          <h1>Inventory,<br /><em>in motion.</em></h1>
          <p className="dashboard-hero-copy">A clearer view of what is moving, what needs attention, and what comes next.</p>
          <div className="dashboard-hero-actions">
            <Link to="/place-order" className="hero-primary-action"><Plus className="h-4 w-4" /> Create an order</Link>
            <Link to="/inventory" className="hero-secondary-action">Review stock <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </div>
        <div className="hero-side-note">
          <span className="hero-date-label">TODAY</span>
          <span className="hero-date">{today.toLocaleDateString('en-US', { weekday: 'long' })}</span>
          <span className="hero-date-number">{today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
          <span className="hero-note-divider" />
          <span className="hero-side-caption">{lowStockCount ? `${lowStockCount} products need a restock check.` : 'Stock levels are looking healthy.'}</span>
        </div>
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
      </section>

      <div className="dashboard-kpi-grid">
        <KpiCard title="Catalog" value={summary?.total_products ?? 0} detail="Products in your workspace" accent="kpi-icon-sage" icon={Package} />
        <KpiCard title="Needs attention" value={lowStockCount} detail={lowStockCount ? 'Below reorder threshold' : 'No low-stock products'} accent="kpi-icon-terracotta" icon={AlertTriangle} />
        <KpiCard title="Orders today" value={summary?.orders_today ?? 0} detail="Placed since midnight" accent="kpi-icon-gold" icon={ShoppingCart} />
        <KpiCard title="Revenue to date" value={currency.format(revenue)} detail="Excludes cancelled orders" accent="kpi-icon-green" icon={DollarSign} />
      </div>

      <section className="dashboard-chart-grid">
        <article className="dashboard-panel sales-panel">
          <div className="panel-heading">
            <div><p className="panel-overline">PERFORMANCE</p><h2>Sales, day by day</h2><p className="panel-subtitle">Revenue from the last seven days</p></div>
            <div className="chart-summary"><span>7-day revenue</span><strong>{currency.format(totalWeekRevenue)}</strong></div>
          </div>
          <div className="sales-chart-wrap">
            <div className="chart-y-labels"><span>{currency.format(peakRevenue)}</span><span>{currency.format(peakRevenue * 0.66)}</span><span>{currency.format(peakRevenue * 0.33)}</span><span>$0</span></div>
            <svg className="sales-chart" viewBox="0 0 600 230" role="img" aria-label="Daily sales revenue over the last seven days">
              <defs><linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#708878" stopOpacity=".25" /><stop offset="100%" stopColor="#708878" stopOpacity="0" /></linearGradient></defs>
              {[38, 87, 136, 185].map((y) => <line key={y} x1="42" x2="578" y1={y} y2={y} className="chart-gridline" />)}
              <path d={areaPath} fill="url(#sales-area)" />
              <path d={linePath} className="chart-line" />
              {chartPoints.map((point) => <g key={point.key}><circle cx={point.x} cy={point.y} r="4.5" className="chart-point" /><title>{point.label}: {currency.format(point.revenue)} · {point.orders} orders</title><text x={point.x} y="218" textAnchor="middle" className="chart-x-label">{point.label}</text></g>)}
            </svg>
          </div>
          <div className="chart-footnote"><span className="chart-legend-dot" /> Daily order revenue <span className="chart-footnote-spacer" /> {trend.reduce((total, day) => total + day.orders, 0)} orders this week</div>
        </article>

        <article className="dashboard-panel order-mix-panel">
          <div className="panel-heading"><div><p className="panel-overline">FULFILLMENT</p><h2>Order mix</h2><p className="panel-subtitle">All-time order status</p></div><Link to="/orders" className="panel-icon-link" aria-label="View all orders"><ArrowUpRight className="h-4 w-4" /></Link></div>
          <div className="donut-wrap">
            <div className="order-donut" style={{ background: `conic-gradient(${statusGradient})` }}><div className="donut-hole"><strong>{totalOrders}</strong><span>ORDERS</span></div></div>
            <div className="order-legend">
              {statusRows.map((row) => <div key={row.status} className="legend-row"><span className="legend-label"><i style={{ background: statusColors[row.status] || '#d7ddd5' }} />{row.status.toLowerCase()}</span><strong>{row.count}</strong></div>)}
              {!statusRows.length && <p className="text-sm text-slate-500">No orders yet.</p>}
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="dashboard-panel recent-panel">
          <div className="panel-heading"><div><p className="panel-overline">LATEST ACTIVITY</p><h2>Recent orders</h2></div><Link to="/orders" className="panel-text-link">All orders <ArrowUpRight className="h-4 w-4" /></Link></div>
          <div className="overflow-x-auto">
            <table className="dashboard-table min-w-full text-left">
              <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>AMOUNT</th><th>STATUS</th></tr></thead>
              <tbody>
                {(summary?.recentOrders || []).slice(0, 6).map((order) => (
                  <tr key={order.id}>
                    <td><Link to={`/orders/${order.id}`} className="dashboard-order-link">{order.order_number}</Link></td>
                    <td className="text-slate-600">{order.customer_name}</td>
                    <td className="font-medium text-slate-800">{currency.format(Number(order.total_amount || 0))}</td>
                    <td><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
                {!summary?.recentOrders?.length && <tr><td colSpan="4" className="py-8 text-center text-sm text-slate-500">Your newest orders will show up here.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <article className="dashboard-panel stock-panel">
          <div className="panel-heading"><div><p className="panel-overline">STOCK HEALTH</p><h2>Restock watch</h2></div><Link to="/inventory" className="panel-icon-link" aria-label="Review inventory"><ArrowUpRight className="h-4 w-4" /></Link></div>
          <div className="stock-alert-list">
            {(summary?.lowStock || []).slice(0, 5).map((item) => {
              const progress = Math.max(0, Math.min(100, (Number(item.quantity_on_hand) / Math.max(1, Number(item.reorder_level))) * 100));
              return <div className="stock-alert" key={item.id}><div className="stock-alert-top"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.sku}</p></div><div className="text-right"><strong>{item.quantity_on_hand}</strong><span> / {item.reorder_level}</span></div></div><div className="stock-progress"><span style={{ width: `${progress}%` }} /></div></div>;
            })}
            {!summary?.lowStock?.length && <div className="stock-empty"><span className="stock-empty-mark">✓</span><div><strong>All clear</strong><p>Nothing is below its reorder point.</p></div></div>}
          </div>
          {!!summary?.lowStock?.length && <Link to="/inventory" className="stock-panel-footer">Open inventory <ArrowUpRight className="h-4 w-4" /></Link>}
        </article>
      </section>
    </div>
  );
}

function ProductsPage() {
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'all';
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [form, setForm] = useState({ sku: '', name: '', description: '', price: '', is_active: true });
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(!hasLoadedRef.current);
      const data = await getProducts({ search, status, page, limit });
      setProducts(data.items || []);
      setPagination(data.pagination || { total: 0, totalPages: 0 });
      setError('');
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.message || 'Unable to load products');
    } finally {
      setLoading(false);
    }
  }, [search, status, page, limit]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  const updateProductFilters = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && !(key === 'status' && value === 'all')) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await createProduct({ ...form, price: Number(form.price), is_active: form.is_active });
      setForm({ sku: '', name: '', description: '', price: '', is_active: true });
      setPage(1);
      if (page === 1) await loadProducts();
      notify('Product created successfully');
    } catch (err) {
      setError(err.message || 'Unable to create product');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (product) => {
    try {
      await toggleProductStatus(product.id, product.is_active === 1 ? false : true);
      await loadProducts();
      notify(`Product ${product.is_active === 1 ? 'deactivated' : 'activated'}`);
    } catch (err) {
      setError(err.message || 'Unable to update status');
    }
  };

  return (
    <>
      <PageHeader title="Products" subtitle="Manage catalog and pricing" />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Product catalog</h2>
            <span className="text-sm text-slate-500">{pagination.total} records</span>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input value={search} onChange={(e) => updateProductFilters('search', e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Search SKU or product" aria-label="Search products" />
            <select value={status} onChange={(e) => updateProductFilters('status', e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" aria-label="Filter product status">
              <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
          {loading ? <div className="p-6 text-slate-500">Loading products…</div> : error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : (
            <div className="mobile-card-table-wrap overflow-x-auto rounded-xl border border-slate-200">
              <table className="mobile-card-table min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Stock</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td data-label="SKU" className="px-3 py-3 text-sm font-medium text-slate-800">{product.sku}</td>
                      <td data-label="Name" className="px-3 py-3 text-sm text-slate-700">{product.name}</td>
                      <td data-label="Price" className="px-3 py-3 text-sm text-slate-700">{currency.format(Number(product.price || 0))}</td>
                      <td data-label="Stock" className="px-3 py-3 text-sm text-slate-700">{product.quantity_on_hand ?? 0}</td>
                      <td data-label="Status" className="px-3 py-3"><StatusBadge status={product.is_active === 1 ? 'active' : 'inactive'} /></td>
                      <td data-label="Actions" className="px-3 py-3">
                        <button
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => toggleStatus(product)}
                        >
                          {product.is_active === 1 ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error && <Pagination page={page} total={pagination.total} totalPages={pagination.totalPages} limit={limit} onPageChange={setPage} onLimitChange={(size) => { setLimit(size); setPage(1); }} />}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Add product</h2>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-[#789383]" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU" required />
            <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-[#789383]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" required />
            <textarea className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-[#789383]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="3" />
            <input type="number" step="0.01" min="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-0 focus:border-[#789383]" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" required />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active product
            </label>
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#315b48] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#26493e] disabled:opacity-60">
              {saving ? 'Saving…' : 'Create product'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function CustomersPage() {
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const search = searchParams.get('search') || '';
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(!hasLoadedRef.current);
      const data = await getCustomers({ search, page, limit });
      setCustomers(data.items || []);
      setPagination(data.pagination || { total: 0, totalPages: 0 });
      setError('');
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.message || 'Unable to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, page, limit]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const submitCustomer = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      await createCustomer(form);
      setForm({ name: '', email: '', phone: '', address: '' });
      await loadCustomers();
      notify('Customer added successfully');
    } catch (err) {
      setError(err.message || 'Unable to add customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Customers" subtitle="Track contacts and order history" />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Customer directory</h2>
            <span className="text-sm text-slate-500">{pagination.total} contacts</span>
          </div>
          <input value={search} onChange={(e) => { const next = new URLSearchParams(searchParams); if (e.target.value) next.set('search', e.target.value); else next.delete('search'); setSearchParams(next, { replace: true }); setPage(1); }} className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Search name or email" aria-label="Search customers" />

          {loading ? <div className="p-6 text-slate-500">Loading customers…</div> : (
            <div className="mobile-card-table-wrap overflow-x-auto rounded-xl border border-slate-200">
              <table className="mobile-card-table min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50">
                      <td data-label="Name" className="px-3 py-3 text-sm font-medium text-slate-800">{customer.name}</td>
                      <td data-label="Email" className="px-3 py-3 text-sm text-slate-700">{customer.email}</td>
                      <td data-label="Phone" className="px-3 py-3 text-sm text-slate-700">{customer.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && <Pagination page={page} total={pagination.total} totalPages={pagination.totalPages} limit={limit} onPageChange={setPage} onLimitChange={(size) => { setLimit(size); setPage(1); }} />}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Add customer</h2>
          <form className="mt-4 space-y-3" onSubmit={submitCustomer}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="Customer name" required />
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="Email" required />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="Phone (optional)" />
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" rows="3" placeholder="Address" />
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#315b48] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#26493e] disabled:opacity-60">{saving ? 'Saving…' : 'Add customer'}</button>
          </form>
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>
      </div>
    </>
  );
}

function InventoryPage() {
  const notify = useNotify();
  const [inventory, setInventory] = useState([]);
  const hasLoadedRef = useRef(false);
  const [lowStock, setLowStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  const loadData = useCallback(async () => {
    try {
      setLoading(!hasLoadedRef.current);
      const [rows, low] = await Promise.all([
        getInventory({ search, status, page, limit }),
        getLowStock()
      ]);
      setInventory(rows.items || []);
      setPagination(rows.pagination || { total: 0, totalPages: 0 });
      setLowStock(low || []);
      setSelectedId((currentId) => currentId || rows.items?.[0]?.id || null);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.message || 'Unable to load inventory');
    } finally {
      setLoading(false);
    }
  }, [search, status, page, limit]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!selectedId) return;
    getProductHistory(selectedId)
      .then((data) => {
        setHistory(data || []);
        setError('');
      })
      .catch((err) => setError(err.message || 'Unable to load stock history'));
  }, [selectedId, historyRefresh]);

  const restock = async (productId) => {
    const quantity = Number(window.prompt('Enter restock quantity', '10'));
    if (!quantity || quantity <= 0) return;
    try {
      await restockProduct(productId, { quantity, note: 'Restock from UI' });
      await loadData();
      setHistoryRefresh((current) => current + 1);
      notify('Inventory restocked successfully');
    } catch (err) {
      notify(err.message || 'Unable to restock', 'error');
    }
  };

  const adjust = async (productId) => {
    const quantity = Number(window.prompt('Enter stock adjustment (+/-)', '5'));
    const note = window.prompt('Explain the adjustment', 'Cycle count adjustment');
    if (!quantity || !note) return;
    try {
      await adjustProduct(productId, { quantity, note });
      await loadData();
      setHistoryRefresh((current) => current + 1);
      notify('Inventory adjusted successfully');
    } catch (err) {
      notify(err.message || 'Unable to adjust stock', 'error');
    }
  };

  return (
    <>
      <PageHeader title="Inventory" subtitle="Current stock and movement history" />
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Stock overview</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{lowStock.length} low-stock</span>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Search SKU or product" aria-label="Search inventory" />
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" aria-label="Filter inventory status">
              <option value="all">All stock</option><option value="low">Low stock</option><option value="healthy">Healthy</option><option value="inactive">Inactive</option>
            </select>
          </div>

          {loading ? <div className="p-6 text-slate-500">Loading inventory…</div> : (
            <div className="mobile-card-table-wrap overflow-x-auto rounded-xl border border-slate-200">
              <table className="mobile-card-table min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">On hand</th>
                    <th className="px-3 py-3">Reorder</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td data-label="Product" className="px-3 py-3 text-sm font-medium text-slate-800" onClick={() => setSelectedId(item.id)}>{item.name}</td>
                      <td data-label="On hand" className="px-3 py-3 text-sm text-slate-700">{item.quantity_on_hand}</td>
                      <td data-label="Reorder" className="px-3 py-3 text-sm text-slate-700">{item.reorder_level}</td>
                      <td data-label="Status" className="px-3 py-3"><StatusBadge status={item.is_active !== 1 ? 'inactive' : item.is_low_stock ? 'low' : 'active'} /></td>
                      <td data-label="Actions" className="space-x-2 px-3 py-3">
                        <button className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50" onClick={() => restock(item.id)}>Restock</button>
                        <button className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50" onClick={() => adjust(item.id)}>Adjust</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && <Pagination page={page} total={pagination.total} totalPages={pagination.totalPages} limit={limit} onPageChange={setPage} onLimitChange={(size) => { setLimit(size); setPage(1); }} />}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Movement history</h2>
          {selectedId ? (
            <div className="mt-4 space-y-3">
              {history.length ? history.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{entry.reason}</span>
                    <span className={`text-sm font-semibold ${entry.change_qty > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {entry.change_qty > 0 ? '+' : ''}{entry.change_qty}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{entry.note || 'No note provided'}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
              )) : <div className="text-sm text-slate-500">No history found</div>}
            </div>
          ) : <div className="mt-4 text-sm text-slate-500">Choose a product to inspect movements.</div>}
        </div>
      </div>
    </>
  );
}

function OrdersPage() {
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const hasLoadedRef = useRef(false);
  const selectedStatus = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(!hasLoadedRef.current);
    try {
      const data = await getOrders({ status: selectedStatus, search, page, limit });
      setOrders(data.items || []);
      setPagination(data.pagination || { total: 0, totalPages: 0 });
      setError('');
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.message || 'Unable to load orders');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, search, page, limit]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  const updateOrderFilters = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && !(key === 'status' && value === 'all')) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const nextStatusMap = {
    PENDING: 'CONFIRMED',
    CONFIRMED: 'SHIPPED',
    SHIPPED: 'DELIVERED'
  };

  const handleStatusAdvance = async (order) => {
    const next = nextStatusMap[order.status];
    if (!next) return;
    try {
      await updateOrderStatus(order.id, next);
      await loadOrders();
      notify(`Order moved to ${next}`);
    } catch (err) {
      notify(err.message || 'Unable to update status', 'error');
    }
  };

  const handleCancel = async (order) => {
    if (!window.confirm(`Cancel order ${order.order_number}?`)) return;
    try {
      await cancelOrder(order.id);
      await loadOrders();
      notify('Order cancelled successfully');
    } catch (err) {
      notify(err.message || 'Unable to cancel order', 'error');
    }
  };

  return (
    <>
      <PageHeader title="Orders" subtitle="Track orders and status workflow" />
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Order list</h2>
          <select value={selectedStatus} onChange={(e) => updateOrderFilters('status', e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <input value={search} onChange={(e) => updateOrderFilters('search', e.target.value)} className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Search order number or customer" aria-label="Search orders" />

        {loading ? <div className="p-6 text-slate-500">Loading orders…</div> : (
          <div className="mobile-card-table-wrap overflow-x-auto rounded-xl border border-slate-200">
            <table className="mobile-card-table min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Order</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td data-label="Order" className="px-3 py-3 text-sm font-medium text-[#446c55]"><Link to={`/orders/${order.id}`}>{order.order_number}</Link></td>
                    <td data-label="Customer" className="px-3 py-3 text-sm text-slate-700">{order.customer_name}</td>
                    <td data-label="Date" className="px-3 py-3 text-sm text-slate-700">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td data-label="Total" className="px-3 py-3 text-sm text-slate-700">{currency.format(Number(order.total_amount || 0))}</td>
                    <td data-label="Status" className="px-3 py-3"><StatusBadge status={order.status} /></td>
                    <td data-label="Actions" className="space-x-2 px-3 py-3">
                      {nextStatusMap[order.status] && (
                        <button className="rounded-lg bg-[#315b48] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#26493e]" onClick={() => handleStatusAdvance(order)}>
                          {nextStatusMap[order.status]}
                        </button>
                      )}
                      {['PENDING', 'CONFIRMED'].includes(order.status) && (
                        <button className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => handleCancel(order)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && <Pagination page={page} total={pagination.total} totalPages={pagination.totalPages} limit={limit} onPageChange={setPage} onLimitChange={(size) => { setLimit(size); setPage(1); }} />}
      </div>
    </>
  );
}

function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getOrder(id)
      .then((data) => setOrder(data))
      .catch((err) => setError(err.message || 'Unable to load order details'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">Loading order details…</div>;
  if (error) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;
  if (!order) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">Order not found.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Order ${order.order_number}`} subtitle="Detailed order information" />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Items</h2>
            <StatusBadge status={order.status} />
          </div>
          <div className="space-y-3">
            {(order.items || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="font-medium text-slate-800">{item.product_name} <span className="text-xs text-slate-500">({item.sku})</span></p>
                  <p className="text-xs text-slate-500">Qty {item.quantity} × {currency.format(Number(item.unit_price || 0))}</p>
                </div>
                <p className="font-semibold text-slate-800">{currency.format(Number(item.line_total || 0))}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Customer</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p className="font-medium text-slate-900">{order.customer_name}</p>
            <p>{order.email}</p>
            <p>{order.phone || 'No phone number'}</p>
            <p>{order.address || 'No address available'}</p>
          </div>
          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Grand total</span>
              <span className="text-lg font-semibold text-slate-900">{currency.format(Number(order.total_amount || 0))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceOrderPage() {
  const notify = useNotify();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      getAllPages(getCustomers),
      getAllPages(getProducts, { status: 'active' })
    ])
      .then(([customerRows, productRows]) => {
        setCustomers(customerRows);
        setProducts(productRows);
        if (customerRows[0]) setCustomerId(String(customerRows[0].id));
      })
      .catch((loadError) => setError(loadError.message || 'Unable to load order form data'));
  }, []);

  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: field === 'quantity' ? Number(value) || 0 : value };
    setItems(next);
  };

  const addRow = () => setItems([...items, { productId: '', quantity: 1 }]);
  const removeRow = (index) => setItems(items.filter((_, i) => i !== index));

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = products.find((p) => String(p.id) === String(item.productId));
      if (!product) return sum;
      return sum + Number(product.price || 0) * Number(item.quantity || 0);
    }, 0);
  }, [items, products]);

  const submitOrder = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      const payload = {
        customerId: Number(customerId),
        items: items.filter((item) => item.productId).map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity)
        }))
      };

      if (!payload.items.length) {
        setError('Add at least one order item');
        return;
      }
      const quantitiesByProduct = payload.items.reduce((quantities, item) => {
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
        return quantities;
      }, new Map());
      const insufficientItem = [...quantitiesByProduct].find(([productId, quantity]) => {
        const product = products.find((row) => Number(row.id) === productId);
        return !product || quantity > Number(product.quantity_on_hand);
      });
      if (insufficientItem) {
        const product = products.find((row) => Number(row.id) === insufficientItem[0]);
        setError(`Only ${product?.quantity_on_hand ?? 0} units of ${product?.name || 'this product'} are available.`);
        return;
      }

      const newOrder = await createOrder(payload);
      notify('Order created successfully');
      navigate(`/orders/${newOrder.id}`);
    } catch (err) {
      setError(err.message || 'Unable to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Place order" subtitle="Create customer orders with stock validation" />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={submitOrder} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end justify-end">
              <div className="rounded-xl bg-[#edf3ed] px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-wide text-[#527567]">Grand total</div>
                <div className="mt-1 text-2xl font-semibold text-[#315b48]">{currency.format(grandTotal)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const product = products.find((p) => String(p.id) === String(item.productId));
              return (
                <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.4fr_0.7fr_0.25fr]">
                  <select value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                    <option value="">Select product</option>
                    {products.filter((productRow) => productRow.is_active === 1 && productRow.quantity_on_hand > 0).map((productRow) => (
                      <option key={productRow.id} value={productRow.id}>{productRow.name} ({productRow.sku})</option>
                    ))}
                  </select>
                  <div>
                    <input
                      type="number"
                      min="1"
                      max={product?.quantity_on_hand ?? undefined}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      aria-label={`Quantity for item ${index + 1}`}
                      required
                    />
                    {product && item.quantity > product.quantity_on_hand && (
                      <p className="mt-1 text-xs text-red-600">Only {product.quantity_on_hand} available.</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-slate-500">{product ? `${product.quantity_on_hand ?? 0} in stock` : '—'}</div>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeRow(index)} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={addRow} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Plus className="h-4 w-4" />
              Add item
            </button>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-[#315b48] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#26493e] disabled:opacity-60">
            {submitting ? 'Creating order…' : 'Submit order'}
          </button>
        </form>
      </div>
    </>
  );
}

export default App;
