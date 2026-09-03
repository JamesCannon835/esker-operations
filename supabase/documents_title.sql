-- =====================================================================
-- Give uploaded documents a human name.
-- Run once in the Supabase SQL editor.
-- =====================================================================

alter table public.documents add column if not exists title text;

-- Backfill existing rows from the stored file name.
update public.documents
set title = split_part(file_url, '/', array_length(string_to_array(file_url, '/'), 1))
where title is null;
