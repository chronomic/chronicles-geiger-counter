import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Audio Element Pool to prevent browser media element exhaustion (limit is 40 in Chrome)
const POOL_SIZE = 16;
const audioPool = [];
let poolIndex = 0;

const OriginalAudio = window.Audio;
if (OriginalAudio) {
  for (let i = 0; i < POOL_SIZE; i++) {
    const audio = new OriginalAudio();
    audioPool.push(audio);
  }

  // Override window.Audio constructor
  window.Audio = function(src) {
    const audio = audioPool[poolIndex];
    poolIndex = (poolIndex + 1) % POOL_SIZE;
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
    const audio = audioPool[poolIndex];
    poolIndex = (poolIndex + 1) % POOL_SIZE;
    return audio;
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

  // Resume all created contexts on first user click/interaction
  const resumeAudio = () => {
    activeContexts.forEach(ctx => {
      OriginalAudioContext.prototype.resume.call(ctx)
        .then(() => console.log("Geiger AudioContext resumed successfully!"))
        .catch(e => console.error("Failed to resume Geiger AudioContext:", e));
    });
    window.removeEventListener('click', resumeAudio);
    window.removeEventListener('keydown', resumeAudio);
    window.removeEventListener('touchstart', resumeAudio);
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
  // If intensity is very small or zero, do not play
  if (intensity <= 0.01) {
    return Promise.resolve();
  }

  const now = performance.now();
  
  // Calculate dynamic cooldown based on mouse speed (intensity) - doubled frequency limits
  const minInterval = 6 + (1 - intensity) * 50; 
  const jitter = Math.random() * (10 + (1 - intensity) * 60);
  const cooldown = minInterval + jitter;

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
