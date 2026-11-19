import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isBackendConfigured = Boolean(url && anonKey && !url.includes('SEU-PROJETO'));

export const supabase = createClient(
  isBackendConfigured ? url : 'https://placeholder.supabase.co',
  isBackendConfigured ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);
