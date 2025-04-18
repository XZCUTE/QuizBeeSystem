import { createContext, useContext, useState, useEffect, useRef } from 'react';

// Create context
const AudioContext = createContext();

/**
 * AudioProvider component to manage sounds throughout the application
 */
export function AudioProvider({ children }) {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7); // Default volume 70%
  const audioCache = useRef({});
  
  // Sound mapping
  const sounds = {
    click: '/sounds/click.mp3',
    correct: '/sounds/correct.mp3',
    incorrect: '/sounds/incorrect.mp3',
    success: '/sounds/success.mp3',
    timeout: '/sounds/timeout.mp3',
  };
  
  // Preload sounds
  useEffect(() => {
    Object.entries(sounds).forEach(([name, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audioCache.current[name] = audio;
    });
    
    // Cleanup on unmount
    return () => {
      Object.values(audioCache.current).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      audioCache.current = {};
    };
  }, []);
  
  // Update volume for all audio elements when volume changes
  useEffect(() => {
    Object.values(audioCache.current).forEach(audio => {
      audio.volume = isMuted ? 0 : volume;
    });
  }, [volume, isMuted]);
  
  /**
   * Play a sound by its key
   * @param {string} sound - Key of the sound to play
   */
  const playSound = (sound) => {
    if (!sound || !audioCache.current[sound]) return;
    
    // Create a new audio element to allow overlapping sounds
    const audio = new Audio(sounds[sound]);
    audio.volume = isMuted ? 0 : volume;
    audio.play().catch(err => console.error('Error playing sound:', err));
  };
  
  /**
   * Toggle mute state
   */
  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };
  
  /**
   * Change volume
   * @param {number} newVolume - Volume between 0-1
   */
  const changeVolume = (newVolume) => {
    if (newVolume >= 0 && newVolume <= 1) {
      setVolume(newVolume);
    }
  };
  
  return (
    <AudioContext.Provider 
      value={{ 
        isMuted, 
        volume, 
        playSound, 
        toggleMute, 
        changeVolume 
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

/**
 * Custom hook to use audio functionality throughout the app
 */
export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}

export default AudioContext; 