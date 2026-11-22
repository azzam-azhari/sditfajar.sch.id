-- ==============================================================================
-- MIGRATION 16 - FASE 6: PENGUMUMAN, TAHFIDZ & MARKETPLACE
-- 1. Pengumuman: target konsisten, dibuat super admin/admin/kepala sekolah,
--    terbit hanya bila published_at <= now().
-- 2. Tahfidz: kolom jumlah halaman; pencatat = koordinator tahfidz, wali kelas
--    murid, atau pengampu mapel Tahfidz (kode TFZ/TAHFIDZ) di kelas murid.
-- 3. Marketplace: jenis produk, stok, cover_path, nomor pesanan; pesanan hanya
--    lewat fungsi server (price snapshot, stok, tagihan unpaid) dalam satu transaksi.
-- Idempotent: aman dijalankan ulang.
-- ==============================================================================

begin;

-- 1. PENGUMUMAN -------------------------------------------------------------------
alter table public.announcements drop constraint if exists chk_announcements_target;
alter table public.announcements
  add constraint chk_announcements_target check (
    (target_type = 'all')
    or (target_type = 'role' and target_role is not null)
    or (target_type = 'class' and classroom_id is not null)
    or (target_type = 'student' and student_id is not null)
  ) not valid;

create or replace function public.can_manage_announcements()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_super() or public.has_teacher_position('kepala_sekolah');
$$;
revoke all on function public.can_manage_announcements() from public;
grant execute on function public.can_manage_announcements() to authenticated;

drop policy if exists "Announcements admin write" on public.announcements;
drop policy if exists "Announcements manage" on public.announcements;
create policy "Announcements manage"
  on public.announcements for all
  to authenticated
  using (public.is_admin_or_super() or (public.can_manage_announcements() and created_by = auth.uid()))
  with check (public.is_admin_or_super() or (public.can_manage_announcements() and created_by = auth.uid()));

drop policy if exists "Announcements read" on public.announcements;
create policy "Announcements read"
  on public.announcements for select
  to authenticated
  using (
    public.can_manage_announcements()
    or (
      status = 'published' and (published_at is null or published_at <= now()) and (
        target_type = 'all'
        or (target_type = 'role' and target_role = public.current_user_role())
        or (
          target_type = 'class' and (
            exists (
              select 1 from public.class_students cs
              join public.students s on s.id = cs.student_id
              where cs.classroom_id = announcements.classroom_id and s.profile_id = auth.uid()
            )
            or exists (
              select 1 from public.class_students cs
              join public.parent_students ps on ps.student_id = cs.student_id
              join public.parents p on p.id = ps.parent_id
              where cs.classroom_id = announcements.classroom_id and p.profile_id = auth.uid()
            )
            or public.is_my_homeroom(announcements.classroom_id)
          )
        )
        or (
          target_type = 'student' and (
            exists (select 1 from public.students s where s.id = announcements.student_id and s.profile_id = auth.uid())
            or exists (
              select 1 from public.parent_students ps
              join public.parents p on p.id = ps.parent_id
              where ps.student_id = announcements.student_id and p.profile_id = auth.uid()
            )
          )
        )
      )
    )
  );

-- 2. TAHFIDZ -------------------------------------------------------------------------
alter table public.tahfidz_records add column if not exists pages numeric(5,1);
alter table public.tahfidz_records drop constraint if exists chk_tahfidz_pages;
alter table public.tahfidz_records add constraint chk_tahfidz_pages check (pages is null or pages >= 0);

create or replace function public.can_record_tahfidz(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_super()
    or public.has_teacher_position('koordinator_tahfidz')
    or exists (
      select 1 from public.class_students cs
      join public.classrooms c on c.id = cs.classroom_id
      where cs.student_id = p_student_id and cs.status = 'active' and cs.left_at is null
        and c.homeroom_teacher_id = public.current_teacher_id()
    )
    or exists (
      select 1 from public.class_students cs
      join public.teaching_assignments ta on ta.classroom_id = cs.classroom_id
      join public.subjects sub on sub.id = ta.subject_id
      where cs.student_id = p_student_id and cs.status = 'active' and cs.left_at is null
        and ta.teacher_id = public.current_teacher_id()
        and (upper(sub.code) in ('TFZ', 'TAHFIDZ') or sub.name ilike '%tahfidz%')
    );
$$;
revoke all on function public.can_record_tahfidz(uuid) from public;
grant execute on function public.can_record_tahfidz(uuid) to authenticated;

drop policy if exists "Tahfidz records write" on public.tahfidz_records;
create policy "Tahfidz records write"
  on public.tahfidz_records for all
  to authenticated
  using (public.is_admin_or_super() or (public.can_record_tahfidz(student_id) and teacher_id = auth.uid()))
  with check (public.is_admin_or_super() or (public.can_record_tahfidz(student_id) and teacher_id = auth.uid()));

drop policy if exists "Tahfidz records read" on public.tahfidz_records;
create policy "Tahfidz records read"
  on public.tahfidz_records for select
  to authenticated
  using (
    public.can_record_tahfidz(student_id)
    or teacher_id = auth.uid()
    or exists (select 1 from public.students s where s.id = tahfidz_records.student_id and s.profile_id = auth.uid())
    or exists (
      select 1 from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = tahfidz_records.student_id and p.profile_id = auth.uid()
    )
  );

-- 3. MARKETPLACE ---------------------------------------------------------------------
alter table public.marketplace_products add column if not exists product_type text not null default 'physical';
alter table public.marketplace_products add column if not exists stock integer;
alter table public.marketplace_products add column if not exists cover_path text;
alter table public.marketplace_products drop constraint if exists chk_marketplace_product_type;
alter table public.marketplace_products
  add constraint chk_marketplace_product_type check (product_type in ('physical', 'digital'));
alter table public.marketplace_products drop constraint if exists chk_marketplace_stock;
alter table public.marketplace_products add constraint chk_marketplace_stock check (stock is null or stock >= 0);

alter table public.marketplace_orders add column if not exists order_number text;
alter table public.marketplace_orders add column if not exists fulfilled_at timestamptz;
create unique index if not exists uq_marketplace_orders_number on public.marketplace_orders(order_number) where order_number is not null;
create sequence if not exists public.seq_marketplace_order_number start with 1001;

-- Wali tidak lagi menulis langsung pesanan/item (harga bisa dimanipulasi).
drop policy if exists "Marketplace orders parent create" on public.marketplace_orders;
drop policy if exists "Marketplace order items insert" on public.marketplace_order_items;
drop policy if exists "Marketplace order items admin write" on public.marketplace_order_items;
create policy "Marketplace order items admin write"
  on public.marketplace_order_items for all
  to authenticated
  using (public.is_admin_or_super())
  with check (public.is_admin_or_super());
drop policy if exists "Marketplace orders admin insert" on public.marketplace_orders;
create policy "Marketplace orders admin insert"
  on public.marketplace_orders for insert
  to authenticated
  with check (public.is_admin_or_super());

create or replace function public.create_marketplace_order(p_student_id uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_parent_id uuid;
  v_order_id uuid;
  v_year_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_product public.marketplace_products%rowtype;
  v_qty int;
  v_number text;
begin
  if public.current_user_role() is distinct from 'wali_murid' then
    raise exception 'Hanya wali murid yang dapat melakukan pemesanan.';
  end if;
  select p.id into v_parent_id from public.parents p where p.profile_id = auth.uid();
  if v_parent_id is null then raise exception 'Data wali murid tidak ditemukan.'; end if;
  if not exists (select 1 from public.parent_students ps where ps.parent_id = v_parent_id and ps.student_id = p_student_id) then
    raise exception 'Murid yang dipilih bukan anak Anda.';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Keranjang masih kosong.'; end if;
  select id into v_year_id from public.academic_years where is_active = true limit 1;
  if v_year_id is null then raise exception 'Belum ada tahun ajaran aktif.'; end if;

  v_number := 'MP-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || nextval('public.seq_marketplace_order_number');
  insert into public.marketplace_orders (parent_id, student_id, status, total_amount, order_number)
  values (v_parent_id, p_student_id, 'pending_payment', 0, v_number)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 100 then raise exception 'Jumlah barang tidak valid.'; end if;
    select * into v_product from public.marketplace_products
      where id = (v_item->>'product_id')::uuid and is_published = true
      for update;
    if not found then raise exception 'Produk tidak tersedia.'; end if;
    if v_product.product_type = 'digital' then
      v_qty := 1;
    elsif v_product.stock is not null then
      if v_product.stock < v_qty then
        raise exception 'Stok "%" tidak mencukupi (tersisa %).', v_product.title, v_product.stock;
      end if;
      update public.marketplace_products set stock = stock - v_qty where id = v_product.id;
    end if;
    insert into public.marketplace_order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_qty, v_product.price);
    v_total := v_total + v_product.price * v_qty;
  end loop;

  if v_total <= 0 then raise exception 'Total pesanan harus lebih dari 0.'; end if;
  update public.marketplace_orders set total_amount = v_total where id = v_order_id;

  insert into public.payment_invoices (student_id, parent_id, marketplace_order_id, academic_year_id, type, title, amount, due_date, status, created_by)
  values (p_student_id, v_parent_id, v_order_id, v_year_id, 'marketplace', 'Pesanan Marketplace ' || v_number, v_total,
          ((now() at time zone 'Asia/Jakarta')::date + 3), 'unpaid', auth.uid());

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'create_marketplace_order', 'marketplace_orders', v_order_id,
          jsonb_build_object('order_number', v_number, 'total', v_total));
  return v_order_id;
end;
$$;
revoke all on function public.create_marketplace_order(uuid, jsonb) from public, anon;
grant execute on function public.create_marketplace_order(uuid, jsonb) to authenticated;

create or replace function public.cancel_marketplace_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.marketplace_orders%rowtype;
begin
  select o.* into v_order from public.marketplace_orders o
    join public.parents p on p.id = o.parent_id
    where o.id = p_order_id and (p.profile_id = auth.uid() or public.is_admin_or_super())
    for update of o;
  if not found then raise exception 'Pesanan tidak ditemukan.'; end if;
  if v_order.status <> 'pending_payment' then raise exception 'Pesanan ini tidak dapat dibatalkan.'; end if;
  if exists (select 1 from public.payment_invoices i where i.marketplace_order_id = p_order_id and i.status = 'paid') then
    raise exception 'Pesanan yang sudah lunas tidak dapat dibatalkan.';
  end if;
  update public.marketplace_products mp set stock = mp.stock + oi.quantity
    from public.marketplace_order_items oi
    where oi.order_id = p_order_id and oi.product_id = mp.id and mp.stock is not null and mp.product_type = 'physical';
  update public.marketplace_orders set status = 'cancelled' where id = p_order_id;
  update public.payment_invoices set status = 'cancelled' where marketplace_order_id = p_order_id and status <> 'paid';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'cancel_marketplace_order', 'marketplace_orders', p_order_id, '{}'::jsonb);
end;
$$;
revoke all on function public.cancel_marketplace_order(uuid) from public, anon;
grant execute on function public.cancel_marketplace_order(uuid) to authenticated;

commit;
