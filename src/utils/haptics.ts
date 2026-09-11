// src/utils/haptics.ts
// Lightweight, safe haptic feedback utility using the standard navigator.vibrate API.

export const haptics = {
  /** Gentle 10ms tap for tab switches, radio buttons, and chip clicks */
  selection: () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch {}
  },

  /** Rhythmic double buzz for successful actions: payment toggled, bet confirmed, etc. */
  success: () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([15, 40, 25]);
      }
    } catch {}
  },

  /** Double strong buzz for warnings and errors */
  warning: () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 60, 40]);
      }
    } catch {}
  },

  /** Hype multi-pulse vibration for confetti & GW winner celebrations */
  celebrate: () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 40, 60, 40, 80, 50, 100]);
      }
    } catch {}
  },
};
