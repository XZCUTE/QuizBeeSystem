import { useState, useEffect, useRef } from 'react';
import { db } from "@/firebase/config";
import { ref, onValue, get, off } from "firebase/database";
import { motion } from "framer-motion";

/**
 * A more reliable centralized timer component that works with Firebase Realtime Database
 * with automatic periodic synchronization
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
    
    // If we're already syncing or it's been less than 1 second since last sync, skip
    const now = Date.now();
    if (isSyncing || (now - lastSyncTimeRef.current < 1000 && silent)) {
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
          
          // Only restart the countdown if the end time is significantly different
          // or if we don't have an existing end time
          if (!timerEndTime || Math.abs(endTime - timerEndTime) > 1000) {
            setTimerEndTime(endTime);
            setIsActive(true);
            
            // Start the local countdown
            startLocalCountdown(endTime);
          }
        } else if (!timerData.isActive) {
          // Timer is paused or stopped
          setIsActive(false);
          setTimeLeft(timerData.duration || initialTime);
          
          // Clear any running countdown
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } else {
        // No timer data exists
        setIsActive(false);
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
  
  // Setup auto-sync interval
  useEffect(() => {
    if (!quizId || !questionId) return;
    
    // Initial sync
    syncWithServer(true);
    
    // Set up auto-sync every 5 seconds
    syncIntervalRef.current = setInterval(() => {
      syncWithServer(true);
    }, 5000); // Auto-sync every 5 seconds
    
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
  
  // Setup timer listener
  useEffect(() => {
    if (!quizId || !questionId) return;
    
    const timerRef = ref(db, `quizzes/${quizId}/questionTimers/${questionId}`);
    
    // Listen for changes to the timer data
    const handleTimerUpdate = (snapshot) => {
      if (snapshot.exists()) {
        const timerData = snapshot.val();
        timerDataRef.current = timerData;
        
        // Calculate end time once and store it
        if (timerData.isActive && timerData.startTime && timerData.duration) {
          // Calculate when the timer will end
          const endTime = timerData.startTime + (timerData.duration * 1000);
          
          // Check if there's a significant change in end time
          const shouldUpdateTimer = !timerEndTime || Math.abs(endTime - timerEndTime) > 1000;
          
          if (shouldUpdateTimer) {
            setTimerEndTime(endTime);
            setIsActive(true);
            
            // Start the local countdown
            startLocalCountdown(endTime);
          }
        } else if (!timerData.isActive) {
          // Timer is paused or stopped
          setIsActive(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          
          // Update the time left with the duration from Firebase
          if (timerData.duration !== undefined) {
            setTimeLeft(timerData.duration);
          }
        }
      } else {
        // No timer data exists
        setIsActive(false);
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
  }, [quizId, questionId, initialTime, timerEndTime]);
  
  // Function to start the local countdown timer
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
    
    // Start a new interval that updates more frequently
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
    }, 250); // Update 4 times per second for more accurate timing
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
      syncWithServer(true);
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
        syncWithServer(true);
      }
    };
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center justify-center">
        <motion.div 
          animate={{ scale: timeLeft < 10 && isActive ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 0.5, repeat: timeLeft < 10 && isActive ? Infinity : 0 }}
          className={`flex items-center text-4xl font-bold ${
            !isActive ? "text-gray-500" : 
            timeLeft < 10 ? "text-red-500" : "text-primary"
          } ${!isActive ? 'opacity-75' : ''}`}
        >
          <span className="text-6xl font-bold">{timeLeft}</span>
          {!isActive && (
            <span className="text-sm ml-1 opacity-80">
              {timeLeft === initialTime ? "(not started)" : "(paused)"}
            </span>
          )}
        </motion.div>
      </div>
      
      {/* Progress bar indicator */}
      <div className="w-full h-2 my-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div 
          className={`h-full ${
            !isActive ? "bg-gray-400" : 
            timeLeft < 10 ? "bg-red-500" : "bg-primary"
          }`}
          initial={{ width: "100%" }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      {/* Auto-sync indicator - smaller and more subtle */}
      <div 
        className="text-xs text-gray-400 flex items-center gap-1 mt-1"
        onClick={() => syncWithServer(false)}
      >
        {isSyncing ? "Syncing..." : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span>Auto-syncing</span>
          </>
        )}
      </div>
    </div>
  );
} 