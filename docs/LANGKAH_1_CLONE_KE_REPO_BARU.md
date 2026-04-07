# Langkah 1 - Clone Project Master ke Repo Toko Baru

Panduan ini dipakai saat Anda ingin membuat instance toko baru dari project master `bangunan-pos`.

## Tujuan

Hasil akhir langkah ini:

- source code master berhasil diduplikat ke folder baru
- folder baru terhubung ke repo GitHub baru
- branch `main` berhasil ter-push ke repo baru

Contoh yang dipakai di panduan ini:

- Project master: `C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos`
- Folder toko baru: `C:\Users\Bben\.gemini\antigravity\scratch\pos-baru`
- Repo GitHub baru: `https://github.com/bbenBW/pos-baru.git`

## Opsi yang disarankan

Paling aman: salin source code ke folder baru, lalu buat koneksi Git ke repo baru.

## A. Duplikat folder project master

Buka PowerShell, lalu jalankan:

```powershell
Copy-Item -Path "C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos" -Destination "C:\Users\Bben\.gemini\antigravity\scratch\pos-baru" -Recurse
```

Kalau folder `pos-baru` sudah ada dan ingin diganti dari awal, hapus dulu folder lama secara manual dari File Explorer, lalu jalankan perintah copy di atas.

## B. Masuk ke folder baru

```powershell
cd "C:\Users\Bben\.gemini\antigravity\scratch\pos-baru"
```

## C. Cek apakah folder hasil copy masih membawa repo Git lama

```powershell
git remote -v
```

Kalau muncul repo lama seperti `bangunan-pos.git`, lanjut ke langkah D.

Kalau muncul error seperti `not a git repository`, lompat ke langkah E.

## D. Ganti remote Git dari repo lama ke repo baru

Jalankan ini satu per satu:

```powershell
git remote remove origin
git remote add origin https://github.com/bbenBW/pos-baru.git
git branch -M main
git push -u origin main
```

## E. Kalau folder baru belum punya Git

Kalau langkah C gagal karena bukan repo Git, jalankan ini:

```powershell
git init
git add .
git commit -m "Initial store instance"
git branch -M main
git remote add origin https://github.com/bbenBW/pos-baru.git
git push -u origin main
```

## F. Verifikasi hasil push

Jalankan:

```powershell
git remote -v
git branch --show-current
git status
```

Hasil yang diharapkan:

- `origin` mengarah ke `https://github.com/bbenBW/pos-baru.git`
- branch aktif = `main`
- status bersih atau tidak ada error serius

Lalu cek di browser:

- buka [https://github.com/bbenBW/pos-baru](https://github.com/bbenBW/pos-baru)
- pastikan file project sudah muncul

## G. Setelah langkah ini selesai

Baru lanjut ke langkah berikutnya:

1. buat project Supabase baru
2. jalankan file `sql/supabase-bootstrap.sql`
3. buat project Vercel baru
4. isi environment variable Supabase baru
5. deploy

## Troubleshooting

### 1. Error `remote origin already exists`

Artinya remote lama masih ada. Jalankan:

```powershell
git remote remove origin
git remote add origin https://github.com/bbenBW/pos-baru.git
```

### 2. Error `failed to push some refs`

Biasanya karena repo GitHub baru sudah ada isi file awal seperti README.

Solusi paling aman:

```powershell
git pull origin main --allow-unrelated-histories
git push -u origin main
```

Kalau repo baru benar-benar kosong, error ini biasanya tidak muncul.

### 3. Salah copy folder

Hapus folder `pos-baru` secara manual, lalu ulangi langkah A.

### 4. Takut data toko lama ikut tercampur

Di tahap ini belum tercampur selama:

- repo GitHub sudah beda
- nanti Supabase juga dibuat baru
- env toko baru tidak memakai Supabase toko lama

## Ringkasan super singkat

Urutannya:

```powershell
Copy-Item -Path "C:\Users\Bben\.gemini\antigravity\scratch\bangunan-pos" -Destination "C:\Users\Bben\.gemini\antigravity\scratch\pos-baru" -Recurse
cd "C:\Users\Bben\.gemini\antigravity\scratch\pos-baru"
git remote remove origin
git remote add origin https://github.com/bbenBW/pos-baru.git
git branch -M main
git push -u origin main
```

Kalau folder baru belum punya Git:

```powershell
cd "C:\Users\Bben\.gemini\antigravity\scratch\pos-baru"
git init
git add .
git commit -m "Initial store instance"
git branch -M main
git remote add origin https://github.com/bbenBW/pos-baru.git
git push -u origin main
```