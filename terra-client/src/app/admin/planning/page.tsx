"use client";

import { useState, useEffect } from 'react';
import { Plus, X, ArrowRight, ArrowLeft, Trash2, Tag, Edit3, Save, Copy, Check, Settings, Layout } from 'lucide-react';

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
    { id: 'MAP', label: 'Map & World', color: 'bg-emerald-500' },
    { id: 'CHARACTER', label: 'Character', color: 'bg-purple-500' },
    { id: 'ITEM', label: 'Items & Inv', color: 'bg-yellow-500' },
    { id: 'ECONOMY', label: 'Economy', color: 'bg-cyan-500' },
    { id: 'USER', label: 'Users', color: 'bg-pink-500' },
    { id: 'ADMIN', label: 'Admin Tools', color: 'bg-red-500' },
    { id: 'SERVER', label: 'Server/DB', color: 'bg-blue-500' },
    { id: 'SETTINGS', label: 'Settings', color: 'bg-slate-500' },
];

const COLUMNS = [
    { id: 'TODO', title: 'To Do', color: 'bg-red-500' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-500' },
    { id: 'DONE', title: 'Done', color: 'bg-green-500' },
];

export default function PlanningPage() {
    // --- State ---
    const [tasks, setTasks] = useState<Task[]>([]);
    const [categories, setCategories] = useState<TaskCategory[]>(DEFAULT_CATEGORIES);

    // UI State
    const [activeTab, setActiveTab] = useState<string>('ALL');
    const [isLoaded, setIsLoaded] = useState(false);

    // Modal State (Task)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState<Partial<Task>>({});

    // Modal State (Category Manager)
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<TaskCategory | null>(null);

    // --- Persistence & Migration ---
    useEffect(() => {
        // Load Categories
        const savedCats = localStorage.getItem('terra_admin_categories');
        if (savedCats) {
            setCategories(JSON.parse(savedCats));
        }

        // Load Tasks (v3)
        const savedTasks = localStorage.getItem('terra_admin_tasks_v3');
        if (savedTasks) {
            setTasks(JSON.parse(savedTasks));
        } else {
            // Migration v2 -> v3
            const v2Tasks = localStorage.getItem('terra_admin_tasks_v2');
            if (v2Tasks) {
                try {
                    const oldTasks = JSON.parse(v2Tasks);
                    const migrated = oldTasks.map((t: any) => ({
                        id: t.id,
                        title: t.content, // Map content to title
                        description: '', // Default empty desc
                        status: t.status,
                        categoryId: t.category === 'ALL' ? 'ADMIN' : t.category,
                        createdAt: t.createdAt
                    }));
                    setTasks(migrated);
                } catch (e) {
                    console.error("Migration failed", e);
                }
            } else {
                // Migration v1 -> v3 (fallback)
                const v1Tasks = localStorage.getItem('terra_admin_tasks');
                if (v1Tasks) {
                    try {
                        const oldTasks = JSON.parse(v1Tasks);
                        const migrated = oldTasks.map((t: any) => ({
                            id: t.id,
                            title: t.content,
                            description: '',
                            status: t.status,
                            categoryId: 'ADMIN', // Default
                            createdAt: t.createdAt
                        }));
                        setTasks(migrated);
                    } catch (e) { console.error(e); }
                }
            }
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('terra_admin_tasks_v3', JSON.stringify(tasks));
            localStorage.setItem('terra_admin_categories', JSON.stringify(categories));
        }
    }, [tasks, categories, isLoaded]);

    // --- Task Operations ---
    const handleSaveTask = () => {
        if (!currentTask.title?.trim()) return;

        if (currentTask.id) {
            // Edit existing
            setTasks(tasks.map(t => t.id === currentTask.id ? { ...t, ...currentTask } as Task : t));
        } else {
            // Create New
            const newTask: Task = {
                id: crypto.randomUUID(),
                title: currentTask.title!,
                description: currentTask.description || '',
                status: 'TODO',
                categoryId: currentTask.categoryId || (activeTab === 'ALL' ? categories[0].id : activeTab),
                createdAt: Date.now()
            };
            setTasks([newTask, ...tasks]);
        }
        setIsTaskModalOpen(false);
        setCurrentTask({});
    };

    const handleDeleteTask = (id: string) => {
        if (confirm("Delete this task?")) {
            setTasks(tasks.filter(t => t.id !== id));
            setIsTaskModalOpen(false); // If open
        }
    };

    const moveTask = (taskId: string, newStatus: Task['status']) => {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        // Also update currentTask if it's the one open to reflect status change in UI immediately if needed
        if (currentTask.id === taskId) {
            setCurrentTask(prev => ({ ...prev, status: newStatus }));
        }
    };

    // --- Category Operations ---
    const handleAddCategory = () => {
        const newCat: TaskCategory = {
            id: `CAT_${Date.now()}`,
            label: 'New Category',
            color: 'bg-gray-500'
        };
        setCategories([...categories, newCat]);
    };

    const handleUpdateCategory = (id: string, updates: Partial<TaskCategory>) => {
        setCategories(categories.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleDeleteCategory = (id: string) => {
        if (confirm("Delete this category? Tasks using it will default to the first category.")) {
            // Reassign tasks
            const fallbackId = categories.find(c => c.id !== id)?.id || 'DEFAULT';
            setTasks(tasks.map(t => t.categoryId === id ? { ...t, categoryId: fallbackId } : t));
            setCategories(categories.filter(c => c.id !== id));
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
    const getCategory = (id: string) => categories.find(c => c.id === id) || { label: '?', color: 'bg-gray-500' };

    const filteredTasks = activeTab === 'ALL' ? tasks : tasks.filter(t => t.categoryId === activeTab);

    if (!isLoaded) return null;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Layout className="text-purple-400" />
                    Advanced Planner
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCatModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-xs font-bold border border-slate-700"
                    >
                        <Settings size={14} /> Manage Categories
                    </button>
                    <button
                        onClick={() => { setCurrentTask({}); setIsTaskModalOpen(true); }}
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
                            ? `${cat.color} border-transparent text-white shadow-lg`
                            : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                        <div className={`w-2 h-2 rounded-full ${cat.color}`} />
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
                                <div className={`w-3 h-3 rounded-full ${col.color} animate-pulse`} />
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
                                        onClick={() => { setCurrentTask(task); setIsTaskModalOpen(true); }}
                                        className="bg-[#161b22] border border-slate-800 hover:border-slate-600 p-4 rounded-lg cursor-pointer group shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${cat.color}`} />

                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400`}>
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
                                        onChange={e => setCurrentTask({ ...currentTask, status: e.target.value as any })}
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
                                    <button
                                        onClick={() => handleDeleteTask(currentTask.id!)}
                                        className="px-4 py-2 text-red-400 hover:bg-red-900/20 rounded font-bold text-sm flex items-center gap-2"
                                    >
                                        <Trash2 size={16} /> Delete
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
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
                            {categories.map(cat => (
                                <div key={cat.id} className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-800">
                                    <input
                                        type="color"
                                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                                        // Simple color mapping not fully implemented for custom hex, using classnames for now or just generic color picker if desired. 
                                        // For prototype, we'll stick to predefined classes or simple text edit.
                                        disabled
                                        title="Color editing coming soon"
                                    />
                                    <div className={`w-4 h-4 rounded-full ${cat.color}`} />

                                    <input
                                        className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-slate-600"
                                        value={cat.label}
                                        onChange={e => handleUpdateCategory(cat.id, { label: e.target.value })}
                                    />
                                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                                </div>
                            ))}
                            <button onClick={handleAddCategory} className="w-full py-2 border border-dashed border-slate-700 text-slate-500 rounded hover:border-slate-500 hover:text-slate-300 text-sm font-bold mt-4">
                                + Add Category
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
