import { useEffect, useState } from 'react';
import Confetti from 'react-confetti';

/**
 * A reusable full-screen confetti component that renders confetti across the entire viewport
 * @param {Object} props - Component props
 * @param {boolean} props.active - Whether the confetti should be shown
 * @param {number} props.duration - Optional duration in ms after which confetti will stop (0 for infinite)
 * @param {number} props.pieces - Number of confetti pieces (default: 200)
 * @param {number} props.recycle - Whether pieces should be recycled (continuous effect)
 * @param {string[]} props.colors - Array of colors for confetti pieces
 * @param {Object} props.confettiProps - Additional props to pass to react-confetti
 */
export default function FullScreenConfetti({
  active = true,
  duration = 0,
  pieces = 200,
  recycle = true,
  colors = ['#FFD700', '#FFC107', '#06BEE1', '#2541B2', '#FFFFFF', '#FF5252', '#69F0AE'],
  confettiProps = {}
}) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  const [isActive, setIsActive] = useState(active);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Handle duration
  useEffect(() => {
    setIsActive(active);
    
    if (duration && active) {
      const timer = setTimeout(() => {
        setIsActive(false);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [active, duration]);
  
  if (!isActive) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden" 
      style={{ position: 'fixed', top: 0, left: 0, bottom: 0, right: 0 }}
    >
      <Confetti
        width={dimensions.width}
        height={dimensions.height}
        numberOfPieces={pieces}
        recycle={recycle}
        colors={colors}
        gravity={0.1}
        wind={0.01}
        opacity={0.8}
        tweenDuration={5000}
        initialVelocityX={4}
        initialVelocityY={10}
        {...confettiProps}
      />
    </div>
  );
} 