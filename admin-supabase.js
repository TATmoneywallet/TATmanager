/* ═══════════════════════════════════════════
   TAT Admin Panel — Supabase Connection
   ═══════════════════════════════════════════ */

// ⚠️ این دو مقدار رو از پروژه TATmanager بگیر
const ADMIN_SUPABASE_URL = 'https://YOUR-ADMIN-PROJECT.supabase.co';
const ADMIN_SUPABASE_ANON_KEY = 'YOUR-ADMIN-ANON-KEY';

// ⚠️ این مقدار رو از پروژه کاربران (TAT اصلی) بگیر
const USERS_SUPABASE_URL = 'https://lvujgergogwodfskkqrh.supabase.co';
const USERS_SUPABASE_ANON_KEY = 'YOUR-USERS-ANON-KEY';

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
