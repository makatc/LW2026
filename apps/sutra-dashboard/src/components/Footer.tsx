'use client';

export default function Footer() {
    return (
        <footer className="w-full py-6 px-6 border-t border-slate-200 bg-white mt-auto">
            <div className="max-w-[1600px] mx-auto text-center">
                <p className="text-sm text-slate-500">
                    Copyright © {new Date().getFullYear()} LegalWatch AI | Hecho con ❤️ en Puerto Rico | All Rights Reserved.
                </p>
            </div>
        </footer>
    );
}
