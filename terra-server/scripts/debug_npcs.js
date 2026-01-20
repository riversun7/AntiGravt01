/**
 * @file debug_npcs.js
 * @description 실행 중인 서버의 NPC API(/api/npcs)를 호출하여 NPC 상태를 확인하는 외부 테스트 스크립트
 * @role API 응답 검증 (NPC 생성 여부 확인)
 * @dependencies fetch (Node.js 18+ Built-in)
 * @status Maintenance
 */

// Remote 'require' since Node 18 has native fetch
async function checkNpcs() {
    try {
        const response = await fetch('http://localhost:3001/api/npcs');
        const data = await response.json();
        console.log('Total NPCs found:', data.npcs ? data.npcs.length : 0);

        if (data.npcs) {
            const freeNpcs = data.npcs.filter(n => n.npc_type === 'FREE');
            console.log('Free Faction NPCs:', freeNpcs.length);
            if (freeNpcs.length > 0) {
                console.log('Sample Free NPC:', JSON.stringify(freeNpcs[0], null, 2));
            } else {
                console.log('No Free Faction NPCs found in API response!');
            }

            const absNpcs = data.npcs.filter(n => n.npc_type === 'ABSOLUTE');
            console.log('Absolute Faction NPCs:', absNpcs.length);
        }
    } catch (error) {
        console.error('Error fetching NPCs:', error);
    }
}

checkNpcs();
