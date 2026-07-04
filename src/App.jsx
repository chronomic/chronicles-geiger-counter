import React, { useState, useRef, useEffect } from 'react';
import { Geiger } from 'react-geiger';

// Radioisotopes specifications
const ISOTOPES = [
  { id: 'u235', name: 'Uranium-235', symbol: 'U-235', danger: 'Medium', color: '#00ff66', decayTime: 180, speedSens: 4.5, cpmMultiplier: 10000, baseCpm: 120, maxSv: 48.5, label: 'Classic Geiger click rate with standard decay curve.' },
  { id: 'ra226', name: 'Radium-226', symbol: 'Ra-226', danger: 'High', color: '#ffdd00', decayTime: 250, speedSens: 3.5, cpmMultiplier: 18000, baseCpm: 450, maxSv: 92.4, label: 'Volatile isotope. Higher click frequency and longer decay time.' },
  { id: 'pu239', name: 'Plutonium-239', symbol: 'Pu-239', danger: 'CRITICAL', color: '#ff3300', decayTime: 100, speedSens: 2.5, cpmMultiplier: 35000, baseCpm: 900, maxSv: 220.0, label: 'Extremely hazardous. Spikes instantly to near-meltdown speed.' },
  { id: 'k40', name: 'Potassium-40', symbol: 'K-40', danger: 'Minimal', color: '#00ccff', decayTime: 350, speedSens: 8.0, cpmMultiplier: 150, baseCpm: 12, maxSv: 0.9, label: 'Banana radiation. Extremely lazy, sparse click events.' }
];

export default function App() {
  // Config states
  const [isotopeId, setIsotopeId] = useState('u235');
  const [isStartingUp, setIsStartingUp] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [particleDensity, setParticleDensity] = useState('medium');
  const [enableCRT, setEnableCRT] = useState(true);
  const [enableScreenShake, setEnableScreenShake] = useState(true);
  
  // Interactive states
  const [intensity, setIntensity] = useState(0); 
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [_manualPulse, setManualPulse] = useState(0); // Driven to trigger re-renders
  const [activeParticles, setActiveParticles] = useState(0);

  // Diagnostic Logs
  const [logs, setLogs] = useState([
    `[${new Date().toLocaleTimeString()}] CORE CONTROL MONITOR ONLINE`,
    `[${new Date().toLocaleTimeString()}] DETECTOR TUBE LND-712 CALIBRATED`,
    `[${new Date().toLocaleTimeString()}] ISOTOPE CORES LOADED. CURRENT MODERATOR: CARBON GRID`,
    `[${new Date().toLocaleTimeString()}] STANDBY MODE. BOMBARD THE CORE REACTOR CHAMBER TO TRIGGER Renders.`
  ]);

  const selectedIsotope = ISOTOPES.find(iso => iso.id === isotopeId) || ISOTOPES[0];

  const cardRef = useRef(null);
  const canvasRef = useRef(null);
  const oscilloscopeRef = useRef(null);
  const particlesRef = useRef([]);
  const waveHistoryRef = useRef(new Array(80).fill(0));
  const renderCountRef = useRef(0);
  const lastMove = useRef({ time: Date.now(), x: 0, y: 0 });
  const timeoutRef = useRef(null);

  // Keep track of renders
  renderCountRef.current += 1;

  // Add a log entry
  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${time}] ${msg}`].slice(-15)); // Keep last 15 items
  };

  // TV Startup Animation
  useEffect(() => {
    const timer = setTimeout(() => setIsStartingUp(false), 2200); // CRT sequence duration
    return () => clearTimeout(timer);
  }, []);

  // Sync volume state with main.jsx globals
  useEffect(() => {
    window.geigerUserVolume = volume;
    window.geigerMuted = isMuted;
    if (window.updateGeigerVolumes) {
      window.updateGeigerVolumes(intensity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, isMuted]);

  // Log Isotope change
  useEffect(() => {
    addLog(`ISOTOPE MODULE LOADED: ${selectedIsotope.name} (${selectedIsotope.symbol}) [Danger: ${selectedIsotope.danger}]`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isotopeId]);

  // Push new intensity values onto the Oscilloscope history scroll
  useEffect(() => {
    const interval = setInterval(() => {
      waveHistoryRef.current.push(intensity);
      waveHistoryRef.current.shift();
    }, 45); // ~22fps scrolling wave
    return () => clearInterval(interval);
  }, [intensity]);

  // Handle cursor moving inside reactor chamber
  const handleMouseMove = (event) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const now = Date.now();
    
    // Speed in pixels per millisecond
    const dt = now - lastMove.current.time || 1; 
    const dx = event.clientX - lastMove.current.x;
    const dy = event.clientY - lastMove.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = dist / dt; 

    // Normalize speed according to loaded isotope sensitivity
    const newIntensity = Math.min(speed / selectedIsotope.speedSens, 1); 

    setIntensity(newIntensity);
    
    // Push updates to Geiger sound handler
    if (window.updateGeigerVolumes) {
      window.updateGeigerVolumes(newIntensity);
    }
    
    lastMove.current = { time: now, x: event.clientX, y: event.clientY };
    
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    setPosition({ x: mouseX, y: mouseY });

    // Emit radioactive particles
    const canvas = canvasRef.current;
    if (canvas) {
      const densityMax = particleDensity === 'high' ? 8 : particleDensity === 'medium' ? 4 : 2;
      const count = Math.max(1, Math.round(newIntensity * densityMax));
      
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = (Math.random() * 2 + 0.5) * (1 + newIntensity * 4);
        particlesRef.current.push({
          x: mouseX,
          y: mouseY,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          size: Math.random() * 5 + 1.5 + newIntensity * 6,
          color: newIntensity > 0.85 ? '#ff0033' : newIntensity > 0.5 ? '#ff6600' : newIntensity > 0.2 ? '#ffdd00' : selectedIsotope.color,
          life: 1.0,
          decay: 0.015 + Math.random() * 0.025
        });
      }
    }

    // Log high radiation levels
    if (newIntensity > 0.85 && Math.random() < 0.15) {
      addLog(`⚠️ WARNING: CORE RADIATION FLUX REACHED DANGEROUS LEVEL (${Math.round(newIntensity * 100)}%)`);
    }

    // Decay core intensity when cursor stops moving
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIntensity(0);
      if (window.updateGeigerVolumes) {
        window.updateGeigerVolumes(0);
      }
    }, selectedIsotope.decayTime);
  };

  // Trigger Renders Programmatically
  const triggerManualRenders = (count) => {
    addLog(`MANUAL IONIZATION PULSE: EMITTING ${count} PARTICLES TO INSTIGATE CORE Renders...`);
    let i = 0;
    const interval = setInterval(() => {
      // Modifies state to force re-render, playing Geiger clicks
      setManualPulse(prev => prev + 1);
      
      // Simulate erratic mouse positioning to spawn particles
      const canvas = canvasRef.current;
      const pulseIntensity = Math.random() * 0.5 + 0.2;
      setIntensity(pulseIntensity);
      
      if (window.updateGeigerVolumes) {
        window.updateGeigerVolumes(pulseIntensity);
      }

      if (canvas) {
        const rx = Math.random() * canvas.width;
        const ry = Math.random() * canvas.height;
        setPosition({ x: rx, y: ry });
        
        for (let j = 0; j < 5; j++) {
          const angle = Math.random() * Math.PI * 2;
          particlesRef.current.push({
            x: rx, y: ry,
            vx: Math.cos(angle) * (Math.random() * 3 + 1),
            vy: Math.sin(angle) * (Math.random() * 3 + 1),
            size: Math.random() * 6 + 2,
            color: selectedIsotope.color,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.02
          });
        }
      }

      i++;
      if (i >= count) {
        clearInterval(interval);
        setTimeout(() => {
          setIntensity(0);
          if (window.updateGeigerVolumes) window.updateGeigerVolumes(0);
        }, selectedIsotope.decayTime);
      }
    }, 12);
  };

  // Run uncontrolled core reaction
  const triggerMeltdownTest = () => {
    addLog("🚨 CRITICAL CORE TRIGGER LOADED: INITIATING FULL THERMAL RUNAWAY MELTDOWN STATE!");
    let i = 0;
    const interval = setInterval(() => {
      setManualPulse(prev => prev + 1);
      setIntensity(1.0);
      
      if (window.updateGeigerVolumes) {
        window.updateGeigerVolumes(1.0);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        // Spawn massive random particles
        const rx = Math.random() * canvas.width;
        const ry = Math.random() * canvas.height;
        setPosition({ x: rx, y: ry });
        
        for (let j = 0; j < 8; j++) {
          const angle = Math.random() * Math.PI * 2;
          particlesRef.current.push({
            x: rx, y: ry,
            vx: Math.cos(angle) * (Math.random() * 7 + 2),
            vy: Math.sin(angle) * (Math.random() * 7 + 2),
            size: Math.random() * 8 + 3,
            color: Math.random() > 0.5 ? '#ff0033' : '#ff6600',
            life: 1.0,
            decay: 0.01 + Math.random() * 0.02
          });
        }
      }

      i++;
      if (i >= 120) { // ~1.5s of absolute noise
        clearInterval(interval);
        addLog("✅ EMERGENCY MODERATOR SHIELD DEPLOYED. CORE STABILIZED.");
        setIntensity(0);
        if (window.updateGeigerVolumes) window.updateGeigerVolumes(0);
      }
    }, 12);
  };

  // Canvas Particle Animation Engine
  useEffect(() => {
    let animFrame;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || 600;
      canvas.height = rect.height || 450;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const updateLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid coordinates in background
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.04)';
      ctx.lineWidth = 1;
      const gridSpacing = 40;
      for (let x = 0; x < canvas.width; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Draw particle count indicator overlay
      const particles = particlesRef.current;
      setActiveParticles(particles.length);

      // Render and update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        p.size *= 0.97; // Gradually shrink

        if (p.life <= 0 || p.size <= 0.3) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.shadowBlur = 8 + intensity * 15;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animFrame = requestAnimationFrame(updateLoop);
    };

    updateLoop();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, [particleDensity, intensity, isotopeId]);

  // Oscilloscope drawing logic
  useEffect(() => {
    let animFrame;
    const canvas = oscilloscopeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement.clientWidth || 300;
      canvas.height = canvas.parentElement.clientHeight || 120;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const drawOscilloscope = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;

      // Draw grid
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 25) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Draw waveform
      const history = waveHistoryRef.current;
      ctx.strokeStyle = selectedIsotope.color;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = selectedIsotope.color;
      ctx.beginPath();

      for (let i = 0; i < history.length; i++) {
        const xPos = (i / (history.length - 1)) * w;
        const val = history[i];
        
        // Add electrical jitter based on intensity
        let yOffset = 0;
        if (val > 0.02) {
          const freq = 12 + val * 45;
          const amp = val * (h / 2.5);
          yOffset = Math.sin((i / 4) * freq + Date.now() / 45) * amp;
        }

        const yPos = (h / 2) + yOffset;

        if (i === 0) {
          ctx.moveTo(xPos, yPos);
        } else {
          ctx.lineTo(xPos, yPos);
        }
      }
      ctx.stroke();
      animFrame = requestAnimationFrame(drawOscilloscope);
    };

    drawOscilloscope();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedIsotope.color]);

  // Core warning status values
  const currentCpm = Math.round(intensity * selectedIsotope.cpmMultiplier + (selectedIsotope.baseCpm || 20) * (1 + Math.random() * 0.15));
  const currentSv = parseFloat((intensity * selectedIsotope.maxSv + 0.12 + Math.random() * 0.03).toFixed(2));
  const coreTemp = Math.round(300 + intensity * 950 + Math.random() * 5);
  
  let coreStatus = 'SAFE';
  let panelClass = 'active';
  let textClass = 'glow-text-green';
  let ledClass = 'led-green';
  
  if (intensity > 0.8) {
    coreStatus = 'CRITICAL MELTDOWN';
    panelClass = 'critical-red';
    textClass = 'glow-text-red';
    ledClass = 'led-red';
  } else if (intensity > 0.5) {
    coreStatus = 'HIGH RADIATION';
    panelClass = 'hazard-orange';
    textClass = 'glow-text-orange';
    ledClass = 'led-orange';
  } else if (intensity > 0.15) {
    coreStatus = 'ELEVATED DECAY';
    panelClass = 'warning-yellow';
    textClass = 'glow-text-yellow';
    ledClass = 'led-yellow';
  }

  // Scroll logs container internally to bottom on change
  const logsContainerRef = useRef(null);
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Geiger renderTimeThreshold={0} customSound="/sounds/Geiger-shot-single.mp3">
      
      {isStartingUp && <div className="crt-startup-overlay" />}

      {/* Root Layout with CRT and screen shake */}
      <div className={`crt-container ${enableCRT ? 'crt-screen crt-flicker' : ''} ${enableScreenShake && intensity > 0.75 ? 'screen-shake' : ''}`}>
        
        {/* CRT Scanline Noise Layer */}
        {enableCRT && <div className="crt-noise" />}
        
        {/* Reactor Meltdown Alarm Flash BG overlay */}
        <div className={`dashboard-container select-none ${intensity > 0.75 ? 'alarm-flash-bg' : ''}`}>
          
          {/* HEADER CONSOLE BAR */}
          <header className="cyber-panel dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="flex-row-center">
              <span className="text-2xl">☢️</span>
              <div>
                <h1 className="text-lg font-bold tracking-widest glow-text-green m-0">
                  GEIGER PERFORMANCE REACTOR TERMINAL v4.2
                </h1>
                <p className="text-[10px] text-gray-400 font-sans tracking-wide m-0">
                  REAL-TIME MONITORING OF UNOPTIMIZED REACT RENDERS AND EVENT-TRIGGERED PARTICLE DECAY
                </p>
              </div>
            </div>

            {/* Chronicles Studio Branding */}
            <a href="https://chronicles.cz" target="_blank" rel="noopener noreferrer" className="flex-row-center" style={{ textDecoration: 'none', gap: '12px', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '0.8'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '10px', color: 'var(--green-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Engineered by</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#4ade80' }}>Chronicles Studio</p>
              </div>
              <img src="/Chronicles%20studio%20logo.svg" alt="Chronicles Studio Logo" style={{ height: '32px' }} />
            </a>

            
            {/* LED Status Lightbar */}
            <div className="flex-row-center border border-green-dim bg-black/40 px-3 py-1.5 rounded">
              <div className="flex-row-center">
                <span className="text-[10px] text-gray-500">PWR</span>
                <div className="led-indicator led-green" />
              </div>
              <div className="flex-row-center">
                <span className="text-[10px] text-gray-500">SYS</span>
                <div className="led-indicator led-green" />
              </div>
              <div className="flex-row-center">
                <span className="text-[10px] text-gray-500">RAD</span>
                <div className={`led-indicator ${intensity > 0.15 ? ledClass : 'bg-gray-700'}`} />
              </div>
              <div className="flex-row-center">
                <span className="text-[10px] text-gray-500">ALRM</span>
                <div className={`led-indicator ${intensity > 0.75 ? 'led-red' : 'bg-gray-700'}`} />
              </div>
            </div>
          </header>

          {/* MAIN CONTAINER GRID */}
          <div className="dashboard-main">
            
            {/* COLUMN 1: DIAGNOSTIC INSTRUMENTS */}
            <aside className="dashboard-column left">
              
              {/* WIDGET: REACTOR DIAGNOSTICS */}
              <div className={`cyber-panel p-2 flex-grow flex flex-col gap-2.5 ${panelClass}`}>
                <div className="border-b border-green-dim pb-1 flex-space-between text-xs">
                  <span className="font-bold tracking-wider">CORE METRICS</span>
                  <span className="text-[9px] text-gray-500">[ SENSOR LOADED ]</span>
                </div>
                
                {/* CPM Digital Panel */}
                <div className="bg-black-60 p-2 text-center relative overflow-hidden">
                  <div className="text-[9px] text-gray-500 tracking-wider text-left">TUBE DISCHARGE (CPM)</div>
                  <div className={`text-3xl font-bold font-mono tracking-widest ${textClass} my-1`}>
                    {currentCpm.toLocaleString()}
                  </div>
                  <div className="w-full bg-gray-900 h-1 rounded overflow-hidden mt-1">
                    <div 
                      className="h-full transition-all duration-75"
                      style={{ 
                        width: `${intensity * 100}%`,
                        backgroundColor: intensity > 0.8 ? 'var(--red-meltdown)' : intensity > 0.5 ? 'var(--orange-hazard)' : intensity > 0.15 ? 'var(--yellow-warning)' : 'var(--green-primary)'
                      }}
                    />
                  </div>
                </div>

                {/* Dose Rate Gauge */}
                <div className="bg-black-60 p-2 text-center relative">
                  <div className="text-[9px] text-gray-500 tracking-wider text-left">RADIATION EXPOSURE</div>
                  <div className={`text-2xl font-bold font-mono tracking-widest ${textClass} my-1`}>
                    {currentSv} <span className="text-sm">μSv/h</span>
                  </div>
                  <div className="text-[9px] text-gray-400">
                    {intensity === 0 ? 'Normal Background Radiation' : `WARN: ${Math.round(intensity * 100)}x baseline flux`}
                  </div>
                </div>

                {/* Oscilloscope timeline screen */}
                <div className="flex-column-grow gap-1">
                  <div className="text-[10px] text-gray-400 tracking-widest uppercase">Oscilloscope: Particle Pulse Wave</div>
                  <div className="border border-green-dim bg-black/70 rounded relative overflow-hidden flex-grow" style={{ minHeight: '60px', height: '80px' }}>
                    <canvas ref={oscilloscopeRef} className="w-full h-full block" />
                  </div>
                </div>

                {/* Core Status & Temp */}
                <div className="grid-cols-2 mt-1">
                  <div className="bg-black/40 border border-green-dim/40 p-1.5 rounded text-center">
                    <div className="text-[9px] text-gray-500">CORE TEMP</div>
                    <div className={`text-sm font-bold font-mono ${coreTemp > 900 ? 'glow-text-red' : 'glow-text-green'}`}>
                      {coreTemp} K
                    </div>
                  </div>
                  <div className="bg-black/40 border border-green-dim/40 p-1.5 rounded text-center">
                    <div className="text-[9px] text-gray-500">REACTOR STATUS</div>
                    <div className={`text-[10px] font-bold font-mono ${textClass} truncate`}>
                      {coreStatus}
                    </div>
                  </div>
                </div>
              </div>

              {/* WIDGET: PERFORMANCE LAB STATS */}
              <div className="cyber-panel p-2 flex flex-col gap-2">
                <div className="border-b border-green-dim pb-1">
                  <span className="font-bold text-xs tracking-wider">RENDER STATS LOG</span>
                </div>
                <div className="flex flex-col gap-1 font-mono text-[11px]">
                  <div className="flex-space-between border-b border-green-dim/20 pb-0.5">
                    <span className="text-gray-400">Total Renders:</span>
                    <span className="glow-text-green font-bold">{renderCountRef.current}</span>
                  </div>
                  <div className="flex-space-between border-b border-green-dim/20 pb-0.5">
                    <span className="text-gray-400">Chamber Sensitivity:</span>
                    <span className="text-white">{(10 - selectedIsotope.speedSens).toFixed(1)} / 10</span>
                  </div>
                  <div className="flex-space-between border-b border-green-dim/20 pb-0.5">
                    <span className="text-gray-400">Active Particles:</span>
                    <span className="glow-text-green">{activeParticles}</span>
                  </div>
                  <div className="flex-space-between">
                    <span className="text-gray-400">Moderator Efficiency:</span>
                    <span className="text-white">99.84%</span>
                  </div>
                </div>
              </div>

            </aside>

            {/* COLUMN 2: REACTOR CHAMBER - INTERACTIVE AREA */}
            <main className="dashboard-column center">
              <div 
                className="cyber-panel active flex-grow relative flex flex-col justify-between overflow-hidden cursor-crosshair group"
                ref={cardRef}
                onMouseMove={handleMouseMove}
              >
                {/* Diagonal Hazard border accents */}
                <div className="absolute top-0 left-0 w-full h-2 hazard-stripes" />
                <div className="absolute bottom-0 left-0 w-full h-2 hazard-stripes" />

                {/* Neon glow effect tracking cursor */}
                <div style={{
                  position: 'absolute',
                  top: position.y - 180,
                  left: position.x - 180,
                  width: '360px',
                  height: '360px',
                  background: `radial-gradient(circle, ${selectedIsotope.color}15 0%, transparent 65%)`,
                  pointerEvents: 'none',
                  transition: 'background 0.1s ease',
                  opacity: intensity > 0 ? 1 : 0
                }} />

                {/* Particle canvas */}
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-10 pointer-events-none" />

                {/* Overlay Scope Graphics (SVG) */}
                <div className="absolute inset-0 pointer-events-none border border-green-dim/30 m-3 rounded flex items-center justify-center">
                  {/* Crosshair scope */}
                  <svg className="w-36 h-36 text-green-primary/10" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                    <circle cx="50" cy="50" r="40" strokeWidth="0.5" strokeDasharray="3 3" />
                    <circle cx="50" cy="50" r="20" strokeWidth="0.5" />
                    <line x1="50" y1="5" x2="50" y2="95" strokeWidth="0.5" />
                    <line x1="5" y1="50" x2="95" y2="50" strokeWidth="0.5" />
                  </svg>
                  
                  {/* Target coordinates panel */}
                  <div className="absolute bottom-3 left-3 text-[9px] text-green-primary/40 font-mono">
                    COORD: X:{Math.round(position.x)} Y:{Math.round(position.y)} | VEL: {Math.round(intensity * 100)} RAD/s
                  </div>
                  <div className="absolute top-3 right-3 text-[9px] text-green-primary/40 font-mono tracking-widest">
                    SYS: ACTIVE
                  </div>
                </div>

                {/* Compact Top Header inside Chamber */}
                <div className="z-20 p-2 text-center pointer-events-none mt-2 select-none w-full">
                  <div className="flex-row-center justify-center gap-1.5">
                    <span className="text-yellow-500 text-xs animate-pulse">⚠️</span>
                    <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase font-mono">
                      CORE REACTOR INTERACTIVE CHAMBER
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5 font-mono">
                    BOMBARD REACTOR CORE BY HOVERING CURSOR TO EMIT RADIOACTIVE PARTICLES
                  </div>
                </div>

                {/* Chamber Status Bar */}
                <div className="z-20 p-2.5 border-t border-green-dim/30 bg-black/75 flex-space-between text-xs font-mono">
                  <div className="flex-row-center">
                    <span className="text-gray-500">ISOTOPE INSTALLED:</span>
                    <span style={{ color: selectedIsotope.color, textShadow: `0 0 6px ${selectedIsotope.color}` }} className="font-bold">
                      {selectedIsotope.name}
                    </span>
                  </div>
                  <div className="flex-row-center">
                    <div className={`w-2 h-2 rounded-full ${intensity > 0 ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
                    <span className="text-gray-400">{intensity > 0 ? 'BOMBARDMENT ACTIVE' : 'STABLE CORE'}</span>
                  </div>
                </div>
              </div>
            </main>

            {/* COLUMN 3: REACTOR SETTINGS & MANUAL SIMULATORS */}
            <aside className="dashboard-column right">
              
              {/* PANEL: REACTOR SOUND & CRT SETTINGS */}
              <div className="cyber-panel p-2 flex flex-col gap-2">
                <div className="border-b border-green-dim pb-1 flex-space-between text-xs">
                  <span className="font-bold tracking-wider">AUDIO & CORE MONITOR</span>
                </div>
                
                {/* Audio volume & mute controls */}
                <div className="flex flex-col gap-2">
                  <div className="flex-space-between">
                    <span className="text-xs text-gray-400">MUTED</span>
                    <button 
                      className={`cyber-btn px-2 py-0.5 text-[10px] ${isMuted ? 'active' : ''}`}
                      onClick={() => {
                        setIsMuted(!isMuted);
                        addLog(`GEIGER AUDIO DETECTOR: ${!isMuted ? 'MUTED' : 'UNMUTED'}`);
                      }}
                    >
                      {isMuted ? 'MUTED' : 'UNMUTED'}
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-0.5">
                    <div className="flex-space-between text-[10px] text-gray-400">
                      <span>AUDIO VOLUME</span>
                      <span>{Math.round(volume * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="cyber-slider"
                      disabled={isMuted}
                    />
                  </div>
                </div>

                <div className="border-t border-green-dim/20 pt-2 flex flex-col gap-1.5">
                  <div className="flex-space-between text-xs">
                    <span className="text-gray-400">CRT FILTER</span>
                    <input 
                      type="checkbox" 
                      checked={enableCRT}
                      onChange={(e) => setEnableCRT(e.target.checked)}
                      className="accent-green-500"
                    />
                  </div>
                  <div className="flex-space-between text-xs">
                    <span className="text-gray-400">SCREEN SHAKE</span>
                    <input 
                      type="checkbox" 
                      checked={enableScreenShake}
                      onChange={(e) => setEnableScreenShake(e.target.checked)}
                      className="accent-green-500"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="text-[9px] text-gray-400">PARTICLE EMISSION</span>
                    <div className="grid-cols-3">
                      {['low', 'medium', 'high'].map(lvl => (
                        <button
                          key={lvl}
                          className={`cyber-btn p-0.5 text-[9px] ${particleDensity === lvl ? 'active' : ''}`}
                          onClick={() => setParticleDensity(lvl)}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* PANEL: ISOTOPE LOADER */}
              <div className="cyber-panel p-2 flex flex-col gap-2 flex-grow overflow-hidden">
                <div className="border-b border-green-dim pb-1 flex-space-between text-xs">
                  <span className="font-bold tracking-wider">LOAD ISOTOPE FUEL</span>
                </div>

                <div className="flex-column-grow gap-1.5 overflow-y-auto pr-1">
                  {ISOTOPES.map(iso => (
                    <label 
                      key={iso.id}
                      className={`flex flex-col p-1.5 border rounded cursor-pointer transition-all ${
                        isotopeId === iso.id 
                          ? 'bg-green-dim/10 border-green-primary' 
                          : 'border-green-dim/20 hover:border-green-dim/50 bg-black/20'
                      }`}
                    >
                      <div className="flex-space-between">
                        <div className="flex-row-center">
                          <input 
                            type="radio" 
                            name="isotope-loader"
                            value={iso.id}
                            checked={isotopeId === iso.id}
                            onChange={() => setIsotopeId(iso.id)}
                            className="hidden"
                          />
                          <span className="font-bold text-xs tracking-wider" style={{ color: iso.color }}>{iso.symbol}</span>
                          <span className="text-[9px] text-gray-400 font-sans">{iso.name}</span>
                        </div>
                        <span className={`text-[8px] px-1 py-0.25 rounded font-sans font-bold ${
                          iso.danger === 'CRITICAL' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                          iso.danger === 'High' ? 'bg-amber-900/50 text-amber-300 border border-amber-700' :
                          iso.danger === 'Medium' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                          'bg-cyan-900/50 text-cyan-300 border border-cyan-700'
                        }`}>
                          {iso.danger}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-500 font-sans mt-0.5 leading-tight">
                        {iso.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* PANEL: CORE REACTOR ACTIONS */}
              <div className="cyber-panel p-2 flex flex-col gap-2">
                <div className="border-b border-green-dim pb-1 flex-space-between text-xs">
                  <span className="font-bold tracking-wider">REACTOR EMISSION</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <button 
                    className="cyber-btn text-[11px] py-1"
                    onClick={() => triggerManualRenders(40)}
                  >
                    🚀 Ionization Pulse (40 Renders)
                  </button>
                  
                  <button 
                    className="cyber-btn cyber-btn-orange text-[11px] py-1"
                    onClick={triggerMeltdownTest}
                  >
                    🚨 Core Runaway Test (120 Renders)
                  </button>
                </div>
              </div>

            </aside>

          </div>

          {/* REACTOR EVENT LOG CONSOLE */}
          <footer className="cyber-panel p-2 dashboard-footer bg-black/85">
            <div className="border-b border-green-dim/30 pb-0.5 flex-space-between text-xs">
              <span className="font-bold tracking-wider text-[11px]">☢️ SYSTEM EVENT MONITOR LOG</span>
              <span className="text-[9px] text-gray-500 font-mono">SYS_LOGS_ACTIVE // MAX_CAP_15</span>
            </div>
            
            <div 
              ref={logsContainerRef}
              className="flex-grow overflow-y-auto font-mono text-[10px] flex flex-col gap-0.5 pr-2"
            >
              {logs.map((log, idx) => {
                let textCol = 'text-green-400';
                if (log.includes('⚠️')) textCol = 'text-yellow-400';
                if (log.includes('🚨') || log.includes('RUNAWAY') || log.includes('MELTDOWN')) textCol = 'text-red-400 glow-text-red';
                if (log.includes('✅')) textCol = 'text-green-300 font-bold';
                return (
                  <div key={idx} className={textCol}>
                    {log}
                  </div>
                );
              })}
            </div>
          </footer>

        </div>
      </div>
    </Geiger>
  );
}
