
const db = require('./database');

const entries = [
    {
        code: 'WALL',
        name: '방벽',
        description: '적의 공격을 막아내는 방어 시설.',
        tier: 1,
        category: 'DEFENSE',
        construction_cost: JSON.stringify({ gold: 50, ore: 10 }),
        maintenance_cost: JSON.stringify({ gold: 1 }),
        production_rate: 0.0,
        production_type: null,
        storage_volume: 0.0,
        is_territory_center: 0,
        territory_radius: 0.0,
        prerequisites: JSON.stringify(['COMMAND_CENTER']),
        max_hp: 500,
        image: 'WALL.png'
    },
    {
        code: 'TURRET',
        name: '포탑',
        description: '접근하는 적을 자동으로 공격하는 방어 타워.',
        tier: 2,
        category: 'DEFENSE',
        construction_cost: JSON.stringify({ gold: 150, ore: 50 }),
        maintenance_cost: JSON.stringify({ gold: 5, energy: 2 }),
        production_rate: 0.0,
        production_type: null,
        storage_volume: 0.0,
        is_territory_center: 0,
        territory_radius: 2.0,
        prerequisites: JSON.stringify(['BARRACKS']),
        max_hp: 300,
        image: 'TURRET.png'
    },
    {
        code: 'POWER_PLANT',
        name: '발전소',
        description: '에너지를 생산하여 기지에 전력을 공급합니다.',
        tier: 2,
        category: 'INDUSTRIAL',
        construction_cost: JSON.stringify({ gold: 300, ore: 100 }),
        maintenance_cost: JSON.stringify({ gold: 10 }),
        production_rate: 20.0,
        production_type: 'ENERGY',
        storage_volume: 100.0,
        is_territory_center: 0,
        territory_radius: 0.0,
        prerequisites: JSON.stringify(['FACTORY']),
        max_hp: 200,
        image: 'POWER_PLANT.png'
    }
];

// Check if image column exists, if not, ignore it (backward compatibility)
// But based on previous checks, it should exist.
const insertStmt = db.prepare(`
    INSERT INTO building_types (
        code, name, description, tier, category, construction_cost, maintenance_cost,
        production_rate, production_type, storage_volume,
        is_territory_center, territory_radius, prerequisites, max_hp, image, internal_map_size
    ) VALUES (
        @code, @name, @description, @tier, @category, @construction_cost, @maintenance_cost,
        @production_rate, @production_type, @storage_volume,
        @is_territory_center, @territory_radius, @prerequisites, @max_hp, @image, @internal_map_size
    )
`);

const checkStmt = db.prepare('SELECT id FROM building_types WHERE code = ?');

db.transaction(() => {
    for (const entry of entries) {
        const existing = checkStmt.get(entry.code);
        if (!existing) {
            console.log(`Inserting missing building: ${entry.code}`);
            insertStmt.run(entry);
        } else {
            console.log(`Building already exists: ${entry.code}`);
        }
    }
})();

console.log('Seeding complete.');
