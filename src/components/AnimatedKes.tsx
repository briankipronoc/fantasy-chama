import { useCountUp } from '../hooks/useCountUp';

interface AnimatedKesProps {
    amount: number;
    className?: string;
    showPrefix?: boolean;
}

export default function AnimatedKes({ amount, className = '', showPrefix = true }: AnimatedKesProps) {
    const displayed = useCountUp(amount);
    return (
        <span className={className}>
            {showPrefix && 'KES '}
            {displayed.toLocaleString()}
        </span>
    );
}
