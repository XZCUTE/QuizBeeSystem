import React, { useState, useEffect } from 'react';
import { FaVolumeUp, FaVolumeMute, FaVolumeDown } from 'react-icons/fa';
import soundManager from '@/utils/sound';
import useSound from '@/hooks/useSound';

/**
 * Component for controlling sound across the application
 * Provides controls for toggling sound on/off and adjusting volume
 */
const SoundControl = () => {
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);
  const [volume, setVolume] = useState(soundManager.volume);
  const [showControls, setShowControls] = useState(false);
  const sound = useSound();

  // Sync state with soundManager periodically
  useEffect(() => {
    const checkState = () => {
      if (isMuted !== soundManager.isMuted) {
        setIsMuted(soundManager.isMuted);
      }
      if (volume !== soundManager.volume) {
        setVolume(soundManager.volume);
      }
    };

    const intervalId = setInterval(checkState, 1000);
    return () => clearInterval(intervalId);
  }, [isMuted, volume]);

  const handleToggleMute = () => {
    const newMuteState = soundManager.toggleMute();
    setIsMuted(newMuteState);
    
    // Play feedback sound when unmuting
    if (!newMuteState) {
      sound.playClick();
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    soundManager.setVolume(newVolume);
    setVolume(newVolume);
    
    // Play feedback sound when changing volume (if not muted)
    if (!isMuted && newVolume > 0) {
      sound.playClick();
    }
  };

  const toggleControls = () => {
    setShowControls(prev => !prev);
    
    // Play feedback sound
    if (!isMuted) {
      sound.playHover();
    }
  };

  // Icon based on volume level and mute status
  const VolumeIcon = isMuted 
    ? FaVolumeMute 
    : volume > 0.5 
      ? FaVolumeUp 
      : FaVolumeDown;

  return (
    <div className="sound-controls">
      {showControls && (
        <div className="sound-controls-panel">
          <div className="volume-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
            />
          </div>
          <button
            className="mute-toggle-btn"
            onClick={handleToggleMute}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      )}
      <button
        className="sound-toggle-btn"
        onClick={toggleControls}
        aria-label="Toggle sound controls"
      >
        <VolumeIcon size={18} color={isMuted ? "#999" : "#3b82f6"} />
      </button>
    </div>
  );
};

export default SoundControl; 