/* ═══════════════════════════════════════════
   TAT Admin Panel — Supabase Connection
   ═══════════════════════════════════════════ */

// ⚠️ این دو مقدار رو از پروژه TATmanager بگیر
const ADMIN_SUPABASE_URL = 'https://irqtkkkaignvsjccquzd.supabase.co';
const ADMIN_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlycXRra2thaWdudnNqY2NxdXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MzIwMDksImV4cCI6MjEwNTQwODAwOX0.oYziZfngr3LmcV794eupK1CBwM6u44EKFRS0LYf_nRM';

// ⚠️ این مقدار رو از پروژه کاربران (TAT اصلی) بگیر
const USERS_SUPABASE_URL = 'https://lvujgergogwodfskkqrh.supabase.co';
const USERS_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dWpnZXJnb2d3b2Rmc2trcXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NDYwNTEsImV4cCI6MjEwNTMyMjA1MX0.W1OPbhAaBbtJrfgir3Nez4iP8tBWShXv7wFYkYGNKrY';

// کلاینت ادمین
const adminSupabase = window.supabase.createClient(
  ADMIN_SUPABASE_URL,
  ADMIN_SUPABASE_ANON_KEY
);

// کلاینت کاربران (برای خواندن داده)
const usersSupabase = window.supabase.createClient(
  USERS_SUPABASE_URL,
  USERS_SUPABASE_ANON_KEY
);

// ═══════════════════════════════════════
// توابع API ادمین
// ═══════════════════════════════════════

// ورود ادمین
async function apiAdminLogin(email, password) {
  const { data, error } = await adminSupabase.functions.invoke('admin-login', {
    body: { email, password }
  });

  if (error) throw new Error(error.message || 'خطا در ورود');
  if (data.error) throw new Error(data.error);
  return data;
}

// گرفتن آمار کاربران
async function apiGetUsersStats() {
  const { count: userCount } = await usersSupabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { data: users } = await usersSupabase
    .from('users')
    .select('balance');

  const totalBalance = users?.reduce((sum, u) => sum + parseFloat(u.balance || 0), 0) || 0;

  const { count: txCount } = await usersSupabase
    .from('transactions')
    .select('*', { count: 'exact', head: true });

  const { count: inviteCount } = await usersSupabase
    .from('invite_codes')
    .select('*', { count: 'exact', head: true });

  return {
    users: userCount || 0,
    balance: totalBalance,
    transactions: txCount || 0,
    invites: inviteCount || 0
  };
}

// گرفتن لیست کاربران
async function apiGetUsers(limit = 100) {
  const { data, error } = await usersSupabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// گرفتن تراکنش‌ها
async function apiGetTransactions(limit = 100) {
  const { data, error } = await usersSupabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// گرفتن کدهای دعوت
async function apiGetInviteCodes(limit = 100) {
  const { data, error } = await usersSupabase
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// گرفتن قیمت‌ها
async function apiGetPrices() {
  const { data, error } = await usersSupabase
    .from('prices')
    .select('*')
    .order('symbol');

  if (error) throw error;
  return data || [];
}

// آپدیت قیمت
async function apiUpdatePrice(symbol, newPrice, change) {
  const { data, error } = await usersSupabase
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
// Admin Actions (via Edge Function)
// ═══════════════════════════════════════

async function apiAdminAction(action, data) {
  const { data: result, error } = await adminSupabase.functions.invoke('admin-actions', {
    body: {
      action,
      token: adminState.token,
      data
    }
  });

  if (error) throw new Error(error.message || 'خطا در اجرا');
  if (result.error) throw new Error(result.error);
  return result;
}

// ویرایش موجودی
async function apiUpdateUserBalance(userId, amount, reason) {
  return await apiAdminAction('update_balance', { userId, amount, reason });
}

// قفل/آزاد
async function apiToggleUserBlock(userId, block) {
  return await apiAdminAction('toggle_block', { userId, block });
}

// حذف کاربر
async function apiDeleteUser(userId) {
  return await apiAdminAction('delete_user', { userId });
}

// Mint
async function apiMint(userId, amount, reason) {
  return await apiAdminAction('mint', { userId, amount, reason });
}

// Burn
async function apiBurn(userId, amount, reason) {
  return await apiAdminAction('burn', { userId, amount, reason });
}
