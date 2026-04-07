'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pos_font_scale';
const DEFAULT_SCALE = 100;
const MIN_SCALE = 70;
const MAX_SCALE = 150;
const STEP = 5;

export function useFontScale() {
    const [scale, setScale] = useState<number>(DEFAULT_SCALE);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? parseInt(stored, 10) : DEFAULT_SCALE;
        const valid = isNaN(parsed) ? DEFAULT_SCALE : Math.min(MAX_SCALE, Math.max(MIN_SCALE, parsed));
        setScale(valid);
        document.documentElement.style.fontSize = `${valid}%`;
    }, []);

    const applyScale = useCallback((newScale: number) => {
        const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
        setScale(clamped);
        localStorage.setItem(STORAGE_KEY, String(clamped));
        document.documentElement.style.fontSize = `${clamped}%`;
    }, []);

    const increase = () => applyScale(scale + STEP);
    const decrease = () => applyScale(scale - STEP);
    const reset = () => applyScale(DEFAULT_SCALE);

    return { scale, increase, decrease, reset, applyScale, min: MIN_SCALE, max: MAX_SCALE };
}
