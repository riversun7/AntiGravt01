
import { useState, useEffect } from 'react'
import './App.css'
import WorldMap from './components/WorldMap'
import InnerMap from './components/InnerMap'
import Minimap from './components/Minimap'
import MapOverlay from './components/MapOverlay'
import WorldMapPanel from './components/WorldMapPanel'
import SettingsPanel from './components/SettingsPanel'
import ConstructionMenu from './components/ConstructionMenu'
import AssetsPanel from './components/AssetsPanel'
import ManagementPanel from './components/ManagementPanel'
import ResearchPanel from './components/ResearchPanel'
import SaveSlotMenu from './components/SaveSlotMenu'
import { TILE_TYPES } from './data/worldData'
import { MapService } from './services/mapService'
import { useGame } from './context/GameContext'
import { useTranslation } from './i18n/i18n'
import GlobalMap from './components/GlobalMap'
import TerrainMap from './components/TerrainMap'

function App() {
  const {
    gameState, player, map, innerMap, playerPos, log,
    login, loadGame, saveGame, logout,
    setInnerMap, setPlayer, addToLog, t
  } = useGame();

  // Slot Selection State
  const [showNameInput, setShowNameInput] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [tempName, setTempName] = useState('');

  // View State
  const [activeTab, setActiveTab] = useState('world_map');
  const [viewMode, setViewMode] = useState('ORBIT');

  const [innerMapData, setInnerMapData] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('terra_theme') || 'cyber';
  });

  const [moving, setMoving] = useState(false)
  const [constructionTarget, setConstructionTarget] = useState(null)
  const [selectedTile, setSelectedTile] = useState(null)

  // Theme Management
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
      logout(); // Use context logout
      localStorage.removeItem('terra_theme');
      location.reload();
    }
  };

  // World Map Movement
  const movePlayerTo = (targetX, targetY) => {
    if (moving || !map) return;
    if (playerPos.x === targetX && playerPos.y === targetY) return;

    // Simple Manhattan distance
    const distX = Math.abs(playerPos.x - targetX);
    const distY = Math.abs(playerPos.y - targetY);
    const totalDist = distX + distY;

    const targetTile = map[targetY][targetX];
    const terrainCost = MapService.getMovementCost(targetTile.type);
    const totalEnergyCost = Math.floor(totalDist * terrainCost);

    if (player.energy < totalEnergyCost) {
      addToLog(`Insufficient Energy. Need ${totalEnergyCost} for this trajectory.`);
      return;
    }

    setMoving(true);

    // Calculate path (simple orthogonal path: Move X first, then Y)
    const path = [];
    let currentX = playerPos.x;
    let currentY = playerPos.y;

    while (currentX !== targetX) {
      currentX += (targetX > currentX ? 1 : -1);
      path.push({ x: currentX, y: currentY });
    }
    while (currentY !== targetY) {
      currentY += (targetY > currentY ? 1 : -1);
      path.push({ x: targetX, y: currentY });
    }

    // Step Duration based on terrain (speed)
    // Faster movement for better UX, but still visual
    const stepDuration = 50 * terrainCost; // 50ms base * terrain penalty

    let stepIndex = 0;
    const energyPerStep = totalEnergyCost / path.length;

    addToLog(`Thrusters engaged. Calculating trajectory...`);

    const moveInterval = setInterval(() => {
      if (stepIndex >= path.length) {
        clearInterval(moveInterval);
        setMoving(false);
        setPlayerPos({ x: targetX, y: targetY }); // Ensure final pos matches

        if (map[targetY][targetX].type === TILE_TYPES.CITY) {
          addToLog(`Arrived at ${map[targetY][targetX].data.name}. Orbit established.`);
        } else {
          addToLog(`Arrival confirmed at [${targetX}, ${targetY}].`);
        }
        return;
      }

      const nextPos = path[stepIndex];
      setPlayerPos(nextPos);
      setPlayer(p => ({ ...p, energy: Math.max(0, p.energy - energyPerStep) }));
      stepIndex++;
    }, stepDuration);
  };

  const handleWorldMove = (x, y) => movePlayerTo(x, y);

  const handleTileDoubleClick = (tile) => {
    if (tile.x === playerPos.x && tile.y === playerPos.y) {
      handleEnterSector();
    } else {
      movePlayerTo(tile.x, tile.y);
    }
  }

  const handleEnterSector = () => {
    const currentTile = map[playerPos.y][playerPos.x];
    if (currentTile.type === TILE_TYPES.OCEAN) {
      addToLog("Cannot land on Ocean without specialized equipment.");
      return;
    }

    // Generate Local Map
    const localData = MapService.generateInnerMap(currentTile);
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

    setPlayer(p => ({
      ...p,
      money: p.money - building.cost.money,
      materials: p.materials - building.cost.materials,
      buildings: [...(p.buildings || []), building] // Add to economy
    }));

    // Local Map Data update (Still local for now, effectively "Session" state for inner map)
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

  const handleTileSelect = (tile) => {
    setSelectedTile(tile);
  }

  const handleEnterManagement = () => {
    setActiveTab('tile_detail');
  }

  // --- Render ---
  if (gameState === 'init') {
    return (
      <>
        {showNameInput ? (
          <div className="screen-container">
            <h2 className="title-large">IDENTIFY</h2>
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p>Enter Commander Name for Slot {selectedSlot}</p>
              <input
                autoFocus
                className="input-field"
                placeholder="Commander Name"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tempName.trim()) {
                    login(tempName, selectedSlot);
                  }
                }}
              />
              <button
                className="btn-primary"
                onClick={() => {
                  if (tempName.trim()) login(tempName, selectedSlot);
                }}
              >
                INITIALIZE
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowNameInput(false)}
                style={{ marginTop: '1rem' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <SaveSlotMenu onSelectSlot={(slotId, isEmpty) => {
            if (isEmpty) {
              setSelectedSlot(slotId);
              setShowNameInput(true);
            } else {
              loadGame(slotId);
            }
          }} />
        )}
      </>
    );
  }

  // Fallback for safety
  if (!player) return <div className="screen-container">Loading Neural Interface...</div>

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="main-content">
        <Navbar player={player} onLogout={logout} />
        <div className="content-viewport">

          <div className="view-container">

            {activeTab === 'world_map' && (
              <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ color: 'var(--accent-primary)' }}>
                    {viewMode === 'ORBIT' ? t('mode.orbit') : t('mode.surface')}
                    {moving && <span style={{ fontSize: '0.8rem', color: 'var(--warning)' }}> ({t('msg.thrusters')})</span>}
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

            {activeTab === 'research' && (
              <ResearchPanel />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel
                theme={theme}
                onThemeChange={handleThemeChange}
                onResetData={handleResetData}
              />
            )}

            {activeTab === 'global_map' && (
              <GlobalMap />
            )}

            {activeTab === 'terrain_map' && (
              <TerrainMap />
            )}

            {activeTab === 'globe_projection' && (
              <WorldMapPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ activeTab, onTabChange }) {
  const { t } = useTranslation();
  return (
    <div className="sidebar">
      <div className="brand-title">TERRA<br />IN-COGNITA</div>
      <div className="nav-menu">
        <div className={`nav-item ${activeTab === 'world_map' ? 'active' : ''}`} onClick={() => onTabChange('world_map')}>
          <span>🌍</span> {t('nav.world_map')}
        </div>
        <div className={`nav-item ${activeTab === 'global_map' ? 'active' : ''}`} onClick={() => onTabChange('global_map')}>
          <span>🗺️</span> Global Map
        </div>
        <div className={`nav-item ${activeTab === 'terrain_map' ? 'active' : ''}`} onClick={() => onTabChange('terrain_map')}>
          <span>🏔️</span> Terrain Map
        </div>
        <div className={`nav-item ${activeTab === 'tile_detail' ? 'active' : ''}`} onClick={() => onTabChange('tile_detail')}>
          <span>🏗️</span> {t('nav.tile_detail')}
        </div>
        <div className={`nav-item ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => onTabChange('assets')}>
          <span>📦</span> {t('nav.assets')}
        </div>
        <div className={`nav-item ${activeTab === 'research' ? 'active' : ''}`} onClick={() => onTabChange('research')}>
          <span>🧬</span> Research
        </div>
        <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => onTabChange('settings')}>
          <span>⚙️</span> {t('nav.settings')}
        </div>
        <div className={`nav-item ${activeTab === 'globe_projection' ? 'active' : ''}`} onClick={() => onTabChange('globe_projection')}>
          <span>🌐</span> World Map
        </div>
      </div>
    </div>
  )
}

function Navbar({ player, onLogout }) {
  if (!player) return <div className="navbar"></div>
  return (
    <div className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>
          CMD: <span style={{ color: 'var(--accent-primary)' }}>{player.name}</span>
        </div>
        <button className="btn-small" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={onLogout}>
          Logout
        </button>
      </div>
      <div className="resource-bar">
        <div className="res-item"><span className="icon">💳</span> <span style={{ color: 'var(--warning)' }}>{player.money.toLocaleString()}</span></div>
        <div className="res-item"><span className="icon">⚡</span> <span style={{ color: 'var(--success)' }}>{player.energy}</span></div>
        <div className="res-item"><span className="icon">📦</span> <span>{player.materials}</span></div>
        <div className="res-item" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem', marginLeft: '0.5rem' }}>
          <span className="icon">🛡️</span>
          <span style={{ color: 'var(--accent-primary)' }}>{player.defenseLevel || 0}</span>
          <span style={{ margin: '0 0.5rem', color: 'var(--text-secondary)' }}>/</span>
          <span className="icon">⚠️</span>
          <span style={{ color: (player.threatLevel || 0) > 80 ? 'var(--danger)' : 'var(--text-secondary)' }}>
            {Math.floor(player.threatLevel || 0)}%
          </span>
        </div>
      </div>
    </div>
  )
}

function LogPanel({ log }) {
  return (
    <div className="log-panel-container" style={{ marginTop: 'auto', maxHeight: '150px', overflowY: 'auto' }}>
      {log.map((entry, i) => (
        <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
          <span style={{ color: 'var(--accent-primary)', marginRight: '8px' }}>&gt;</span>
          {entry}
        </div>
      ))}
    </div>
  )
}

export default App
