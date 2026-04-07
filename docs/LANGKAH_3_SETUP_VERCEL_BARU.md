# Langkah 3 - Setup Vercel Baru untuk Toko Baru

Panduan ini dipakai setelah repo toko baru dan project Supabase baru sudah siap.

## Tujuan

Hasil akhir langkah ini:

- repo toko baru terhubung ke Vercel
- environment variable memakai Supabase toko baru
- aplikasi toko baru live di URL sendiri

Contoh:

- Repo GitHub baru: `https://github.com/bbenBW/pos-baru`
- Project Supabase baru: `https://PROJECTBARU.supabase.co`

## A. Login ke Vercel

1. Buka [https://vercel.com](https://vercel.com)
2. Login dengan akun GitHub

## B. Import repo baru

1. Klik `Add New...`
2. Pilih `Project`
3. Cari repo:
   - `pos-baru`
4. Klik `Import`

## C. Cek pengaturan framework

Biasanya Vercel otomatis mendeteksi project ini sebagai `Next.js`.

Pastikan:

- `Framework Preset`: `Next.js`
- `Root Directory`: kosong atau root project
- `Build Command`: default
- `Output Directory`: default

## D. Isi Environment Variables

Tambahkan:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Contoh:

- `NEXT_PUBLIC_SUPABASE_URL=https://PROJECTBARU.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=ISI_ANON_KEY_BARU`

Penting:

- jangan pakai URL dan key milik toko lama
- harus milik project Supabase toko baru

## E. Deploy

1. Klik `Deploy`
2. Tunggu build selesai
3. Setelah selesai, Vercel akan memberi URL seperti:
   - `https://pos-baru.vercel.app`

## F. Verifikasi deployment

Setelah deploy selesai:

1. buka URL Vercel
2. cek apakah aplikasi terbuka normal
3. buka `Pengaturan`
4. cek apakah halaman bisa dimuat
5. buka `Kasir (POS)`
6. cek apakah produk/sistem terbaca normal

## G. Isi data toko baru

Di aplikasi yang baru live:

1. buka `Pengaturan > Detail Toko`
2. isi:
   - nama toko
   - nama owner
   - alamat
   - telepon
3. simpan

## H. Tes awal setelah deploy

Lakukan tes singkat:

1. tambah produk
2. transaksi tunai
3. transaksi tempo
4. pembayaran kasbon
5. buka shift
6. tutup shift
7. monitoring shift
8. print struk
9. scanner barcode

## I. Kalau mau pakai custom domain

Setelah deploy normal, bisa tambah domain sendiri:

1. buka project di Vercel
2. `Settings`
3. `Domains`
4. tambahkan domain atau subdomain

Contoh:

- `pos.tokosurya.com`
- `kasir.tokobangunanjaya.com`

## J. Checklist hasil langkah 3

Langkah ini dianggap selesai kalau:

- repo baru sudah terhubung ke Vercel
- env Supabase baru sudah diisi
- deploy sukses
- URL baru sudah live
- aplikasi bisa dibuka normal
- profil toko baru bisa diisi

## Troubleshooting

### 1. Build gagal

Cek log build di Vercel.

Biasanya penyebab:

- env belum diisi
- typo di env
- repo belum lengkap ter-push

### 2. App terbuka tapi data kosong/error

Biasanya karena:

- `NEXT_PUBLIC_SUPABASE_URL` salah
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` salah
- schema Supabase belum dijalankan

### 3. Data toko lama muncul

Berarti env masih mengarah ke Supabase lama. Segera ganti env project Vercel ke Supabase baru.

### 4. Update code tidak muncul

Pastikan push dilakukan ke repo baru, bukan repo master.

## Lanjut setelah langkah ini

Kalau sudah live, lanjut:

1. isi data master toko
2. setup printer/scanner/device
3. tes operasional lengkap sebelum dipakai harian