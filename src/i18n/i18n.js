import { useState, useCallback } from 'react';

const translations = {
    ko: {
        'nav.world_map': '네비게이션',
        'nav.tile_detail': '관리',
        'nav.assets': '자산',
        'nav.settings': '설정',
        'mode.orbit': '글로벌 궤도 스캔',
        'mode.surface': '행성 표면 링크',
        'btn.enter': '대기권 진입 (착륙)',
        'btn.back': '궤도 복귀 (이륙)',
        'msg.thrusters': '추진기 가동 중...',
        'unit.money': '크레딧',
        'unit.energy': '에너지',
        'unit.materials': '자재'
    },
    en: {
        'nav.world_map': 'Navigation',
        'nav.tile_detail': 'Management',
        'nav.assets': 'Assets',
        'nav.settings': 'Settings',
        'mode.orbit': 'Global Orbit Scan',
        'mode.surface': 'Planetary Surface Link',
        'btn.enter': 'Enter Atmosphere',
        'btn.back': 'Return to Orbit',
        'msg.thrusters': 'Thrusters Active...',
        'unit.money': 'Credits',
        'unit.energy': 'Energy',
        'unit.materials': 'Materials'
    }
};

let currentLang = 'ko'; // Default to Korean as per user request (implied by Korean prompts)

export const useTranslation = () => {
    // Force update pattern if we want dynamic switching, for now simple static access is fine for MVP
    // but let's make it a hook.
    // In a real app we'd use a context, but we are keeping this decoupled.

    const t = useCallback((key) => {
        return translations[currentLang][key] || key;
    }, []);

    const setLanguage = (lang) => {
        if (translations[lang]) {
            currentLang = lang;
        }
    };

    return { t, setLanguage, lang: currentLang };
};
