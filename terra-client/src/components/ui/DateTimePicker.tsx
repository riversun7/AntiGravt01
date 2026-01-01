"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DateTimePickerProps {
    value: string; // ISO string or empty
    onChange: (value: string) => void;
    label?: string;
}

export default function DateTimePicker({ value, onChange, label }: DateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Internal state for selection before applying
    const [selectedDate, setSelectedDate] = useState<Date>(value ? new Date(value) : new Date());
    const [viewDate, setViewDate] = useState<Date>(value ? new Date(value) : new Date());

    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Format Helpers
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const formatTime = (d: Date) => d.toTimeString().slice(0, 5);
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const handleDateClick = (day: number) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(viewDate.getFullYear());
        newDate.setMonth(viewDate.getMonth());
        newDate.setDate(day);
        setSelectedDate(newDate);
        onChange(newDate.toISOString());
    };

    const handleTimeChange = (type: 'hour' | 'minute', val: number) => {
        const newDate = new Date(selectedDate);
        if (type === 'hour') newDate.setHours(val);
        if (type === 'minute') newDate.setMinutes(val);
        setSelectedDate(newDate);
        onChange(newDate.toISOString());
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };

    // Calendar Generation
    const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">{label}</label>}

            {/* Trigger Input */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-surface-dark border ${isOpen ? 'border-cyan-500' : 'border-surface-border'} rounded p-3 text-white flex justify-between items-center cursor-pointer transition-colors hover:border-cyan-500/50`}
            >
                <div>
                    {value ? (
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-cyan-400 font-bold">{new Date(value).toLocaleDateString()}</span>
                            <span className="text-gray-600">|</span>
                            <span className="font-mono text-yellow-400 font-bold">{new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    ) : (
                        <span className="text-gray-500">Pick a date & time...</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {value && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onChange(""); }}
                            className="p-1 text-gray-500 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <CalendarIcon size={16} className={`text-gray-500 transition-transform ${isOpen ? 'text-cyan-400' : ''}`} />
                </div>
            </div>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute z-50 mt-2 bg-slate-900 border border-cyan-500/30 rounded-lg shadow-2xl p-4 w-80 animate-in fade-in zoom-in-95 duration-100 right-0 md:left-0 md:right-auto">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-800 rounded text-gray-400 hover:text-white"><ChevronLeft size={16} /></button>
                        <span className="font-bold text-white">
                            {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-800 rounded text-gray-400 hover:text-white"><ChevronRight size={16} /></button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center text-xs mb-4">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} className="text-gray-500 font-bold py-1">{d}</div>
                        ))}
                        {days.map((day, idx) => (
                            <button
                                key={idx}
                                disabled={!day}
                                onClick={() => day && handleDateClick(day)}
                                className={`
                                    py-2 rounded transition-colors
                                    ${!day ? 'invisible' : ''}
                                    ${day === selectedDate.getDate() && viewDate.getMonth() === selectedDate.getMonth() && viewDate.getFullYear() === selectedDate.getFullYear()
                                        ? 'bg-cyan-600 text-white font-bold shadow-lg shadow-cyan-500/50'
                                        : 'text-gray-300 hover:bg-slate-800 hover:text-white'}
                                `}
                            >
                                {day}
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-slate-800 my-3"></div>

                    {/* Time Picker */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                            <Clock size={14} /> Time
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedDate.getHours()}
                                onChange={(e) => handleTimeChange('hour', Number(e.target.value))}
                                className="bg-slate-950 border border-slate-700 rounded p-1 text-white text-sm font-mono focus:border-cyan-500 outline-none"
                            >
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <option key={i} value={i} className="text-black">{i.toString().padStart(2, '0')}</option>
                                ))}
                            </select>
                            <span className="text-gray-500">:</span>
                            <select
                                value={selectedDate.getMinutes()}
                                onChange={(e) => handleTimeChange('minute', Number(e.target.value))}
                                className="bg-slate-950 border border-slate-700 rounded p-1 text-white text-sm font-mono focus:border-cyan-500 outline-none"
                            >
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <option key={i} value={i * 5} className="text-black">{(i * 5).toString().padStart(2, '0')}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
