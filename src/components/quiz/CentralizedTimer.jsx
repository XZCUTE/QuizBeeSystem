import { useState, useEffect, useRef } from 'react';
import { db } from "@/firebase/config";
import { ref, onValue, get, off } from "firebase/database";
import { motion } from "framer-motion";

/**
 * A more reliable centralized timer component that works with Firebase Realtime Database
 * with automatic periodic synchronization and immediate start
 * @param {Object} props
 * @param {string} props.quizId - ID of the current quiz
 * @param {string} props.questionId - ID of the current question
 * @param {number} props.initialTime - The initial time in seconds
 * @param {Function} props.onTimeUp - Callback when time is up
 */
export default function CentralizedTimer({ quizId, questionId, initialTime = 30, onTimeUp }) {
  // Timer state
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerEndTime, setTimerEndTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Refs for interval and timer data
  const intervalRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const timerDataRef = useRef(null);
  const lastSyncTimeRef = useRef(0);
  
  // Function to fetch the latest timer data from Firebase
  const syncWithServer = async (silent = false) => {
    if (!quizId || !questionId) return;
    
    // If we're already syncing or it's been less than 500ms since last sync, skip
    const now = Date.now();
    if (isSyncing || (now - lastSyncTimeRef.current < 500 && silent)) {
      return;
    }
    
    if (!silent) {
      setIsSyncing(true);
    }
    
    try {
      // Record the sync time
      lastSyncTimeRef.current = now;
      
      // Fetch latest timer data
      const timerRef = ref(db, `quizzes/${quizId}/questionTimers/${questionId}`);
      const snapshot = await get(timerRef);
      
      if (snapshot.exists()) {
        const timerData = snapshot.val();
        timerDataRef.current = timerData;
        
        // Calculate end time if timer is active
        if (timerData.isActive && timerData.startTime && timerData.duration) {
          const endTime = timerData.startTime + (timerData.duration * 1000);
          
          // Update the timer state immediately
          setTimerEndTime(endTime);
          setIsActive(true);
          setIsPaused(false);
          
          // Start the local countdown
          startLocalCountdown(endTime);
        } else if (!timerData.isActive) {
          // Timer is paused or stopped
          setIsActive(false);
          
          // Check if timer is paused (has pausedRemaining or duration)
          const isPausedTimer = timerData.pausedAt && 
                               (timerData.pausedRemaining > 0 || timerData.duration > 0);
          
          setIsPaused(isPausedTimer);
          setTimeLeft(timerData.pausedRemaining || timerData.duration || initialTime);
          
          // Clear any running countdown
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } else {
        // Initialize timer with default values if no data exists
        setIsActive(false);
        setIsPaused(false);
        setTimeLeft(initialTime);
        
        // Clear any running countdown
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (error) {
      console.error("Error syncing timer:", error);
    } finally {
      if (!silent) {
        setIsSyncing(false);
      }
    }
  };
  
  // Setup auto-sync interval with more frequent updates
  useEffect(() => {
    if (!quizId || !questionId) return;
    
    // Initial sync immediately when component mounts
    syncWithServer(false);
    
    // Set up auto-sync every 2 seconds for more responsive updates
    syncIntervalRef.current = setInterval(() => {
      syncWithServer(true);
    }, 2000); // More frequent auto-sync
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [quizId, questionId]);
  
  // Listen for timer state changes from Firebase
  useEffect(() => {
    if (!quizId || !questionId) return;
    
    // Clean up previous listeners if any
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [quizId, questionId]);
  
  // Setup timer listener for real-time updates
  useEffect(() => {
    if (!quizId || !questionId) return;
    
    const timerRef = ref(db, `quizzes/${quizId}/questionTimers/${questionId}`);
    
    // Listen for changes to the timer data
    const handleTimerUpdate = (snapshot) => {
      if (snapshot.exists()) {
        const timerData = snapshot.val();
        timerDataRef.current = timerData;
        
        // Handle active timer
        if (timerData.isActive && timerData.startTime && timerData.duration) {
          // Calculate when the timer will end
          const endTime = timerData.startTime + (timerData.duration * 1000);
          
          // Always update the timer when there's a change
          setTimerEndTime(endTime);
          setIsActive(true);
          setIsPaused(false);
          
          // Start or update the local countdown
          startLocalCountdown(endTime);
        } else if (!timerData.isActive) {
          // Timer is paused or stopped
          setIsActive(false);
          
          // Check if timer is paused (has pausedRemaining or duration)
          const isPausedTimer = timerData.pausedAt && 
                               (timerData.pausedRemaining > 0 || timerData.duration > 0);
          
          setIsPaused(isPausedTimer);
          
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          
          // Update the time left with the duration from Firebase
          if (timerData.duration !== undefined) {
            setTimeLeft(timerData.pausedRemaining || timerData.duration);
          }
        }
      } else {
        // No timer data exists
        setIsActive(false);
        setIsPaused(false);
        setTimeLeft(initialTime);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };
    
    // Register listener
    onValue(timerRef, handleTimerUpdate);
    
    // Cleanup
    return () => {
      off(timerRef, 'value', handleTimerUpdate);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [quizId, questionId, initialTime]);
  
  // Function to start the local countdown timer with improved accuracy
  const startLocalCountdown = (endTime) => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Calculate initial remaining time
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    setTimeLeft(remaining);
    
    // If already expired
    if (remaining <= 0) {
      setIsActive(false);
      if (onTimeUp) onTimeUp();
      return;
    }
    
    // Start a new interval that updates more frequently for smoother countdown
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const secondsRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
      
      setTimeLeft(secondsRemaining);
      
      if (secondsRemaining <= 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsActive(false);
        if (onTimeUp) onTimeUp();
      }
    }, 100); // Update 10 times per second for smoother timing
  };
  
  // Calculate percentage for visual display
  const percentage = Math.min(100, Math.max(0, (timeLeft / initialTime) * 100));
  
  // Handle component unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, []);
  
  // Auto-reconnect mechanism in case of network issues
  useEffect(() => {
    const handleOnline = () => {
      // When coming back online, force a sync with the server
      syncWithServer(false); // Not silent for immediate update
    };
    
    // Listen for online event
    window.addEventListener('online', handleOnline);
    
    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  
  // Handle visibility change (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User came back to the tab, force a sync with the server
        syncWithServer(false); // Not silent for immediate update
      }
    };
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Visual display of the timer
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-1 text-center">
        {isSyncing ? (
          <span className="text-xs text-gray-500">Syncing timer...</span>
        ) : (
          <span className="text-xs text-gray-500">
            {isActive ? "Timer running" : isPaused ? "Timer paused" : "Timer stopped"}
          </span>
        )}
      </div>
      
      <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
        {/* Timer progress bar */}
        <motion.div 
          className={`absolute left-0 top-0 h-full ${
            isPaused 
              ? "bg-yellow-500 animate-pulse" 
              : percentage <= 20 
                ? "bg-red-500" 
                : percentage <= 60 
                  ? "bg-yellow-500" 
                  : "bg-green-500"
          }`}
          initial={{ width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3 }}
          style={{ 
            width: `${percentage}%` 
          }}
        />
        
        {/* Time remaining text */}
        <div className={`absolute inset-0 flex items-center justify-center font-bold ${
          percentage <= 20 ? "text-white" : "text-gray-800"
        }`}>
          {isPaused ? (
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {timeLeft}s (PAUSED)
            </span>
          ) : (
            `${timeLeft}s`
          )}
        </div>
      </div>
    </div>
  );
} 