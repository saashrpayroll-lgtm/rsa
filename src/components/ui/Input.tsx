import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
    className,
    label,
    error,
    icon,
    ...props
}) => {
    return (
        <div className="space-y-1.5 w-full">
            {label && <label className="text-sm font-medium text-gray-300 ml-1">{label}</label>}
            <div className="relative group">
                {icon && (
                    <div className="absolute left-3.5 top-3.5 text-gray-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                        {icon}
                    </div>
                )}
                <input
                    className={cn(
                        "w-full bg-white/5 border border-white/10 rounded-xl py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all",
                        icon ? "pl-11 pr-4" : "px-4",
                        error && "border-red-500/50 focus:border-red-500 bg-red-500/5",
                        className
                    )}
                    {...props}
                />
            </div>
            {error && <span className="text-xs text-red-400 ml-1">{error}</span>}
        </div>
    );
};
