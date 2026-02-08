import React from 'react';

interface CardProps {
    title: string;
    count?: number;
    children: React.ReactNode;
    className?: string; // Allow passing external classes
}

export function Card({ title, count, children, className = '' }: CardProps) {
    return (
        <div className={`bg-card border border-border rounded-xl shadow-sm p-6 flex flex-col h-full ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-card-foreground">{title}</h3>
                {count !== undefined && (
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        {count}
                    </span>
                )}
            </div>
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
