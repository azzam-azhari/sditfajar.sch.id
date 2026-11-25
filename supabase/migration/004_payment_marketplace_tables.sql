-- ==============================================================================
-- 004 - PEMBAYARAN (TRANSFER MANUAL) & MARKETPLACE
-- Kolom & constraint final, termasuk payment_proofs.
-- ==============================================================================

-- 1. payment_settings: Konfigurasi Provider Pembayaran (Server Key disimpan di .env, BUKAN di tabel)
create table if not exists public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'midtrans',
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  merchant_id text,
  client_key text,
  provider_logo_url text,
  is_enabled boolean not null default false,
  is_spp_enabled boolean not null default false,
  is_iuran_enabled boolean not null default false,
  is_pendaftaran_semester_enabled boolean not null default false,
  is_marketplace_enabled boolean not null default false,
  manual_transfer_enabled boolean not null default true,
  bank_accounts jsonb not null default '[]'::jsonb,
  manual_instructions text,
  spmb_bank_account jsonb, -- {bank, account_number, account_name} rekening biaya formulir SPMB
  spmb_transfer_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. marketplace_products: Etalase Produk/Buku/Modul Terbitan Sekolah
create table if not exists public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  cover_url text,
  cover_path text,
  file_url text,
  file_path text, -- storage path di bucket 'marketplace-files'
  product_type text not null default 'physical' constraint chk_marketplace_product_type check (product_type in ('physical', 'digital')),
  stock integer constraint chk_marketplace_stock check (stock is null or stock >= 0),
  price numeric not null default 0 check (price >= 0),
  is_published boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketplace_products_slug on public.marketplace_products(slug);
create index if not exists idx_marketplace_products_published on public.marketplace_products(is_published);

-- 3. marketplace_orders: Pesanan Pembelian oleh Wali Murid
create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  status order_status not null default 'draft',
  order_number text,
  total_amount numeric not null default 0 check (total_amount >= 0),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketplace_orders_parent on public.marketplace_orders(parent_id);
create unique index if not exists uq_marketplace_orders_number on public.marketplace_orders(order_number) where order_number is not null;
create sequence if not exists public.seq_marketplace_order_number start with 1001;

-- 4. marketplace_order_items: Rincian Produk dalam Pesanan
create table if not exists public.marketplace_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  constraint uq_order_product unique (order_id, product_id)
);

create index if not exists idx_order_items_order on public.marketplace_order_items(order_id);

-- 5. payment_invoices: Tagihan SPP, Iuran, & Transaksi Pembayaran Sekolah
create table if not exists public.payment_invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  parent_id uuid references public.parents(id) on delete cascade,
  marketplace_order_id uuid references public.marketplace_orders(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  type payment_type not null,
  billing_month int check (billing_month between 1 and 12),
  billing_year int,
  invoice_number text, -- diisi otomatis oleh trigger set_invoice_number
  title text not null, -- contoh: 'SPP Juli 2026'
  amount numeric not null check (amount > 0),
  due_date date,
  reminder_offsets int[] not null default '{30,14,7,3,1}'::int[],
  status payment_status not null default 'draft',
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_student_status on public.payment_invoices(student_id, status, type);
create index if not exists idx_invoices_parent on public.payment_invoices(parent_id);
create index if not exists idx_invoices_year on public.payment_invoices(academic_year_id);
create unique index if not exists uq_payment_invoices_number on public.payment_invoices(invoice_number);
create sequence if not exists public.seq_invoice_number start with 1;

-- 6. payment_transactions: Pencatatan Transaksi Midtrans Snap
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.payment_invoices(id) on delete cascade,
  provider text not null default 'midtrans',
  order_id text not null unique, -- order_id yang dikirim ke Midtrans
  transaction_id text, -- ID transaksi resmi dari Midtrans
  snap_token text,
  redirect_url text,
  gross_amount numeric not null check (gross_amount > 0),
  status payment_status not null default 'pending',
  paid_at timestamptz,
  payer_bank_name text,
  payer_bank_account_number text,
  payer_bank_account_name text,
  destination_bank_name text,
  destination_bank_account_number text,
  destination_bank_account_name text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_transactions_order on public.payment_transactions(order_id);
create index if not exists idx_payment_transactions_invoice on public.payment_transactions(invoice_id);

-- 7. payment_receipts: Snapshot Bukti Pembayaran Resmi (Print-friendly)
create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.payment_invoices(id) on delete cascade,
  transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  class_name text,
  school_logo_url text,
  midtrans_logo_url text,
  paid_at timestamptz not null default now(),
  invoice_number text not null,
  student_name text not null,
  amount numeric not null check (amount > 0),
  status payment_status not null default 'paid',
  payer_bank_name text,
  payer_bank_account_number text,
  payer_bank_account_name text,
  destination_bank_name text,
  destination_bank_account_number text,
  destination_bank_account_name text,
  created_at timestamptz not null default now(),
  constraint uq_receipt_invoice_transaction unique (invoice_id, transaction_id)
);

create index if not exists idx_receipts_invoice on public.payment_receipts(invoice_id);
create index if not exists idx_receipts_student on public.payment_receipts(student_id);

-- 8. payment_proofs: Bukti transfer manual dari wali murid
create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.payment_invoices(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  file_path text not null, -- storage path di bucket 'payment-files'
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
