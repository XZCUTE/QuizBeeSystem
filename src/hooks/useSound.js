import { useEffect } from 'react';
import soundManager from '@/utils/sound';

export default function useSound(options = {}) {
  const {
    pageType = null,
    playBackgroundMusic = true,
  } = options;
  
  useEffect(() => {
    // Play background music based on page type
    if (playBackgroundMusic && pageType) {
      let musicType = 'lobby';
      
      switch (pageType) {
        case 'home':
          musicType = 'lobby';
          break;
        case 'host':
        case 'participant':
          if (options.step === 'waiting' || options.step === 'enter-code' || options.step === 'enter-info' || options.step === 'create-questions') {
            musicType = 'lobby';
          } else if (options.step === 'quiz-active' || options.step === 'view-participants') {
            musicType = 'game';
          } else if (options.step === 'quiz-completed') {
            musicType = 'results';
          }
          break;
        default:
          musicType = 'lobby';
      }
      
      soundManager.playBackgroundMusic(musicType);
    }
    
    // Play entrance sound if requested
    if (options.playEntranceSound) {
      soundManager.play('transition');
    }
    
    // Clean up on component unmount
    return () => {
      // If music should stop when component unmounts
      if (options.stopMusicOnUnmount) {
        soundManager.fadeOut(soundManager.backgroundMusic, () => {
          soundManager.stopSound(soundManager.backgroundMusic);
          soundManager.backgroundMusic = null;
        });
      }
    };
  }, [pageType, playBackgroundMusic, options.step, options.playEntranceSound, options.stopMusicOnUnmount]);
  
  // Return sound utility functions 
  return {
    play: (soundId) => soundManager.play(soundId),
    playSuccess: () => soundManager.play('success'),
    playError: () => soundManager.play('error'),
    playClick: () => soundManager.play('click'),
    playHover: () => soundManager.play('hover'),
    playCorrect: () => soundManager.play('correctAnswer'),
    playWrong: () => soundManager.play('wrongAnswer'),
    playCountdown: () => soundManager.play('countdown'),
    playCountdownFinish: () => soundManager.play('countdownFinish'),
    playTimesUp: () => soundManager.play('timesUp'),
    playNextQuestion: () => soundManager.play('nextQuestion'),
    playCelebration: () => soundManager.play('celebration'),
    toggleMute: () => {
      const isMuted = soundManager.toggleMute();
      return isMuted;
    },
    setVolume: (volume) => soundManager.setVolume(volume),
    isMuted: soundManager.isMuted,
    volume: soundManager.volume,
  };
} 