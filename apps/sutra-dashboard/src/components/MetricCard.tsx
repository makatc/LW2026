interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    filterOptions?: string[];
}

export default function MetricCard({ title, value, subtitle, filterOptions }: MetricCardProps) {
    return (
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
                {filterOptions && (
                    <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5V3.75m0 9.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 3.75V16.5m12-3V3.75m0 9.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 9.75V10.5" />
                        </svg>
                    </button>
                )}
            </div>
            <div className="mb-1">
                <p className="text-3xl font-bold text-slate-900">{value}</p>
            </div>
            {subtitle && (
                <p className="text-xs text-slate-500">{subtitle}</p>
            )}
        </div>
    );
}
