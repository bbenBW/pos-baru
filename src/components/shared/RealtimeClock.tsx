'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function RealtimeClock({ className = '' }: { className?: string }) {
    const [now, setNow] = useState<Date | null>(null);

    useEffect(() => {
        setNow(new Date());
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!now) return null;

    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className={`flex items-center gap-1.5 bg-white border rounded-lg px-2.5 py-1 shadow-sm select-none ${className}`}>
            <Clock className="w-3 h-3 text-primary flex-shrink-0" />
            <div className="text-right leading-tight">
                <p className="text-sm font-black text-gray-800 tabular-nums tracking-tight">{timeStr}</p>
                <p className="text-[9px] text-gray-400 font-medium">{dateStr}</p>
            </div>
        </div>
    );
}
