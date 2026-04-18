// useTheme.ts — Three-way Dark / System / Light mode toggle.
// Reads preference from localStorage, applies data-theme attribute to <html>.
// 'system' = auto-detects OS preference (prefers-color-scheme).

import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'system' | 'light';

const THEME_KEY = 'fc-theme';
const THEME_USER_SET_KEY = 'fc-theme-user-set';

export function initializeTheme() {
    if (typeof window === 'undefined') return;

    const hasExplicitUserTheme = localStorage.getItem(THEME_USER_SET_KEY) === '1';
    const savedTheme = (localStorage.getItem(THEME_KEY) as Theme | null);
    const root = document.documentElement;
    const resolvedTheme: Theme = hasExplicitUserTheme && savedTheme ? savedTheme : 'system';

    if (resolvedTheme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem(THEME_KEY, 'system');
        return;
    }

    root.setAttribute('data-theme', resolvedTheme);
    localStorage.setItem(THEME_KEY, resolvedTheme);
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        return (localStorage.getItem(THEME_KEY) as Theme) || 'system';
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', isDark ? 'dark' : 'light');
        } else {
            root.setAttribute('data-theme', theme);
        }
        localStorage.setItem(THEME_KEY, theme);
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
        localStorage.setItem(THEME_USER_SET_KEY, '1');
        setTheme(prev => prev === 'dark' ? 'system' : prev === 'system' ? 'light' : 'dark');
    };

    const setThemePreference = (nextTheme: Theme) => {
        localStorage.setItem(THEME_USER_SET_KEY, '1');
        setTheme(nextTheme);
    };

    return { theme, setTheme: setThemePreference, cycle, isDark: theme === 'dark' };
}
