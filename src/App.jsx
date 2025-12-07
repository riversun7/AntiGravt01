import { useState, useEffect, useRef } from 'react'
import WorldMap from './components/WorldMap'
import { generateInitialMap, TILE_TYPES, getMovementCost } from './data/worldData'
import './App.css'

function App() {
  const [gameState, setGameState] = useState('start')
  const [player, setPlayer] = useState(null)
  const [map, setMap] = useState(null)
  const [playerPos, setPlayerPos] = useState({ x: 9, y: 7 })
  const [log, setLog] = useState([])

  // UI State for Layout
  const [activeTab, setActiveTab] = useState('world_map'); // world_map, sector_view, city_view, market
  const [moving, setMoving] = useState(false);

  // Initial Setup
  useEffect(() => {
    if (gameState === 'dashboard' && !map) {
      setMap(generateInitialMap())
      addToLog("System Initialized. Planetary Scan Complete.")
    }
  }, [gameState]);

  // Auto-mining Tick (Global)
  useEffect(() => {
    if (gameState !== 'dashboard' || !map) return;
    const interval = setInterval(() => {
      setPlayer(prevPlayer => {
        if (!prevPlayer) return prevPlayer;
        let addedMaterials = 0;
        let addedEnergy = 0;
        map.forEach(row => row.forEach(tile => {
          if (tile.drones > 0) {
            if (tile.type === TILE_TYPES.RESOURCE_MINERAL) addedMaterials += (5 * tile.drones);
            if (tile.type === TILE_TYPES.RESOURCE_ENERGY) addedEnergy += (5 * tile.drones);
            if (tile.type === TILE_TYPES.FOREST) addedMaterials += (5 * tile.drones);
          }
        }));
        if (addedMaterials === 0 && addedEnergy === 0) return prevPlayer;
        // Cap Logic
        const maxMat = prevPlayer.maxMaterials || 100;
        return {
          ...prevPlayer,
          materials: Math.min(prevPlayer.materials + addedMaterials, maxMat),
          energy: prevPlayer.energy + addedEnergy
        };
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [gameState, map]);

  const addToLog = (msg) => {
    setLog(prev => [msg, ...prev].slice(0, 5))
  }

  const handleMove = (x, y) => {
    if (moving) return;
    const dist = Math.abs(playerPos.x - x) + Math.abs(playerPos.y - y)
    if (dist === 0 || dist > 1) return;

    const targetTile = map[y][x];
    const moveCost = getMovementCost(targetTile.type);

    if (player.energy < moveCost) {
      addToLog(`Insufficient Energy. Need ${moveCost} Energy.`); return;
    }

    setMoving(true);
    setTimeout(() => {
      setPlayer(p => ({ ...p, energy: p.energy - moveCost }))
      setPlayerPos({ x, y })
      setMoving(false);
      if (targetTile.type === TILE_TYPES.CITY) {
        addToLog(`Arrived at ${targetTile.data.name}.`)
        // Auto switch tab if wanted, but user might prefer staying on map
      }
    }, 200 * moveCost);
  }

  const handleInteract = (action) => {
    // Shared Interaction Logic
    const tile = map[playerPos.y][playerPos.x]

    if (action === 'gather') {
      if (tile.type === TILE_TYPES.RESOURCE_MINERAL || tile.type === TILE_TYPES.FOREST) {
        const amount = 10;
        const maxMat = player.maxMaterials || 100;
        if (player.materials >= maxMat) { addToLog("Storage Full."); return; }

        setPlayer(p => ({ ...p, materials: Math.min(p.materials + amount, maxMat), energy: p.energy - 2 }))
        addToLog(`Gathered ${amount} Materials.`)
      } else if (tile.type === TILE_TYPES.RESOURCE_ENERGY) {
        const amount = 10;
        setPlayer(p => ({ ...p, energy: p.energy + amount }))
        addToLog(`Harvested ${amount} Energy.`)
      } else {
        addToLog("No resources to gather manually.")
      }
    }
    else if (action === 'deploy_drone') {
      if (player.money < 100) { addToLog("Insufficient Credits (100 ₡)."); return; }
      if ([TILE_TYPES.RESOURCE_MINERAL, TILE_TYPES.RESOURCE_ENERGY, TILE_TYPES.FOREST].includes(tile.type)) {
        const newMap = [...map];
        const currentDrones = newMap[playerPos.y][playerPos.x].drones || 0;
        newMap[playerPos.y][playerPos.x] = { ...tile, drones: currentDrones + 1 };
        setMap(newMap);
        setPlayer(p => ({ ...p, money: p.money - 100 }));
        addToLog("Drone deployed. Auto-harvesting initiated.");
      } else { addToLog("Drones can only be deployed on Resource Sectors."); }
    }
    else if (action === 'build_warehouse') {
      if (tile.type !== TILE_TYPES.EMPTY) { addToLog("Sector not clear."); return; }
      if (player.money < 200) { addToLog("Insufficient Credits (200 ₡)."); return; }
      const newMap = [...map];
      newMap[playerPos.y][playerPos.x] = { ...tile, type: TILE_TYPES.FACILITY_WAREHOUSE };
      setMap(newMap);
      setPlayer(p => ({ ...p, money: p.money - 200, maxMaterials: (p.maxMaterials || 100) + 100 }));
      addToLog(`Warehouse constructed. Storage capacity increased.`);
    }
  }

  // --- RENDERERS ---

  if (gameState === 'start') {
    return <StartScreen onStart={() => setGameState('create')} />
  }
  if (gameState === 'create') {
    return <CharacterCreation onComplete={(data) => {
      setPlayer(data); setGameState('dashboard');
    }} />
  }

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="main-content">
        <Navbar player={player} />
        <div className="content-viewport">
          {/* Render Active View */}
          <div className="view-container">
            {activeTab === 'world_map' && (
              <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>
                  Global Sector Scan {moving && <span style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>(RELOCATING...)</span>}
                </h3>
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
                  <WorldMap map={map} playerPos={playerPos} onMove={handleMove} onInteract={handleInteract} />
                </div>
                <LogPanel log={log} />
              </div>
            )}

            {activeTab === 'sector_view' && (
              <SectorView map={map} playerPos={playerPos} onInteract={handleInteract} />
            )}

            {activeTab === 'city_view' && (
              <CityView map={map} playerPos={playerPos} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- SUB COMPONENTS ---

function Sidebar({ activeTab, onTabChange }) {
  return (
    <div className="sidebar">
      <div className="brand-title">TERRA<br />IN-COGNITA</div>
      <div className="nav-menu">
        <div className={`nav-item ${activeTab === 'world_map' ? 'active' : ''}`} onClick={() => onTabChange('world_map')}>
          <span>🌍</span> World Map
        </div>
        <div className={`nav-item ${activeTab === 'sector_view' ? 'active' : ''}`} onClick={() => onTabChange('sector_view')}>
          <span>🔭</span> Sector Detail
        </div>
        <div className={`nav-item ${activeTab === 'city_view' ? 'active' : ''}`} onClick={() => onTabChange('city_view')}>
          <span>🏙️</span> City / Base
        </div>
        <div className="nav-item">
          <span>⚙️</span> Settings
        </div>
      </div>
    </div>
  )
}

function Navbar({ player }) {
  if (!player) return <div className="navbar"></div>
  return (
    <div className="navbar">
      <div style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>
        OPERATOR: <span style={{ color: 'var(--accent-primary)' }}>{player.name}</span>
      </div>
      <div className="resource-bar">
        <div className="res-item"><span className="icon">💳</span> <span style={{ color: 'var(--warning)' }}>{player.money.toLocaleString()}</span></div>
        <div className="res-item"><span className="icon">⚡</span> <span style={{ color: 'var(--success)' }}>{player.energy}</span></div>
        <div className="res-item"><span className="icon">📦</span> <span>{player.materials} / {player.maxMaterials || 100}</span></div>
      </div>
    </div>
  )
}

function StartScreen({ onStart }) {
  return (
    <div className="screen-container">
      <h1 className="title-large">Terra In-cognita</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--accent-primary)', letterSpacing: '1px' }}>
        MULTI-LANGUAGE SYSTEM: ONLINE
      </p>
      <button className="btn-primary" onClick={onStart}>Initialize System</button>
    </div>
  )
}

function CharacterCreation({ onComplete }) {
  const [name, setName] = useState('')
  return (
    <div className="screen-container">
      <h2>Identify Yourself</h2>
      <div className="card" style={{ padding: '2rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '300px' }}>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          Species: <strong style={{ color: 'var(--accent-primary)' }}>Cyborg</strong> (Hybrid)
        </p>
        <input className="input-field" placeholder="Enter Cyborg ID" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn-primary" onClick={() => name.trim() && onComplete({ name, type: 'Cyborg', money: 1000, energy: 500, materials: 50, maxMaterials: 100 })}>
          Confirm Identity
        </button>
      </div>
    </div>
  )
}

function LogPanel({ log }) {
  return (
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto' }}>
      {log.map((entry, i) => (
        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginBottom: '0.2rem' }}>{`> ${entry}`}</div>
      ))}
    </div>
  )
}

function SectorView({ map, playerPos, onInteract }) {
  if (!map) return null;
  const tile = map[playerPos.y][playerPos.x];

  return (
    <div className="sector-detail">
      <h2 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
        Sector Analysis [{playerPos.x}, {playerPos.y}]
      </h2>
      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '5rem', textAlign: 'center', padding: '2rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            {tile.type === TILE_TYPES.CITY ? '🏙️' :
              tile.type === TILE_TYPES.RESOURCE_MINERAL ? '💎' :
                tile.type === TILE_TYPES.RESOURCE_ENERGY ? '⚡' :
                  tile.type === TILE_TYPES.OCEAN ? '🌊' : '⬜'}
          </div>
        </div>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><strong>Type:</strong> <span style={{ color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{tile.type}</span></div>
          <div><strong>Condition:</strong> Stable</div>
          {tile.drones > 0 && <div style={{ color: 'var(--success)' }}>Automated Drones Active: {tile.drones}</div>}

          <div className="divider" style={{ width: '100%', height: '1px' }}></div>

          <h4>Available Protocols</h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button className="btn-small" onClick={() => onInteract('gather')}>Manual Extraction</button>
            <button className="btn-small build-btn" onClick={() => onInteract('deploy_drone')}>Deploy Drone (100₡)</button>
            <button className="btn-small build-btn" onClick={() => onInteract('build_warehouse')}>Construct Warehouse (200₡)</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CityView({ map, playerPos }) {
  if (!map) return null;
  const tile = map[playerPos.y][playerPos.x];

  if (tile.type !== TILE_TYPES.CITY) {
    return (
      <div className="sector-detail" style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>NO SIGNAL</h2>
        <p style={{ color: 'var(--text-secondary)' }}>There is no city established in this sector.</p>
      </div>
    )
  }

  return (
    <div className="sector-detail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--accent-primary)', paddingBottom: '1rem' }}>
        <h1>{tile.data.name}</h1>
        <span style={{ fontSize: '0.8rem', background: 'var(--accent-primary)', color: 'black', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
          TYPE: {tile.data.type}
        </span>
      </div>

      <div style={{ padding: '2rem 0' }}>
        <p style={{ fontSize: '1.2rem', fontStyle: 'italic', color: 'var(--text-primary)' }}>"{tile.data.desc}"</p>
        <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="card">
            <h4>Population</h4>
            <div className="stat-value">{tile.data.population.toLocaleString()}</div>
          </div>
          <div className="card">
            <h4>Tax Rate</h4>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>15%</div>
          </div>
        </div>

        <h3 style={{ marginTop: '2rem' }}>District Services</h3>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn-small">Marketplace</button>
          <button className="btn-small">Job Board</button>
          <button className="btn-small">Governemnt Office</button>
        </div>
      </div>
    </div>
  )
}

export default App
