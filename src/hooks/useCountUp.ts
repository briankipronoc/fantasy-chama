import { useEffect, useState } from 'react';

/**
 * useCountUp hook for animating KES balances, pots, and scores.
 * Uses requestAnimationFrame with easeOutExpo for buttery-smooth 60fps transitions.
 */
export function useCountUp(targetValue: number, duration: number = 700): number {
    const [currentValue, setCurrentValue] = useState<number>(() => targetValue || 0);

    useEffect(() => {
        const startValue = currentValue;
        const diff = targetValue - startValue;

        if (diff === 0 || isNaN(targetValue)) {
            return;
        }

        let startTimestamp: number | null = null;
        let frameId: number;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // easeOutExpo
            const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const nextVal = Math.round(startValue + diff * ease);
            setCurrentValue(nextVal);

            if (progress < 1) {
                frameId = requestAnimationFrame(step);
            } else {
                setCurrentValue(targetValue);
            }
        };

        frameId = requestAnimationFrame(step);

        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [targetValue, duration]);

    return currentValue;
}
