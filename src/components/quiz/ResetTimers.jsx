import { useState } from 'react';
import { db } from "@/firebase/config";
import { ref, get, update } from "firebase/database";
import Button from "@/components/Button";
import toast from "react-hot-toast";

/**
 * A component for quiz hosts to reset or clear stuck timers
 */
export default function ResetTimers({ quizId, currentQuestionId }) {
  const [isResetting, setIsResetting] = useState(false);
  
  // Function to reset the current question timer
  const handleResetTimer = async () => {
    if (!quizId || !currentQuestionId) {
      toast.error("No current question to reset timer for");
      return;
    }
    
    try {
      setIsResetting(true);
      
      // Get current timer state first
      const timerRef = ref(db, `quizzes/${quizId}/questionTimers/${currentQuestionId}`);
      const snapshot = await get(timerRef);
      
      if (snapshot.exists()) {
        // Deactivate the timer
        await update(timerRef, {
          isActive: false,
          duration: 0,
          pausedAt: Date.now()
        });
        
        // Also update legacy timer
        await update(ref(db, `quizzes/${quizId}`), {
          timer: 0,
          timerRunning: false
        });
        
        toast.success("Timer reset successfully");
      } else {
        toast.info("No active timer found");
      }
    } catch (error) {
      console.error("Error resetting timer:", error);
      toast.error("Failed to reset timer");
    } finally {
      setIsResetting(false);
    }
  };
  
  // Function to clear all timers for the entire quiz
  const handleClearAllTimers = async () => {
    if (!quizId) {
      toast.error("No quiz ID provided");
      return;
    }
    
    if (!window.confirm("Are you sure you want to clear ALL timers for this quiz? This will affect all questions.")) {
      return;
    }
    
    try {
      setIsResetting(true);
      
      // Clear the entire questionTimers node
      await update(ref(db, `quizzes/${quizId}`), {
        questionTimers: null,
        timer: 0,
        timerRunning: false
      });
      
      toast.success("All timers cleared successfully");
    } catch (error) {
      console.error("Error clearing timers:", error);
      toast.error("Failed to clear timers");
    } finally {
      setIsResetting(false);
    }
  };
  
  return (
    <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
      <h3 className="text-lg font-bold mb-2">Timer Controls</h3>
      <p className="text-sm text-gray-600 mb-4">
        Use these controls if timers get stuck or need to be reset.
      </p>
      
      <div className="space-y-3">
        <Button
          onClick={handleResetTimer}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          disabled={isResetting || !currentQuestionId}
        >
          {isResetting ? "Resetting..." : "Reset Current Timer"}
        </Button>
        
        <Button
          onClick={handleClearAllTimers}
          className="w-full bg-red-500 hover:bg-red-600 text-white"
          disabled={isResetting}
        >
          {isResetting ? "Clearing..." : "Clear All Timers"}
        </Button>
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        <p>Reset Current: Stops just the current question's timer</p>
        <p>Clear All: Removes all timers from the entire quiz</p>
      </div>
    </div>
  );
} 