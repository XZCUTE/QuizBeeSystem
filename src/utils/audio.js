// Audio utility for managing sounds across the application

class AudioManager {
  constructor() {
    this.sounds = {};
    this.backgroundMusic = null;
    this.isMuted = localStorage.getItem('isMuted') === 'true';
    this.volume = parseFloat(localStorage.getItem('volume') || '0.5');
  }

  // Load a sound effect
  loadSound(name, path) {
    this.sounds[name] = new Audio(`/sounds/${path}`);
    this.sounds[name].volume = this.volume;
    return this.sounds[name];
  }

  // Load background music
  loadBackgroundMusic(path) {
    this.backgroundMusic = new Audio(`/sounds/${path}`);
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = this.volume * 0.5; // Lower volume for background music
    return this.backgroundMusic;
  }

  // Play a sound effect
  playSound(name) {
    if (this.isMuted || !this.sounds[name]) return;
    
    // Create a clone to allow overlapping sounds
    const sound = this.sounds[name].cloneNode();
    sound.volume = this.volume;
    sound.play().catch(error => console.error(`Error playing sound ${name}:`, error));
  }

  // Start background music
  playBackgroundMusic() {
    if (this.isMuted || !this.backgroundMusic) return;
    this.backgroundMusic.play().catch(error => console.error('Error playing background music:', error));
  }

  // Pause background music
  pauseBackgroundMusic() {
    if (!this.backgroundMusic) return;
    this.backgroundMusic.pause();
  }

  // Toggle mute for all sounds
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('isMuted', this.isMuted);
    
    if (this.isMuted) {
      this.pauseBackgroundMusic();
    } else if (this.backgroundMusic) {
      this.playBackgroundMusic();
    }
    
    return this.isMuted;
  }

  // Set volume for all sounds
  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
    localStorage.setItem('volume', this.volume);
    
    // Update volume for all loaded sounds
    Object.values(this.sounds).forEach(sound => {
      sound.volume = this.volume;
    });
    
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = this.volume * 0.5;
    }
  }

  // Preload common sounds
  preloadCommonSounds() {
    this.loadSound('buttonClick', 'boump.mp3');
    this.loadSound('answerSubmit', 'answersSound.mp3');
    this.loadSound('countdown', 'three.mp3');
    this.loadSound('showQuestion', 'show.mp3');
    this.loadSound('results', 'results.mp3');
    this.loadSound('first', 'first.mp3');
    this.loadSound('second', 'second.mp3');
    this.loadSound('drumRoll', 'snearRoll.mp3');
    
    // Load background music for quiz sessions
    this.loadBackgroundMusic('answersMusic.mp3');
  }
}

// Create a singleton instance
const audioManager = new AudioManager();
audioManager.preloadCommonSounds();

export default audioManager; 