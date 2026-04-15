// useTheme.ts — Three-way Dark / System / Light mode toggle.
// Reads preference from localStorage, applies data-theme attribute to <html>.
// 'system' = auto-detects OS preference (prefers-color-scheme).

import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'system' | 'light';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        return (localStorage.getItem('fc-theme') as Theme) || 'dark';
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', isDark ? 'dark' : 'light');
        } else {
            root.setAttribute('data-theme', theme);
        }
        localStorage.setItem('fc-theme', theme);
    }, [theme]);

    // Listen to OS changes when on system mode
    useEffect(() => {
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    const cycle = () => {
        setTheme(prev => prev === 'dark' ? 'system' : prev === 'system' ? 'light' : 'dark');
    };

    return { theme, setTheme, cycle, isDark: theme === 'dark' };
}
