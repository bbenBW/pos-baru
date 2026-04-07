/**
 * Skrip untuk memanggil API Supabase agar database tetap aktif (mencegah auto-pause).
 * Dijalankan otomatis melalui GitHub Actions setiap 3 hari.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("EROR: Variabel lingkungan SUPABASE_URL atau SUPABASE_KEY tidak ditemukan!");
  process.exit(1);
}

async function pingSupabase() {
  console.log("------------------------------------------");
  console.log("Sedang mengirim sinyal ke Supabase untuk menjaga proyek tetap aktif...");
  
  try {
    // Memanggil endpoint rest-api Supabase dengan limit 1 data saja dari tabel 'products'
    // yang kita tahu ada di proyek 'bangunan-pos' (berdasarkan productStore.ts).
    const response = await fetch(`${supabaseUrl}/rest/v1/products?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log("✅ BERHASIL: Proyek Supabase sudah dihubungi!");
      console.log(`Status: ${response.status} ${response.statusText}`);
    } else {
      console.error(`❌ GAGAL: Supabase memberikan error ${response.status}`);
      const errorContent = await response.text();
      console.error("Konten Error:", errorContent);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ ERROR SAAT PING:", error);
    process.exit(1);
  } finally {
    console.log("------------------------------------------");
  }
}

pingSupabase();
