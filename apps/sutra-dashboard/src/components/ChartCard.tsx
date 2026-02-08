import { ReactNode } from 'react';

interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    className?: string;
    actions?: ReactNode;
}

export default function ChartCard({ title, subtitle, children, className = '', actions }: ChartCardProps) {
    return (
        <div className={`bg-white rounded-lg p-6 border border-slate-200 shadow-sm ${className}`}>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-base font-bold text-slate-900">{title}</h3>
                    {subtitle && (
                        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
                    )}
                </div>
                {actions && <div>{actions}</div>}
            </div>
            <div>
                {children}
            </div>
        </div>
    );
}
