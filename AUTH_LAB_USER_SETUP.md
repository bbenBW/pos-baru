# Auth Lab - Setup User Login

Kita pakai 4 role:

- `owner`
- `admin`
- `kasir`
- `gudang`

## 1. Jalankan SQL profile user

Di Supabase project `pos-baru-lab`, buka SQL Editor lalu jalankan isi file:

- `C:\Users\Bben\Documents\New project\bangunan-pos-auth-lab\sql\auth-users.sql`

## 2. Buat 4 user di Supabase Auth

Masuk ke:

- `Authentication`
- `Users`
- `Add user`

Buat 4 akun contoh:

1. `owner@posbaru.test`
2. `admin@posbaru.test`
3. `kasir@posbaru.test`
4. `gudang@posbaru.test`

Gunakan password sementara yang mudah diingat untuk lab.

## 3. Catat UUID masing-masing user

Setelah user dibuat, copy nilai `id` dari masing-masing user.

## 4. Masukkan ke tabel `app_users`

Jalankan SQL seperti ini dan ganti UUID/email/nama sesuai akun yang dibuat:

```sql
insert into public.app_users (id, email, full_name, role, is_active)
values
  ('UUID_OWNER', 'owner@posbaru.test', 'Beni (Owner)', 'owner', true),
  ('UUID_ADMIN', 'admin@posbaru.test', 'Admin Toko', 'admin', true),
  ('UUID_KASIR', 'kasir@posbaru.test', 'Kasir Toko', 'kasir', true),
  ('UUID_GUDANG', 'gudang@posbaru.test', 'Staff Gudang', 'gudang', true)
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();
```

## 5. Jalankan auth-lab

Di folder:

- `C:\Users\Bben\Documents\New project\bangunan-pos-auth-lab`

jalankan:

```powershell
npm run dev
```

Lalu buka:

- [http://localhost:3000/login](http://localhost:3000/login)

## Catatan

- Role switching lokal lama sudah dimatikan di auth-lab.
- Pindah role sekarang caranya logout lalu login dengan akun Supabase lain.
- Ini aman untuk eksperimen karena tidak menyentuh toko live.
