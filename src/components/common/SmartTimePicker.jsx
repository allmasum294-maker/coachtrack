import React, { useState, useEffect } from 'react';
import { Clock, ChevronUp, ChevronDown, Check } from 'lucide-react';

const SmartTimePicker = ({ value, onChange, label }) => {
    // Value format expected: "HH:mm" (24h)
    const [h24, setH24] = useState(14);
    const [min, setMin] = useState(0);
    const [isPM, setIsPM] = useState(true);
    const [h12, setH12] = useState(2);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                setH24(h);
                setMin(m);
                setIsPM(h >= 12);
                setH12(h % 12 || 12);
            }
        }
    }, [value]);

    const handleHourSelect = (h) => {
        let newH24;
        // Smart Logic: 12, 1-8 -> PM, 9-11 -> AM
        let smartIsPM = isPM;
        if (h === 12 || (h >= 1 && h <= 8)) {
            smartIsPM = true;
        } else if (h >= 9 && h <= 11) {
            smartIsPM = false;
        }

        if (smartIsPM) {
            newH24 = h === 12 ? 12 : h + 12;
        } else {
            newH24 = h === 12 ? 0 : h;
        }

        setIsPM(smartIsPM);
        setH12(h);
        setH24(newH24);
        updateValue(newH24, min);
    };

    const handleMinSelect = (m) => {
        setMin(m);
        updateValue(h24, m);
    };

    const toggleAMPM = () => {
        const nextPM = !isPM;
        let newH24;
        if (nextPM) {
            newH24 = h12 === 12 ? 12 : h12 + 12;
        } else {
            newH24 = h12 === 12 ? 0 : h12;
        }
        setIsPM(nextPM);
        setH24(newH24);
        updateValue(newH24, min);
    };

    const updateValue = (h, m) => {
        const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        onChange(formatted);
    };

    const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const minutes = [0, 15, 30, 45];

    return (
        <div className="form-group" style={{ position: 'relative' }}>
            {label && <label className="form-label">{label}</label>}
            
            <div 
                className="form-input" 
                onClick={() => setIsOpen(!isOpen)}
                style={{ 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    height: '52px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: isOpen ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                    boxShadow: isOpen ? '0 0 0 3px var(--color-accent-soft)' : 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Clock size={18} className={isOpen ? "text-primary" : "text-muted"} />
                    <span style={{ fontWeight: 800, fontSize: '15px' }}>
                        {h12}:{min.toString().padStart(2, '0')} {isPM ? 'PM' : 'AM'}
                    </span>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {isOpen && (
                <>
                    <div 
                        style={{ position: 'fixed', inset: 0, zIndex: 100 }} 
                        onClick={() => setIsOpen(false)} 
                    />
                    <div className="glass-panel" style={{ 
                        position: 'absolute', 
                        top: 'calc(100% + 8px)', 
                        left: 0, 
                        right: 0, 
                        zIndex: 101, 
                        padding: '16px',
                        borderRadius: '20px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        animation: 'fadeIn 0.2s ease'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-primary)' }}>Select Time</span>
                            <div 
                                onClick={toggleAMPM}
                                style={{ 
                                    display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '2px', cursor: 'pointer' 
                                }}
                            >
                                <div style={{ 
                                    padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 900,
                                    background: !isPM ? 'var(--color-primary)' : 'transparent',
                                    color: !isPM ? 'white' : 'var(--color-text-muted)'
                                }}>AM</div>
                                <div style={{ 
                                    padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 900,
                                    background: isPM ? 'var(--color-primary)' : 'transparent',
                                    color: isPM ? 'white' : 'var(--color-text-muted)'
                                }}>PM</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                            {hours.map(h => (
                                <div 
                                    key={h}
                                    onClick={() => handleHourSelect(h)}
                                    style={{ 
                                        height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '14px', fontWeight: h12 === h ? 900 : 600, cursor: 'pointer',
                                        background: h12 === h ? 'var(--color-accent-soft)' : 'rgba(255,255,255,0.03)',
                                        color: h12 === h ? 'var(--color-accent)' : 'var(--color-text-primary)',
                                        border: h12 === h ? '1px solid var(--color-accent)' : '1px solid transparent'
                                    }}
                                >
                                    {h}
                                </div>
                            ))}
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', gap: '8px' }}>
                            {minutes.map(m => (
                                <div 
                                    key={m}
                                    onClick={() => handleMinSelect(m)}
                                    style={{ 
                                        flex: 1, height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '12px', fontWeight: min === m ? 900 : 600, cursor: 'pointer',
                                        background: min === m ? 'var(--color-primary)' : 'rgba(255,255,255,0.03)',
                                        color: min === m ? 'white' : 'var(--color-text-muted)',
                                    }}
                                >
                                    :{m.toString().padStart(2, '0')}
                                </div>
                            ))}
                            <div 
                                onClick={() => setIsOpen(false)}
                                style={{ 
                                    flex: 1, height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 900, cursor: 'pointer',
                                    background: 'var(--color-success)', color: 'white'
                                }}
                            >
                                <Check size={16} />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SmartTimePicker;
