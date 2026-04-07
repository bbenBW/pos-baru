'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Loader2, X, RefreshCw } from 'lucide-react';
import { isNativeAndroidApp, requestNativeCameraPermission } from '@/lib/cameraAccess';

interface Props {
    open: boolean;
    title?: string;
    onClose: () => void;
    onDetected: (barcode: string) => void;
}

type DetectorLike = {
    detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

export function CameraBarcodeScannerModal({ open, title = 'Scan Barcode dengan Kamera', onClose, onDetected }: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<number | null>(null);
    const scanningRef = useRef(false);
    const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'unsupported' | 'error'>('idle');
    const [message, setMessage] = useState('Arahkan kamera ke barcode produk.');
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

    const detectorSupported = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return typeof (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => DetectorLike }).BarcodeDetector !== 'undefined';
    }, []);
    const mediaSupported = useMemo(() => {
        if (typeof navigator === 'undefined') return false;
        return !!navigator.mediaDevices?.getUserMedia;
    }, []);

    useEffect(() => {
        if (!open) return;

        const stopStream = () => {
            if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            scanningRef.current = false;
        };

        const start = async () => {
            if (!window.isSecureContext) {
                setStatus('error');
                setMessage('Scan kamera butuh koneksi aman (HTTPS). Buka aplikasi dari URL HTTPS atau app Android.');
                return;
            }

            if (!mediaSupported) {
                setStatus('unsupported');
                setMessage('Browser ini belum mendukung akses kamera. Pakai scanner HID/keyboard atau app Android.');
                return;
            }

            try {
                setStatus('starting');
                setMessage(`Menyalakan kamera ${facingMode === 'environment' ? 'belakang' : 'depan'}...`);

                if (isNativeAndroidApp()) {
                    setMessage('Meminta izin kamera dari aplikasi Android...');
                    const granted = await requestNativeCameraPermission();
                    if (!granted) {
                        setStatus('error');
                        setMessage('Izin kamera ditolak oleh aplikasi Android. Izinkan kamera untuk aplikasi POS lalu coba lagi.');
                        return;
                    }
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: facingMode } },
                    audio: false
                });

                streamRef.current = stream;
                const video = videoRef.current;
                if (!video) return;
                video.srcObject = stream;
                await video.play();

                if (!detectorSupported) {
                    setStatus('unsupported');
                    setMessage('Kamera berhasil dibuka, tapi browser ini belum mendukung scan barcode otomatis. Pakai Chrome Android terbaru, app Android, atau scanner HID.');
                    return;
                }

                const Detector = (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => DetectorLike }).BarcodeDetector!;
                const detector = new Detector({
                    formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'codabar']
                });

                setStatus('ready');
                setMessage('Arahkan barcode ke kotak pemindai.');

                intervalRef.current = window.setInterval(async () => {
                    if (scanningRef.current || !videoRef.current || !canvasRef.current) return;
                    const currentVideo = videoRef.current;
                    const canvas = canvasRef.current;
                    if (currentVideo.readyState < 2 || !currentVideo.videoWidth || !currentVideo.videoHeight) return;

                    scanningRef.current = true;
                    try {
                        canvas.width = currentVideo.videoWidth;
                        canvas.height = currentVideo.videoHeight;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        ctx.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
                        const detections = await detector.detect(canvas);
                        const value = detections.find(item => item.rawValue?.trim())?.rawValue?.trim();
                        if (value) {
                            stopStream();
                            onDetected(value);
                            onClose();
                        }
                    } catch {
                        // keep scanning quietly
                    } finally {
                        scanningRef.current = false;
                    }
                }, 450);
            } catch (error) {
                setStatus('error');
                const name = error instanceof DOMException ? error.name : '';
                if (name === 'NotAllowedError') {
                    setMessage('Izin kamera ditolak. Buka izin situs/browser lalu ubah Kamera menjadi Izinkan, kemudian coba lagi.');
                } else if (name === 'NotFoundError') {
                    setMessage('Kamera tidak ditemukan di perangkat ini.');
                } else if (name === 'NotReadableError') {
                    setMessage('Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lalu coba lagi.');
                } else {
                    setMessage(error instanceof Error ? error.message : 'Kamera tidak bisa diakses.');
                }
            }
        };

        void start();

        return () => {
            stopStream();
        };
    }, [detectorSupported, mediaSupported, onClose, onDetected, open, facingMode]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                        <p className="text-xs text-gray-500 mt-1">Bisa dipakai di kasir dan form produk untuk membaca barcode lewat kamera.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                            className="p-2 rounded-lg hover:bg-slate-100 text-primary border border-slate-200 flex items-center gap-2 text-xs font-semibold"
                            title="Ganti ke kamera depan/belakang"
                        >
                            <RefreshCw className="w-4 h-4" /> Ganti Kamera
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-gray-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 aspect-[4/3]">
                        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-[78%] h-[34%] rounded-2xl border-2 border-emerald-300/90 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]" />
                        </div>
                        {status !== 'ready' && (
                            <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center text-white gap-2 px-5 text-center">
                                {status === 'starting' ? <Loader2 className="w-7 h-7 animate-spin" /> : status === 'unsupported' ? <AlertTriangle className="w-7 h-7 text-amber-300" /> : <Camera className="w-7 h-7" />}
                                <p className="text-sm font-medium">{message}</p>
                            </div>
                        )}
                    </div>

                    <div className={`rounded-xl px-3 py-2 text-xs ${status === 'ready'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : status === 'unsupported'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                        {message}
                    </div>
                </div>
            </div>
        </div>
    );
}
