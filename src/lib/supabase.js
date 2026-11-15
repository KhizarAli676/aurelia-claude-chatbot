import { createClient } from '@supabase/supabase-js';

// Reads from .env first, falling back to your configured Supabase project credentials
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://fbvtbuolutkltepzwekm.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_DN-IxA6MwmSJLNF6EPAwhw_cptV86SD';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;
