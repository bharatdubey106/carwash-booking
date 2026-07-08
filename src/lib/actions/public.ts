// lib/actions/public.ts
'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Public, unauthenticated read of platform settings — safe because RLS's
 * platform_settings_public_read policy only exposes these three columns via
 * this table, and the table has nothing sensitive in it.
 */
export async function getPublicSettings() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('platform_settings')
    .select('whatsapp_number, default_slot_interval_minutes, max_advance_days')
    .eq('id', true)
    .single();

  if (error || !data) {
    // Sane fallback so the landing page never breaks if settings are missing.
    return { whatsapp_number: '919407822022', default_slot_interval_minutes: 30, max_advance_days: 60 };
  }
  return data;
}