'use client';
import { useState } from 'react';

export type HumanSchedule = {
    type: 'minutes' | 'hours' | 'daily' | 'weekly' | 'custom';
    everyN?: number;       // for minutes/hours ("every N minutes/hours")
    timeHour?: number;     // 0-23, for daily/weekly
    timeMinute?: number;   // 0-59, for daily/weekly
    weekDays?: number[];   // 0=Sun … 6=Sat, for weekly
    customCron?: string;   // raw cron, for custom type
};

export function humanScheduleToCron(s: HumanSchedule): string {
    if (s.type === 'minutes')  return `*/${s.everyN ?? 30} * * * *`;
    if (s.type === 'hours')    return `${s.timeMinute ?? 0} */${s.everyN ?? 1} * * *`;
    if (s.type === 'daily')    return `${s.timeMinute ?? 0} ${s.timeHour ?? 8} * * *`;
    if (s.type === 'weekly') {
        const days = (s.weekDays ?? [1]).join(',');
        return `${s.timeMinute ?? 0} ${s.timeHour ?? 8} * * ${days}`;
    }
    return s.customCron ?? '0 6 * * *';
}

export function cronToHuman(cron: string): string {
    if (!cron) return 'No configurado';
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return cron;
    const [min, hour, dom, month, dow] = parts;

    if (min.startsWith('*/') && hour === '*' && dom === '*') {
        return `Cada ${min.slice(2)} minutos`;
    }
    if (hour.startsWith('*/') && dom === '*') {
        const m = min === '0' ? '' : ` y ${min} minutos`;
        return `Cada ${hour.slice(2)} horas${m}`;
    }
    if (dom === '*' && month === '*' && dow === '*') {
        return `Diario a las ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    }
    if (dom === '*' && month === '*' && dow !== '*') {
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dayLabels = dow.split(',').map(d => dayNames[parseInt(d)] ?? d).join(', ');
        return `Semanal (${dayLabels}) a las ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    }
    return cron;
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function parseCronToHumanSchedule(cron: string): HumanSchedule {
    if (!cron) return { type: 'daily', timeHour: 6, timeMinute: 0 };
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return { type: 'custom', customCron: cron };
    const [min, hour, dom, , dow] = parts;

    if (min.startsWith('*/') && hour === '*') {
        return { type: 'minutes', everyN: parseInt(min.slice(2)) };
    }
    if (hour.startsWith('*/')) {
        return { type: 'hours', everyN: parseInt(hour.slice(2)), timeMinute: parseInt(min) || 0 };
    }
    if (dow !== '*') {
        const days = dow.split(',').map(Number);
        return { type: 'weekly', timeHour: parseInt(hour), timeMinute: parseInt(min), weekDays: days };
    }
    return { type: 'daily', timeHour: parseInt(hour), timeMinute: parseInt(min) };
}

interface Props {
    id: string;
    label: string;
    currentCron: string;
    isEnabled: boolean;
    lastRunAt?: string | null;
    onSave: (id: string, is_enabled: boolean, cron_expression: string) => Promise<void>;
    onTrigger: (id: string) => void;
    isTriggering: boolean;
}

export function ScraperCard({ id, label, currentCron, isEnabled, lastRunAt, onSave, onTrigger, isTriggering }: Props) {
    const [editing, setEditing] = useState(false);
    const [schedule, setSchedule] = useState<HumanSchedule>(() => parseCronToHumanSchedule(currentCron));
    const [saving, setSaving] = useState(false);
    const [enabled, setEnabled] = useState(isEnabled);

    async function handleSave() {
        setSaving(true);
        try {
            const cron = humanScheduleToCron(schedule);
            await onSave(id, enabled, cron);
            setEditing(false);
        } finally {
            setSaving(false);
        }
    }

    async function handleToggle() {
        const newVal = !enabled;
        setEnabled(newVal);
        const cron = humanScheduleToCron(schedule);
        await onSave(id, newVal, cron);
    }

    const lastRunFormatted = lastRunAt
        ? new Date(lastRunAt).toLocaleString('es-PR', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Nunca';

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800">{label}</p>
                {/* ON/OFF Toggle */}
                <button
                    onClick={handleToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${enabled ? 'bg-green-500' : 'bg-slate-300'}`}
                    title={enabled ? 'Desactivar auto-scrape' : 'Activar auto-scrape'}
                >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
            </div>

            {/* Last run */}
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Última ejecución: <span className="font-medium text-slate-700">{lastRunFormatted}</span>
            </div>

            {/* Schedule summary */}
            <div className="bg-slate-50 rounded-lg p-2.5 flex justify-between items-start gap-2">
                <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Frecuencia</p>
                    {editing ? null : (
                        <p className="text-xs text-slate-700 font-medium">{cronToHuman(humanScheduleToCron(schedule))}</p>
                    )}
                </div>
                {!editing && (
                    <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">
                        Editar
                    </button>
                )}
            </div>

            {/* Inline editor */}
            {editing && (
                <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3 space-y-3">
                    {/* Type selector */}
                    <div className="grid grid-cols-2 gap-1.5">
                        {(['minutes', 'hours', 'daily', 'weekly'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setSchedule(s => ({ ...s, type: t }))}
                                className={`py-1.5 px-2 text-xs font-medium rounded border transition-colors ${schedule.type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                            >
                                {t === 'minutes' ? 'Cada X min' : t === 'hours' ? 'Cada X horas' : t === 'daily' ? 'Diario' : 'Semanal'}
                            </button>
                        ))}
                    </div>

                    {/* Minutes */}
                    {schedule.type === 'minutes' && (
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                            Cada
                            <input type="number" min={1} max={59} value={schedule.everyN ?? 30}
                                onChange={e => setSchedule(s => ({ ...s, everyN: parseInt(e.target.value) || 30 }))}
                                className="w-16 border border-slate-300 rounded px-2 py-1 text-center text-sm"
                            />
                            minutos
                        </label>
                    )}

                    {/* Hours */}
                    {schedule.type === 'hours' && (
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs text-slate-700">
                                Cada
                                <input type="number" min={1} max={23} value={schedule.everyN ?? 4}
                                    onChange={e => setSchedule(s => ({ ...s, everyN: parseInt(e.target.value) || 4 }))}
                                    className="w-16 border border-slate-300 rounded px-2 py-1 text-center text-sm"
                                />
                                horas, a los min
                                <input type="number" min={0} max={59} value={schedule.timeMinute ?? 0}
                                    onChange={e => setSchedule(s => ({ ...s, timeMinute: parseInt(e.target.value) || 0 }))}
                                    className="w-16 border border-slate-300 rounded px-2 py-1 text-center text-sm"
                                />
                            </label>
                        </div>
                    )}

                    {/* Daily */}
                    {schedule.type === 'daily' && (
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                            A las
                            <input type="number" min={0} max={23} value={schedule.timeHour ?? 8}
                                onChange={e => setSchedule(s => ({ ...s, timeHour: parseInt(e.target.value) || 0 }))}
                                className="w-16 border border-slate-300 rounded px-2 py-1 text-center text-sm"
                                placeholder="HH"
                            />
                            :
                            <input type="number" min={0} max={59} value={schedule.timeMinute ?? 0}
                                onChange={e => setSchedule(s => ({ ...s, timeMinute: parseInt(e.target.value) || 0 }))}
                                className="w-16 border border-slate-300 rounded px-2 py-1 text-center text-sm"
                                placeholder="MM"
                            />
                        </label>
                    )}

                    {/* Weekly */}
                    {schedule.type === 'weekly' && (
                        <div className="space-y-2">
                            <p className="text-xs text-slate-600 font-medium">Días de la semana:</p>
                            <div className="flex gap-1 flex-wrap">
                                {DAY_LABELS.map((d, i) => {
                                    const selected = (schedule.weekDays ?? [1]).includes(i);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSchedule(s => {
                                                const days = s.weekDays ?? [1];
                                                return { ...s, weekDays: selected ? days.filter(x => x !== i) : [...days, i].sort() };
                                            })}
                                            className={`w-9 py-1 text-xs rounded border font-medium transition-colors ${selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                                        >
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-700">
                                A las
                                <input type="number" min={0} max={23} value={schedule.timeHour ?? 8}
                                    onChange={e => setSchedule(s => ({ ...s, timeHour: parseInt(e.target.value) || 0 }))}
                                    className="w-16 border border-slate-300 rounded px-2 py-1 text-center text-sm"
                                />
                                :
                                <input type="number" min={0} max={59} value={schedule.timeMinute ?? 0}
                                    onChange={e => setSchedule(s => ({ ...s, timeMinute: parseInt(e.target.value) || 0 }))}
                                    className="w-16 border border-slate-300 rounded px-2 py-1 text-center text-sm"
                                />
                            </label>
                        </div>
                    )}

                    <p className="text-[10px] text-slate-400">
                        CRON resultante: <span className="font-mono">{humanScheduleToCron(schedule)}</span>
                    </p>

                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={() => setEditing(false)}
                            className="flex-1 py-1.5 text-xs font-medium border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Auto status & trigger button */}
            <div className="flex items-center gap-2 mt-auto pt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {enabled ? 'Auto activado' : 'Manual'}
                </span>
                <button
                    onClick={() => onTrigger(id)}
                    disabled={isTriggering}
                    className="ml-auto flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    {isTriggering ? 'Corriendo...' : 'Correr Ahora'}
                </button>
            </div>
        </div>
    );
}
