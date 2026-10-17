// js/app/supabase.js — klien Supabase saja, tanpa dependensi berat. Dipakai gerbang login (main.js/auth.js) dan bootstrap.js.
// VITE_SB_URL = https://<ref>.supabase.co  (tanpa /rest/v1 dan tanpa garis miring di akhir)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SB_URL, import.meta.env.VITE_SB_KEY);
