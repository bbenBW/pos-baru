# Struktur Nama Folder dan Repo Toko Baru

Panduan singkat agar instance tiap toko rapi dan mudah dirawat.

## Tujuan

Supaya tiap toko punya pola nama yang konsisten untuk:

- folder lokal
- repo GitHub
- project Vercel
- domain/subdomain
- catatan support

## Pola yang disarankan

Gunakan nama dasar aplikasi lalu tambah slug toko.

Contoh slug:

- `toko-surya`
- `tb-jaya-abadi`
- `bangunan-sumber-rezeki`

## Folder Lokal

Contoh pola:

- `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos`
- `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos-toko-surya`
- `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos-tb-jaya-abadi`

Saran:

- folder `bangunan-pos` tetap jadi instance master/internal
- folder toko baru selalu pakai suffix nama toko
- hindari nama folder dengan spasi panjang atau karakter aneh

## Repo GitHub

Contoh pola:

- `bangunan-pos`
- `bangunan-pos-toko-surya`
- `bangunan-pos-tb-jaya-abadi`

Kalau mau lebih rapi lagi untuk komersial:

- `pos-bangunan-master`
- `pos-bangunan-toko-surya`
- `pos-bangunan-tb-jaya-abadi`

## Project Vercel

Contoh pola:

- `bangunan-pos`
- `bangunan-pos-toko-surya`
- `bangunan-pos-tb-jaya-abadi`

Usahakan nama project Vercel sama atau mirip dengan nama repo supaya tidak membingungkan.

## Domain / Subdomain

Contoh:

- `bangunan-pos.vercel.app`
- `bangunan-pos-toko-surya.vercel.app`
- `bangunan-pos-tb-jaya-abadi.vercel.app`

Kalau sudah punya domain sendiri, pola yang bagus:

- `toko-surya.namadomain.com`
- `tb-jaya.namadomain.com`

## File Env Lokal

Untuk setiap toko, buat `.env.local` sendiri.

Contoh:

- `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos-toko-surya\.env.local`
- `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos-tb-jaya-abadi\.env.local`

Isi minimal:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Jangan pernah menyalin env toko lain tanpa mengganti nilainya.

## Catatan Support Per Toko

Simpan satu catatan per toko dengan pola seperti ini:

- `docs/support-notes/toko-surya.md`
- `docs/support-notes/tb-jaya-abadi.md`

Isi minimal:

- nama toko
- folder lokal
- repo GitHub
- URL Vercel
- Supabase URL
- owner utama
- printer
- scanner
- device utama
- paket komersial

## Saran Operasional

- gunakan slug toko yang pendek dan stabil
- jangan ganti-ganti slug setelah toko live
- samakan slug di folder, repo, dan project Vercel agar mudah dicari
- simpan instance master terpisah dari instance pelanggan

## Contoh Lengkap

### Toko internal

- Folder: `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos`
- Repo: `bangunan-pos`
- Vercel: `bangunan-pos`

### Pelanggan baru

- Folder: `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos-toko-surya`
- Repo: `bangunan-pos-toko-surya`
- Vercel: `bangunan-pos-toko-surya`
- Env: project Supabase milik Toko Surya sendiri