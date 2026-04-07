# Paket Komersial POS Bangunan

Dokumen ini bisa dipakai sebagai draft penawaran saat aplikasi mulai dijual ke toko lain.

## Paket 1 — Basic

Cocok untuk:

- toko kecil
- 1 owner
- 1-2 kasir
- 1 perangkat utama

Fitur:

- transaksi tunai
- transaksi tempo / kasbon
- master produk
- stok produk
- riwayat transaksi
- void transaksi
- void per item
- laporan dasar
- buka/tutup shift
- print struk browser
- scanner barcode HID

Batasan yang bisa diterapkan:

- 1 cabang
- 1-2 perangkat aktif
- tanpa custom branding lanjutan

## Paket 2 — Pro

Cocok untuk:

- toko yang sudah ramai
- lebih dari 1 kasir
- butuh monitoring lebih rapi

Fitur:

- semua fitur Basic
- multi cabang
- monitoring shift owner/admin
- log sinkronisasi
- audit log stok
- print ulang struk dari riwayat
- Bluetooth thermal print Android
- scan barcode kamera
- print barcode label
- pengaturan perangkat dan printer

Batasan yang bisa diterapkan:

- jumlah cabang tertentu
- jumlah perangkat tertentu

## Paket 3 — Enterprise / Custom

Cocok untuk:

- toko besar
- jaringan cabang
- kebutuhan custom

Fitur:

- semua fitur Pro
- custom branding
- domain khusus
- onboarding dibantu
- migrasi data awal
- custom laporan
- custom workflow operasional
- prioritas support

## Biaya yang Bisa Dipisah

Supaya model jualannya sehat, biaya bisa dipisah jadi:

1. Biaya setup awal

- setup Supabase
- setup Vercel
- setup profil toko
- setup printer/scanner
- import data awal

2. Biaya langganan bulanan

- hosting dan database
- maintenance
- update fitur minor
- support teknis

3. Biaya custom

- fitur khusus
- branding khusus
- laporan khusus
- integrasi hardware khusus

## Komponen Biaya Internal

Saat menentukan harga, pertimbangkan:

- biaya Vercel
- biaya Supabase
- waktu support
- waktu onboarding
- waktu maintenance bug
- biaya build APK / distribusi

## Saran Model Awal

Untuk awal, model paling aman:

- per toko = single-tenant
- ada biaya setup
- ada biaya bulanan maintenance
- custom dihitung terpisah

## Contoh Struktur Penawaran

### Basic

- setup awal
- langganan bulanan
- support jam kerja

### Pro

- setup awal
- langganan bulanan lebih tinggi
- support lebih cepat
- fitur monitoring dan printer penuh

### Enterprise

- penawaran by request
- scope custom
- SLA support

## Catatan Penting

Jangan menjual banyak toko memakai project Supabase toko milikmu yang sekarang.

Tetap gunakan model:

- 1 toko
- 1 project Supabase
- 1 project Vercel
- 1 data terpisah

Supaya data tetap aman dan support lebih gampang.
