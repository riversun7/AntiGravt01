"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
    label: string;
    value: string | number;
    category?: string;
    subtext?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string | number;
    onChange: (value: string | number) => void;
    placeholder?: string;
    label?: string;
}

/**
 * @file SearchableSelect.tsx
 * @description 검색 가능한 드롭다운 선택 컴포넌트
 * @role 많은 수의 옵션 중 검색을 통해 원하는 항목을 빠르게 선택
 * @dependencies react, lucide-react
 * @status Active
 * 
 * @analysis
 * - 카테고리별 그룹화(Group by Category) 기능을 지원하여 옵션 목록을 체계적으로 보여줌.
 * - 키보드 내비게이션은 아직 구현되지 않음 (추후 개선 가능).
 * - 모바일 환경에서의 터치 사용성 고려 필요 (현재는 클릭 기반).
 */
export default function SearchableSelect({ options, value, onChange, placeholder = "선택하세요...", label }: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
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

    // Filter Options
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.category?.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(opt => opt.value == value);

    // Group by Category if available
    const groupedOptions = filteredOptions.reduce((acc, opt) => {
        const cat = opt.category || "General";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(opt);
        return acc;
    }, {} as Record<string, Option[]>);

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-sm text-gray-400 mb-2">{label}</label>}

            {/* Trigger Button */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-surface-dark border ${isOpen ? 'border-cyan-500' : 'border-surface-border'} rounded p-3 text-white flex justify-between items-center cursor-pointer transition-colors hover:border-cyan-500/50`}
            >
                <div>
                    {selectedOption ? (
                        <div className="flex flex-col">
                            <span className="font-bold">{selectedOption.label}</span>
                            {selectedOption.subtext && <span className="text-xs text-gray-500">{selectedOption.subtext}</span>}
                        </div>
                    ) : (
                        <span className="text-gray-500">{placeholder}</span>
                    )}
                </div>
                <ChevronDown size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-cyan-500/30 rounded-lg shadow-2xl max-h-96 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">

                    {/* Search Bar */}
                    <div className="p-2 border-b border-slate-800 bg-slate-950/50">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                autoFocus
                                className="w-full bg-slate-900 border border-slate-700 rounded pl-9 pr-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                                placeholder="검색어 입력..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {search && (
                                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                        {Object.keys(groupedOptions).length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">검색 결과가 없습니다.</div>
                        ) : (
                            Object.entries(groupedOptions).map(([category, opts]) => (
                                <div key={category}>
                                    {Object.keys(groupedOptions).length > 1 && (
                                        <div className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase bg-slate-800/50 mt-1">{category}</div>
                                    )}
                                    {opts.map(opt => (
                                        <div
                                            key={opt.value}
                                            onClick={() => {
                                                onChange(opt.value);
                                                setIsOpen(false);
                                                setSearch("");
                                            }}
                                            className={`px-3 py-2 rounded cursor-pointer flex justify-between items-center group transition-colors ${opt.value == value ? 'bg-cyan-900/30 text-cyan-300' : 'hover:bg-slate-800 text-gray-300'}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium group-hover:text-white transition-colors">{opt.label}</span>
                                                {opt.subtext && <span className="text-[10px] text-gray-600 group-hover:text-gray-400">{opt.subtext}</span>}
                                            </div>
                                            {opt.value == value && <div className="w-2 h-2 rounded-full bg-cyan-400"></div>}
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
