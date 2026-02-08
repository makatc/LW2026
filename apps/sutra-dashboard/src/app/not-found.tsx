import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full">
                <div className="text-4xl mb-4">🔍</div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Página no encontrada</h2>
                <p className="text-slate-600 mb-6">
                    Lo sentimos, la página que estás buscando no existe o ha sido movida.
                </p>
                <Link
                    href="/"
                    className="block w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                    Volver al Dashboard
                </Link>
            </div>
        </div>
    );
}
