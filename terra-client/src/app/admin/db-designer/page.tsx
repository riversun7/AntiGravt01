"use client";

import { useState, useRef, useEffect } from 'react';
import mermaid from 'mermaid';
import { Save, Plus, Trash2, Database, GripVertical, X, ZoomIn, ZoomOut, Move, Filter, Link as LinkIcon } from 'lucide-react';

// Types for GUI State
interface DBColumn {
    id: string;
    name: string;
    type: string;
    isKey?: boolean;
    isFk?: boolean;
    fkTargetTableId?: string; // ID of the table this FK references
}

interface DBTable {
    id: string;
    name: string;
    schema: string; // e.g. 'public', 'auth', 'game'
    columns: DBColumn[];
}

const DEFAULT_TABLES: DBTable[] = [
    {
        id: '1',
        name: 'USER',
        schema: 'AUTH',
        columns: [
            { id: 'c1', name: 'id', type: 'int', isKey: true },
            { id: 'c2', name: 'username', type: 'string' },
            { id: 'c3', name: 'email', type: 'string' }
        ]
    },
    {
        id: '2',
        name: 'POST',
        schema: 'GAME',
        columns: [
            { id: 'p1', name: 'id', type: 'int', isKey: true },
            { id: 'p2', name: 'title', type: 'string' },
            { id: 'p3', name: 'user_id', type: 'int', isFk: true, fkTargetTableId: '1' }
        ]
    }
];

const generateMermaidCode = (visibleTables: DBTable[]) => {
    let code = 'erDiagram\n';

    // Render Tables
    visibleTables.forEach(table => {
        code += `    ${table.name.replace(/\s+/g, '_') || 'UNNAMED'} {\n`;
        table.columns.forEach(col => {
            const type = col.type || 'string';
            const name = col.name || 'new_col';
            const keyLabel = col.isKey ? 'PK' : (col.isFk ? 'FK' : '');
            code += `        ${type} ${name} ${keyLabel}\n`;
        });
        code += `    }\n`;
    });

    // Render Relationships using Visible Tables
    visibleTables.forEach(table => {
        table.columns.forEach(col => {
            if (col.isFk && col.fkTargetTableId) {
                const targetTable = visibleTables.find(t => t.id === col.fkTargetTableId);
                if (targetTable) {
                    // RELATION: TARGET ||--o{ SOURCE
                    const tName = targetTable.name.replace(/\s+/g, '_');
                    const sName = table.name.replace(/\s+/g, '_');
                    code += `    ${tName} ||--o{ ${sName} : "${col.name}"\n`;
                }
            }
        });
    });

    return code;
};

const renderDiagram = async (code: string, mermaidRef: React.RefObject<HTMLDivElement | null>, setRenderError: React.Dispatch<React.SetStateAction<string | null>>) => {
    if (!mermaidRef.current) return;
    // Don't render empty diagram if no tables
    if (!code.includes('{')) {
        mermaidRef.current.innerHTML = '<div class="text-gray-600 text-sm">No tables to display</div>';
        setRenderError(null);
        return;
    }

    try {
        mermaidRef.current.innerHTML = '';
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);
        mermaidRef.current.innerHTML = svg;
        setRenderError(null);
    } catch (_err: unknown) {
        setRenderError("Syntax or Render Error");
    }
};

export default function DBDesignerPage() {
    const [tables, setTables] = useState<DBTable[]>(DEFAULT_TABLES);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const mermaidRef = useRef<HTMLDivElement>(null);

    // View State
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [activeSchemaFilter, setActiveSchemaFilter] = useState<string>('ALL');

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('terra_db_gui_state_v2');
        if (saved) {
            try {
                setTables(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse DB state", e);
            }
        }

        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            securityLevel: 'loose',
            er: { useMaxWidth: false }
        });
    }, []);

    // Auto-generate Mermaid when state changes
    useEffect(() => {
        const filteredTables = activeSchemaFilter === 'ALL'
            ? tables
            : tables.filter(t => t.schema === activeSchemaFilter);

        const code = generateMermaidCode(filteredTables);
        renderDiagram(code, mermaidRef, setRenderError);
    }, [tables, activeSchemaFilter, mermaidRef, setRenderError]);

    const handleSave = () => {
        localStorage.setItem('terra_db_gui_state_v2', JSON.stringify(tables));
        alert('Design saved to local storage!');
    };

    // --- Table Operations ---
    const addTable = () => {
        // Generate a unique name
        const nameBase = 'NEW_TABLE';
        let counter = 1;
        let newName = nameBase;

        while (tables.some(t => t.name === newName)) {
            newName = `${nameBase}_${counter}`;
            counter++;
        }

        const newTable: DBTable = {
            id: crypto.randomUUID(),
            name: newName,
            schema: 'PUBLIC',
            columns: [{ id: crypto.randomUUID(), name: 'id', type: 'int', isKey: true }]
        };
        setTables([...tables, newTable]);
        setSelectedTableId(newTable.id);
    };

    const updateTable = (id: string, field: keyof DBTable, value: DBTable[typeof field]) => {
        setTables(tables.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const deleteTable = (id: string) => {
        if (confirm('Delete this table?')) {
            setTables(tables.filter(t => t.id !== id));
            if (selectedTableId === id) setSelectedTableId(null);
        }
    };

    // --- Column Operations ---
    const addColumn = (tableId: string) => {
        const newCol: DBColumn = { id: crypto.randomUUID(), name: 'new_col', type: 'string' };
        setTables(tables.map(t =>
            t.id === tableId
                ? { ...t, columns: [...t.columns, newCol] }
                : t
        ));
    };

    const updateColumn = (tableId: string, colId: string, field: keyof DBColumn, value: DBColumn[typeof field]) => {
        setTables(tables.map(t =>
            t.id === tableId
                ? {
                    ...t,
                    columns: t.columns.map(c => c.id === colId ? { ...c, [field]: value } : c)
                }
                : t
        ));
    };

    const deleteColumn = (tableId: string, colId: string) => {
        setTables(tables.map(t =>
            t.id === tableId
                ? { ...t, columns: t.columns.filter(c => c.id !== colId) }
                : t
        ));
    };

    // --- Pan & Zoom Handlers ---
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault(); // Browser zoom
            return;
        }
        // Simple zoom
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setScale(s => Math.min(Math.max(0.1, s * delta), 5));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    // --- Helpers ---
    const selectedTable = tables.find(t => t.id === selectedTableId);

    // Get unique schemas for filter
    const schemas = Array.from(new Set(tables.map(t => t.schema || 'PUBLIC'))).sort();

    const filteredTables = activeSchemaFilter === 'ALL' ? tables : tables.filter(t => t.schema === activeSchemaFilter);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Database className="text-purple-400" />
                    No-Code DB Designer
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded font-bold hover:bg-primary/80 transition-colors shadow-lg shadow-purple-900/20"
                    >
                        <Save size={16} /> Save
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Visual Preview Area */}
                <div className="col-span-12 lg:col-span-8 flex flex-col bg-[#0d1117] border border-surface-border rounded-lg overflow-hidden relative order-last lg:order-first">
                    {/* Toolbar */}
                    <div className="bg-surface-light/50 px-4 py-2 border-b border-surface-border text-xs font-bold text-gray-500 uppercase flex justify-between items-center z-10">
                        <div className="flex items-center gap-4">
                            <span>Diagram Preview</span>
                            <div className="flex items-center gap-1 bg-black/20 rounded px-2 py-0.5">
                                <Move size={12} />
                                <span className="opacity-50">Drag to Pan</span>
                            </div>
                            <div className="flex items-center gap-1 bg-black/20 rounded px-2 py-0.5">
                                <ZoomIn size={12} />
                                <span className="opacity-50">Scroll to Zoom</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                                <Filter size={12} />
                                <select
                                    className="bg-transparent text-white focus:outline-none"
                                    value={activeSchemaFilter}
                                    onChange={e => setActiveSchemaFilter(e.target.value)}
                                >
                                    <option value="ALL">ALL SCHEMAS</option>
                                    {schemas.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            {renderError && <span className="text-red-500 bg-red-900/20 px-2 py-0.5 rounded animate-pulse">ERROR</span>}
                        </div>
                    </div>

                    {/* Canvas */}
                    <div
                        className="flex-1 overflow-hidden relative bg-dots-pattern cursor-move"
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <div
                            style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                transformOrigin: '0 0',
                                transition: isDragging ? 'none' : 'transform 0.1s'
                            }}
                            className="absolute top-0 left-0 w-full h-full p-20"
                        >
                            <div ref={mermaidRef} className="w-full h-full pointer-events-none" />
                        </div>

                        {/* Zoom Controls Overlay */}
                        <div className="absolute bottom-4 right-4 flex flex-col gap-1">
                            <button onClick={() => setScale(s => s * 1.1)} className="p-2 bg-slate-800 text-white rounded shadow border border-slate-700 hover:bg-slate-700"><ZoomIn size={16} /></button>
                            <button onClick={() => setScale(1)} className="p-2 bg-slate-800 text-white rounded shadow border border-slate-700 hover:bg-slate-700 text-xs font-bold font-mono">{Math.round(scale * 100)}%</button>
                            <button onClick={() => setScale(s => s * 0.9)} className="p-2 bg-slate-800 text-white rounded shadow border border-slate-700 hover:bg-slate-700"><ZoomOut size={16} /></button>
                        </div>
                    </div>
                </div>

                {/* Editor Panel */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-hidden h-full">

                    {/* Table List */}
                    <div className="flex-1 flex flex-col bg-surface border border-surface-border rounded-lg overflow-hidden min-h-0 shadow-xl">
                        <div className="p-3 border-b border-surface-border flex justify-between items-center bg-surface-light">
                            <span className="font-bold text-gray-300 text-sm">Tables ({filteredTables.length})</span>
                            <button onClick={addTable} className="p-1 hover:bg-white/10 rounded text-primary">
                                <Plus size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {(activeSchemaFilter === 'ALL' ? tables : tables.filter(t => t.schema === activeSchemaFilter)).map(table => (
                                <div
                                    key={table.id}
                                    onClick={() => setSelectedTableId(table.id)}
                                    className={`p-3 rounded border cursor-pointer transition-all group ${selectedTableId === table.id
                                        ? 'bg-purple-900/20 border-purple-500/50'
                                        : 'bg-background border-surface-border hover:border-gray-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <input
                                            type="text"
                                            value={table.name}
                                            onChange={(e) => updateTable(table.id, 'name', e.target.value)}
                                            className="bg-transparent font-bold text-sm text-white focus:outline-none w-full"
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="TABLE_NAME"
                                        />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                                            className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <input
                                            type="text"
                                            value={table.schema || 'PUBLIC'}
                                            onChange={(e) => updateTable(table.id, 'schema', e.target.value.toUpperCase())}
                                            className="bg-transparent text-[10px] text-gray-400 focus:outline-none uppercase font-mono bg-white/5 px-1 rounded hover:bg-white/10"
                                            onClick={(e) => e.stopPropagation()}
                                            title="Edit Schema"
                                        />
                                        <span className="text-[10px] text-gray-600">{table.columns.length} cols</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column Editor */}
                    {selectedTable ? (
                        <div className="h-[60%] flex flex-col bg-surface border border-surface-border rounded-lg overflow-hidden shadow-xl">
                            <div className="p-3 border-b border-surface-border flex justify-between items-center bg-surface-light">
                                <span className="font-bold text-gray-300 text-sm truncate max-w-[150px]">
                                    {selectedTable.name}
                                </span>
                                <button onClick={() => addColumn(selectedTable.id)} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded">
                                    + Add Col
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {selectedTable.columns.map(col => (
                                    <div key={col.id} className="p-2 bg-background rounded border border-surface-border/50 text-xs flex flex-col gap-2">
                                        {/* Row 1: Basic Info */}
                                        <div className="flex items-center gap-2">
                                            <GripVertical size={12} className="text-gray-600" />
                                            <input
                                                value={col.name}
                                                onChange={(e) => updateColumn(selectedTable.id, col.id, 'name', e.target.value)}
                                                className="bg-transparent w-24 focus:outline-none text-gray-300 border-b border-transparent focus:border-purple-500 font-mono"
                                                placeholder="col_name"
                                            />
                                            <select
                                                value={col.type}
                                                onChange={(e) => updateColumn(selectedTable.id, col.id, 'type', e.target.value)}
                                                className="bg-black/20 text-gray-400 rounded px-1 w-20 focus:outline-none"
                                            >
                                                <option value="int">int</option>
                                                <option value="string">string</option>
                                                <option value="boolean">bool</option>
                                                <option value="datetime">date</option>
                                                <option value="float">float</option>
                                                <option value="json">json</option>
                                            </select>

                                            <button
                                                onClick={() => deleteColumn(selectedTable.id, col.id)}
                                                className="ml-auto text-gray-600 hover:text-red-500"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>

                                        {/* Row 2: Keys & Relations */}
                                        <div className="flex items-center gap-2 pl-5">
                                            <button
                                                onClick={() => updateColumn(selectedTable.id, col.id, 'isKey', !col.isKey)}
                                                className={`px-1.5 py-0.5 rounded text-[10px] border ${col.isKey ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                            >
                                                PK
                                            </button>
                                            <button
                                                onClick={() => updateColumn(selectedTable.id, col.id, 'isFk', !col.isFk)}
                                                className={`px-1.5 py-0.5 rounded text-[10px] border ${col.isFk ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                            >
                                                FK
                                            </button>

                                            {/* Relation Selector */}
                                            {col.isFk && (
                                                <div className="flex items-center gap-1 bg-blue-900/10 px-1 rounded ml-2">
                                                    <LinkIcon size={10} className="text-blue-400" />
                                                    <select
                                                        value={col.fkTargetTableId || ''}
                                                        onChange={(e) => updateColumn(selectedTable.id, col.id, 'fkTargetTableId', e.target.value)}
                                                        className="bg-transparent text-[10px] text-blue-300 focus:outline-none w-24"
                                                    >
                                                        <option value="">Select Target...</option>
                                                        {tables
                                                            .filter(t => t.id !== selectedTable.id) // Can't self-reference clearly in this simple UI yet, or allow it
                                                            .map(t => (
                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                            ))
                                                        }
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm italic">
                            Select a table to edit columns
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper to keep TS happy if filters below are messy in JSX
const filteredTables = []; // (Placeholder, logic handles activeSchemaFilter)
