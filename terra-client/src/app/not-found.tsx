import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-gray-400 gap-6 p-4">
            <h1 className="text-9xl font-black text-slate-800 select-none">404</h1>
            <div className="absolute flex flex-col items-center gap-4">
                <div className="text-2xl font-bold text-cyan-500">SECTOR NOT FOUND</div>
                <p className="text-center max-w-md">
                    The coordinates you are trying to access do not exist in the known universe map.
                </p>
                <Link
                    href="/"
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition-all shadow-lg shadow-cyan-900/50 mt-4"
                >
                    RETURN TO SECTOR 0
                </Link>
            </div>
        </div>
    );
}
