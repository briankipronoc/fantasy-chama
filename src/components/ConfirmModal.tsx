import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title?: string;
    subtitle?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    variant?: 'danger' | 'warning' | 'info' | 'success' | 'primary';
    icon?: React.ReactNode;
    isLoading?: boolean;
    children?: React.ReactNode;
    maxWidth?: string;
    hideButtons?: boolean;
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    subtitle,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    showCancel = false,
    variant = 'danger',
    icon,
    isLoading = false,
    children,
    maxWidth = 'max-w-md',
    hideButtons = false,
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
    const isSuccess = variant === 'success';
    const isPrimary = variant === 'primary';

    const glowColor = isDanger
        ? 'bg-red-500'
        : isWarning
        ? 'bg-amber-500'
        : isSuccess
        ? 'bg-emerald-500'
        : isPrimary
        ? 'bg-blue-500'
        : 'bg-emerald-500';

    const defaultIcon = isDanger ? (
        <Trash2 className="w-6 h-6" />
    ) : isWarning ? (
        <AlertTriangle className="w-6 h-6" />
    ) : isSuccess ? (
        <CheckCircle2 className="w-6 h-6" />
    ) : isPrimary ? (
        <ShieldAlert className="w-6 h-6" />
    ) : (
        <Info className="w-6 h-6" />
    );

    const iconBoxStyle = isDanger
        ? 'bg-red-500/15 border-red-500/30 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
        : isWarning
        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
        : isSuccess
        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
        : isPrimary
        ? 'bg-blue-500/15 border-blue-500/30 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.25)]'
        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]';

    const confirmBtnStyle = isDanger
        ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-red-500/30'
        : isWarning
        ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black shadow-amber-500/30'
        : isSuccess
        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-emerald-500/30'
        : isPrimary
        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/30'
        : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-emerald-500/30';

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Dark glass backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
                onClick={() => {
                    if (!isLoading) onClose();
                }}
            />

            {/* Modal Dialog Squircle Card */}
            <div
                className={clsx(
                    'relative w-full bg-gradient-to-b from-[#161a22]/98 to-[#0c0f14]/98 border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden text-white font-sans',
                    maxWidth
                )}
                role="dialog"
                aria-modal="true"
            >
                {/* Glow ambient accent */}
                <div
                    className={clsx(
                        'absolute -top-16 -right-16 w-44 h-44 rounded-full blur-[65px] pointer-events-none opacity-35',
                        glowColor
                    )}
                />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50 cursor-pointer"
                    aria-label="Close dialog"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header Icon + Title */}
                <div className="flex items-start gap-4">
                    <div
                        className={clsx(
                            'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border',
                            iconBoxStyle
                        )}
                    >
                        {icon || defaultIcon}
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                        <h3 className="fc-frosty-title text-xl font-black tracking-tight">{title}</h3>
                        {subtitle && <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{subtitle}</p>}
                        {message && <p className="text-gray-300 text-sm mt-2 leading-relaxed font-medium">{message}</p>}
                    </div>
                </div>

                {/* Optional Custom Content */}
                {children && <div className="mt-4">{children}</div>}

                {/* Actions */}
                {!hideButtons && (
                    <div className="mt-6 pt-4 border-t border-white/5">
                        {showCancel ? (
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="h-12 w-full px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95 cursor-pointer flex items-center justify-center text-center select-none"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className={clsx(
                                        'h-12 w-full px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-center select-none',
                                        confirmBtnStyle
                                    )}
                                >
                                    {isLoading && (
                                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                                    )}
                                    {confirmText}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={isLoading}
                                className={clsx(
                                    'h-12 w-full px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-center select-none',
                                    confirmBtnStyle
                                )}
                            >
                                {isLoading && (
                                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                                )}
                                {confirmText}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
