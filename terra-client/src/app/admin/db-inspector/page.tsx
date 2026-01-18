"use client";

import { useEffect, useState } from "react";
import { ServerFile } from "@/types/admin";
import { Database, Edit2, Save, X, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

export default function DBInspectorPage() {
    const [files, setFiles] = useState<ServerFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
    const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [userMap, setUserMap] = useState<Record<number, string>>({}); // user_id -> username mapping

    // Fetch all usernames for user_id lookups
    const fetchUsernames = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/db/terra.db/users`);
            if (res.ok) {
                const users = await res.json();
                const map: Record<number, string> = {};
                users.forEach((u: any) => {
                    map[u.id] = u.username;
                });
                setUserMap(map);
            }
        } catch (e) {
            console.error("Failed to fetch users", e);
        }
    };

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/admin/files`)
            .then(res => res.json())
            .then(data => {
                setFiles(data as ServerFile[]);
                // Auto-select first file (usually terra.db)
                if (data.length > 0) {
                    setSelectedFile(data[0].name);
                    fetchTables(data[0].name);
                }
            });
        // Fetch user mapping for ID lookups
        fetchUsernames();
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

    const handleCellClick = (rowIndex: number, colName: string, currentValue: unknown) => {
        setEditingCell({ row: rowIndex, col: colName });
        setEditValue(String(currentValue));
    };

    const handleSaveCell = async () => {
        if (!editingCell || !selectedFile || !selectedTable) return;

        const row = tableData[editingCell.row];
        const primaryKey = row.id; // Assuming 'id' is the primary key

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/db/${selectedFile}/${selectedTable}/${primaryKey}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [editingCell.col]: editValue })
            });

            if (res.ok) {
                // Update local state
                const updatedData = [...tableData];
                updatedData[editingCell.row] = { ...updatedData[editingCell.row], [editingCell.col]: editValue };
                setTableData(updatedData);
                setEditingCell(null);
            } else {
                alert("Failed to update cell");
            }
        } catch (e) {
            console.error(e);
            alert("Error updating cell");
        }
    };

    const handleCancelEdit = () => {
        setEditingCell(null);
        setEditValue("");
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header with DB selector */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Database className="text-blue-500" />
                    Database Inspector
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Database:</span>
                    <div className="px-3 py-1 bg-surface border border-surface-border rounded text-sm text-white font-mono">
                        {selectedFile || "None"}
                    </div>
                    {selectedTable && (
                        <button
                            onClick={() => selectedFile && fetchTableData(selectedFile, selectedTable)}
                            className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white"
                            title="Refresh"
                        >
                            <RefreshCw size={16} />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
                {/* Table List (Span 2) */}
                <div className="col-span-2 bg-surface border border-surface-border rounded-lg p-4 overflow-y-auto">
                    <h3 className="text-gray-400 font-bold mb-4 text-xs uppercase tracking-wider">Tables</h3>
                    {selectedFile ? (
                        <div className="space-y-1">
                            {tables.map(table => (
                                <button
                                    key={table}
                                    onClick={() => fetchTableData(selectedFile, table)}
                                    className={`w-full text-left px-3 py-2 rounded text-xs font-mono whitespace-nowrap transition-colors ${selectedTable === table ? 'bg-secondary text-black font-bold' : 'text-gray-300 hover:bg-surface-light hover:text-white'}`}
                                >
                                    {table}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-600 text-xs italic">Loading...</div>
                    )}
                </div>

                {/* Data Viewer (Span 10) */}
                <div className="col-span-10 bg-surface border border-surface-border rounded-lg p-4 overflow-hidden flex flex-col">
                    {selectedTable ? (
                        <>
                            <div className="mb-4 flex items-center justify-between border-b border-surface-border pb-2">
                                <h3 className="text-white font-bold text-sm font-mono flex items-center gap-2">
                                    <span className="text-secondary">{selectedTable}</span>
                                    <span className="text-gray-600 text-xs">({tableData.length} rows)</span>
                                </h3>
                                <div className="text-xs text-yellow-400">
                                    💡 Click any cell to edit
                                </div>
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
                                            {tableData.map((row, rowIndex) => (
                                                <tr key={rowIndex} className="hover:bg-white/5 font-mono text-gray-400 transition-colors">
                                                    {Object.entries(row).map(([colName, val]) => {
                                                        const isEditing = editingCell?.row === rowIndex && editingCell?.col === colName;

                                                        // Check if this is a user_id column and we have username mapping
                                                        const isUserId = colName === 'user_id' || colName === 'sender_id' || colName === 'recipient_id';
                                                        const userId = isUserId ? Number(val) : null;
                                                        const username = userId && userMap[userId] ? userMap[userId] : null;

                                                        return (
                                                            <td
                                                                key={colName}
                                                                className="px-4 py-2 whitespace-nowrap max-w-[200px] truncate cursor-pointer hover:bg-blue-500/10 relative"
                                                                onClick={() => !isEditing && handleCellClick(rowIndex, colName, val)}
                                                                title={String(val)}
                                                            >
                                                                {isEditing ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="text"
                                                                            value={editValue}
                                                                            onChange={(e) => setEditValue(e.target.value)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') handleSaveCell();
                                                                                if (e.key === 'Escape') handleCancelEdit();
                                                                            }}
                                                                            className="w-full bg-slate-900 border border-blue-500 text-white px-1 py-0.5 text-xs rounded focus:outline-none"
                                                                            autoFocus
                                                                        />
                                                                        <button onClick={handleSaveCell} className="text-green-500 hover:text-green-400">
                                                                            <Save size={12} />
                                                                        </button>
                                                                        <button onClick={handleCancelEdit} className="text-red-500 hover:text-red-400">
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-between group">
                                                                        <span>
                                                                            {String(val)}
                                                                            {username && (
                                                                                <span className="ml-2 text-xs text-blue-400">({username})</span>
                                                                            )}
                                                                        </span>
                                                                        <Edit2 size={10} className="opacity-0 group-hover:opacity-50 text-blue-400" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
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
                            {selectedFile ? "Select a table to inspect data" : "Loading database..."}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
