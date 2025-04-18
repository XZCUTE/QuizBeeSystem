// Sound management utility
class SoundManager {
  constructor() {
    this.sounds = {};
    this.backgroundMusic = null;
    this.isMuted = false;
    this.volume = 0.5;
    this.backgroundVolume = 0.3;
    
    // Try to load mute state from localStorage
    const savedMute = localStorage.getItem('icctqb-muted');
    if (savedMute !== null) {
      this.isMuted = savedMute === 'true';
    }
    
    const savedVolume = localStorage.getItem('icctqb-volume');
    if (savedVolume !== null) {
      this.volume = parseFloat(savedVolume);
    }
    
    // Preload all sounds
    this.preloadSounds();
  }
  
  preloadSounds() {
    // UI Sounds
    this.registerSound('click', '/sounds/click.mp3');
    this.registerSound('hover', '/sounds/hover.mp3');
    this.registerSound('success', '/sounds/success.mp3');
    this.registerSound('error', '/sounds/error.mp3');
    this.registerSound('transition', '/sounds/transition.mp3');
    
    // Quiz Sounds
    this.registerSound('countdown', '/sounds/countdown.mp3');
    this.registerSound('countdownFinish', '/sounds/countdown-finish.mp3');
    this.registerSound('correctAnswer', '/sounds/correct-answer.mp3');
    this.registerSound('wrongAnswer', '/sounds/wrong-answer.mp3');
    this.registerSound('timesUp', '/sounds/times-up.mp3');
    this.registerSound('nextQuestion', '/sounds/next-question.mp3');
    this.registerSound('celebration', '/sounds/celebration.mp3');
    
    // Background Music Options
    this.registerBackgroundMusic('lobby', '/sounds/music/lobby-music.mp3');
    this.registerBackgroundMusic('game', '/sounds/music/game-music.mp3');
    this.registerBackgroundMusic('results', '/sounds/music/results-music.mp3');
  }
  
  registerSound(id, path) {
    this.sounds[id] = { path, audio: null };
  }
  
  registerBackgroundMusic(id, path) {
    if (!this.sounds[`bg_${id}`]) {
      this.sounds[`bg_${id}`] = { 
        path, 
        audio: null, 
        isBackgroundMusic: true 
      };
    }
  }
  
  _initializeAudio(id) {
    if (!this.sounds[id]) return null;
    
    if (!this.sounds[id].audio) {
      const audio = new Audio(this.sounds[id].path);
      
      // Set volume based on type
      if (this.sounds[id].isBackgroundMusic) {
        audio.volume = this.backgroundVolume * this.volume;
        audio.loop = true;
      } else {
        audio.volume = this.volume;
      }
      
      this.sounds[id].audio = audio;
    }
    
    return this.sounds[id].audio;
  }
  
  play(id) {
    if (this.isMuted) return;
    
    const audio = this._initializeAudio(id);
    if (!audio) return;
    
    // Reset audio to start if it's already playing
    audio.currentTime = 0;
    
    // Play the sound
    audio.play().catch(error => {
      console.warn(`Failed to play sound ${id}:`, error);
    });
  }
  
  stopSound(id) {
    if (!this.sounds[id] || !this.sounds[id].audio) return;
    
    this.sounds[id].audio.pause();
    this.sounds[id].audio.currentTime = 0;
  }
  
  playBackgroundMusic(id) {
    if (this.backgroundMusic) {
      // Fade out current music
      this.fadeOut(this.backgroundMusic, () => {
        this.stopSound(this.backgroundMusic);
        this._startNewBackgroundMusic(id);
      });
    } else {
      this._startNewBackgroundMusic(id);
    }
  }
  
  _startNewBackgroundMusic(id) {
    const bgId = `bg_${id}`;
    this.backgroundMusic = bgId;
    
    if (this.isMuted) return;
    
    const audio = this._initializeAudio(bgId);
    if (!audio) return;
    
    // Start at zero volume and fade in
    audio.volume = 0;
    audio.play().catch(error => {
      console.warn(`Failed to play background music ${id}:`, error);
    });
    
    this.fadeIn(bgId);
  }
  
  fadeIn(id, duration = 1000) {
    if (!this.sounds[id] || !this.sounds[id].audio) return;
    
    const audio = this.sounds[id].audio;
    const targetVolume = this.sounds[id].isBackgroundMusic ? 
      this.backgroundVolume * this.volume : this.volume;
    
    let startVolume = audio.volume;
    const volumeChange = targetVolume - startVolume;
    const startTime = performance.now();
    
    const updateVolume = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      audio.volume = startVolume + volumeChange * progress;
      
      if (progress < 1) {
        requestAnimationFrame(updateVolume);
      }
    };
    
    requestAnimationFrame(updateVolume);
  }
  
  fadeOut(id, callback, duration = 1000) {
    if (!this.sounds[id] || !this.sounds[id].audio) {
      if (callback) callback();
      return;
    }
    
    const audio = this.sounds[id].audio;
    const startVolume = audio.volume;
    const startTime = performance.now();
    
    const updateVolume = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      audio.volume = startVolume * (1 - progress);
      
      if (progress < 1) {
        requestAnimationFrame(updateVolume);
      } else {
        if (callback) callback();
      }
    };
    
    requestAnimationFrame(updateVolume);
  }
  
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('icctqb-muted', this.isMuted.toString());
    
    // Update all active audio elements
    Object.keys(this.sounds).forEach(id => {
      if (this.sounds[id].audio) {
        if (this.isMuted) {
          this.sounds[id].audio.volume = 0;
        } else {
          this.sounds[id].audio.volume = this.sounds[id].isBackgroundMusic ? 
            this.backgroundVolume * this.volume : this.volume;
        }
      }
    });
    
    return this.isMuted;
  }
  
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('icctqb-volume', this.volume.toString());
    
    // Update all active audio elements
    Object.keys(this.sounds).forEach(id => {
      if (this.sounds[id].audio && !this.isMuted) {
        this.sounds[id].audio.volume = this.sounds[id].isBackgroundMusic ? 
          this.backgroundVolume * this.volume : this.volume;
      }
    });
  }
}

// Singleton instance
const soundManager = new SoundManager();
export default soundManager; 