// useTheme.ts — Three-way Dark / System / Light mode toggle.
// Reads preference from localStorage, applies data-theme attribute to <html>.
// 'system' = auto-detects OS preference (prefers-color-scheme).

import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'stealth' | 'system' | 'light';

const THEME_KEY = 'fc-theme';
const THEME_USER_SET_KEY = 'fc-theme-user-set';

function applyTheme(targetTheme: 'dark' | 'stealth' | 'light') {
    const root = document.documentElement;
    root.setAttribute('data-theme', targetTheme);
    if (targetTheme === 'stealth') {
        root.classList.add('dark', 'stealth');
    } else if (targetTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('stealth');
    } else {
        root.classList.remove('dark', 'stealth');
    }
}

export function initializeTheme() {
    if (typeof window === 'undefined') return;

    const hasExplicitUserTheme = localStorage.getItem(THEME_USER_SET_KEY) === '1';
    const savedTheme = (localStorage.getItem(THEME_KEY) as Theme | null);
    const resolvedTheme: Theme = hasExplicitUserTheme && savedTheme ? savedTheme : 'system';

    if (resolvedTheme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(isDark ? 'dark' : 'light');
        localStorage.setItem(THEME_KEY, 'system');
        return;
    }

    applyTheme(resolvedTheme);
    localStorage.setItem(THEME_KEY, resolvedTheme);
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        const hasExplicitUserTheme = typeof window !== 'undefined' && localStorage.getItem(THEME_USER_SET_KEY) === '1';
        const saved = typeof window !== 'undefined' ? (localStorage.getItem(THEME_KEY) as Theme) : null;
        return (hasExplicitUserTheme && saved) ? saved : 'system';
    });

    const [isSystemDark, setIsSystemDark] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        if (theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(isDark ? 'dark' : 'light');
            setIsSystemDark(isDark);
        } else {
            applyTheme(theme);
        }
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    // Listen to OS changes when on system mode
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            setIsSystemDark(e.matches);
            if (theme === 'system') {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    const cycle = () => {
        localStorage.setItem(THEME_USER_SET_KEY, '1');
        setTheme(prev => prev === 'stealth' ? 'dark' : prev === 'dark' ? 'system' : prev === 'system' ? 'light' : 'stealth');
    };

    const setThemePreference = (nextTheme: Theme) => {
        localStorage.setItem(THEME_USER_SET_KEY, '1');
        setTheme(nextTheme);
    };

    const isDark = theme === 'system' ? isSystemDark : (theme === 'dark' || theme === 'stealth');

    return { theme, setTheme: setThemePreference, cycle, isDark };
}
