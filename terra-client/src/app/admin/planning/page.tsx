"use client";

import { useState, useEffect, useRef } from 'react';
import { Plus, X, ArrowRight, ArrowLeft, Trash2, Save, Copy, Settings, Layout, AlertCircle, Palette } from 'lucide-react';

// --- Types ---
interface TaskCategory {
    id: string;
    label: string;
    color: string;
}

interface Task {
    id: string;
    title: string;
    description: string;
    status: 'TODO' | 'IN_PROGRESS' | 'DONE';
    categoryId: string;
    createdAt: number;
}

const DEFAULT_CATEGORIES: TaskCategory[] = [
    { id: 'ADMIN', label: 'Admin Tools', color: '#ef4444' }, // Red (Critical)
    { id: 'ECONOMY', label: 'Economy', color: '#f97316' }, // Orange
    { id: 'ITEM', label: 'Items & Inv', color: '#eab308' }, // Yellow
    { id: 'MAP', label: 'Map & World', color: '#22c55e' }, // Green
    { id: 'SERVER', label: 'Server/DB', color: '#06b6d4' }, // Cyan
    { id: 'USER', label: 'Users', color: '#3b82f6' }, // Blue
    { id: 'CHARACTER', label: 'Character', color: '#a855f7' }, // Purple
    { id: 'SETTINGS', label: 'Settings', color: '#64748b' }, // Slate
];

const COLUMNS = [
    { id: 'TODO', title: 'To Do', color: '#ef4444' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: '#3b82f6' },
    { id: 'DONE', title: 'Done', color: '#22c55e' },
];

const PRESET_COLORS = [
    '#64748b', // Slate
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#eab308', // Yellow
    '#84cc16', // Lime
    '#22c55e', // Green
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#0ea5e9', // Sky
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#a855f7', // Purple
    '#d946ef', // Fuchsia
    '#ec4899', // Pink
    '#f43f5e', // Rose
];

const getRandomHexColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
};

const LEGACY_COLOR_MAP: Record<string, string> = {
    'bg-emerald-500': '#10b981',
    'bg-purple-500': '#a855f7',
    'bg-yellow-500': '#eab308',
    'bg-cyan-500': '#06b6d4',
    'bg-pink-500': '#ec4899',
    'bg-red-500': '#ef4444',
    'bg-blue-500': '#3b82f6',
    'bg-slate-500': '#64748b',
    // Fallbacks
    'bg-gray-500': '#64748b',
    'bg-green-500': '#22c55e',
    'bg-indigo-500': '#6366f1',
    'bg-orange-500': '#f97316',
};

export default function PlanningPage() {
    // --- State ---
    const [tasks, setTasks] = useState<Task[]>([]);
    const [categories, setCategories] = useState<TaskCategory[]>(DEFAULT_CATEGORIES);

    // UI State
    const [activeTab, setActiveTab] = useState<string>('ALL');
    const [isLoading, setIsLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/admin/planning');
            const data = await res.json();

            // Check Migration: If Server Empty AND LocalStorage has data
            if (data.tasks.length === 0) {
                const localTasks = localStorage.getItem('terra_admin_tasks_v3');
                if (localTasks) {
                    console.log("Migrating LocalStorage to Server...");
                    await migrateData(JSON.parse(localTasks));
                    return;
                }
            }

            setTasks(data.tasks);
            if (data.categories && data.categories.length > 0) {
                // Check for Legacy Colors
                const fixedCats = fixLegacyColors(data.categories);
                setCategories(fixedCats);
            }
        } catch (e) {
            console.error("Failed to fetch planning data", e);
        } finally {
            setIsLoading(false);
        }
    };

    const fixLegacyColors = (cats: TaskCategory[]) => {
        let hasChanges = false;
        const fixed = cats.map(c => {
            if (!c.color || c.color.startsWith('bg-')) {
                hasChanges = true;
                const newColor = LEGACY_COLOR_MAP[c.color] || getRandomHexColor();
                console.log(`Migrating legacy color for ${c.label}: ${c.color} -> ${newColor}`);
                return { ...c, color: newColor };
            }
            return c;
        });

        if (hasChanges) {
            setTimeout(() => syncCategories(fixed), 1000); // Sync back to server
        }
        return fixed;
    };

    const migrateData = async (localTasks: Task[]) => {
        try {
            // Upload Categories
            const localCats = localStorage.getItem('terra_admin_categories');
            const catsToUpload = localCats ? JSON.parse(localCats) : categories;
            await fetch('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catsToUpload)
            });

            // Upload Tasks
            await Promise.all(localTasks.map(t =>
                fetch('/api/admin/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(t)
                })
            ));

            // Clear Local and Refetch
            localStorage.removeItem('terra_admin_tasks_v3');
            localStorage.removeItem('terra_admin_categories');
            fetchData();
        } catch (e) {
            console.error("Migration Failed", e);
            alert("Migration failed. Check console.");
        }
    };

    // Modal State (Task)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState<Partial<Task>>({});
    const [isDeleting, setIsDeleting] = useState(false); // For delete confirmation UI

    // Modal State (Category Manager)
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [deleteCatConfirm, setDeleteCatConfirm] = useState<string | null>(null);
    const [resetCatConfirm, setResetCatConfirm] = useState(false);

    // Validation State
    const [validationError, setValidationError] = useState<string | null>(null);

    // --- Task Operations ---
    const handleSaveTask = async () => {
        if (!currentTask.title?.trim()) {
            setValidationError("Task title is required");
            return;
        }
        setValidationError(null);

        const newTask: Task = {
            id: currentTask.id || `TASK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: currentTask.title!,
            description: currentTask.description || '',
            status: currentTask.status || 'TODO',
            categoryId: currentTask.categoryId || (activeTab === 'ALL' ? categories[0].id : activeTab),
            createdAt: currentTask.createdAt || Date.now()
        };

        // Optimistic Update
        const prevTasks = [...tasks];
        if (currentTask.id) {
            setTasks(tasks.map(t => t.id === newTask.id ? newTask : t));
        } else {
            setTasks([newTask, ...tasks]);
        }
        setIsTaskModalOpen(false);
        setCurrentTask({});

        try {
            await fetch('/api/admin/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            });
        } catch (e) {
            console.error("Save failed", e);
            setTasks(prevTasks); // Revert
            alert("Failed to save task");
        }
    };

    const handleDeleteTask = async (id: string) => {
        // Optimistic
        const prevTasks = [...tasks];
        setTasks(tasks.filter(t => t.id !== id));
        setIsTaskModalOpen(false);
        setIsDeleting(false);

        try {
            await fetch(`/api/admin/tasks/${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error("Delete failed", e);
            setTasks(prevTasks);
        }
    };

    const moveTask = async (taskId: string, newStatus: Task['status']) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const updated = { ...task, status: newStatus };

        // Optimistic
        setTasks(tasks.map(t => t.id === taskId ? updated : t));
        if (currentTask.id === taskId) {
            setCurrentTask(prev => ({ ...prev, status: newStatus }));
        }

        try {
            await fetch('/api/admin/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });
        } catch (e) {
            console.error("Move failed", e);
        }
    };

    // --- Category Operations ---
    const handleAddCategory = () => {
        const newCat: TaskCategory = {
            id: `CAT_${Date.now()}`,
            label: 'New Category',
            color: getRandomHexColor() // Random color
        };
        const newCats = [...categories, newCat];
        setCategories(newCats);
        syncCategories(newCats);
    };

    const handleUpdateCategory = (id: string, updates: Partial<TaskCategory>) => {
        const newCats = categories.map(c => c.id === id ? { ...c, ...updates } : c);
        setCategories(newCats);
        syncCategories(newCats);
    };

    const handleDeleteCategory = (id: string) => {
        // UI Confirmation handles the check now
        const newCats = categories.filter(c => c.id !== id);
        setCategories(newCats);
        setDeleteCatConfirm(null);

        fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    };

    const handleResetCategories = async () => {
        setCategories(DEFAULT_CATEGORIES);
        await syncCategories(DEFAULT_CATEGORIES);
        setResetCatConfirm(false);
    };

    const syncCategories = async (cats: TaskCategory[]) => {
        try {
            await fetch('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cats)
            });
        } catch (e) {
            console.error("Cat sync failed", e);
        }
    };

    // --- AI Export ---
    const generatePrompt = (task: Task) => {
        const catLabel = categories.find(c => c.id === task.categoryId)?.label || 'General';
        const prompt = `[Task Context: ${catLabel}]
Objective: ${task.title}

Details:
${task.description || 'No additional details provided.'}

Current Status: ${task.status}
`;
        navigator.clipboard.writeText(prompt);
        alert("Prompt copied to clipboard!");
    };

    // --- Render Helpers ---
    const getCategory = (id: string) => categories.find(c => c.id === id) || { label: '?', color: '#94a3b8' };

    const filteredTasks = activeTab === 'ALL' ? tasks : tasks.filter(t => t.categoryId === activeTab);

    // Component for Category Row
    const CategoryRow = ({ cat }: { cat: TaskCategory }) => {
        // Use hidden input to trigger color picker
        const colorInputRef = useRef<HTMLInputElement>(null);
        const [showPalette, setShowPalette] = useState(false);
        const [localLabel, setLocalLabel] = useState(cat.label);

        useEffect(() => { setLocalLabel(cat.label); }, [cat.label]);

        const handleBlur = () => {
            if (localLabel !== cat.label) handleUpdateCategory(cat.id, { label: localLabel });
        };

        return (
            <div className="flex flex-col bg-slate-900 border border-slate-800 rounded mb-2 overflow-hidden transition-all">
                <div className="flex items-center gap-2 p-2">
                    {/* Circular Color Swatch - Toggle Palette */}
                    <div
                        onClick={() => setShowPalette(!showPalette)}
                        className="w-6 h-6 rounded-full cursor-pointer border border-white/20 hover:scale-110 transition-transform shadow-sm flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                        title="Click to open color palette"
                    />

                    {/* Hidden Input for Custom Color fallback */}
                    <input
                        ref={colorInputRef}
                        type="color"
                        className="w-0 h-0 opacity-0 absolute"
                        value={cat.color}
                        onChange={e => handleUpdateCategory(cat.id, { color: e.target.value })}
                    />

                    <input
                        className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-slate-600"
                        value={localLabel}
                        onChange={e => setLocalLabel(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    />

                    {deleteCatConfirm === cat.id ? (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                            <button onClick={() => handleDeleteCategory(cat.id)} className="px-2 py-0.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 font-bold">Delete?</button>
                            <button onClick={() => setDeleteCatConfirm(null)} className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded hover:bg-slate-600">Cancel</button>
                        </div>
                    ) : (
                        <button onClick={() => setDeleteCatConfirm(cat.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                    )}
                </div>

                {/* Expandable Palette */}
                {showPalette && (
                    <div className="p-2 bg-black/40 border-t border-slate-800 grid grid-cols-9 gap-2 animate-in slide-in-from-top-2 duration-200">
                        {PRESET_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => { handleUpdateCategory(cat.id, { color }); setShowPalette(false); }}
                                className={`w-5 h-5 rounded-full hover:scale-125 transition-transform border border-white/10 ${cat.color === color ? 'ring-2 ring-white' : ''}`}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                        {/* Custom Picker Trigger */}
                        <button
                            onClick={() => colorInputRef.current?.click()}
                            className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 via-green-500 to-blue-500 hover:scale-125 transition-transform border border-white/20 flex items-center justify-center"
                            title="Custom Color..."
                        >
                            <Palette size={10} className="text-white drop-shadow-md" />
                        </button>
                    </div>
                )}
            </div>
        )
    };

    if (isLoading) return <div className="h-full flex items-center justify-center text-slate-500">Loading Planning Board...</div>;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Layout className="text-purple-400" />
                    Advanced Planner <span className="text-xs text-slate-500 border border-slate-700 px-2 py-0.5 rounded">DB Connected</span>
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCatModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-xs font-bold border border-slate-700"
                    >
                        <Settings size={14} /> Manage Categories
                    </button>
                    <button
                        onClick={() => { setCurrentTask({}); setIsTaskModalOpen(true); setIsDeleting(false); }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded font-bold hover:bg-primary/80 transition-colors shadow-lg shadow-purple-900/20"
                    >
                        <Plus size={16} /> New Task
                    </button>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'ALL' ? 'bg-white text-black' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                >
                    ALL TASKS
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-2 whitespace-nowrap ${activeTab === cat.id
                            ? 'border-transparent text-white shadow-lg'
                            : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        style={activeTab === cat.id ? { backgroundColor: cat.color } : {}}
                    >
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: activeTab === cat.id ? 'white' : cat.color }}
                        />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Board Columns */}
            <div className="flex items-start gap-4 h-full min-h-0 overflow-x-auto">
                {COLUMNS.map(col => (
                    <div key={col.id} className="min-w-[300px] w-full max-w-md flex flex-col bg-surface border border-surface-border rounded-xl h-full shadow-xl shadow-black/20">
                        {/* Column Header */}
                        <div className={`p-4 border-b border-surface-border flex justify-between items-center bg-gradient-to-r from-transparent to-black/20`}>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: col.color }} />
                                <h3 className="font-bold text-gray-200">{col.title}</h3>
                            </div>
                            <span className="text-xs bg-black/40 px-2 py-0.5 rounded text-gray-400 font-mono">
                                {filteredTasks.filter(t => t.status === col.id).length}
                            </span>
                        </div>

                        {/* Drop Zone / List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#0a0d14]/50">
                            {filteredTasks.filter(t => t.status === col.id).map(task => {
                                const cat = getCategory(task.categoryId);
                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => { setCurrentTask(task); setIsTaskModalOpen(true); setIsDeleting(false); }}
                                        className="bg-[#161b22] border border-slate-800 hover:border-slate-600 p-4 rounded-lg cursor-pointer group shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: cat.color }} />

                                        <div className="flex items-center gap-2 mb-2">
                                            <span
                                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400"
                                                style={{ borderColor: cat.color, color: 'white' }}
                                            >
                                                {cat.label}
                                            </span>
                                        </div>

                                        <h4 className="font-bold text-slate-200 text-sm mb-2 line-clamp-2">{task.title}</h4>
                                        {task.description && (
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-3 font-mono">{task.description}</p>
                                        )}

                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/50">
                                            <div className="text-[10px] text-slate-600">{new Date(task.createdAt).toLocaleDateString()}</div>

                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                {col.id !== 'TODO' && (
                                                    <button onClick={() => moveTask(task.id, col.id === 'DONE' ? 'IN_PROGRESS' : 'TODO')} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ArrowLeft size={12} /></button>
                                                )}
                                                {col.id !== 'DONE' && (
                                                    <button onClick={() => moveTask(task.id, col.id === 'TODO' ? 'IN_PROGRESS' : 'DONE')} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ArrowRight size={12} /></button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* --- Modals --- */}

            {/* 1. Task Edit/Create Modal */}
            {isTaskModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setIsTaskModalOpen(false)}>
                    <div className="bg-[#161b22] w-full max-w-2xl rounded-xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                            <input
                                className="bg-transparent text-2xl font-bold text-white w-full focus:outline-none placeholder:text-slate-600"
                                placeholder="Task Title..."
                                value={currentTask.title || ''}
                                onChange={e => setCurrentTask({ ...currentTask, title: e.target.value })}
                            />
                            <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-500 hover:text-white"><X /></button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            {/* Metadata Row */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Category</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                        value={currentTask.categoryId}
                                        onChange={e => setCurrentTask({ ...currentTask, categoryId: e.target.value })}
                                    >
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Status</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                        value={currentTask.status}
                                        onChange={e => setCurrentTask({ ...currentTask, status: e.target.value as Task['status'] })}
                                    >
                                        {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="flex-1 flex flex-col min-h-[200px]">
                                <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Description & Prompt Context</label>
                                <textarea
                                    className="flex-1 w-full bg-slate-900 border border-slate-700 rounded p-4 text-sm text-slate-300 font-mono focus:border-primary focus:outline-none resize-none leading-relaxed"
                                    placeholder="Enter detailed task requirements, logic, and context here..."
                                    value={currentTask.description || ''}
                                    onChange={e => setCurrentTask({ ...currentTask, description: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-between rounded-b-xl">
                            <div className="flex gap-2">
                                {currentTask.id && (
                                    <>
                                        {!isDeleting ? (
                                            <button
                                                onClick={() => setIsDeleting(true)}
                                                className="px-4 py-2 text-red-400 hover:bg-red-900/20 rounded font-bold text-sm flex items-center gap-2"
                                            >
                                                <Trash2 size={16} /> Delete
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-red-400 font-bold">Really delete?</p>
                                                <button
                                                    onClick={() => handleDeleteTask(currentTask.id!)}
                                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold"
                                                >
                                                    Yes, Delete
                                                </button>
                                                <button
                                                    onClick={() => setIsDeleting(false)}
                                                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2 items-center">
                                {validationError && (
                                    <span className="text-red-400 text-xs font-bold animate-pulse px-2">
                                        ! {validationError}
                                    </span>
                                )}
                                {currentTask.id && (
                                    <button
                                        onClick={() => generatePrompt(currentTask as Task)}
                                        className="px-4 py-2 text-cyan-400 hover:bg-cyan-900/20 border border-cyan-900/50 rounded font-bold text-sm flex items-center gap-2"
                                    >
                                        <Copy size={16} /> Copy for AI
                                    </button>
                                )}
                                <button
                                    onClick={handleSaveTask}
                                    className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded font-bold text-sm flex items-center gap-2 shadow-lg shadow-purple-900/20"
                                >
                                    <Save size={16} /> Save Task
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Category Manager Modal */}
            {isCatModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setIsCatModalOpen(false)}>
                    <div className="bg-[#161b22] w-full max-w-md rounded-xl border border-slate-700 shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-800 text-lg font-bold text-white flex justify-between items-center">
                            Manage Categories
                            <button onClick={() => setIsCatModalOpen(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-2 flex-1">
                            {categories.map(cat => <CategoryRow key={cat.id} cat={cat} />)}
                            <button onClick={handleAddCategory} className="w-full py-2 border border-dashed border-slate-700 text-slate-500 rounded hover:border-slate-500 hover:text-slate-300 text-sm font-bold mt-4">
                                + Add Category
                            </button>
                            <div className="mt-4 pt-4 border-t border-slate-800">
                                {resetCatConfirm ? (
                                    <div className="flex flex-col gap-2 p-2 bg-red-900/10 rounded border border-red-900/30">
                                        <p className="text-red-400 text-xs text-center font-bold">Really reset all to defaults? Custom categories will be lost.</p>
                                        <div className="flex gap-2 justify-center">
                                            <button onClick={handleResetCategories} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold">Yes, Reset</button>
                                            <button onClick={() => setResetCatConfirm(false)} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setResetCatConfirm(true)} className="w-full py-2 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40 text-xs font-bold transition-colors">
                                        Reset to Defaults
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
