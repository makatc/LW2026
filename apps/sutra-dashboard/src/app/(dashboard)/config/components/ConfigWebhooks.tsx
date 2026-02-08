import { useState, useEffect } from 'react';
import { fetchWebhooks, updateWebhooks } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export function ConfigWebhooks() {
    const [alertsUrl, setAlertsUrl] = useState('');
    const [updatesUrl, setUpdatesUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Email Preferences State
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [emailFrequency, setEmailFrequency] = useState<'daily' | 'weekly'>('daily');
    const [emailLoading, setEmailLoading] = useState(false);

    const { user } = useAuth();

    useEffect(() => {
        loadData();
        loadEmailPreferences();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchWebhooks();
            setAlertsUrl(data.alertsUrl || '');
            setUpdatesUrl(data.updatesUrl || '');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        try {
            await updateWebhooks({ alertsUrl, updatesUrl });
            setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al guardar configuración' });
        }
    };

    const loadEmailPreferences = async () => {
        try {
            const data = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/config/email-preferences`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }).then(r => r.json());

            setEmailEnabled(data.enabled ?? true);
            setEmailFrequency(data.frequency || 'daily');
        } catch (error) {
            console.error('Error loading email preferences:', error);
        }
    };

    const handleEmailPreferencesSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setEmailLoading(true);

        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/config/email-preferences`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    enabled: emailEnabled,
                    frequency: emailFrequency
                })
            });

            setMessage({ type: 'success', text: 'Preferencias de email guardadas correctamente' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al guardar preferencias de email' });
        } finally {
            setEmailLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Intro */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <span className="text-xl mt-0.5">ℹ️</span>
                <div>
                    <h4 className="font-semibold text-blue-900 text-sm">¿Cómo funcionan las notificaciones?</h4>
                    <p className="text-sm text-blue-700/80 mt-1">
                        SUTRA puede enviar mensajes automáticos a tus canales de Discord, Slack o Telegram.
                        Solo necesitas pegar la URL del Webhook correspondiente en los campos de abajo.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-6">
                {/* 1. Alertas Generales */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full translate-x-8 -translate-y-8 blur-2xl opacity-50 pointer-events-none"></div>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xl">🚨</div>
                        <div>
                            <h3 className="font-bold text-slate-800">Alertas Generales</h3>
                            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Prioridad Alta</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-600 mb-6 min-h-[40px]">
                        Recibe notificaciones inmediatas cuando se detecten tus <strong>Palabras Clave</strong> o <strong>Temas</strong> en nuevas medidas.
                    </p>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Webhook URL</label>
                        <input
                            type="url"
                            value={alertsUrl}
                            onChange={(e) => setAlertsUrl(e.target.value)}
                            placeholder="https://discord.com/api/webhooks/..."
                            className="w-full rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors focus:border-red-500 focus:ring-red-500 text-sm"
                        />
                    </div>
                </div>

                {/* 2. Actualizaciones Sutra */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full translate-x-8 -translate-y-8 blur-2xl opacity-50 pointer-events-none"></div>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xl">📢</div>
                        <div>
                            <h3 className="font-bold text-slate-800">Actualizaciones</h3>
                            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Información</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-600 mb-6 min-h-[40px]">
                        Recibe reportes de estado, confirmaciones de "Scrapes" exitosos y novedades de la plataforma SUTRA.
                    </p>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Webhook URL</label>
                        <input
                            type="url"
                            value={updatesUrl}
                            onChange={(e) => setUpdatesUrl(e.target.value)}
                            placeholder="https://discord.com/api/webhooks/..."
                            className="w-full rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                    </div>
                </div>

                {/* Footer Actions for Webhooks */}
                <div className="md:col-span-2 pt-4 border-t border-slate-100 flex items-center justify-between">
                    {message ? (
                        <div className={`px-4 py-2 rounded-lg text-sm font-medium animate-in fade-in flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {message.type === 'success' ? '✅' : '⚠️'}
                            <span>{message.text}</span>
                        </div>
                    ) : (
                        <div /> // Spacer
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Guardando...' : 'Guardar Webhooks'}
                    </button>
                </div>
            </form>

            {/* Email Notification Preferences Section */}
            <div className="pt-8 border-t-2 border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📧</span>
                    Preferencias de Notificaciones por Email
                </h3>
                <p className="text-sm text-slate-600 mb-6">
                    Configura cómo deseas recibir notificaciones de nuevas alertas legislativas.
                </p>

                <form onSubmit={handleEmailPreferencesSubmit} className="space-y-6">
                    {/* Email Enabled Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex-1">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={emailEnabled}
                                    onChange={(e) => setEmailEnabled(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                                />
                                Recibir alertas por correo electrónico
                            </label>
                            <p className="text-xs text-slate-500 mt-1 ml-7">
                                Activa esta opción para recibir notificaciones de nuevas medidas que coincidan con tus intereses.
                            </p>
                        </div>
                    </div>

                    {/* Frequency Selector (only shown if enabled) */}
                    {emailEnabled && (
                        <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                Frecuencia de Envío
                            </label>
                            <select
                                value={emailFrequency}
                                onChange={(e) => setEmailFrequency(e.target.value as 'daily' | 'weekly')}
                                className="w-full rounded-lg border-slate-200 bg-white focus:border-primary focus:ring-primary text-sm"
                            >
                                <option value="daily">Diario (cada 30 minutos)</option>
                                <option value="weekly">Semanal (lunes a las 9 AM)</option>
                            </select>
                            <p className="text-xs text-slate-600 mt-2">
                                {emailFrequency === 'daily'
                                    ? '📅 Recibirás un resumen cada 30 minutos si hay nuevas alertas.'
                                    : '📅 Recibirás un resumen semanal cada lunes a las 9 AM con todas las alertas de la semana.'}
                            </p>
                        </div>
                    )}

                    {/* User Email Display */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm text-slate-700">
                            <span className="font-semibold">Correo de destino:</span>{' '}
                            <span className="text-green-700 font-mono">{user?.email || 'No disponible'}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Los correos se enviarán a la dirección registrada en tu cuenta.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={emailLoading}
                            className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {emailLoading ? 'Guardando...' : 'Guardar Preferencias'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
