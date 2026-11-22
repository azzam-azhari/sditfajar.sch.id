-- ==============================================================================
-- MIGRATION 18 - FASE 7: PEMBAYARAN MANUAL (BUKTI TRANSFER & TUNAI)
-- Payment gateway (Midtrans) ditunda. Wali mengunggah bukti transfer, staf
-- keuangan (admin, super admin, guru jabatan bendahara) memverifikasi, atau
-- mencatat pembayaran tunai. Status 'paid' hanya dapat diubah lewat fungsi ini.
-- Idempotent: aman dijalankan ulang.
-- ==============================================================================

begin;

-- 1. HELPER ---------------------------------------------------------------------------
create or replace function public.is_finance_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_super() or public.has_teacher_position('bendahara');
$$;
revoke all on function public.is_finance_staff() from public;
grant execute on function public.is_finance_staff() to authenticated;

-- 2. NOMOR TAGIHAN ------------------------------------------------------------------
alter table public.payment_invoices add column if not exists invoice_number text;
create sequence if not exists public.seq_invoice_number start with 1;

create or replace function public.set_invoice_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.invoice_number is null then
    new.invoice_number := 'INV-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM') || '-'
      || lpad(nextval('public.seq_invoice_number')::text, 5, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists set_invoice_number on public.payment_invoices;
create trigger set_invoice_number before insert on public.payment_invoices
for each row execute function public.set_invoice_number();

update public.payment_invoices
set invoice_number = 'INV-' || to_char(created_at at time zone 'Asia/Jakarta', 'YYYYMM') || '-'
  || lpad(nextval('public.seq_invoice_number')::text, 5, '0')
where invoice_number is null;
create unique index if not exists uq_payment_invoices_number on public.payment_invoices(invoice_number);

-- 3. STATUS 'PAID' HANYA LEWAT FUNGSI PEMBAYARAN -------------------------------------
create or replace function public.guard_invoice_paid()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.payment_settlement', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.status = 'paid' then
    raise exception 'Tagihan baru tidak dapat langsung berstatus lunas.';
  end if;
  if tg_op = 'UPDATE' and (
    (new.status = 'paid' and old.status is distinct from 'paid')
    or (old.status = 'paid' and new.status is distinct from 'paid')
  ) then
    raise exception 'Status lunas hanya dapat diubah melalui verifikasi pembayaran.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_invoice_paid on public.payment_invoices;
create trigger guard_invoice_paid before insert or update on public.payment_invoices
for each row execute function public.guard_invoice_paid();

-- 4. PENGATURAN PEMBAYARAN MANUAL ----------------------------------------------------
alter table public.payment_settings add column if not exists manual_transfer_enabled boolean not null default true;
alter table public.payment_settings add column if not exists bank_accounts jsonb not null default '[]'::jsonb;
alter table public.payment_settings add column if not exists manual_instructions text;

-- 5. BUKTI PEMBAYARAN ----------------------------------------------------------------
create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.payment_invoices(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  file_path text not null,
  amount numeric not null check (amount > 0),
  transfer_date date not null,
  sender_name text not null,
  sender_bank text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payment_proofs_invoice on public.payment_proofs(invoice_id);
create index if not exists idx_payment_proofs_status on public.payment_proofs(status);
create unique index if not exists uq_payment_proofs_one_pending on public.payment_proofs(invoice_id) where status = 'pending';
drop trigger if exists set_payment_proofs_updated_at on public.payment_proofs;
create trigger set_payment_proofs_updated_at before update on public.payment_proofs
for each row execute function public.handle_updated_at();

alter table public.payment_proofs enable row level security;
drop policy if exists "Payment proofs read" on public.payment_proofs;
create policy "Payment proofs read"
  on public.payment_proofs for select
  to authenticated
  using (
    public.is_finance_staff()
    or exists (select 1 from public.parents p where p.id = payment_proofs.parent_id and p.profile_id = auth.uid())
  );
-- Tidak ada policy tulis: semua perubahan melalui fungsi security definer.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-files', 'payment-files', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 6. RLS KEUANGAN ---------------------------------------------------------------------
drop policy if exists "Invoices read policy" on public.payment_invoices;
create policy "Invoices read policy"
  on public.payment_invoices for select
  to authenticated
  using (
    public.is_finance_staff()
    or exists (select 1 from public.students s where s.id = payment_invoices.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.parents p where p.id = payment_invoices.parent_id and p.profile_id = auth.uid())
    or exists (
      select 1 from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = payment_invoices.student_id and p.profile_id = auth.uid()
    )
  );

drop policy if exists "Transactions read policy" on public.payment_transactions;
create policy "Transactions read policy"
  on public.payment_transactions for select
  to authenticated
  using (
    public.is_finance_staff()
    or exists (
      select 1 from public.payment_invoices inv
      join public.parents p on p.id = inv.parent_id
      where inv.id = payment_transactions.invoice_id and p.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.payment_invoices inv
      join public.parent_students ps on ps.student_id = inv.student_id
      join public.parents p on p.id = ps.parent_id
      where inv.id = payment_transactions.invoice_id and p.profile_id = auth.uid()
    )
  );
-- Wali tidak lagi menyisipkan transaksi langsung.
drop policy if exists "Transactions parent insert" on public.payment_transactions;

drop policy if exists "Receipts read policy" on public.payment_receipts;
create policy "Receipts read policy"
  on public.payment_receipts for select
  to authenticated
  using (
    public.is_finance_staff()
    or exists (
      select 1 from public.payment_invoices inv
      join public.parents p on p.id = inv.parent_id
      where inv.id = payment_receipts.invoice_id and p.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = payment_receipts.student_id and p.profile_id = auth.uid()
    )
  );

-- 7. FUNGSI PEMBAYARAN -----------------------------------------------------------------
create or replace function public.submit_payment_proof(
  p_invoice_id uuid, p_file_path text, p_amount numeric, p_transfer_date date,
  p_sender_name text, p_sender_bank text, p_notes text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_parent_id uuid;
  v_invoice public.payment_invoices%rowtype;
  v_proof_id uuid;
begin
  if public.current_user_role() is distinct from 'wali_murid' then
    raise exception 'Hanya wali murid yang dapat mengunggah bukti pembayaran.';
  end if;
  select id into v_parent_id from public.parents where profile_id = auth.uid();
  if v_parent_id is null then raise exception 'Data wali murid tidak ditemukan.'; end if;

  select * into v_invoice from public.payment_invoices where id = p_invoice_id for update;
  if not found then raise exception 'Tagihan tidak ditemukan.'; end if;
  if not (
    v_invoice.parent_id = v_parent_id
    or exists (select 1 from public.parent_students ps where ps.parent_id = v_parent_id and ps.student_id = v_invoice.student_id)
  ) then raise exception 'Tagihan ini bukan milik anak Anda.'; end if;
  if v_invoice.status <> 'unpaid' then
    raise exception 'Tagihan tidak sedang menunggu pembayaran.';
  end if;
  if p_amount <> v_invoice.amount then
    raise exception 'Nominal transfer harus sama dengan nominal tagihan (Rp %).', to_char(v_invoice.amount, 'FM999G999G999');
  end if;
  if p_transfer_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal transfer tidak boleh di masa depan.';
  end if;

  insert into public.payment_proofs (invoice_id, parent_id, file_path, amount, transfer_date, sender_name, sender_bank, notes)
  values (p_invoice_id, v_parent_id, p_file_path, p_amount, p_transfer_date, trim(p_sender_name), trim(p_sender_bank), nullif(trim(p_notes), ''))
  returning id into v_proof_id;
  update public.payment_invoices set status = 'pending' where id = p_invoice_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'submit_payment_proof', 'payment_invoices', p_invoice_id, jsonb_build_object('proof_id', v_proof_id));
  return v_proof_id;
end;
$$;

-- Internal: catat transaksi, tandai lunas, buat kuitansi, lunasi pesanan marketplace.
create or replace function public._settle_invoice(
  p_invoice_id uuid, p_provider text, p_payer_bank text, p_payer_name text, p_payload jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invoice public.payment_invoices%rowtype;
  v_tx_id uuid;
  v_student_name text;
  v_class_name text;
  v_logo text;
begin
  select * into v_invoice from public.payment_invoices where id = p_invoice_id for update;
  if v_invoice.status = 'paid' then raise exception 'Tagihan sudah lunas.'; end if;
  if v_invoice.status not in ('unpaid', 'pending') then raise exception 'Tagihan tidak dapat dilunasi pada status ini.'; end if;

  perform set_config('app.payment_settlement', 'on', true);

  insert into public.payment_transactions (invoice_id, provider, order_id, gross_amount, status, paid_at, payer_bank_name, payer_bank_account_name, raw_payload)
  values (p_invoice_id, p_provider, upper(p_provider) || '-' || v_invoice.invoice_number || '-' || substr(gen_random_uuid()::text, 1, 6),
          v_invoice.amount, 'paid', now(), p_payer_bank, p_payer_name, coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('recorded_by', auth.uid()))
  returning id into v_tx_id;

  update public.payment_invoices set status = 'paid' where id = p_invoice_id;

  select pr.name into v_student_name from public.students s join public.profiles pr on pr.id = s.profile_id where s.id = v_invoice.student_id;
  select c.name into v_class_name from public.class_students cs join public.classrooms c on c.id = cs.classroom_id
    where cs.student_id = v_invoice.student_id and cs.status = 'active' and cs.left_at is null limit 1;
  select logo_url into v_logo from public.school_settings limit 1;

  insert into public.payment_receipts (invoice_id, transaction_id, student_id, class_name, school_logo_url, paid_at, invoice_number, student_name, amount, status, payer_bank_name, payer_bank_account_name)
  values (p_invoice_id, v_tx_id, v_invoice.student_id, v_class_name, v_logo, now(), v_invoice.invoice_number,
          coalesce(v_student_name, '-'), v_invoice.amount, 'paid', p_payer_bank, p_payer_name);

  if v_invoice.marketplace_order_id is not null then
    update public.marketplace_orders set status = 'paid' where id = v_invoice.marketplace_order_id and status = 'pending_payment';
  end if;

  perform set_config('app.payment_settlement', 'off', true);
  return v_tx_id;
end;
$$;
revoke all on function public._settle_invoice(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.approve_payment_proof(p_proof_id uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare v_proof public.payment_proofs%rowtype;
begin
  if not public.is_finance_staff() then raise exception 'Hanya admin atau bendahara yang dapat memverifikasi pembayaran.'; end if;
  select * into v_proof from public.payment_proofs where id = p_proof_id for update;
  if not found then raise exception 'Bukti pembayaran tidak ditemukan.'; end if;
  if v_proof.status <> 'pending' then raise exception 'Bukti pembayaran ini sudah diproses.'; end if;

  perform public._settle_invoice(v_proof.invoice_id, 'manual_transfer', v_proof.sender_bank, v_proof.sender_name,
    jsonb_build_object('proof_id', v_proof.id, 'transfer_date', v_proof.transfer_date));
  update public.payment_proofs
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = nullif(trim(p_notes), '')
    where id = p_proof_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'approve_payment_proof', 'payment_invoices', v_proof.invoice_id, jsonb_build_object('proof_id', p_proof_id));
end;
$$;

create or replace function public.reject_payment_proof(p_proof_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_proof public.payment_proofs%rowtype;
begin
  if not public.is_finance_staff() then raise exception 'Hanya admin atau bendahara yang dapat memverifikasi pembayaran.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Alasan penolakan wajib diisi.'; end if;
  select * into v_proof from public.payment_proofs where id = p_proof_id for update;
  if not found then raise exception 'Bukti pembayaran tidak ditemukan.'; end if;
  if v_proof.status <> 'pending' then raise exception 'Bukti pembayaran ini sudah diproses.'; end if;

  update public.payment_proofs
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = trim(p_reason)
    where id = p_proof_id;
  update public.payment_invoices set status = 'unpaid' where id = v_proof.invoice_id and status = 'pending';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'reject_payment_proof', 'payment_invoices', v_proof.invoice_id, jsonb_build_object('proof_id', p_proof_id));
end;
$$;

create or replace function public.record_cash_payment(p_invoice_id uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_finance_staff() then raise exception 'Hanya admin atau bendahara yang dapat mencatat pembayaran tunai.'; end if;
  perform public._settle_invoice(p_invoice_id, 'cash', null, null, jsonb_build_object('notes', nullif(trim(p_notes), '')));
  update public.payment_proofs
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = 'Tagihan dilunasi tunai di sekolah.'
    where invoice_id = p_invoice_id and status = 'pending';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'record_cash_payment', 'payment_invoices', p_invoice_id, jsonb_build_object('notes', nullif(trim(p_notes), '')));
end;
$$;

revoke all on function public.submit_payment_proof(uuid, text, numeric, date, text, text, text) from public, anon;
revoke all on function public.approve_payment_proof(uuid, text) from public, anon;
revoke all on function public.reject_payment_proof(uuid, text) from public, anon;
revoke all on function public.record_cash_payment(uuid, text) from public, anon;
grant execute on function public.submit_payment_proof(uuid, text, numeric, date, text, text, text) to authenticated;
grant execute on function public.approve_payment_proof(uuid, text) to authenticated;
grant execute on function public.reject_payment_proof(uuid, text) to authenticated;
grant execute on function public.record_cash_payment(uuid, text) to authenticated;

commit;
