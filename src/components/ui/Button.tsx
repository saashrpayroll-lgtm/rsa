import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    className,
    variant = 'primary',
    size = 'md',
    loading,
    icon,
    children,
    disabled,
    ...props
}) => {
    const variants = {
        primary: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 border-transparent',
        secondary: 'bg-white/10 hover:bg-white/20 text-white border-transparent',
        outline: 'bg-transparent border-white/20 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-gray-300 hover:text-cyan-400',
        ghost: 'bg-transparent hover:bg-white/5 text-gray-400 hover:text-white border-transparent',
        danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20',
    };

    const sizes = {
        sm: 'py-2 px-3 text-sm',
        md: 'py-2.5 px-4 text-base',
        lg: 'py-3.5 px-6 text-lg',
    };

    return (
        <button
            className={cn(
                'group relative flex items-center justify-center gap-2 rounded-xl transition-all duration-200 border font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50',
                variants[variant],
                sizes[size],
                loading && 'opacity-70 cursor-not-allowed',
                disabled && 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-400 shadow-none',
                className
            )}
            disabled={loading || disabled}
            {...props}
        >
            {loading ? (
                <Loader2 className="animate-spin" size={20} />
            ) : (
                <>
                    {icon && <span className="text-current">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
};
