'use client';

export default function DossierPage() {
    return (
        <div className="-m-6 h-[calc(100vh-85px)]">
            <iframe
                src="http://localhost:3003"
                className="w-full h-full border-0"
                title="LW Dossier"
                allow="clipboard-read; clipboard-write"
            />
        </div>
    );
}
