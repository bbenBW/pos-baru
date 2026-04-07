# Playbook Clone Toko Baru

Panduan teknis saat membuat instance baru untuk pelanggan/toko lain.

## Tujuan

Membuat toko baru tanpa mencampur data dengan toko lain.

Model yang dipakai:

- single-tenant
- satu toko = satu project Supabase + satu project Vercel

## Langkah 1 — Siapkan project baru

### Supabase

- buat project Supabase baru
- catat:
  - project URL
  - anon key
  - service role key jika nanti dibutuhkan internal

### Vercel

- buat project Vercel baru
- hubungkan ke repo yang sama
- siapkan subdomain/domain toko baru

## Langkah 2 — Bootstrap database

Jalankan file:

- `sql/supabase-bootstrap.sql`

di Supabase SQL Editor project baru.

Setelah itu cek minimal:

- `products`
- `sales`
- `sale_details`
- `customers`
- `receivables_payments`
- `inventory_movements`
- `cash_shifts`
- `store_settings`

## Langkah 3 — Isi environment Vercel

Isi:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Pastikan nilainya milik project toko baru, bukan project toko lain.

## Langkah 4 — Deploy

- lakukan deploy
- buka URL hasil deploy
- cek halaman login dan settings bisa terbuka

## Langkah 5 — Setup data awal

Di aplikasi:

- isi nama toko
- isi nama owner
- isi alamat toko
- isi telepon
- upload logo bila ada
- buat cabang bila diperlukan

## Langkah 6 — Setup user

Buat user awal:

- owner
- admin
- kasir

Gunakan akun yang khusus untuk toko itu.

## Langkah 7 — Setup perangkat

Di setiap device:

- buka aplikasi
- isi nama perangkat
- pair printer Bluetooth jika ada
- set printer aktif
- tes print
- tes scanner barcode

## Langkah 8 — Input / import master data

Masukkan:

- produk
- stok awal
- pelanggan
- supplier
- pengeluaran awal bila perlu

## Langkah 9 — Uji operasional wajib

Sebelum toko live, tes:

1. transaksi tunai
2. transaksi tempo
3. pembayaran kasbon
4. void transaksi
5. void item
6. buka shift
7. tutup shift
8. monitoring shift
9. print struk
10. print ulang struk
11. scanner barcode
12. print barcode
13. sinkronisasi antar device

## Langkah 10 — Backup dan dokumentasi

Simpan catatan berikut untuk toko tersebut:

- nama toko
- URL aplikasi
- Supabase URL
- Vercel project
- owner utama
- perangkat utama
- printer yang dipakai
- scanner yang dipakai
- versi APK bila Android app dipakai

## Checklist Troubleshooting Cepat

Kalau ada masalah:

### Tidak sinkron

- cek `NEXT_PUBLIC_SUPABASE_URL`
- cek `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- cek tabel di Supabase
- cek log sinkronisasi

### Printer gagal

- cek mode printer
- cek Bluetooth pairing
- cek print mode browser vs bluetooth

### Shift tidak muncul

- cek tabel `cash_shifts`
- cek sync selesai
- cek device metadata

### Kasbon gagal

- cek tabel `receivables_payments`
- cek kolom UUID dan payload user_id

## Saran Operasional

Jangan lakukan custom besar langsung di instance toko yang sudah live.

Lebih aman:

1. uji di toko internal dulu
2. baru push ke toko pelanggan

Supaya update fitur tidak mengganggu operasional harian pelanggan.
