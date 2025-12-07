import { useState, useEffect, useRef } from 'react'
import WorldMap from './components/WorldMap'
import InnerMap from './components/InnerMap'
import Minimap from './components/Minimap'
import { generateWorldMap, generateInnerMap, TILE_TYPES, getMovementCost } from './data/worldData'
import './App.css'

function App() {
  const [gameState, setGameState] = useState('start')
  const [player, setPlayer] = useState(null)

  // Global Map State
  const [map, setMap] = useState(null)
  const [playerPos, setPlayerPos] = useState({ x: 250, y: 250 }) // Center of large map

  // View State
  const [activeTab, setActiveTab] = useState('world_map'); // world_map, territory, lab, exchange, settings
  const [viewMode, setViewMode] = useState('ORBIT'); // ORBIT (World), SURFACE (Inner)
  const [innerMapData, setInnerMapData] = useState(null);

  const [log, setLog] = useState([])
  const [moving, setMoving] = useState(false)

  // Initial World Gen
  useEffect(() => {
    if (gameState === 'dashboard' && !map) {
      console.log("Generating World...");
      const newMap = generateWorldMap();
      setMap(newMap);
      addToLog("Global Satellites Interfaced. 500km Scan Complete.");
    }
  }, [gameState]);

  const addToLog = (msg) => {
    setLog(prev => [msg, ...prev].slice(0, 5))
  }

  // World Map Movement
  const handleWorldMove = (x, y) => {
    if (moving) return;
    if (!map) return;

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
        addToLog(`Orbiting ${targetTile.data.name}. Ready for descent.`);
      }
    }, 150 * moveCost);
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
    addToLog("Launching to low orbit.");
  }

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
                        onMove={handleWorldMove}
                        onEnterSector={handleEnterSector}
                      />
                      {/* Floating Minimap */}
                      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 100 }}>
                        <Minimap map={map} playerPos={playerPos} />
                      </div>
                    </>
                  ) : (
                    <InnerMap
                      innerMapData={innerMapData}
                      onBack={handleExitSector}
                    />
                  )}
                </div>
                <LogPanel log={log} />
              </div>
            )}

            {activeTab === 'territory' && (
              <div className="sector-detail">
                <h2>Territory Management</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Manage your claimed sectors and colonies here.</p>
              </div>
            )}

            {activeTab === 'lab' && (
              <div className="sector-detail">
                <h2>Research Laboratory</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Develop new technologies and upgrade your cyborg.</p>
              </div>
            )}

            {activeTab === 'exchange' && (
              <div className="sector-detail">
                <h2>Galactic Exchange</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Trade resources with major factions.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ activeTab, onTabChange }) {
  return (
    <div className="sidebar">
      <div className="brand-title">TERRA<br />IN-COGNITA</div>
      <div className="nav-menu">
        <div className={`nav-item ${activeTab === 'world_map' ? 'active' : ''}`} onClick={() => onTabChange('world_map')}>
          <span>🌍</span> Navigation
        </div>
        <div className={`nav-item ${activeTab === 'territory' ? 'active' : ''}`} onClick={() => onTabChange('territory')}>
          <span>🚩</span> My Territory
        </div>
        <div className={`nav-item ${activeTab === 'lab' ? 'active' : ''}`} onClick={() => onTabChange('lab')}>
          <span>🧬</span> Research Lab
        </div>
        <div className={`nav-item ${activeTab === 'exchange' ? 'active' : ''}`} onClick={() => onTabChange('exchange')}>
          <span>💳</span> Exchange
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
        CMD: <span style={{ color: 'var(--accent-primary)' }}>{player.name}</span>
      </div>
      <div className="resource-bar">
        <div className="res-item"><span className="icon">💳</span> <span style={{ color: 'var(--warning)' }}>{player.money.toLocaleString()}</span></div>
        <div className="res-item"><span className="icon">⚡</span> <span style={{ color: 'var(--success)' }}>{player.energy}</span></div>
        <div className="res-item"><span className="icon">📦</span> <span>{player.materials}</span></div>
      </div>
    </div>
  )
}

function StartScreen({ onStart }) {
  return (
    <div className="screen-container">
      <h1 className="title-large">Terra In-cognita</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--accent-primary)', letterSpacing: '1px' }}>
        HYPER-SCALE SIMULATION
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
          Species: <strong style={{ color: 'var(--accent-primary)' }}>Cyborg</strong> (Class A)
        </p>
        <input className="input-field" placeholder="Enter ID" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn-primary" onClick={() => name.trim() && onComplete({ name, type: 'Cyborg', money: 1000, energy: 500, materials: 50 })}>
          Confirm
        </button>
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
