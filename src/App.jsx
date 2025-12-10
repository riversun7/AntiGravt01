import { useState, useEffect } from 'react'
import './App.css'
import { generateWorldMap, generateInnerMap, TILE_TYPES, getMovementCost } from './data/worldData'




function App() {
  const [gameState, setGameState] = useState(() => {
    return localStorage.getItem('terra_user') ? 'dashboard' : 'start';
  });
  const [player, setPlayer] = useState(() => {
    try {
      const stored = localStorage.getItem('terra_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Global Map State
  const [map, setMap] = useState(() => {
    // Generate map immediately if we are in dashboard mode to avoid undefined map state
    if (localStorage.getItem('terra_user')) {
      console.log("Generating World (Lazy Init)...");
      return generateWorldMap();
    }
    return null;
  });

  const [playerPos, setPlayerPos] = useState({ x: 250, y: 250 }) // Center of large map
  const [selectedTile, setSelectedTile] = useState(null)

  const handleTileSelect = (tile) => {
    setSelectedTile(tile);
  }

  const handleEnterManagement = () => {
    setActiveTab('tile_detail');
  }

  // View State
  const [activeTab, setActiveTab] = useState('world_map');
  const [viewMode, setViewMode] = useState('ORBIT');
  const [innerMapData, setInnerMapData] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('terra_theme') || 'cyber';
  });

  const [log, setLog] = useState([])
  const [moving, setMoving] = useState(false)
  const [constructionTarget, setConstructionTarget] = useState(null) // {x, y} for building

  const addToLog = (msg) => {
    setLog(prev => [msg, ...prev].slice(0, 5))
  }

  // Theme Management Side Effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('terra_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to wipe all data? This cannot be undone.')) {
      localStorage.removeItem('terra_user');
      localStorage.removeItem('terra_theme');
      location.reload();
    }
  };

  // Initial World Gen
  // Initial World Gen moved to State Initializer or explicit Event,
  // preventing useEffect setState loops.

  // Kept empty to clean up old effect hook.

  // Save on state change
  useEffect(() => {
    if (player) {
      localStorage.setItem('terra_user', JSON.stringify(player))
    }
  }, [player])

  const handleLogout = () => {
    localStorage.removeItem('terra_user')
    setPlayer(null)
    setGameState('start')
  }

  // World Map Movement
  const movePlayerTo = (targetX, targetY) => {
    if (moving) return;
    if (!map) return;
    if (playerPos.x === targetX && playerPos.y === targetY) return;

    // Simple Manhattan distance for now (no obstacles)
    const distX = Math.abs(playerPos.x - targetX);
    const distY = Math.abs(playerPos.y - targetY);
    const totalDist = distX + distY;

    // Base cost calculation (simplified for long distance)
    const targetTile = map[targetY][targetX];
    const terrainCost = getMovementCost(targetTile.type);

    // Total energy needed (approximate linear cost)
    const totalEnergyCost = Math.floor(totalDist * terrainCost);

    if (player.energy < totalEnergyCost) {
      addToLog(`Insufficient Energy. Need ${totalEnergyCost} for this trajectory.`);
      return;
    }

    // Initiate Travel
    setMoving(true);
    const travelTimeMs = totalDist * 300 * terrainCost; // 300ms per tile base

    addToLog(`Thrusters engaged. ETA: ${(travelTimeMs / 1000).toFixed(1)}s`);

    // visual update of "ghost" or just wait? 
    // For now, just wait and teleport to simulate travel time, 
    // ideally we would step through, but let's do direct for v1 of this feature.

    setTimeout(() => {
      setPlayer(p => ({ ...p, energy: p.energy - totalEnergyCost }));
      setPlayerPos({ x: targetX, y: targetY });
      setMoving(false);

      if (map[targetY][targetX].type === TILE_TYPES.CITY) {
        addToLog(`Arrived at ${map[targetY][targetX].data.name}. Orbit established.`);
      } else {
        addToLog(`Arrival confirmed at [${targetX}, ${targetY}].`);
      }
    }, travelTimeMs);
  };

  const handleWorldMove = (x, y) => movePlayerTo(x, y);



  const handleTileDoubleClick = (tile) => {
    movePlayerTo(tile.x, tile.y);
  }

  const handleEnterSector = () => {
    const currentTile = map[playerPos.y][playerPos.x];
    if (currentTile.type === TILE_TYPES.OCEAN) {
      addToLog("Cannot land on Ocean without specialized equipment.");
      return;
    }

    // Generate Local Map
    const localData = generateInnerMap(currentTile);
    setInnerMapData(localData);
    setViewMode('SURFACE');
    addToLog(`Initiating Atmosphere Entry... landed at [${currentTile.x}, ${currentTile.y}]`);
  }

  const handleExitSector = () => {
    setViewMode('ORBIT');
    setInnerMapData(null);
    setConstructionTarget(null);
    addToLog("Launching to low orbit.");
  }

  const handleInnerTileClick = (x, y, tile) => {
    // Allow building on empty land or city blocks (redevelopment)
    if (tile.type !== 'empty' && tile.type !== 'city_block') {
      addToLog(`Cannot build on ${tile.type.replace('_', ' ')}.`);
      return;
    }
    if (tile.building) {
      addToLog(`Sector already occupied by ${tile.building.name}.`);
      return;
    }
    setConstructionTarget({ x, y });
  }

  const handleConstruct = (building) => {
    if (!constructionTarget || !innerMapData) return;

    // Deduct resources
    setPlayer(p => ({
      ...p,
      money: p.money - building.cost.money,
      materials: p.materials - building.cost.materials
    }));

    // Update map data (Local State Only for now)
    const newTiles = innerMapData.tiles.map((row, rY) =>
      row.map((tile, rX) => {
        if (rY === constructionTarget.y && rX === constructionTarget.x) {
          return { ...tile, building: building };
        }
        return tile;
      })
    );

    setInnerMapData(prev => ({ ...prev, tiles: newTiles }));
    setConstructionTarget(null);
    addToLog(`Construction Complete: ${building.name} at [${constructionTarget.x}, ${constructionTarget.y}]`);
  }

  if (gameState === 'start') {
    return <StartScreen onStart={() => setGameState('create')} />
  }
  if (gameState === 'create') {
    return <CharacterCreation onComplete={(data) => {
      // Simulate DB Save
      localStorage.setItem('terra_user', JSON.stringify(data))
      setPlayer(data);
      const newMap = generateWorldMap();
      setMap(newMap);
      addToLog("Global Satellites Interfaced. 500km Scan Complete.");
      setGameState('dashboard');
    }} />
  }

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="main-content">
        <Navbar player={player} onLogout={handleLogout} />
        <div className="content-viewport">

          {/* Main View Container */}
          <div className="view-container">

            {activeTab === 'world_map' && (
              <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ color: 'var(--accent-primary)' }}>
                    {viewMode === 'ORBIT' ? 'Global Orbit Scan' : 'Planetary Surface Link'}
                    {moving && <span style={{ fontSize: '0.8rem', color: 'var(--warning)' }}> (THRUSTERS ACTIVE...)</span>}
                  </h3>
                </div>

                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                  {viewMode === 'ORBIT' ? (
                    <>
                      <WorldMap
                        map={map}
                        playerPos={playerPos}
                        selectedTile={selectedTile}
                        onMove={handleWorldMove}
                        onTileClick={handleTileSelect}
                        onTileDoubleClick={handleTileDoubleClick}
                        onEnterSector={handleEnterSector}
                      />
                      <MapOverlay
                        selectedTile={selectedTile}
                        playerPos={playerPos}
                        onMove={handleWorldMove}
                        onManage={handleEnterManagement}
                        onEnter={handleEnterSector}
                        onClose={() => setSelectedTile(null)}
                      />
                      {/* Floating Minimap */}
                      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 100 }}>
                        <Minimap map={map} playerPos={playerPos} />
                      </div>
                    </>
                  ) : (
                    <>
                      <InnerMap
                        innerMapData={innerMapData}
                        onBack={handleExitSector}
                        onTileClick={handleInnerTileClick}
                      />
                      {constructionTarget && (
                        <ConstructionMenu
                          tile={constructionTarget}
                          onBuild={handleConstruct}
                          onCancel={() => setConstructionTarget(null)}
                          player={player}
                        />
                      )}
                    </>
                  )}
                </div>
                <LogPanel log={log} />
              </div>
            )}

            {activeTab === 'tile_detail' && (
              <ManagementPanel
                tile={selectedTile || (map ? map[playerPos.y][playerPos.x] : null)}
                onBack={() => setActiveTab('world_map')}
              />
            )}

            {activeTab === 'assets' && (
              <AssetsPanel player={player} />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel
                theme={theme}
                onThemeChange={handleThemeChange}
                onResetData={handleResetData}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
// Re-verified syntax structure
