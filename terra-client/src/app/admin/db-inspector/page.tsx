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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* File List */}
                <div className="bg-surface border border-surface-border rounded-lg p-4 overflow-y-auto">
                    <h3 className="text-gray-400 font-bold mb-4 text-sm uppercase">Database Files</h3>
                    <div className="space-y-2">
                        {files.map(file => (
                            <div
                                key={file.name}
                                onClick={() => {
                                    setSelectedFile(file.name);
                                    setSelectedTable(null);
                                    setTableData([]);
                                    fetchTables(file.name);
                                }}
                                className={`p-3 rounded cursor-pointer transition-colors flex items-center gap-3 ${selectedFile === file.name ? 'bg-primary/20 border border-primary text-white' : 'hover:bg-surface-light text-gray-400'}`}
                            >
                                <FileCode size={18} />
                                <span className="truncate text-sm font-mono">{file.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Table Lister / Data Viewer */}
                <div className="col-span-2 bg-surface border border-surface-border rounded-lg p-4 overflow-hidden flex flex-col">
                    {selectedFile ? (
                        <>
                            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 border-b border-surface-border">
                                <span className="text-xs text-gray-500 font-bold uppercase shrink-0">Tables:</span>
                                {tables.map(table => (
                                    <button
                                        key={table}
                                        onClick={() => fetchTableData(selectedFile, table)}
                                        className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap transition-colors ${selectedTable === table ? 'bg-secondary text-black font-bold' : 'bg-surface-light text-gray-300 hover:bg-surface-border'}`}
                                    >
                                        {table}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-auto">
                                {selectedTable && tableData.length > 0 ? (
                                    <table className="w-full text-left text-xs">
                                        <thead className="sticky top-0 bg-surface-light text-gray-300 font-bold">
                                            <tr>
                                                {Object.keys(tableData[0]).map(key => (
                                                    <th key={key} className="px-4 py-2 border-b border-surface-border">{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-border">
                                            {tableData.map((row, i) => (
                                                <tr key={i} className="hover:bg-white/5 font-mono text-gray-400">
                                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                    {Object.values(row).map((val: unknown, j) => (
                                                        <td key={j} className="px-4 py-2 whitespace-nowrap">{String(val)}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                        {selectedTable ? "No data found or loading..." : "Select a table to view data"}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Select a database file to inspect
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
