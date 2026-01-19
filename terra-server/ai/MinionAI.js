/**
 * @file MinionAI.js
 * @description 개별 미니언(유닛)의 행동 상태 로직을 관리합니다.
 * @role 미니언의 생체/기계적 욕구(배고픔, 피로, 배터리)에 따른 행동 결정 (Finite State Machine 유사)
 * @dependencies ResourceType
 * @referenced_by server.js (Minion Tick)
 * @status Active
 * @analysis 
 * - Rule-based 시스템으로 구현되어 있습니다.
 * - 우선순위(priority) 기반으로 행동(EAT, REST, RECHARGE, GATHER)을 결정합니다.
 */

// Minion AI Engine - Rule-based decision making
const { ResourceType } = require('../types/ResourceTypes');

class MinionAI {
    constructor(db) {
        this.db = db;
    }

    /**
     * @function decideBehavior
     * @description 미니언의 상태를 분석하여 가장 시급한 행동을 반환합니다.
     * @param {Object} minion - 미니언 객체
     * @returns {Object} { action, priority, reason }
     * @analysis 
     * - 인간/생물형: 배고픔(Hunger), 스태미나(Stamina) 체크
     * - 안드로이드형: 배터리(Battery) 체크
     * - 공통: 피로(Fatigue) 체크
     */
    decideBehavior(minion) {
        // Parse preferences
        const prefs = JSON.parse(minion.preferences || '{}');

        // Critical needs check
        if (minion.type === 'human' || minion.type === 'creature') {
            if (minion.hunger > 80) {
                return { action: 'EAT', priority: 10, reason: 'Critically hungry' };
            }
            if (minion.stamina < 20) {
                return { action: 'REST', priority: 9, reason: 'Exhausted' };
            }
        }

        if (minion.type === 'android') {
            if (minion.battery < 20) {
                return { action: 'RECHARGE', priority: 10, reason: 'Low battery' };
            }
        }

        // Check fatigue for all types
        if (minion.fatigue > 80) {
            return { action: 'REST', priority: 8, reason: 'Too tired' };
        }

        // Moderate hunger - prefer to gather food or eat
        if ((minion.type === 'human' || minion.type === 'creature') && minion.hunger > 50) {
            return { action: 'GATHER_FOOD', priority: 7, reason: 'Hungry, looking for food' };
        }

        // Default behavior based on preferences
        const preferredAction = prefs.preferred_action || 'GATHER';
        const preferredResource = prefs.preferred_resource || ResourceType.WOOD;

        return {
            action: preferredAction,
            priority: 5,
            resource: preferredResource,
            reason: 'Following preferences'
        };
    }

    // Execute an action for a minion
    executeAction(minion, decision) {
        const updates = {
            current_action: decision.action
        };

        switch (decision.action) {
            case 'EAT':
                // Consume food from warehouse
                updates.hunger = Math.max(0, minion.hunger - 30);
                break;

            case 'REST':
                // Restore stamina and reduce fatigue
                if (minion.type !== 'android') {
                    updates.stamina = Math.min(100, minion.stamina + 20);
                }
                updates.fatigue = Math.max(0, minion.fatigue - 15);
                break;

            case 'RECHARGE':
                // Android recharge
                updates.battery = Math.min(100, minion.battery + 25);
                updates.fatigue = Math.max(0, minion.fatigue - 10);
                break;

            case 'GATHER':
            case 'GATHER_FOOD':
                // Gathering increases hunger and fatigue
                if (minion.type !== 'android') {
                    updates.hunger = Math.min(100, minion.hunger + 5);
                    updates.stamina = Math.max(0, minion.stamina - 10);
                }
                updates.fatigue = Math.min(100, minion.fatigue + 10);
                break;

            case 'TRADE':
                // Trading is less exhausting
                if (minion.type !== 'android') {
                    updates.hunger = Math.min(100, minion.hunger + 2);
                }
                updates.fatigue = Math.min(100, minion.fatigue + 5);
                break;

            default:
                // IDLE - slowly restore
                if (minion.type !== 'android') {
                    updates.hunger = Math.min(100, minion.hunger + 1);
                    updates.stamina = Math.min(100, minion.stamina + 5);
                }
                updates.fatigue = Math.max(0, minion.fatigue - 3);
        }

        // Build UPDATE query
        const updateFields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const updateValues = Object.values(updates);

        this.db.prepare(`UPDATE character_minion SET ${updateFields} WHERE id = ?`)
            .run(...updateValues, minion.id);

        return {
            minion_id: minion.id,
            action: decision.action,
            reason: decision.reason,
            updates
        };
    }

    // Update needs over time (passive decay)
    updateNeeds(minion) {
        const updates = {};

        if (minion.type === 'human' || minion.type === 'creature') {
            updates.hunger = Math.min(100, (minion.hunger || 50) + 1);
            updates.stamina = Math.max(0, (minion.stamina || 100) - 1);
        }

        if (minion.type === 'android') {
            updates.battery = Math.max(0, (minion.battery || 100) - 0.5);
        }

        // All types gain fatigue slowly over time
        updates.fatigue = Math.min(100, (minion.fatigue || 0) + 0.5);

        const updateFields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const updateValues = Object.values(updates);

        this.db.prepare(`UPDATE character_minion SET ${updateFields} WHERE id = ?`)
            .run(...updateValues, minion.id);

        return updates;
    }

    // Get all active minions for a user
    getActiveMinions(userId) {
        return this.db.prepare('SELECT * FROM character_minion WHERE user_id = ?').all(userId);
    }

    // Process AI tick for all minions of a user
    processUserMinions(userId) {
        const minions = this.getActiveMinions(userId);
        const results = [];

        minions.forEach(minion => {
            // Update passive needs
            this.updateNeeds(minion);

            // Refresh minion data after needs update
            const updatedMinion = this.db.prepare('SELECT * FROM character_minion WHERE id = ?').get(minion.id);

            // Decide action
            const decision = this.decideBehavior(updatedMinion);

            // Execute action
            const result = this.executeAction(updatedMinion, decision);
            results.push(result);
        });

        return results;
    }
}

module.exports = MinionAI;
