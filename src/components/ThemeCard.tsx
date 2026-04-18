import React from 'react';

interface ThemeCardProps {
    children: React.ReactNode;
    className?: string;
}

export default function ThemeCard({ children, className = '' }: ThemeCardProps) {
    return (
        <div className={`fc-theme-card rounded-2xl border border-white/10 bg-[#161d24]/85 p-4 md:p-5 shadow-sm text-slate-200 ${className}`}>
            {children}
        </div>
    );
}
