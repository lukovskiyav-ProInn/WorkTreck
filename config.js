// ============================================
// НАСТРОЙКИ SUPABASE
// ============================================

const SUPABASE_URL = 'https://gzujsskooxclhhihodgu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_a69q4VL9_U-Y16JwFelkzg_RLgltYa3';
const USE_SUPABASE = true;

let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const lib = window.supabase;
  if (!lib) {
    console.error('[YouGile] window.supabase is undefined — CDN не загрузился');
    return null;
  }
  if (typeof lib.createClient !== 'function') {
    console.error('[YouGile] createClient not found on', lib);
    return null;
  }
  supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('[YouGile] Supabase client OK');
  return supabaseClient;
}

console.log('[YouGile] config.js loaded, USE_SUPABASE=', USE_SUPABASE);
