export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 text-cyan-500">
            <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-cyan-900 rounded-full animate-ping opacity-25"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-t-cyan-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin"></div>
                </div>
                <h2 className="text-xl font-bold tracking-widest animate-pulse">LOADING SYSTEM...</h2>
            </div>
        </div>
    );
}
