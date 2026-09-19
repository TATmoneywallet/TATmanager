/* ═══════════════════════════════════════════
   TAT Admin Panel — Main Logic
   ═══════════════════════════════════════════ */

// State
const adminState = {
  token: null,
  admin: null,
  users: [],
  transactions: [],
  inviteCodes: [],
  prices: []
};

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  checkExistingSession();
});

function checkExistingSession() {
  const saved = localStorage.getItem('tat_admin_session');
  if (saved) {
    try {
      const session = JSON.parse(saved);
      if (session.expiresAt && new Date(session.expiresAt) > new Date()) {
        adminState.token = session.token;
        adminState.admin = session.admin;
        showAdminPanel();
        return;
      }
    } catch (e) {
      console.error('Session error:', e);
    }
  }
  showLoginPage();
}

function showLoginPage() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('adminLayout').style.display = 'none';
}

function showAdminPanel() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('adminLayout').style.display = 'flex';

  // نمایش اطلاعات ادمین
  if (adminState.admin) {
    document.getElementById('adminName').textContent = adminState.admin.name || 'ادمین';
    document.getElementById('adminRole').textContent = 
      adminState.admin.role === 'super_admin' ? 'مدیر ارشد' : 'ادمین';
    document.getElementById('adminAvatar').textContent = 
      (adminState.admin.name || 'ا').charAt(0);
    
    document.getElementById('settingsEmail').textContent = adminState.admin.email;
    document.getElementById('settingsName').textContent = adminState.admin.name;
    document.getElementById('settingsRole').textContent = adminState.admin.role;
  }

  // بارگذاری داده‌ها
  loadDashboard();
}

// ═══════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  errorEl.textContent = '';

  try {
    const result = await apiAdminLogin(email, password);

    // ذخیره session
    adminState.token = result.token;
    adminState.admin = result.admin;

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('tat_admin_session', JSON.stringify({
      token: result.token,
      admin: result.admin,
      expiresAt: expiresAt.toISOString()
    }));

    showToast('خوش اومدی ' + result.admin.name + ' 🎉', 'success');
    showAdminPanel();

  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = error.message || 'خطا در ورود';
  }
}

function handleLogout() {
  if (!confirm('مطمئنی می‌خوای خارج بشی؟')) return;
  
  localStorage.removeItem('tat_admin_session');
  adminState.token = null;
  adminState.admin = null;
  location.reload();
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════

function goTo(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.querySelector(`.page[data-page="${pageName}"]`);
  if (page) page.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (nav) nav.classList.add('active');

  // آپدیت عنوان
  const titles = {
    'dashboard': 'داشبورد',
    'users': 'کاربران',
    'transactions': 'تراکنش‌ها',
    'invite-codes': 'کدهای دعوت',
    'prices': 'قیمت‌ها',
    'reports': 'گزارش‌ها',
    'settings': 'تنظیمات'
  };
  document.getElementById('pageTitle').textContent = titles[pageName] || 'داشبورد';

  // بارگذاری داده‌های صفحه
  if (pageName === 'users') loadUsers();
  else if (pageName === 'transactions') loadTransactions();
  else if (pageName === 'invite-codes') loadInviteCodes();
  else if (pageName === 'prices') loadPrices();
}

// ═══════════════════════════════════════
// LOAD DATA
// ═══════════════════════════════════════

async function loadDashboard() {
  try {
    const stats = await apiGetUsersStats();
    
    document.getElementById('statUsers').textContent = toFa(stats.users);
    document.getElementById('statTransactions').textContent = toFa(stats.transactions);
    document.getElementById('statBalance').textContent = toFa(Math.floor(stats.balance));
    document.getElementById('statInvites').textContent = toFa(stats.invites);

    // آخرین تراکنش‌ها
    const txs = await apiGetTransactions(5);
    const container = document.getElementById('recentActivity');
    
    if (!txs.length) {
      container.innerHTML = '<div class="loading">فعالیتی وجود ندارد</div>';
      return;
    }

    container.innerHTML = txs.map(tx => `
      <div class="activity-item">
        <div class="activity-icon">💸</div>
        <div class="activity-content">
          <div class="activity-title">${tx.description || 'تراکنش'}</div>
          <div class="activity-time">${toFa(tx.amount)} TAT — ${formatTime(tx.created_at)}</div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('loadDashboard error:', error);
    showToast('خطا در بارگذاری داشبورد', 'error');
  }
}

async function loadUsers() {
  try {
    const users = await apiGetUsers(100);
    adminState.users = users;
    renderUsers(users);
  } catch (error) {
    console.error('loadUsers error:', error);
    showToast('خطا در بارگذاری کاربران', 'error');
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading">کاربری وجود ندارد</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="direction:ltr; font-size:12px;">${u.user_id_public || '-'}</td>
      <td>${u.name || 'بدون نام'}</td>
      <td style="direction:ltr;">${u.phone || '-'}</td>
      <td style="color:#F59E0B; font-weight:700;">${toFa(Math.floor(u.balance || 0))} TAT</td>
      <td>
        <span class="badge ${u.is_blocked ? 'badge-danger' : 'badge-success'}">
          ${u.is_blocked ? 'مسدود' : 'فعال'}
        </span>
      </td>
    </tr>
  `).join('');
}

function filterUsers() {
  const q = document.getElementById('userSearch').value.toLowerCase();
  if (!q) {
    renderUsers(adminState.users);
    return;
  }
  const filtered = adminState.users.filter(u => 
    (u.name || '').toLowerCase().includes(q) ||
    (u.phone || '').includes(q) ||
    (u.user_id_public || '').toLowerCase().includes(q)
  );
  renderUsers(filtered);
}

async function loadTransactions() {
  try {
    const txs = await apiGetTransactions(100);
    adminState.transactions = txs;
    
    const tbody = document.getElementById('txTableBody');
    
    if (!txs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">تراکنشی وجود ندارد</td></tr>';
      return;
    }

    tbody.innerHTML = txs.map(tx => `
      <tr>
        <td style="direction:ltr; font-size:12px;">${tx.tx_code || tx.id.substring(0,8)}</td>
        <td>${getTxTypeName(tx.type)}</td>
        <td style="color:${tx.amount > 0 ? '#10B981' : '#EF4444'}; font-weight:700;">
          ${toFa(tx.amount)} TAT
        </td>
        <td>
          <span class="badge ${tx.status === 'success' ? 'badge-success' : 'badge-warning'}">
            ${tx.status === 'success' ? 'موفق' : tx.status}
          </span>
        </td>
        <td>${formatTime(tx.created_at)}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('loadTransactions error:', error);
  }
}

async function loadInviteCodes() {
  try {
    const codes = await apiGetInviteCodes(100);
    
    const tbody = document.getElementById('invitesTableBody');
    
    if (!codes.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading">کدی وجود ندارد</td></tr>';
      return;
    }

    tbody.innerHTML = codes.map(c => `
      <tr>
        <td style="direction:ltr; font-weight:700; color:#3B82F6;">${c.code}</td>
        <td>
          <span class="badge ${
            c.status === 'active' ? 'badge-success' : 
            c.status === 'used' ? 'badge-info' : 'badge-danger'
          }">
            ${c.status === 'active' ? 'فعال' : c.status === 'used' ? 'استفاده شده' : 'منقضی'}
          </span>
        </td>
        <td>${toFa(c.reward_user || 0)} TAT</td>
        <td>${formatDate(c.expires_at)}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('loadInviteCodes error:', error);
  }
}

async function loadPrices() {
  try {
    const prices = await apiGetPrices();
    adminState.prices = prices;
    
    const tbody = document.getElementById('pricesTableBody');
    
    if (!prices.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">قیمتی وجود ندارد</td></tr>';
      return;
    }

    tbody.innerHTML = prices.map(p => `
      <tr>
        <td style="font-weight:700;">${p.symbol}</td>
        <td>${p.name}</td>
        <td style="direction:ltr; font-weight:700;">${toFa(parseFloat(p.price).toLocaleString())} ${p.currency === 'USD' ? '$' : 'تومان'}</td>
        <td style="color:${p.change_24h >= 0 ? '#10B981' : '#EF4444'}">
          ${p.change_24h >= 0 ? '↑' : '↓'} ${toFa(Math.abs(p.change_24h || 0))}٪
        </td>
        <td>
          <button class="badge badge-info" style="cursor:pointer; border:none;" 
                  onclick="editPrice('${p.symbol}')">✏️ ویرایش</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('loadPrices error:', error);
  }
}

function editPrice(symbol) {
  const price = adminState.prices.find(p => p.symbol === symbol);
  if (!price) return;
  
  const newPrice = prompt(`قیمت جدید برای ${symbol}:`, price.price);
  if (!newPrice) return;
  
  const change = prompt(`تغییر ۲۴ ساعته (٪):`, price.change_24h || 0);
  if (change === null) return;

  apiUpdatePrice(symbol, parseFloat(newPrice), parseFloat(change))
    .then(() => {
      showToast('قیمت آپدیت شد ✅', 'success');
      loadPrices();
    })
    .catch(err => {
      showToast('خطا: ' + err.message, 'error');
    });
}

// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════

function toFa(num) {
  const p = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(num).replace(/\d/g, d => p[d]);
}

function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'همین الان';
  if (diff < 3600) return Math.floor(diff / 60) + ' دقیقه پیش';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ساعت پیش';
  if (diff < 604800) return Math.floor(diff / 86400) + ' روز پیش';
  return d.toLocaleDateString('fa-IR');
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fa-IR');
}

function getTxTypeName(type) {
  const names = {
    'transfer': 'انتقال',
    'invite_reward': 'جایزه دعوت',
    'invite_reward_owner': 'جایزه صاحب کد',
    'reward': 'جایزه',
    'stake_interest': 'سود سپرده'
  };
  return names[type] || type;
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 3000);
}

function toggleTheme() {
  document.body.classList.toggle('light-mode');
  localStorage.setItem('tat_admin_theme', 
    document.body.classList.contains('light-mode') ? 'light' : 'dark');
}

// لود تم از localStorage
if (localStorage.getItem('tat_admin_theme') === 'light') {
  document.body.classList.add('light-mode');
}

function refreshData() {
  const currentPage = document.querySelector('.page.active')?.dataset.page;
  if (currentPage === 'dashboard') loadDashboard();
  else if (currentPage === 'users') loadUsers();
  else if (currentPage === 'transactions') loadTransactions();
  else if (currentPage === 'invite-codes') loadInviteCodes();
  else if (currentPage === 'prices') loadPrices();
  showToast('بروزرسانی شد 🔄', 'success');
}
