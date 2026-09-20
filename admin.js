/* ═══════════════════════════════════════════
   TAT Admin Panel — Main Logic (v2.1.0)
   ═══════════════════════════════════════════ */

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

async function checkExistingSession() {
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

  loadUsers().then(() => loadDashboard());
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

async function handleLogout() {
  if (!confirm('مطمئنی می‌خوای خارج بشی؟')) return;
  
  try {
    await apiAdminLogout();
  } catch (e) {
    console.error(e);
  }
  
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

  const titles = {
    'dashboard': 'داشبورد',
    'users': 'کاربران',
    'transactions': 'تراکنش‌ها',
    'invite-codes': 'کدهای دعوت',
    'prices': 'قیمت‌ها',
    'mint-burn': 'Mint / Burn',
    'reports': 'گزارش‌ها',
    'settings': 'تنظیمات'
  };
  document.getElementById('pageTitle').textContent = titles[pageName] || 'داشبورد';

  if (pageName === 'users') loadUsers();
  else if (pageName === 'transactions') loadTransactions();
  else if (pageName === 'invite-codes') loadInviteCodes();
  else if (pageName === 'prices') loadPrices();
  else if (pageName === 'mint-burn') loadMintBurn();
  else if (pageName === 'settings') loadSettings();
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
    tbody.innerHTML = '<tr><td colspan="6" class="loading">کاربری وجود ندارد</td></tr>';
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
      <td>
        <div class="action-buttons">
          <button class="btn-icon view" onclick="viewUser('${u.id}')" title="مشاهده">👁</button>
          <button class="btn-icon edit" onclick="editBalance('${u.id}')" title="ویرایش موجودی">✏️</button>
          <button class="btn-icon ${u.is_blocked ? 'unblock' : 'block'}" 
                  onclick="toggleBlock('${u.id}', ${!u.is_blocked})" 
                  title="${u.is_blocked ? 'آزاد' : 'قفل'}">
            ${u.is_blocked ? '🔓' : '🔒'}
          </button>
        </div>
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
// USER MANAGEMENT
// ═══════════════════════════════════════

let currentUserId = null;
let currentBalanceOp = 'add';

function viewUser(userId) {
  const user = adminState.users.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('userModalTitle').textContent = '👤 ' + (user.name || 'کاربر');
  
  document.getElementById('userModalBody').innerHTML = `
    <div class="user-detail-row">
      <span>آیدی:</span>
      <span style="direction:ltr;">${user.user_id_public || '-'}</span>
    </div>
    <div class="user-detail-row">
      <span>نام:</span>
      <span>${user.name || 'بدون نام'}</span>
    </div>
    <div class="user-detail-row">
      <span>موبایل:</span>
      <span style="direction:ltr;">${user.phone || '-'}</span>
    </div>
    <div class="user-detail-row">
      <span>ایمیل:</span>
      <span style="direction:ltr;">${user.email || '-'}</span>
    </div>
    <div class="user-detail-row">
      <span>شماره کارت:</span>
      <span style="direction:ltr;">${user.card_number || '-'}</span>
    </div>
    <div class="user-detail-row">
      <span>موجودی:</span>
      <span style="color:#F59E0B;">${toFa(Math.floor(user.balance || 0))} TAT</span>
    </div>
    <div class="user-detail-row">
      <span>سطح پروفایل:</span>
      <span>${user.profile_level || 'basic'}</span>
    </div>
    <div class="user-detail-row">
      <span>سطح کاربری:</span>
      <span>${user.tier || 'bronze'}</span>
    </div>
    <div class="user-detail-row">
      <span>وضعیت:</span>
      <span>
        <span class="badge ${user.is_blocked ? 'badge-danger' : 'badge-success'}">
          ${user.is_blocked ? 'مسدود' : 'فعال'}
        </span>
      </span>
    </div>
    <div class="user-detail-row">
      <span>تاریخ عضویت:</span>
      <span>${formatDate(user.created_at)}</span>
    </div>
  `;

  document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('active');
}

function editBalance(userId) {
  const user = adminState.users.find(u => u.id === userId);
  if (!user) return;

  currentUserId = userId;
  currentBalanceOp = 'add';

  document.getElementById('balanceUserName').textContent = user.name || 'کاربر';
  document.getElementById('balanceUserCurrent').textContent = 
    toFa(Math.floor(user.balance || 0)) + ' TAT';
  document.getElementById('balanceAmount').value = '';
  document.getElementById('balanceReason').value = '';

  setBalanceOp('add');
  document.getElementById('balanceModal').classList.add('active');
}

function closeBalanceModal() {
  document.getElementById('balanceModal').classList.remove('active');
  currentUserId = null;
}

function setBalanceOp(op) {
  currentBalanceOp = op;
  document.getElementById('btnAdd').classList.toggle('active', op === 'add');
  document.getElementById('btnSub').classList.toggle('active', op === 'sub');
}

async function submitBalanceChange() {
  const amount = parseFloat(document.getElementById('balanceAmount').value);
  const reason = document.getElementById('balanceReason').value.trim();

  if (!amount || amount <= 0) {
    showToast('مقدار معتبر وارد کن', 'error');
    return;
  }

  const finalAmount = currentBalanceOp === 'add' ? amount : -amount;

  const btn = document.getElementById('balanceSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'در حال ذخیره...';

  try {
    const result = await apiUpdateUserBalance(currentUserId, finalAmount, reason);

    const user = adminState.users.find(u => u.id === currentUserId);
    if (user) user.balance = result.newBalance;

    showToast('موجودی با موفقیت تغییر کرد ✅', 'success');
    closeBalanceModal();
    renderUsers(adminState.users);
    loadDashboard();

  } catch (error) {
    console.error('submitBalanceChange error:', error);
    showToast(error.message || 'خطا در ذخیره', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'ذخیره تغییرات';
  }
}

async function toggleBlock(userId, block) {
  const action = block ? 'قفل' : 'آزاد';
  if (!confirm(`مطمئنی می‌خوای کاربر رو ${action} کنی؟`)) return;

  try {
    await apiToggleUserBlock(userId, block);

    const user = adminState.users.find(u => u.id === userId);
    if (user) user.is_blocked = block;

    showToast(`کاربر ${action} شد ✅`, 'success');
    renderUsers(adminState.users);

  } catch (error) {
    console.error('toggleBlock error:', error);
    showToast(error.message || 'خطا', 'error');
  }
}

// ═══════════════════════════════════════
// MINT / BURN
// ═══════════════════════════════════════

function loadMintBurn() {
  const datalistMint = document.getElementById('usersListMint');
  const datalistBurn = document.getElementById('usersListBurn');
  
  if (datalistMint && adminState.users.length) {
    datalistMint.innerHTML = adminState.users.map(u => 
      `<option value="${u.user_id_public}">${u.name || 'بدون نام'} - ${u.phone || 'بدون موبایل'}</option>`
    ).join('');
  }
  
  if (datalistBurn && adminState.users.length) {
    datalistBurn.innerHTML = adminState.users.map(u => 
      `<option value="${u.user_id_public}">${u.name || 'بدون نام'} - ${u.phone || 'بدون موبایل'}</option>`
    ).join('');
  }

  loadMintBurnHistory();
}

function findUserByInput(input) {
  const q = input.toLowerCase().trim();
  return adminState.users.find(u => 
    u.user_id_public?.toLowerCase() === q ||
    u.phone === q ||
    u.email?.toLowerCase() === q
  );
}

async function doMint() {
  const userInput = document.getElementById('mintUserSearch').value.trim();
  const amount = parseFloat(document.getElementById('mintAmount').value);
  const reason = document.getElementById('mintReason').value.trim();

  if (!userInput) {
    showToast('کاربر رو انتخاب کن', 'error');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('مقدار معتبر وارد کن', 'error');
    return;
  }

  const user = findUserByInput(userInput);
  if (!user) {
    showToast('کاربر پیدا نشد', 'error');
    return;
  }

  if (!confirm(`مطمئنی ${toFa(amount)} TAT برای ${user.name} چاپ کنی؟`)) return;

  try {
    await apiUpdateUserBalance(user.id, amount, reason || 'چاپ توسط ادمین');
    
    user.balance = parseFloat(user.balance) + amount;
    
    showToast(`✅ ${toFa(amount)} TAT برای ${user.name} چاپ شد`, 'success');
    
    document.getElementById('mintUserSearch').value = '';
    document.getElementById('mintAmount').value = '';
    document.getElementById('mintReason').value = '';
    
    loadMintBurnHistory();
    loadDashboard();

  } catch (error) {
    console.error('doMint error:', error);
    showToast(error.message || 'خطا', 'error');
  }
}

async function doBurn() {
  const userInput = document.getElementById('burnUserSearch').value.trim();
  const amount = parseFloat(document.getElementById('burnAmount').value);
  const reason = document.getElementById('burnReason').value.trim();

  if (!userInput) {
    showToast('کاربر رو انتخاب کن', 'error');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('مقدار معتبر وارد کن', 'error');
    return;
  }

  const user = findUserByInput(userInput);
  if (!user) {
    showToast('کاربر پیدا نشد', 'error');
    return;
  }

  if (parseFloat(user.balance) < amount) {
    showToast(`موجودی ${user.name} کافی نیست`, 'error');
    return;
  }

  if (!confirm(`مطمئنی ${toFa(amount)} TAT از ${user.name} بسوزونی؟`)) return;

  try {
    await apiUpdateUserBalance(user.id, -amount, reason || 'سوزاندن توسط ادمین');
    
    user.balance = parseFloat(user.balance) - amount;
    
    showToast(`🔥 ${toFa(amount)} TAT از ${user.name} سوزونده شد`, 'success');
    
    document.getElementById('burnUserSearch').value = '';
    document.getElementById('burnAmount').value = '';
    document.getElementById('burnReason').value = '';
    
    loadMintBurnHistory();
    loadDashboard();

  } catch (error) {
    console.error('doBurn error:', error);
    showToast(error.message || 'خطا', 'error');
  }
}

async function loadMintBurnHistory() {
  try {
    const txs = await apiGetTransactions(50);
    const mintBurn = txs.filter(tx => 
      tx.type === 'admin_credit' || 
      tx.type === 'admin_debit' || 
      tx.type === 'mint' || 
      tx.type === 'burn'
    ).slice(0, 20);

    const container = document.getElementById('mintBurnHistory');
    if (!container) return;
    
    if (!mintBurn.length) {
      container.innerHTML = '<div class="loading">تاریخچه‌ای وجود ندارد</div>';
      return;
    }

    container.innerHTML = mintBurn.map(tx => {
      const isCredit = tx.type === 'admin_credit' || tx.type === 'mint';
      return `
        <div class="activity-item">
          <div class="activity-icon" style="background:${isCredit ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};">
            ${isCredit ? '🪙' : '🔥'}
          </div>
          <div class="activity-content">
            <div class="activity-title">${tx.description || 'عملیات ادمین'}</div>
            <div class="activity-time">${toFa(tx.amount)} TAT — ${formatTime(tx.created_at)}</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('loadMintBurnHistory error:', error);
  }
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
    'stake_interest': 'سود سپرده',
    'admin_credit': 'افزایش ادمین',
    'admin_debit': 'کاهش ادمین',
    'mint': 'چاپ',
    'burn': 'سوزاندن'
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
  else if (currentPage === 'mint-burn') loadMintBurn();
  showToast('بروزرسانی شد 🔄', 'success');
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'userModal') closeUserModal();
  if (e.target.id === 'balanceModal') closeBalanceModal();
});

// ═══════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════

async function loadSettings() {
  try {
    const settings = await apiGetSettings();
    
    // کارمزدها
    if (settings.fees) {
      document.getElementById('feeTransfer').value = settings.fees.transfer || 0.5;
      document.getElementById('feeTrade').value = settings.fees.trade || 1;
    }
    
    // جایزه دعوت
    if (settings.rewards) {
      document.getElementById('rewardOwner').value = settings.rewards.invite_owner || 100;
      document.getElementById('rewardUser').value = settings.rewards.invite_user || 50;
    }
    
    // محدودیت‌ها
    if (settings.limits) {
      document.getElementById('maxInviteCodes').value = settings.limits.max_invite_codes || 10;
      document.getElementById('maxDailyTx').value = settings.limits.max_daily_tx || 100;
    }

  } catch (error) {
    console.error('loadSettings error:', error);
  }
}

async function saveFees() {
  const transfer = parseFloat(document.getElementById('feeTransfer').value);
  const trade = parseFloat(document.getElementById('feeTrade').value);

  if (isNaN(transfer) || isNaN(trade)) {
    showToast('مقادیر معتبر وارد کن', 'error');
    return;
  }

  try {
    await apiUpdateSetting('fees', { transfer, trade });
    showToast('کارمزدها ذخیره شد ✅', 'success');
  } catch (error) {
    console.error('saveFees error:', error);
    showToast(error.message || 'خطا', 'error');
  }
}

async function saveRewards() {
  const owner = parseFloat(document.getElementById('rewardOwner').value);
  const user = parseFloat(document.getElementById('rewardUser').value);

  if (isNaN(owner) || isNaN(user)) {
    showToast('مقادیر معتبر وارد کن', 'error');
    return;
  }

  try {
    await apiUpdateSetting('rewards', { invite_owner: owner, invite_user: user });
    showToast('جایزه‌ها ذخیره شد ✅', 'success');
  } catch (error) {
    console.error('saveRewards error:', error);
    showToast(error.message || 'خطا', 'error');
  }
}

async function saveLimits() {
  const maxInviteCodes = parseInt(document.getElementById('maxInviteCodes').value);
  const maxDailyTx = parseInt(document.getElementById('maxDailyTx').value);

  if (isNaN(maxInviteCodes) || isNaN(maxDailyTx)) {
    showToast('مقادیر معتبر وارد کن', 'error');
    return;
  }

  try {
    await apiUpdateSetting('limits', { max_invite_codes: maxInviteCodes, max_daily_tx: maxDailyTx });
    showToast('محدودیت‌ها ذخیره شد ✅', 'success');
  } catch (error) {
    console.error('saveLimits error:', error);
    showToast(error.message || 'خطا', 'error');
  }
}

// ═══════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════

let currentReportRange = 'today';

function setReportRange(range, btn) {
  document.querySelectorAll('.report-tab-inline').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentReportRange = range;
  loadReports();
}

async function loadReports() {
  try {
    const txs = await apiGetTransactions(500);
    
    // فیلتر بر اساس بازه
    const filtered = filterByRange(txs, currentReportRange);
    
    // محاسبات
    let totalIn = 0;
    let totalOut = 0;
    let totalFee = 0;
    
    filtered.forEach(tx => {
      const amount = parseFloat(tx.amount) || 0;
      const fee = parseFloat(tx.fee) || 0;
      
      if (tx.type === 'transfer') {
        if (tx.from_user) totalOut += amount;
        if (tx.to_user) totalIn += amount;
      } else if (tx.type === 'admin_credit' || tx.type === 'invite_reward' || tx.type === 'invite_reward_owner' || tx.type === 'mint') {
        totalIn += amount;
      } else if (tx.type === 'admin_debit' || tx.type === 'burn') {
        totalOut += amount;
      }
      
      totalFee += fee;
    });
    
    // آپدیت UI
    document.getElementById('reportIn').textContent = toFa(Math.floor(totalIn)) + ' TAT';
    document.getElementById('reportOut').textContent = toFa(Math.floor(totalOut)) + ' TAT';
    document.getElementById('reportCount').textContent = toFa(filtered.length);
    document.getElementById('reportFee').textContent = toFa(Math.floor(totalFee)) + ' TAT';
    
    // نمودار
    renderTxChart(filtered);
    
    // جدول
    renderReportTable(filtered.slice(0, 50));
    
  } catch (error) {
    console.error('loadReports error:', error);
    showToast('خطا در بارگذاری گزارش‌ها', 'error');
  }
}

function filterByRange(txs, range) {
  if (range === 'all') return txs;
  
  const now = new Date();
  let fromDate;
  
  if (range === 'today') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === 'week') {
    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === 'month') {
    fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return txs.filter(tx => new Date(tx.created_at) >= fromDate);
}

function renderTxChart(txs) {
  const container = document.getElementById('txChart');
  
  if (!txs.length) {
    container.innerHTML = '<div class="loading">تراکنشی وجود ندارد</div>';
    return;
  }
  
  // گروه‌بندی بر اساس روز (۷ روز اخیر)
  const days = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayLabel = d.toLocaleDateString('fa-IR', { weekday: 'short' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const count = txs.filter(tx => {
      const txDate = new Date(tx.created_at);
      return txDate >= dayStart && txDate < dayEnd;
    }).length;
    
    days.push({ label: dayLabel, count });
  }
  
  const maxCount = Math.max(...days.map(d => d.count), 1);
  
  container.innerHTML = days.map(d => {
    const height = (d.count / maxCount) * 100;
    return `
      <div class="bar-item">
        <div class="bar-fill" style="height:${height}%;" data-value="${toFa(d.count)}"></div>
        <div class="bar-label">${d.label}</div>
      </div>
    `;
  }).join('');
}

function renderReportTable(txs) {
  const tbody = document.getElementById('reportTableBody');
  
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
      <td style="color:#F59E0B;">${toFa(tx.fee || 0)} TAT</td>
      <td>${formatTime(tx.created_at)}</td>
    </tr>
  `).join('');
}

function exportReport() {
  try {
    const txs = adminState.transactions;
    
    if (!txs.length) {
      showToast('تراکنشی برای خروجی وجود ندارد', 'error');
      return;
    }
    
    // ساخت CSV
    const headers = ['کد پیگیری', 'نوع', 'مقدار', 'کارمزد', 'توضیحات', 'تاریخ'];
    const rows = txs.map(tx => [
      tx.tx_code || tx.id.substring(0,8),
      getTxTypeName(tx.type),
      tx.amount,
      tx.fee || 0,
      tx.description || '',
      new Date(tx.created_at).toLocaleString('fa-IR')
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(','))
    ].join('\n');
    
    // دانلود
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TAT-Report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('گزارش دانلود شد 📥', 'success');
    
  } catch (error) {
    console.error('exportReport error:', error);
    showToast('خطا در خروجی', 'error');
  }
}
