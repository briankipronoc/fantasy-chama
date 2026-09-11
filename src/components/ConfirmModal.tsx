import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import clsx from 'clsx';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false,
}: ConfirmModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isLoading, onClose]);

    if (!isOpen || typeof document === 'undefined') return null;

    const isDanger = variant === 'danger';
    const isWarning = variant === 'warning';

    return createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            {/* Dark glass backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
                onClick={() => {
                    if (!isLoading) onClose();
                }}
            />

            {/* Modal Dialog */}
            <div
                className="relative w-full max-w-md bg-[#0c1218]/95 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden text-white font-sans"
                role="dialog"
                aria-modal="true"
            >
                {/* Glow ambient accent */}
                <div
                    className={clsx(
                        'absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[70px] pointer-events-none opacity-40',
                        isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                    aria-label="Close dialog"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header Icon + Title */}
                <div className="flex items-start gap-4">
                    <div
                        className={clsx(
                            'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border',
                            isDanger
                                ? 'bg-red-500/15 border-red-500/30 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                                : isWarning
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        )}
                    >
                        {isDanger ? (
                            <Trash2 className="w-6 h-6" />
                        ) : (
                            <AlertTriangle className="w-6 h-6" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                        <h3 className="fc-frosty-title text-xl font-black tracking-tight">{title}</h3>
                        <p className="text-gray-300 text-sm mt-2 leading-relaxed font-medium">{message}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-white/5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={clsx(
                            'px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2',
                            isDanger
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25'
                                : isWarning
                                ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/25'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25'
                        )}
                    >
                        {isLoading && (
                            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
