'use client';

import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { ShiftModal } from '@/components/pos/ShiftModal';

export default function POSPage() {
    return (
        <div className="relative flex flex-col lg:flex-row h-full min-h-0 overflow-hidden w-full mt-0 pb-0 bg-white">
            <ShiftModal />
            <div className="w-full lg:w-[65%] xl:w-[70%] flex-1 lg:flex-none overflow-hidden flex flex-col h-1/2 lg:h-full bg-slate-50">
                <ProductGrid />
            </div>
            <div className="w-full lg:w-[35%] xl:w-[30%] flex-1 lg:flex-none overflow-hidden flex flex-col h-1/2 lg:h-full border-t lg:border-t-0 lg:border-l relative z-20 bg-white shadow-[-10px_0_20px_rgba(0,0,0,0.03)]">
                <CartPanel />
            </div>
        </div>
    );
}
