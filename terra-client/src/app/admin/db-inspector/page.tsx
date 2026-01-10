"use client";

import { useEffect, useState } from "react";
import { ServerFile } from "@/types/admin";
import { FileCode } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

export default function DBInspectorPage() {
    const [files, setFiles] = useState<ServerFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/admin/files`)
            .then(res => res.json())
            .then(data => setFiles(data as ServerFile[]));
    }, []);

    const fetchTables = async (filename: string) => {
        const res = await fetch(`${API_BASE_URL}/api/admin/db/${filename}`);
        if (res.ok) setTables(await res.json());
    };

    const fetchTableData = async (filename: string, table: string) => {
        setSelectedTable(table);
        const res = await fetch(`${API_BASE_URL}/api/admin/db/${filename}/${table}`);
        if (res.ok) setTableData(await res.json());
    };

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-6 text-white">Database Inspector</h2>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
                {/* File List (Span 2) */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    {/* File List */}
                    <div className="bg-surface border border-surface-border rounded-lg p-4 overflow-y-auto flex-1">
                        <h3 className="text-gray-400 font-bold mb-4 text-xs uppercase tracking-wider">DB Files</h3>
                        <div className="space-y-1">
                            {files.map(file => (
                                <div
                                    key={file.name}
                                    onClick={() => {
                                        setSelectedFile(file.name);
                                        setSelectedTable(null);
                                        setTableData([]);
                                        fetchTables(file.name);
                                    }}
                                    className={`p-2 rounded cursor-pointer transition-colors flex items-center gap-2 ${selectedFile === file.name ? 'bg-primary/20 border border-primary text-white' : 'hover:bg-surface-light text-gray-400'}`}
                                >
                                    <FileCode size={16} />
                                    <span className="truncate text-xs font-mono">{file.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* DB Actions */}
                    <div className="bg-surface border border-surface-border rounded-lg p-4">
                        <h3 className="text-gray-400 font-bold mb-4 text-xs uppercase tracking-wider">Actions</h3>
                        <button
                            onClick={async () => {
                                if (!confirm("Seeding will create random NPC factions and modify the database. Continue?")) return;
                                try {
                                    const res = await fetch(`${API_BASE_URL}/api/admin/seed-factions`, { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) alert("NPC Factions Seeded Successfully!");
                                    else alert("Failed: " + data.error);
                                } catch (e) {
                                    alert("Error calling seed API");
                                }
                            }}
                            className="w-full bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-500 px-3 py-2 rounded text-xs font-bold transition-colors"
                        >
                            INIT NPC FACTIONS
                        </button>
                    </div>
                </div>

                {/* Table List (Span 2) - Vertical now */}
                <div className="lg:col-span-2 bg-surface border border-surface-border rounded-lg p-4 overflow-y-auto">
                    <h3 className="text-gray-400 font-bold mb-4 text-xs uppercase tracking-wider">Tables</h3>
                    {selectedFile ? (
                        <div className="space-y-1">
                            {tables.map(table => (
                                <button
                                    key={table}
                                    onClick={() => fetchTableData(selectedFile, table)}
                                    className={`w-full text-left px-3 py-2 rounded text-xs font-mono whitespace-nowrap transition-colors flex items-center justify-between ${selectedTable === table ? 'bg-secondary text-black font-bold' : 'text-gray-300 hover:bg-surface-light hover:text-white'}`}
                                >
                                    <span>{table}</span>
                                    {/* Optional: Add row count if available in future */}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-600 text-xs italic">Select a file...</div>
                    )}
                </div>

                {/* Data Viewer (Span 8) */}
                <div className="lg:col-span-8 bg-surface border border-surface-border rounded-lg p-4 overflow-hidden flex flex-col">
                    {selectedTable ? (
                        <>
                            <div className="mb-4 flex items-center justify-between border-b border-surface-border pb-2">
                                <h3 className="text-white font-bold text-sm font-mono flex items-center gap-2">
                                    <span className="text-secondary">{selectedTable}</span>
                                    <span className="text-gray-600 text-xs">({tableData.length} rows)</span>
                                </h3>
                                {/* Future: Export/Edit actions */}
                            </div>

                            <div className="flex-1 overflow-auto">
                                {tableData.length > 0 ? (
                                    <table className="w-full text-left text-xs">
                                        <thead className="sticky top-0 bg-surface-light text-gray-300 font-bold z-10">
                                            <tr>
                                                {Object.keys(tableData[0]).map(key => (
                                                    <th key={key} className="px-4 py-2 border-b border-surface-border whitespace-nowrap bg-surface-light">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-border">
                                            {tableData.map((row, i) => (
                                                <tr key={i} className="hover:bg-white/5 font-mono text-gray-400 transition-colors">
                                                    {Object.values(row).map((val: unknown, j) => (
                                                        <td key={j} className="px-4 py-2 whitespace-nowrap max-w-[200px] truncate" title={String(val)}>{String(val)}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                        Empty table
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            {selectedFile ? "Select a table to inspect data" : "Select a database file"}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
