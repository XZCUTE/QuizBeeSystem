import React from 'react';
import useSound from '@/hooks/useSound';

/**
 * Button component that plays a sound effect when clicked
 * @param {Object} props - Component props
 * @param {string} props.soundEffect - Name of the sound effect to play (click, success, error, etc.)
 * @param {Function} props.onClick - Click handler function
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.type - Button type (button, submit, reset)
 * @param {Object} props.rest - Additional props to pass to the button element
 */
const SoundButton = ({ 
  soundEffect = 'click',
  onClick,
  children, 
  className = '', 
  disabled = false,
  type = 'button',
  ...rest 
}) => {
  const sound = useSound();

  const handleClick = (e) => {
    // Play the requested sound effect
    if (soundEffect === 'click') {
      sound.playClick();
    } else if (soundEffect === 'success') {
      sound.playSuccess();
    } else if (soundEffect === 'error') {
      sound.playError();
    } else if (soundEffect === 'correct') {
      sound.playCorrect();
    } else if (soundEffect === 'wrong') {
      sound.playWrong();
    } else if (soundEffect === 'celebration') {
      sound.playCelebration();
    } else {
      // Default to click sound
      sound.playClick();
    }
    
    // Call the original onClick handler if provided
    if (onClick) {
      onClick(e);
    }
  };

  // Play hover sound on mouse enter
  const handleMouseEnter = (e) => {
    sound.playHover();
    
    // Call original onMouseEnter if provided
    if (rest.onMouseEnter) {
      rest.onMouseEnter(e);
      // Remove onMouseEnter from rest to avoid passing it twice
      const { onMouseEnter, ...newRest } = rest;
      rest = newRest;
    }
  };

  return (
    <button
      type={type}
      className={`sound-button ${className}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export default SoundButton; 