import { useState, useEffect } from 'react';

function SaveSlotMenu({ onSelectSlot }) {
    const [slots, setSlots] = useState([
        { id: 1, empty: true },
        { id: 2, empty: true },
        { id: 3, empty: true }
    ]);

    // Load slots metadata
    useEffect(() => {
        const loadedSlots = [1, 2, 3].map(id => {
            const data = localStorage.getItem(`terra_save_${id}`);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    return { id, empty: false, name: parsed.name, money: parsed.money, day: parsed.day || 1 };
                } catch (e) {
                    return { id, empty: true };
                }
            }
            return { id, empty: true };
        });
        setSlots(loadedSlots);
    }, []);

    const handleSlotClick = (slot) => {
        onSelectSlot(slot.id, slot.empty);
    };

    const handleDelete = (e, id) => { // eslint-disable-line no-unused-vars
        e.stopPropagation();
        if (window.confirm("Delete this save file?")) {
            localStorage.removeItem(`terra_save_${id}`);
            setSlots(prev => prev.map(s => s.id === id ? { id, empty: true } : s));
        }
    };

    return (
        <div className="screen-container">
            <h1 className="title-large">TERRA IN-COGNITA</h1>
            <div className="slot-container" style={{ display: 'flex', gap: '2rem', marginTop: '3rem' }}>
                {slots.map(slot => (
                    <div
                        key={slot.id}
                        className="card slot-card"
                        onClick={() => handleSlotClick(slot)}
                        style={{
                            width: '250px',
                            height: '350px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            border: '1px solid var(--accent-primary)',
                            background: 'rgba(0,0,0,0.6)',
                            transition: 'all 0.3s',
                            position: 'relative'
                        }}
                    >
                        <div style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>SLOT {slot.id}</div>

                        {slot.empty ? (
                            <div style={{ color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>+</div>
                                <div>NEW GAME</div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', width: '100%' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{slot.name}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>Credits: ${slot.money}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>Day: {slot.day}</div>

                                <button
                                    className="btn-danger"
                                    onClick={(e) => handleDelete(e, slot.id)}
                                    style={{
                                        marginTop: '2rem',
                                        background: 'transparent',
                                        border: '1px solid var(--danger)',
                                        color: 'var(--danger)',
                                        padding: '0.5rem 1rem',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    DELETE
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div style={{ marginTop: '2rem', color: 'var(--text-secondary)' }}>Select a slot to engage neural link</div>
        </div>
    );
}

export default SaveSlotMenu;
