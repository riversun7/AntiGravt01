import { useState, useEffect } from 'react';
import { Shield, Swords, Factory, Landmark, Users, Construction, Check, X } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

/**
 * @file DiplomacyPanel.tsx
 * @description 게임 내 외교(Diplomacy) 시스템을 관리하는 패널
 * @role 팩션 목록 조회, 상세 정보 확인, 건설/동맹 요청 승인 및 거절
 * @dependencies react, lucide-react
 * @status Active
 * 
 * @analysis
 * - 팩션(Faction) 정보와 플레이어 간의 상호작용(요청)을 탭으로 분리하여 관리.
 * - 'ABSOLUTE'(절대 세력/NPC), 'FREE'(자유 세력/NPC), 'NONE'(플레이어) 등 NPC 유형에 따른 UI 구분.
 * - 외교 관계 점수(Diplomatic Stance)를 시각적인 바(Bar) 형태로 표현.
 */
interface Faction {
    id: number;
    username: string;
    npc_type: 'ABSOLUTE' | 'FREE' | 'NONE'; // NPC 유형: 절대 세력, 자유 세력, 플레이어
    color: string;           // 팩션 상징색
    personality: string;     // AI 성격 (예: Aggressive, Friendly)
    tech_focus: string;      // 기술적 초점 (예: Military, Economy)
    diplomatic_stance: Record<string, number>; // 다른 유저와의 외교 점수
}

interface DiplomacyPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentUserId: string | null;
}

export default function DiplomacyPanel({ isOpen, onClose, currentUserId }: DiplomacyPanelProps) {
    const [factions, setFactions] = useState<Faction[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
    const [activeTab, setActiveTab] = useState<'list' | 'requests'>('list');

    useEffect(() => {
        if (isOpen) {
            if (activeTab === 'list') fetchFactions();
            else fetchRequests();
        }
    }, [isOpen, activeTab]);

    // 팩션 목록 조회
    const fetchFactions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/factions`);
            if (res.ok) {
                const data = await res.json();
                setFactions(data.factions);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // 외교/건설 요청 목록 조회
    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/diplomacy/requests?userId=${currentUserId}`);
            if (res.ok) {
                const data = await res.json();
                setRequests(data.requests || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/diplomacy/requests/${requestId}/approve`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert("요청이 승인되고 건설이 시작되었습니다 (Request Approved)!");
                fetchRequests();
            } else {
                alert("실패: " + data.error);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleReject = async (requestId: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/diplomacy/requests/${requestId}/reject`, { method: 'POST' });
            if (res.ok) fetchRequests();
        } catch (e) {
            console.error(e);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-[800px] max-h-[80vh] flex flex-col overflow-hidden text-white">
                <header className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Users className="text-blue-400" /> 세력 및 외교 (Global Diplomacy)
                        </h2>
                        <div className="flex bg-slate-700 rounded p-1 gap-1">
                            <button
                                onClick={() => setActiveTab('list')}
                                className={`px-3 py-1 rounded text-sm font-bold transition-colors ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'hover:bg-slate-600 text-slate-300'}`}
                            >
                                세력 목록 (Factions)
                            </button>
                            <button
                                onClick={() => setActiveTab('requests')}
                                className={`px-3 py-1 rounded text-sm font-bold transition-colors ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'hover:bg-slate-600 text-slate-300'}`}
                            >
                                요청 (Requests)
                                {requests.length > 0 && <span className="ml-2 bg-red-500 text-white text-xs px-1.5 rounded-full">{requests.length}</span>}
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {activeTab === 'list' ? (
                        <>
                            {/* Faction List */}
                            <div className="w-1/3 border-r border-slate-700 overflow-y-auto p-4 flex flex-col gap-2">
                                {loading ? <p className="text-center text-gray-500">Loading...</p> : factions.map(f => (
                                    <div
                                        key={f.id}
                                        onClick={() => setSelectedFaction(f)}
                                        className={`p-3 rounded-md cursor-pointer border transition-colors flex items-center gap-3 ${selectedFaction?.id === f.id ? 'bg-blue-900/40 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                    >
                                        <div className="w-4 h-4 rounded-full shadow-sm sticky shrink-0" style={{ backgroundColor: f.color }} />
                                        <div>
                                            <div className="font-bold text-sm truncate">{f.username}</div>
                                            <div className="text-xs text-gray-400">{f.npc_type === 'NONE' ? 'PLAYER' : f.npc_type} FACTION</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Faction Details */}
                            <div className="w-2/3 p-6 overflow-y-auto bg-slate-900/50">
                                {selectedFaction ? (
                                    <div className="flex flex-col gap-6">
                                        <header className="flex items-center gap-4 pb-4 border-b border-slate-700">
                                            <div className="w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-2xl font-bold bg-slate-800 border-2" style={{ borderColor: selectedFaction.color }}>
                                                {selectedFaction.username.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold">{selectedFaction.username}</h3>
                                                <div className="flex gap-2 mt-1">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedFaction.npc_type === 'ABSOLUTE' ? 'bg-purple-900 text-purple-300' : 'bg-orange-900 text-orange-300'}`}>
                                                        {selectedFaction.npc_type}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-700 text-slate-300">
                                                        ID: {selectedFaction.id}
                                                    </span>
                                                </div>
                                            </div>
                                        </header>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-800 p-4 rounded border border-slate-700">
                                                <h4 className="text-gray-400 text-xs uppercase mb-2 flex items-center gap-1"><Landmark size={14} /> 성향 (Personality)</h4>
                                                <p className="text-lg font-semibold">{selectedFaction.personality}</p>
                                            </div>
                                            <div className="bg-slate-800 p-4 rounded border border-slate-700">
                                                <h4 className="text-gray-400 text-xs uppercase mb-2 flex items-center gap-1"><Factory size={14} /> 기술 초점 (Tech Focus)</h4>
                                                <p className="text-lg font-semibold">{selectedFaction.tech_focus}</p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                                            <h4 className="text-gray-400 text-xs uppercase mb-3 flex items-center gap-1"><Swords size={14} /> 외교 관계 (Relations)</h4>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between items-center p-2 bg-slate-900 rounded">
                                                    <span className="text-sm text-gray-300">당신과의 관계 (Your Standing)</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full w-[50%] ${(selectedFaction.diplomatic_stance?.[currentUserId!] || 0) < 0 ? 'bg-red-500' : 'bg-green-500'
                                                                    }`}
                                                                style={{ width: `${Math.min(Math.abs(selectedFaction.diplomatic_stance?.[currentUserId!] || 0) + 50, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className={`text-sm font-bold ${(selectedFaction.diplomatic_stance?.[currentUserId!] || 0) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                            {selectedFaction.diplomatic_stance?.[currentUserId!] || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 pointer-events-none">
                                        <Shield size={64} className="mb-4 opacity-20" />
                                        <p>팩션을 선택하여 상세 정보를 확인하세요.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="w-full p-6 overflow-y-auto bg-slate-900/50">
                            {/* Requests List */}
                            <div className="max-w-3xl mx-auto space-y-4">
                                {loading && <p className="text-center text-gray-500">요청 로딩 중...</p>}
                                {!loading && requests.length === 0 && (
                                    <div className="text-center py-10 text-gray-500 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
                                        <Construction className="mx-auto mb-3 opacity-20" size={48} />
                                        <p>대기 중인 건설 요청이 없습니다.</p>
                                    </div>
                                )}
                                {requests.map(req => (
                                    <div key={req.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex justify-between items-center hover:border-blue-500 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-yellow-900/50 p-3 rounded text-yellow-500">
                                                <Construction size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-white">건설 요청 (Construction Request)</h4>
                                                <p className="text-slate-300">
                                                    <span className="font-bold text-blue-400">{req.requester_name}</span> 님이 당신의 영토에 <span className="font-bold text-yellow-400">{req.building_type}</span> 건설을 원합니다.
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">위치: {req.x.toFixed(4)}, {req.y.toFixed(4)}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(req.id)}
                                                className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-md font-bold transition-colors"
                                            >
                                                <Check size={16} /> 승인
                                            </button>
                                            <button
                                                onClick={() => handleReject(req.id)}
                                                className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md font-bold transition-colors"
                                            >
                                                <X size={16} /> 거절
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
