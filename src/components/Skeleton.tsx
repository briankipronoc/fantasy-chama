import clsx from 'clsx';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'card';
    width?: string;
    height?: string;
    count?: number;
}

export default function Skeleton({ className, variant = 'text', width, height, count = 1 }: SkeletonProps) {
    const baseClasses = 'animate-pulse bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] bg-[length:200%_100%]';

    const variantClasses = {
        text: 'h-3 rounded-md',
        circular: 'rounded-full',
        rectangular: 'rounded-xl',
        card: 'rounded-[1.5rem] min-h-[180px]',
    };

    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={clsx(baseClasses, variantClasses[variant], className)}
                    style={{ width: width || '100%', height: height || undefined }}
                />
            ))}
        </>
    );
}

// Pre-built compound skeletons for common page sections
export function DashboardSkeleton() {
    return (
        <div className="space-y-6 p-6 md:p-10 animate-in fade-in duration-300">
            {/* Header skeleton */}
            <div className="flex items-center gap-3">
                <Skeleton variant="circular" width="48px" height="48px" />
                <div className="space-y-2 flex-1">
                    <Skeleton variant="text" width="200px" height="20px" />
                    <Skeleton variant="text" width="140px" height="12px" />
                </div>
            </div>

            {/* Cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton variant="card" />
                <Skeleton variant="card" />
            </div>

            {/* Table skeleton */}
            <div className="space-y-2">
                <Skeleton variant="rectangular" height="40px" />
                <Skeleton variant="rectangular" height="56px" count={4} className="mt-1" />
            </div>
        </div>
    );
}

export function StandingsSkeleton() {
    return (
        <div className="space-y-4 p-6 md:p-10 animate-in fade-in duration-300">
            <Skeleton variant="text" width="250px" height="28px" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton variant="card" height="160px" />
                <Skeleton variant="card" height="160px" />
            </div>
            <Skeleton variant="rectangular" height="40px" />
            {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" height="52px" className="mt-1" />
            ))}
        </div>
    );
}
