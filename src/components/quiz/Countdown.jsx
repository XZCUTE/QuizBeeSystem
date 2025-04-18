import { useState, useEffect } from 'react';

/**
 * Countdown timer component
 * @param {object} props
 * @param {number} props.seconds - Starting seconds for countdown
 * @param {boolean} props.isRunning - Whether the timer is currently running
 * @param {function} props.onComplete - Callback function when timer reaches zero
 */
export default function Countdown({ seconds, isRunning, onComplete }) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  
  // Reset timeLeft when seconds prop changes
  useEffect(() => {
    setTimeLeft(seconds);
  }, [seconds]);
  
  // Handle countdown logic
  useEffect(() => {
    if (!isRunning) return;
    
    // Don't start if timer is at 0
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timer);
          if (onComplete) onComplete();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, onComplete]);
  
  // Format time as MM:SS
  const formatTime = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Calculate percentage for circular progress
  const percentage = (timeLeft / seconds) * 100;
  
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Circular background */}
      <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#e6e6e6"
          strokeWidth="8"
        />
        {/* Progress circle with stroke-dasharray and stroke-dashoffset for animation */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={timeLeft > 5 ? '#4f46e5' : '#ef4444'}
          strokeWidth="8"
          strokeDasharray="283"  /* 2 * PI * 45 (circumference of circle) */
          strokeDashoffset={283 - (percentage / 100) * 283}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          className="transition-all duration-1000"
        />
      </svg>
      
      {/* Timer text */}
      <div className={`text-xl font-bold ${timeLeft > 5 ? 'text-primary' : 'text-red-500'}`}>
        {timeLeft < 60 ? timeLeft : formatTime()}
      </div>
    </div>
  );
} 