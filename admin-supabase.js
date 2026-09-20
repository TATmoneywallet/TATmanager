/* ═══════════════════════════════════════════
   TAT Admin Panel — Supabase Connection (JWT-based)
   ═══════════════════════════════════════════ */

// پروژه ادمین (TATmanager)
const ADMIN_PROJECT_URL = 'https://irqtkkkaignvsjccquzd.supabase.co';
const ADMIN_PROJECT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlycXRra2thaWdudnNqY2NxdXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MzIwMDksImV4cCI6MjEwNTQwODAwOX0.oYziZfngr3LmcV794eupK1CBwM6u44EKFRS0LYf_nRM';

const adminProjectClient = window.supabase.createClient(
  ADMIN_PROJECT_URL,
  ADMIN_PROJECT_ANON
);

// ⚠️ فقط URL و anon key پروژه کاربران
const USERS_SUPABASE_URL = 'https://lvujgergogwodfskkqrh.supabase.co';
const USERS_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dWpnZXJnb2d3b2Rmc2trcXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NDYwNTEsImV4cCI6MjEwNTMyMjA1MX0.W1OPbhAaBbtJrfgir3Nez4iP8tBWShXv7wFYkYGNKrY';

// یه کلاینت
const supabaseClient = window.supabase.createClient(
  USERS_SUPABASE_URL,
  USERS_SUPABASE_ANON_KEY
);

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════

async function apiAdminLogin(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw new Error(error.message);
  
  // چک کن کاربر ادمین هست
  const { data: userCheck } = await supabaseClient
    .from('users')
    .select('user_id_public, name')
    .eq('auth_user_id', data.user.id)
    .single();

  if (!userCheck || userCheck.user_id_public !== '@admin') {
    await supabaseClient.auth.signOut();
    throw new Error('شما دسترسی ادمین ندارید');
  }

  return {
    token: data.session.access_token,
    admin: {
      id: data.user.id,
      email: data.user.email,
      name: userCheck.name || 'مدیر ارشد',
      role: 'super_admin'
    }
  };
}

async function apiAdminLogout() {
  await supabaseClient.auth.signOut();
}

// ═══════════════════════════════════════
// USERS
// ═══════════════════════════════════════

async function apiGetUsersStats() {
  const { count: userCount } = await supabaseClient
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { data: users } = await supabaseClient
    .from('users')
    .select('balance');

  const totalBalance = users?.reduce((sum, u) => sum + parseFloat(u.balance || 0), 0) || 0;

  const { count: txCount } = await supabaseClient
    .from('transactions')
    .select('*', { count: 'exact', head: true });

  const { count: inviteCount } = await supabaseClient
    .from('invite_codes')
    .select('*', { count: 'exact', head: true });

  return {
    users: userCount || 0,
    balance: totalBalance,
    transactions: txCount || 0,
    invites: inviteCount || 0
  };
}

async function apiGetUsers(limit = 100) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function apiGetTransactions(limit = 100) {
  const { data, error } = await supabaseClient
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function apiGetInviteCodes(limit = 100) {
  const { data, error } = await supabaseClient
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function apiGetPrices() {
  const { data, error } = await supabaseClient
    .from('prices')
    .select('*')
    .order('symbol');

  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════
// ADMIN ACTIONS (direct DB)
// ═══════════════════════════════════════

async function apiUpdateUserBalance(userId, amount, reason) {
  // چک کاربر
  const { data: user } = await supabaseClient
    .from('users')
    .select('balance, name')
    .eq('id', userId)
    .single();

  if (!user) throw new Error('کاربر پیدا نشد');

  const newBalance = parseFloat(user.balance) + parseFloat(amount);
  if (newBalance < 0) throw new Error('موجودی نمی‌تونه منفی بشه');

  // آپدیت
  const { error } = await supabaseClient
    .from('users')
    .update({ balance: newBalance })
    .eq('id', userId);

  if (error) throw error;

  // ثبت تراکنش
  await supabaseClient.from('transactions').insert({
    to_user: userId,
    amount: Math.abs(amount),
    type: amount > 0 ? 'admin_credit' : 'admin_debit',
    description: reason || (amount > 0 ? 'افزایش توسط ادمین' : 'کاهش توسط ادمین'),
    status: 'success',
    tx_code: 'ADMIN-' + Date.now().toString(36).toUpperCase()
  });

  return { success: true, newBalance };
}

async function apiToggleUserBlock(userId, block) {
  const { error } = await supabaseClient
    .from('users')
    .update({ is_blocked: block })
    .eq('id', userId);

  if (error) throw error;
  return { success: true, blocked: block };
}

async function apiDeleteUser(userId) {
  const { error } = await supabaseClient
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) throw error;
  return { success: true };
}

async function apiUpdatePrice(symbol, newPrice, change) {
  const { data, error } = await supabaseClient
    .from('prices')
    .update({ 
      price: newPrice,
      change_24h: change,
      last_updated: new Date().toISOString()
    })
    .eq('symbol', symbol)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════
// SYSTEM SETTINGS
// ═══════════════════════════════════════

async function apiGetSettings() {
  const { data, error } = await adminProjectClient
    .from('system_settings')
    .select('*');

  if (error) throw error;
  
  const settings = {};
  data.forEach(s => {
    settings[s.key] = s.value;
  });
  return settings;
}

async function apiUpdateSetting(key, value) {
  const { data, error } = await adminProjectClient
    .from('system_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// پروژه ادمین (TATmanager)
const ADMIN_PROJECT_URL = 'https://irqtkkkaignvsjccquzd.supabase.co';
const ADMIN_PROJECT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlycXRra2thaWdudnNqY2NxdXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MzIwMDksImV4cCI6MjEwNTQwODAwOX0.oYziZfngr3LmcV794eupK1CBwM6u44EKFRS0LYf_nRM';

const adminProjectClient = window.supabase.createClient(
  ADMIN_PROJECT_URL,
  ADMIN_PROJECT_ANON
);
