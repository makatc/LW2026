'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        console.log('🚀 Attempting login for:', email);

        try {
            await login(email, password);
            console.log('✅ Login successful, redirecting...');
            router.push('/');
        } catch (err: any) {
            console.error('❌ Login error:', err);
            setError(err.message || 'Login failed. Please check your connection to the backend.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#2B3544] p-4 font-[family-name:var(--font-inter)]">
            <div className="bg-[#FDFDFE] rounded-[2.5rem] shadow-2xl w-full max-w-6xl overflow-hidden flex min-h-[700px]">

                {/* Left Side - Form */}
                <div className="w-full lg:w-1/2 p-12 md:py-16 md:pl-20 md:pr-12 flex flex-col justify-center relative">
                    {/* Logo (Centered in Form Area) */}
                    <div className="mb-12 flex justify-center">
                        <img
                            src="/logologin.png"
                            alt="LegalWatch AI"
                            className="h-14 object-contain"
                        />
                    </div>

                    <div className="max-w-md w-full mx-auto">
                        <div className="mb-10 text-center">
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">Login</h1>
                            <p className="text-slate-500 text-sm">Welcome back! Please enter your details.</p>
                        </div>

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-pulse">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-5">
                                <div className="group">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-400">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                            </svg>
                                        </div>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 text-slate-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:border-transparent transition-all text-sm font-medium placeholder-slate-400"
                                            placeholder="admin@sutramonitor.com"
                                        />
                                    </div>
                                </div>

                                <div className="group">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-400">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                            </svg>
                                        </div>
                                        <input
                                            id="password"
                                            name="password"
                                            type="password"
                                            autoComplete="current-password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 text-slate-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:border-transparent transition-all text-sm font-medium placeholder-slate-400"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center space-x-2 cursor-pointer group">
                                    <input type="checkbox" className="w-4 h-4 text-[#0F172A] rounded border-slate-300 focus:ring-[#0F172A] transition-colors" />
                                    <span className="text-slate-500 group-hover:text-slate-700 transition-colors">Remember Password</span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 px-6 bg-[#0F172A] hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/10 transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed text-sm uppercase tracking-wide"
                            >
                                {isLoading ? 'Logging in...' : 'Login'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Side - Illustration */}
                <div className="hidden lg:flex w-1/2 bg-[#FDFDFE] items-center justify-center p-6 relative overflow-hidden">
                    <img
                        src="/login-illustration-v2.png"
                        alt="LegalWatch AI Illustration"
                        className="w-full h-auto object-contain scale-105"
                    />
                </div>
            </div>
        </div>
    );
}
