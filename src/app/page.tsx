'use client';

import { useEffect, useState } from 'react';
import { db, OfflineSaleQueue } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { TrendingUp, Package, Users, FileText, Award, RefreshCw, Wallet, DollarSign, Settings, Plus } from 'lucide-react';
import { RealtimeClock } from '@/components/shared/RealtimeClock';
import { useSync } from '@/hooks/useSync';
import { useBranchStore } from '@/store/branchStore';
import { useAuthStore } from '@/store/authStore';
import { useShiftStore } from '@/store/shiftStore';
import { useSyncStatusStore } from '@/store/syncStatusStore';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface TopProduct {
  name: string;
  unitSold: number;
  revenue: number;
  unit: string;
}

const dedupeRemoteDetails = <T extends Record<string, any>>(details: T[]) => {
  const seen = new Set<string>();
  return details.filter((detail) => {
    const key = [
      detail.product_id,
      detail.unit_name,
      detail.unit_multiplier,
      detail.qty,
      detail.base_qty,
      detail.price_per_unit,
      detail.discount,
      detail.subtotal,
      detail.cogs_subtotal
    ].join('|');

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function HomeDashboard() {
  const { user } = useAuthStore();
  const isOwner = user?.role === 'owner' || user?.role === 'admin';
  const { activeBranch } = useBranchStore();
  const [adjustType, setAdjustType] = useState<'safe' | 'laci' | 'bank' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { adjustShiftCash, activeShift: sharedActiveShift } = useShiftStore();
  const [stats, setStats] = useState<any>({
    salesToday: 0,
    totalTransactions: 0,
    lowStockItems: 0,
    grossProfitToday: 0,
    netProfitToday: 0,
    expenseRatio: 0,
    totalProducts: 0,
    totalCashLaci: 0,
    totalSafeBalance: 0,
    totalBankBalance: 0,
    _bankNet: 0,
    _safeNet: 0
  });

  const [activeShiftObj, setActiveShiftObj] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<{ name: string; stock: number; min: number; unit: string }[]>([]);

  const { isSyncing, syncOfflineData } = useSync();
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  useEffect(() => {
    loadDashboardData();

    // Listen for balance-changing events
    const handleRefresh = () => loadDashboardData();
    window.addEventListener('expenses-changed', handleRefresh);
    window.addEventListener('branch-changed', handleRefresh);

    return () => {
      window.removeEventListener('expenses-changed', handleRefresh);
      window.removeEventListener('branch-changed', handleRefresh);
    };
  }, [activeBranch?.id]);

  const handleResync = async () => {
    await syncOfflineData();
    await loadDashboardData();
    setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
  };

  const loadDashboardData = async () => {
    const toLocalISO = (date: Date | string) => {
      const d = new Date(date);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - (offset * 60 * 1000));
      return local.toISOString().split('T')[0];
    };

    const today = toLocalISO(new Date());
    const localSales = await db.sale_queue.toArray();
    const products = await db.products.toArray();
    const localExpenses = await db.expenses.toArray();

    let remoteSales: OfflineSaleQueue[] = [];
    let remoteExpenses: any[] = [];
    if (navigator.onLine) {
      try {
        // --- 1. Sync Store Settings / Balances First ---
        const { data: cloudGlobal, error: profileError } = await supabase
          .from('store_settings')
          .select('preferences')
          .eq('id', 'global_profile')
          .maybeSingle();

        if (!profileError && cloudGlobal?.preferences) {
          const localSettings = (await db.store_settings.toArray())[0];
          if (localSettings) {
            await db.store_settings.update(localSettings.id, {
              preferences: { ...localSettings.preferences, ...cloudGlobal.preferences },
              updated_at: new Date().toISOString()
            });
          }
        }

        // --- 2. Fetch Sales and Expenses ---
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        const d7Str = d7.toISOString();

        // Helper to handle branch_id in queries
        const applyBranchFilter = (q: any) => {
          if (activeBranch?.id === 'main-branch' || activeBranch?.id === '00000000-0000-0000-0000-000000000000') {
            return q.or('branch_id.is.null,branch_id.eq.00000000-0000-0000-0000-000000000000');
          }
          if (activeBranch?.id) return q.eq('branch_id', activeBranch.id);
          return q;
        };

        const salesQuery = supabase
          .from('sales')
          .select('*, details:sale_details(*)')
          .gte('created_at', d7Str);

        const { data: sData } = await applyBranchFilter(salesQuery);

        if (sData) {
          remoteSales = sData.map((s: any) => ({
            ...s,
            details: s.details.map((d: any) => ({ ...d, _productName: d.product_name || d._productName }))
          }));
        }

        const expensesQuery = supabase
          .from('expenses')
          .select('*')
          .gte('expense_date', d7.toLocaleDateString('en-CA'));

        const { data: eData } = await applyBranchFilter(expensesQuery);

        if (eData) remoteExpenses = eData;
      } catch (err) {
        console.error("Failed to fetch remote data for dashboard:", err);
      }
    }

    const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const combinedSales = [...localSales];
    const localReceipts = new Set(localSales.map(s => s.receipt_number));
    for (const rs of remoteSales) {
      if (!localReceipts.has(rs.receipt_number)) combinedSales.push(rs);
    }

    const combinedExpenses = [...localExpenses];
    const localExpIds = new Set(localExpenses.map(e => e.id));
    for (const re of remoteExpenses) {
      if (!localExpIds.has(re.id)) combinedExpenses.push(re);
    }

    const todaySales = combinedSales.filter(s => toLocalISO(s.created_at) === today && !s.voided);
    const revenue = todaySales.reduce((acc, sale) => acc + sale.total, 0);

    const grossProfit = todaySales.reduce((acc, sale) => {
      const cogs = sale.details.reduce((sum, d) => sum + (d.cogs_subtotal || 0), 0);
      return acc + (sale.total - cogs);
    }, 0);

    const todayExpenses = combinedExpenses.filter(e => toLocalISO(e.expense_date || e.created_at) === today);
    const opExpenses = todayExpenses
      .filter(e => e.category !== 'Pembelian Stok (Tunai)' && e.category !== 'Pembayaran Hutang Supplier')
      .reduce((acc, e) => acc + e.amount, 0);

    const netProfit = grossProfit - opExpenses;
    const expenseRatio = revenue > 0 ? (opExpenses / revenue) * 100 : 0;

    const allTimeReceivables = await db.receivables_payments.toArray();
    const allShifts = await db.cash_shifts.toArray();
    const storeSettings = (await db.store_settings.toArray())[0];

    const normalizeBranchId = (value?: string | null) => {
      if (!value || value === 'main-branch' || value === '00000000-0000-0000-0000-000000000000') return '00000000-0000-0000-0000-000000000000';
      return value;
    };
    const initialSafe = storeSettings?.preferences?.safe_initial_balance || 0;
    const rebaseLaci = storeSettings?.preferences?.laci_rebase_balance || 0;
    const initialBank = storeSettings?.preferences?.bank_initial_balance || 0;

    // 1. KAS BESAR
    const safeInReceivables = allTimeReceivables.filter(p => p.payment_method === 'kas_besar').reduce((acc, p) => acc + p.amount, 0);
    const safeOutExpenses = combinedExpenses.filter(e => e.payment_method === 'kas_besar').reduce((acc, e) => acc + e.amount, 0);
    const safeInFromShifts = allShifts.reduce((acc, s) => acc + (s.cash_deposited || 0), 0);
    const safeNetMovement = safeInReceivables + safeInFromShifts - safeOutExpenses;
    const estimatedSafeBalance = initialSafe + safeNetMovement;

    // 2. KAS LACI
    const branchKey = normalizeBranchId(activeBranch?.id);
    const openShifts = allShifts
      .filter(s => s.status === 'open' && normalizeBranchId(s.branch_id) === branchKey)
      .sort((a, b) => new Date(b.opening_time).getTime() - new Date(a.opening_time).getTime());

    const activeShift = (sharedActiveShift && sharedActiveShift.status === 'open' && normalizeBranchId(sharedActiveShift.branch_id) === branchKey)
      ? sharedActiveShift
      : openShifts[0];

    setActiveShiftObj(activeShift || null);
    let estimatedCashLaci = 0;

    if (activeShift) {
      const shiftStart = new Date(activeShift.opening_time);
      const salesInShift = combinedSales.filter(s => !s.voided && new Date(s.created_at) >= shiftStart);
      const receivablesInShift = allTimeReceivables.filter(p => new Date(p.created_at) >= shiftStart);
      const expensesInShift = combinedExpenses.filter(e => {
        const expDateLocal = toLocalISO(e.created_at || e.expense_date);
        const shiftDateLocal = toLocalISO(activeShift.opening_time);

        // Match if on the same day or newer
        return expDateLocal >= shiftDateLocal;
      });
      const cashIn = salesInShift.reduce((acc, s) => {
        if (s.payment_method === 'cash') return acc + s.total;
        if (s.payment_method === 'split') return acc + (s.payment_breakdown?.cash || 0);
        if (s.payment_method === 'tempo') return acc + (s.paid || 0);
        return acc;
      }, 0);
      const recIn = receivablesInShift.filter(p => p.payment_method === 'cash').reduce((acc, p) => acc + p.amount, 0);
      const expOut = expensesInShift.filter(e => e.payment_method === 'cash').reduce((acc, e) => acc + e.amount, 0);
      const cashLaciAdjustments = activeShift?.adjustments?.reduce((acc, adj) => acc + adj.amount, 0) || 0;
      estimatedCashLaci = activeShift.opening_cash + cashIn + recIn - expOut + cashLaciAdjustments;
    } else {
      estimatedCashLaci = rebaseLaci;
    }

    // 3. SALDO BANK
    const bankInSales = combinedSales.filter(s => !s.voided && (s.payment_method === 'qris' || s.payment_method === 'transfer' || s.payment_method === 'split')).reduce((acc, s) => {
      if (s.payment_method === 'qris' || s.payment_method === 'transfer') return acc + s.total;
      if (s.payment_method === 'split') return acc + (s.payment_breakdown?.transfer || 0) + (s.payment_breakdown?.qris || 0);
      return acc;
    }, 0);
    const bankInReceivables = allTimeReceivables.filter(p => p.payment_method === 'qris' || p.payment_method === 'transfer').reduce((acc, p) => acc + p.amount, 0);
    const bankOut = combinedExpenses.filter(e => e.payment_method === 'qris' || e.payment_method === 'transfer').reduce((acc, e) => acc + e.amount, 0);
    const bankNetMovement = bankInSales + bankInReceivables - bankOut;
    const estimatedBankBalance = initialBank + bankNetMovement;

    setStats({
      salesToday: revenue,
      totalTransactions: todaySales.length,
      lowStockItems: products.filter(p => p.current_stock <= (p.min_stock || 0)).length,
      grossProfitToday: grossProfit,
      netProfitToday: netProfit,
      expenseRatio: expenseRatio,
      totalProducts: products.length,
      totalCashLaci: estimatedCashLaci,
      totalSafeBalance: estimatedSafeBalance,
      totalBankBalance: estimatedBankBalance,
      _bankNet: bankNetMovement,
      _safeNet: safeNetMovement
    });

    const productSalesMap: Record<string, { name: string; qty: number; revenue: number; unit: string }> = {};
    for (const sale of todaySales) {
      for (const detail of sale.details) {
        const key = detail.product_id;
        if (!productSalesMap[key]) productSalesMap[key] = { name: detail._productName || key, qty: 0, revenue: 0, unit: '' };
        productSalesMap[key].qty += (detail.base_qty || detail.qty);
        productSalesMap[key].revenue += detail.subtotal;
      }
    }
    setTopProducts(Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8).map(p => ({
      name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
      unitSold: parseFloat(Number(p.qty).toFixed(2)),
      revenue: p.revenue,
      unit: p.unit
    })));

    const last7: any[] = [];
    const daysArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dStr = toLocalISO(d);
      const dayRev = combinedSales.filter(s => toLocalISO(s.created_at) === dStr && !s.voided).reduce((acc, s) => acc + s.total, 0);
      last7.push({ name: `${daysArr[d.getDay()].slice(0, 3)}, ${d.getDate()}`, penjualan: dayRev });
    }
    setChartData(last7);

    setLowStockProducts(products.filter(p => (!activeBranch || p.branch_id === activeBranch.id) && p.current_stock <= (p.min_stock || 0)).slice(0, 10).map(p => ({
      name: p.name, stock: parseFloat(Number(p.current_stock).toFixed(3)), min: p.min_stock || 0, unit: p.base_unit
    })));
  };

  // Specific Balance Adjustment Modal
  const LocalAdjustmentModal = () => {
    const isLaci = adjustType === 'laci';
    const isSafe = adjustType === 'safe';
    const isBank = adjustType === 'bank';

    const currentVal = isLaci ? stats.totalCashLaci : isSafe ? stats.totalSafeBalance : stats.totalBankBalance;
    const [val, setVal] = useState(currentVal.toString());
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
      setIsSaving(true);
      try {
        const target = parseFloat(val) || 0;
        const settings = (await db.store_settings.toArray())[0] || { id: 'default', preferences: {} };
        const newPrefs = { ...settings.preferences };

        if (isLaci) {
          if (activeShiftObj) {
            const diff = target - stats.totalCashLaci;
            if (Math.abs(diff) > 0) await adjustShiftCash(diff, "Koreksi saldo (Dashboard)");
          }
          newPrefs.laci_rebase_balance = target;
          newPrefs.laci_rebase_time = new Date().toISOString();
        }
        else if (isSafe) {
          newPrefs.safe_initial_balance = target - stats._safeNet;
        }
        else if (isBank) {
          newPrefs.bank_initial_balance = target - stats._bankNet;
        }

        await db.store_settings.put({ ...settings, preferences: newPrefs });

        // --- PUSH TO CLOUD ---
        if (navigator.onLine) {
          await supabase.from('store_settings').upsert({
            id: 'global_profile',
            preferences: newPrefs,
            updated_at: new Date().toISOString()
          });
        }

        setAdjustType(null);
        setTimeout(() => loadDashboardData(), 100);
      } catch (error) {
        console.error(error);
        alert('Gagal menyimpan koreksi.');
      } finally {
        setIsSaving(false);
      }
    };

    const title = isLaci ? 'Koreksi Saldo Laci' : isSafe ? 'Koreksi Saldo Brankas' : 'Koreksi Saldo Bank';
    const label = isLaci ? 'Total Uang Fisik di Laci (Rp)' : isSafe ? 'Total Uang Fisik di Brankas (Rp)' : 'Total Saldo Bank / QRIS (Rp)';

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 p-4 text-white text-center">
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-xs opacity-70 italic">Samakan dengan uang fisik yang ada saat ini.</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
              <input type="number" value={val} onChange={e => setVal(e.target.value)} autoFocus className="w-full text-3xl font-black p-3 border-2 border-slate-100 rounded-xl focus:border-primary outline-none transition-all text-center" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setAdjustType(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">Batal</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 shadow-lg shadow-slate-200">Simpan</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          Dashboard <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">Real-time</span>
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <RealtimeClock />
          <button onClick={handleResync} disabled={isSyncing} className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-gray-700 font-semibold px-4 py-1.5 rounded-xl text-sm transition-all shadow-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sinkron...' : 'Resync'}
          </button>
          {navigator.onLine ? (
            <span className="bg-emerald-100 text-emerald-800 text-sm font-semibold px-3 py-1.5 rounded-xl flex items-center gap-2 border border-emerald-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Online
            </span>
          ) : (
            <span className="bg-orange-100 text-orange-800 text-sm font-semibold px-3 py-1.5 rounded-xl flex items-center gap-2 border border-orange-200">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span> Offline
            </span>
          )}
        </div>
      </div>

      <SyncErrorBanner />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Omset Hari Ini" value={`Rp ${stats.salesToday.toLocaleString('id-ID')}`} icon={TrendingUp} color="text-blue-600" bg="bg-blue-50" />
        <StatCard title="Laba Bersih" value={`Rp ${stats.netProfitToday.toLocaleString('id-ID')}`} icon={Award} color="text-emerald-600" bg="bg-emerald-50" highlight />
        <StatCard title="Kas Laci" value={`Rp ${stats.totalCashLaci.toLocaleString('id-ID')}`} icon={Wallet} color="text-amber-600" bg="bg-amber-50"
          action={isOwner && (
            <div className="flex gap-1">
              <button onClick={() => setShowAddModal(true)} title="Tambah Modal" className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAdjustType('laci')} title="Koreksi Saldo" className="p-1 hover:bg-amber-100 rounded text-amber-600 transition-colors"><Settings className="w-3.5 h-3.5" /></button>
            </div>
          )}
        />
        <StatCard title="Saldo Bank" value={`Rp ${stats.totalBankBalance.toLocaleString('id-ID')}`} icon={DollarSign} color="text-blue-600" bg="bg-blue-50"
          action={isOwner && (
            <button onClick={() => setAdjustType('bank')} title="Koreksi Saldo" className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"><Settings className="w-3.5 h-3.5" /></button>
          )}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Saldo Brankas" value={`Rp ${stats.totalSafeBalance.toLocaleString('id-ID')}`} icon={Wallet} color="text-purple-600" bg="bg-purple-50"
          action={isOwner && (
            <button onClick={() => setAdjustType('safe')} title="Koreksi Saldo" className="p-1 hover:bg-purple-100 rounded text-purple-600 transition-colors"><Settings className="w-3.5 h-3.5" /></button>
          )}
        />
        <StatCard title="Total Produk" value={stats.totalProducts.toString()} icon={Package} color="text-slate-600" bg="bg-slate-50" />
        <StatCard title="Stok Menipis" value={stats.lowStockItems.toString()} icon={Package} color="text-red-600" bg="bg-red-50" />
        <StatCard title="Rasio Biaya" value={`${stats.expenseRatio.toFixed(1)}%`} icon={FileText} color={stats.expenseRatio > 30 ? "text-red-600" : "text-orange-600"} bg={stats.expenseRatio > 30 ? "bg-red-50" : "bg-orange-50"} />
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-primary p-4 text-white text-center">
              <h3 className="font-bold text-lg">Tambah Modal Laci</h3>
              <p className="text-xs opacity-70 italic">Gunakan ini untuk menambah uang kembalian dsb.</p>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const amount = parseFloat((e.target as any).amount.value) || 0;
              const note = (e.target as any).note.value || 'Tambah modal manual';
              await adjustShiftCash(amount, note);
              setShowAddModal(false);
              loadDashboardData();
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Jumlah Uang Tambahan (Rp)</label>
                <input name="amount" type="number" required autoFocus className="w-full text-3xl font-black p-3 border-2 border-slate-100 rounded-xl focus:border-primary outline-none transition-all text-center" />
              </div>
              <input name="note" type="text" placeholder="Keterangan (Opsional)" className="w-full p-2 border rounded-xl outline-none" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-50 rounded-xl">Batal</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-shadow shadow-lg shadow-primary/20">Konfirmasi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-bold text-gray-800 mb-6">Grafik Penjualan 7 Hari Terakhir</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Penjualan']} />
                <Line type="monotone" dataKey="penjualan" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" /> Produk Laris</h3>
          {topProducts.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Belum ada data.</p> : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p.unitSold} terjual</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 flex-shrink-0">Rp {(p.revenue / 1000).toFixed(0)}K</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><Package className="w-5 h-5 text-orange-600" /><h3 className="font-bold text-orange-800">⚠️ Stok Menipis</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockProducts.map((p, i) => (
              <div key={i} className="bg-white rounded-lg border border-orange-100 px-3 py-2 flex items-center justify-between">
                <div><p className="text-sm font-semibold text-gray-800 truncate max-w-32">{p.name}</p><p className="text-xs text-orange-600">Stok: {p.stock}</p></div>
                <a href="/products" className="text-xs text-primary font-medium">Stok In →</a>
              </div>
            ))}
          </div>
        </div>
      )}
      {adjustType && <LocalAdjustmentModal />}
    </div>
  );
}

function SyncErrorBanner() {
  const { lastError, history } = useSyncStatusStore();
  const { activeBranch } = useBranchStore();
  const { user } = useAuthStore();
  const [show, setShow] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);

  const fetchDebugInfo = async () => {
    if (!navigator.onLine) return;
    const { data: profile } = await supabase.from('store_settings').select('*').eq('id', 'global_profile').maybeSingle();
    const { data: shift } = await supabase.from('cash_shifts').select('*').eq('status', 'open');
    setDebugData({ profile, shift });
  };

  if (!lastError && !show) {
    return (
      <div className="flex justify-end -mt-4 mb-2">
        <button onClick={() => { setShow(true); fetchDebugInfo(); }} className="text-[10px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1">
          <Settings className="w-3 h-3" /> Diagnosa Sync
        </button>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border mb-6 transition-all ${lastError ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            {lastError ? <AlertCircle className="w-5 h-5 text-red-600" /> : <CheckCircle className="w-5 h-5 text-emerald-600" />}
            <h5 className={`text-sm font-bold ${lastError ? 'text-red-800' : 'text-slate-800'}`}>
              {lastError ? 'Terdeteksi Masalah Sinkronisasi' : 'Sistem Sinkronisasi Aktif'}
            </h5>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono p-3 bg-white/50 rounded-lg border border-slate-200">
            <div><span className="text-slate-400">User ID:</span> <span className="font-bold">{user?.id?.slice(0, 8)}...</span></div>
            <div><span className="text-slate-400">User Role:</span> <span className="font-bold">{user?.role}</span></div>
            <div><span className="text-slate-400">Branch ID:</span> <span className="font-bold">{activeBranch?.id}</span></div>
            <div><span className="text-slate-400">Online:</span> <span className="font-bold text-emerald-600">{navigator.onLine ? 'YA' : 'TIDAK'}</span></div>
          </div>

          {lastError && (
            <div className="p-3 bg-red-100/50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              Error Terbaru: {lastError}
            </div>
          )}

          {debugData && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cloud State (Supabase):</p>
              <div className="p-2 bg-slate-900 text-emerald-400 rounded-lg text-[10px] overflow-x-auto font-mono max-h-40">
                <pre>{JSON.stringify(debugData, null, 2)}</pre>
              </div>
            </div>
          )}

          <button onClick={fetchDebugInfo} className="text-[10px] bg-white border px-2 py-1 rounded hover:bg-slate-50 font-bold">Refresh Data Cloud</button>
        </div>
        <button onClick={() => setShow(false)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg, highlight, action }: any) {
  return (
    <div className={`p-5 rounded-xl border flex items-center justify-between group hover:shadow-md transition-all ${highlight ? 'bg-white border-primary border-2 shadow-md' : 'bg-white shadow-sm border-slate-100'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className={`text-sm font-bold truncate ${highlight ? 'text-primary' : 'text-gray-500'}`}>{title}</p>
          {action}
        </div>
        <h4 className="text-xl sm:text-2xl font-black text-gray-900 truncate">{value}</h4>
      </div>
      <div className={`p-3 rounded-xl ${bg} ${color} flex-shrink-0 ml-3`}><Icon className="w-6 h-6" /></div>
    </div>
  );
}
