const SUPABASE_URL = 'https://arhgxyvrmpyancrfbtdj.supabase.co';
// IMPORTANT: Paste your full Supabase API (anon) key here
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyaGd4eXZybXB5YW5jcmZidGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTY3MjQsImV4cCI6MjA3NTQzMjcyNH0.ySeFQ1tegBz-ulkh9V9iilZvf6AXYcahYhpaKey10-0';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
