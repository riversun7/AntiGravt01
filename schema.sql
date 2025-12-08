-- Database Schema for Terra In-cognita
-- Based on game data structures in src/data/worldData.js and src/App.jsx

-- 1. Users / Players
-- Stores account information and core game resources.
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    
    -- Player Resources (from App.jsx initial state)
    money BIGINT DEFAULT 1000,
    energy INT DEFAULT 500,
    materials INT DEFAULT 50,
    
    -- Character Info
    species VARCHAR(50) DEFAULT 'Cyborg',
    class_type VARCHAR(50) DEFAULT 'Class A'
);

-- 2. Worlds
-- Supports multiple game worlds (servers) or save slots.
CREATE TABLE worlds (
    world_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    world_seed VARCHAR(100), -- Seed used for procedural generation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    width INT DEFAULT 500,
    height INT DEFAULT 500
);

-- 3. World Tiles (The Global Map)
-- Represents the 500x500 grid.
-- Note: For a 500x500 map (250,000 tiles), this table will grow large.
-- Consider partitioning or only storing 'modified' tiles in a production environment.
CREATE TABLE world_tiles (
    tile_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    world_id BIGINT NOT NULL,
    x_coord INT NOT NULL,
    y_coord INT NOT NULL,
    
    -- Terrain Type (ocean, plains, forest, mountain, city)
    tile_type VARCHAR(20) NOT NULL,
    
    -- Exploration Status (Per-world for single player, or link to user_exploration for multiplayer)
    -- For this schema, we assume a single shared state or simple single-player persistence.
    is_explored BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (world_id) REFERENCES worlds(world_id) ON DELETE CASCADE,
    UNIQUE KEY unique_tile_position (world_id, x_coord, y_coord)
);

-- 4. Cities
-- Stores specific data for tiles where tile_type = 'CITY'
CREATE TABLE cities (
    city_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tile_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    -- Economic / Game Data
    population INT DEFAULT 0,
    specialization VARCHAR(50), -- e.g., 'Tech', 'Finance', 'Diplomacy'
    description TEXT,
    
    FOREIGN KEY (tile_id) REFERENCES world_tiles(tile_id) ON DELETE CASCADE
);

-- 5. Player Sessions / State
-- Tracks where the player is currently located and what they are looking at.
CREATE TABLE player_states (
    player_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    world_id BIGINT NOT NULL,
    
    -- Current Position
    current_x INT DEFAULT 250,
    current_y INT DEFAULT 250,
    
    -- View Mode State
    view_mode ENUM('ORBIT', 'SURFACE') DEFAULT 'ORBIT',
    
    -- Timestamp for last movement (to calculate cooldowns server-side if needed)
    last_move_time TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (world_id) REFERENCES worlds(world_id) ON DELETE CASCADE
);

-- 6. Local/Inner Map Modifications (Optional)
-- If players can modify the 20x20 inner maps (build bases, etc.), store those changes here.
-- Only store tiles that differ from the procedural generation to save space.
CREATE TABLE local_sector_structures (
    structure_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tile_id BIGINT NOT NULL, -- The parent world tile (the sector)
    local_x INT NOT NULL,
    local_y INT NOT NULL,
    structure_type VARCHAR(50), -- e.g., 'mining_rig', 'lab', 'bunker'
    owner_user_id BIGINT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tile_id) REFERENCES world_tiles(tile_id) ON DELETE CASCADE,
    FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
);

-- Indexes for Performance
CREATE INDEX idx_world_tiles_location ON world_tiles(world_id, x_coord, y_coord);
CREATE INDEX idx_users_username ON users(username);
