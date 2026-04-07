# Langkah 2 - Setup Supabase Baru untuk Toko Baru

Panduan ini dipakai setelah langkah clone project selesai.

## Tujuan

Hasil akhir langkah ini:

- toko baru punya project Supabase sendiri
- schema database POS sudah siap
- tabel tambahan yang dibutuhkan aplikasi sudah tersedia
- data toko lama tidak tercampur

Contoh yang dipakai:

- Folder toko baru: `C:\Users\Bben\.gemini\antigravity\scratch\pos-baru`
- File bootstrap SQL: `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos\sql\supabase-bootstrap.sql`

## A. Buat project Supabase baru

1. Buka [https://supabase.com](https://supabase.com)
2. Login
3. Klik `New project`
4. Pilih organization
5. Isi:
   - `Project name`: misalnya `pos-baru`
   - `Database password`: simpan baik-baik
   - `Region`: pilih yang paling dekat
6. Klik `Create new project`
7. Tunggu sampai project siap

## B. Ambil URL dan anon key

Setelah project jadi:

1. Buka `Project Settings`
2. Buka `API`
3. Catat:
   - `Project URL`
   - `anon public key`

Nanti ini dipakai di `.env.local` dan Vercel.

## C. Jalankan bootstrap SQL

1. Buka `SQL Editor`
2. Buka file ini di komputer:
   - `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos\sql\supabase-bootstrap.sql`
3. Copy seluruh isi file
4. Paste ke `Supabase SQL Editor`
5. Klik `Run`

## D. Tambahkan kolom tambahan untuk aplikasi terbaru

Setelah bootstrap selesai, jalankan SQL berikut:

```sql
alter table public.cash_shifts
add column if not exists device_id text null,
add column if not exists device_name text null,
add column if not exists user_role text null,
add column if not exists user_name text null;
```

Kalau tabel `receivables_payments` sudah ada tapi kolomnya belum lengkap, jalankan juga:

```sql
alter table public.receivables_payments
add column if not exists branch_id uuid null references public.branches(id) on delete set null,
add column if not exists user_id uuid null,
add column if not exists amount numeric(14,2) not null default 0,
add column if not exists payment_method text not null default 'cash',
add column if not exists notes text null,
add column if not exists status text not null default 'completed',
add column if not exists created_at timestamptz not null default now();
```

## E. Verifikasi tabel penting

Buka `Table Editor`, lalu pastikan tabel ini ada:

- `branches`
- `products`
- `unit_conversions`
- `customers`
- `suppliers`
- `expenses`
- `inventory_movements`
- `sales`
- `sale_details`
- `receivables_payments`
- `cash_shifts`
- `store_settings`

## F. Verifikasi struktur cash_shifts

Jalankan query ini:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cash_shifts'
order by ordinal_position;
```

Pastikan minimal ada:

- `id`
- `branch_id`
- `user_id`
- `opening_time`
- `closing_time`
- `opening_cash`
- `expected_closing_cash`
- `actual_closing_cash`
- `difference`
- `status`
- `notes`
- `created_at`
- `device_id`
- `device_name`
- `user_role`
- `user_name`

## G. Verifikasi struktur receivables_payments

Jalankan query ini:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'receivables_payments'
order by ordinal_position;
```

Pastikan minimal ada:

- `id`
- `customer_id`
- `branch_id`
- `user_id`
- `amount`
- `payment_method`
- `notes`
- `status`
- `created_at`

## H. Checklist hasil langkah 2

Langkah ini dianggap selesai kalau:

- project Supabase baru sudah jadi
- URL project sudah dicatat
- anon key sudah dicatat
- bootstrap SQL sudah dijalankan
- tabel penting sudah muncul
- kolom tambahan shift sudah ada
- kolom pembayaran kasbon sudah ada

## Troubleshooting

### 1. Error tabel sudah ada

Kalau SQL pakai `if not exists`, biasanya aman. Kalau tetap error, cek apakah sebelumnya sudah ada tabel separuh jadi.

### 2. Error kolom tidak ada

Biasanya karena tabel lama belum lengkap. Jalankan `alter table ... add column if not exists ...`

### 3. Kasbon gagal sync

Cek tabel `receivables_payments` dan pastikan kolom `user_id`, `status`, `payment_method`, `created_at` sudah ada.

### 4. Shift monitoring kosong

Cek apakah `cash_shifts` punya kolom:

- `device_id`
- `device_name`
- `user_role`
- `user_name`

## Lanjut ke langkah berikutnya

Setelah ini selesai, lanjut ke:

- `LANGKAH_3_SETUP_VERCEL_BARU.md`