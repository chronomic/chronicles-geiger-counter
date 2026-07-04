import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Audio Element Pool to prevent browser media element exhaustion (limit is 40 in Chrome)
const POOL_SIZE = 40;
const audioPool = [];

const OriginalAudio = window.Audio;
if (OriginalAudio) {
  for (let i = 0; i < POOL_SIZE; i++) {
    const audio = new OriginalAudio();
    audioPool.push(audio);
  }

  const getAvailableAudio = () => {
    // Only recycle audio that has finished playing
    let audio = audioPool.find(a => a.ended || (a.duration && a.currentTime >= a.duration));
    if (!audio) {
      // Force recycle the oldest one in the pool
      audio = audioPool.shift();
      audioPool.push(audio);
      audio.pause();
    }
    try { audio.currentTime = 0; } catch(e) {}
    return audio;
  };

  // Override window.Audio constructor
  window.Audio = function(src) {
    const audio = getAvailableAudio();
    if (src) {
      audio.src = src;
    }
    return audio;
  };
}

// Override document.createElement for audio elements
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName, options) {
    if (tagName && tagName.toLowerCase() === 'audio') {
      return getAvailableAudio();
    }
    return originalCreateElement.call(document, tagName, options);
  };

// Patch AudioContext for react-geiger browser autoplay compatibility
const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
if (OriginalAudioContext) {
  const activeContexts = [];
  const OriginalCreateMediaElementSource = OriginalAudioContext.prototype.createMediaElementSource;

  // Prevent InvalidStateError when react-geiger calls createMediaElementSource on a recycled audio element
  OriginalAudioContext.prototype.createMediaElementSource = function(mediaElement) {
    if (mediaElement._mediaSourceNode) {
      return mediaElement._mediaSourceNode;
    }
    const sourceNode = OriginalCreateMediaElementSource.call(this, mediaElement);
    mediaElement._mediaSourceNode = sourceNode;
    return sourceNode;
  };

  class PatchedAudioContext extends OriginalAudioContext {
    constructor(...args) {
      super(...args);
      activeContexts.push(this);
      
      // Force state to always report "running" to Geiger's initial check
      Object.defineProperty(this, 'state', {
        value: 'running',
        writable: false,
        configurable: true
      });
    }
  }

  window.AudioContext = PatchedAudioContext;
  if (window.webkitAudioContext) {
    window.webkitAudioContext = PatchedAudioContext;
  }

  // Resume all created contexts on user interaction
  const resumeAudio = () => {
    activeContexts.forEach(ctx => {
      OriginalAudioContext.prototype.resume.call(ctx).catch(e => {});
    });
  };

  window.addEventListener('click', resumeAudio);
  window.addEventListener('keydown', resumeAudio);
  window.addEventListener('touchstart', resumeAudio);
}

// Intercept volume settings
const originalVolumeSetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume').set;
const originalVolumeGetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume').get;
const originalPlay = HTMLMediaElement.prototype.play;

Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
  set(val) {
    this._baseVolume = val;
    const intensity = window.currentGeigerIntensity !== undefined ? window.currentGeigerIntensity : 1;
    const jitter = this._volumeJitter !== undefined ? this._volumeJitter : 1;
    const userVolume = window.geigerUserVolume !== undefined ? window.geigerUserVolume : 1;
    const isMuted = window.geigerMuted === true;
    const finalVolume = isMuted ? 0 : Math.max(0, Math.min(1, val * intensity * jitter * userVolume));
    originalVolumeSetter.call(this, finalVolume);
  },
  get() {
    return this._baseVolume !== undefined ? this._baseVolume : originalVolumeGetter.call(this);
  },
  configurable: true
});

let lastPlayTime = 0;

HTMLMediaElement.prototype.play = function() {
  const intensity = window.currentGeigerIntensity !== undefined ? window.currentGeigerIntensity : 0;
  const now = performance.now();
  
  // Pull the calculated target CPM from the React app
  const targetCpm = window.currentGeigerTargetCpm || 10;
  
  // Calculate ideal milliseconds between clicks (60,000 ms / CPM)
  let baseInterval = 60000 / Math.max(1, targetCpm);
  
  // Apply Poisson-like jitter for realistic radiation randomness (-ln(rand) * mean)
  // We clamp it slightly to avoid excessively long gaps
  let cooldown = -Math.log(Math.random()) * baseInterval;
  
  // Hard cap to prevent browser audio engine exhaustion
  if (cooldown < 3) cooldown = 3;

  if (now - lastPlayTime < cooldown) {
    return Promise.resolve();
  }

  lastPlayTime = now;
  
  // Generate random volume jitter (+/- 15%) unique to this click event
  const volumeJitter = 0.85 + Math.random() * 0.30;
  this._volumeJitter = volumeJitter;

  const baseVolume = this._baseVolume !== undefined ? this._baseVolume : originalVolumeGetter.call(this);
  const userVolume = window.geigerUserVolume !== undefined ? window.geigerUserVolume : 1;
  const isMuted = window.geigerMuted === true;
  const finalVolume = isMuted ? 0 : Math.max(0, Math.min(1, baseVolume * intensity * volumeJitter * userVolume));
  originalVolumeSetter.call(this, finalVolume);
  const playPromise = originalPlay.apply(this, arguments);
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Silence abort/interruption errors from rapid render click overlap
    });
  }
  return playPromise;
};

window.updateGeigerVolumes = (intensity) => {
  window.currentGeigerIntensity = intensity;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
