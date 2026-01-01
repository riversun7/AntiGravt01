import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-background text-white font-sans">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto h-screen p-8">
                {children}
            </main>
        </div>
    );
}
