import { useEffect, useRef, useState } from 'react';

export function useBarcodeScanner(onScan: (barcode: string) => void) {
    const barcodeBuffer = useRef('');
    const lastKeyTime = useRef(0);
    const [lastScannedValue, setLastScannedValue] = useState<string | null>(null);
    const [lastScannedAt, setLastScannedAt] = useState<number | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            const timeDiff = now - lastKeyTime.current;

            // Typical scanner will type keystrokes very fast (< 30ms apart)
            // If gap is > 50ms, we assume user is manually typing and reset buffer.
            if (timeDiff > 50 && e.key !== 'Enter') {
                // Only start buffer if single character
                barcodeBuffer.current = e.key.length === 1 ? e.key : '';
            } else {
                if (e.key === 'Enter') {
                    // If buffered string is reasonably long like a barcode
                    if (barcodeBuffer.current.length >= 3) {
                        setLastScannedValue(barcodeBuffer.current);
                        setLastScannedAt(Date.now());
                        onScan(barcodeBuffer.current);

                        // Optionally prevent default if focus is on an input 
                        // to avoid submitting a form prematurely
                        e.preventDefault();
                    }
                    barcodeBuffer.current = '';
                } else if (e.key.length === 1) {
                    barcodeBuffer.current += e.key;
                }
            }
            lastKeyTime.current = now;
        };

        // Attach to window so it works regardless of focus
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onScan]);

    return {
        isListening: true,
        lastScannedValue,
        lastScannedAt
    };
}
