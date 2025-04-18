import { useState, useEffect, useRef } from "react";
import { db } from "@/firebase/config";
import { ref, update, get, serverTimestamp, onValue, off } from "firebase/database";
import Button from "@/components/Button";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

// Enhanced difficulty multiplier with visual elements - removed multipliers as per new rules
const difficultyDetails = {
  "easy": { 
    color: "bg-green-500",
    label: "Easy",
    icon: "⭐"
  },
  "intermediate": { 
    color: "bg-blue-500",
    label: "Intermediate",
    icon: "⭐⭐" 
  },
  "hard": { 
    color: "bg-orange-500",
    label: "Hard",
    icon: "⭐⭐⭐" 
  },
  "difficult": { 
    color: "bg-red-500",
    label: "Difficult",
    icon: "⭐⭐⭐⭐"
  },
  "tie-breaker": { 
    color: "bg-purple-500",
    label: "Tie Breaker",
    icon: "🏆"
  }
};

export default function QuizQuestion({ question, quizId, participantId, isHost }) {
  const [timer, setTimer] = useState(question?.timer || 30);
  const [localSelectedAnswer, setLocalSelectedAnswer] = useState(null);
  const [submittedAnswer, setSubmittedAnswer] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [serverTime, setServerTime] = useState(null);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [scoreAnimation, setScoreAnimation] = useState({ show: false, score: 0 });
  const [difficultyTooltip, setDifficultyTooltip] = useState(false);
  const timeoutRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const answerSentAtRef = useRef(null);
  
  // Store references to Firebase listeners for proper cleanup
  const correctAnswerListenerRef = useRef(null);
  const userAnswerListenerRef = useRef(null);
  const timerListenerRef = useRef(null);
  
  // Get the effective answer (either submitted or local selection)
  const selectedAnswer = isAnswerSubmitted ? submittedAnswer : localSelectedAnswer;

  // This checks if participant already submitted an answer (one-time check)
  useEffect(() => {
    const checkExistingAnswer = async () => {
      if (isHost || !participantId || !question) return;
      
      try {
        const answerRef = ref(db, `quizzes/${quizId}/answers/${question.id}/${participantId}`);
        const snapshot = await get(answerRef);
        
        if (snapshot.exists()) {
          const answerData = snapshot.val();
          setSubmittedAnswer(answerData.answer);
          setIsAnswerSubmitted(true);
          
          // If server shows the correct answer, display it locally too
          if (question.showCorrectAnswer) {
            setShowCorrectAnswer(true);
          }
        }
      } catch (error) {
        console.error("Error checking existing answer:", error);
      }
    };
    
    // Reset all states when question changes
    setLocalSelectedAnswer(null);
    setSubmittedAnswer(null);
    setIsAnswerSubmitted(false);
    setShowCorrectAnswer(false);
    setTimer(question?.timer || 30);
    setAnswerLocked(false);
    setScoreAnimation({ show: false, score: 0 });
    
    // Clear any existing intervals or timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    // Check if participant already answered this question
    checkExistingAnswer();
    
    // Clean up all listeners from previous questions
    return () => {
      if (correctAnswerListenerRef.current) {
        off(correctAnswerListenerRef.current);
        correctAnswerListenerRef.current = null;
      }
      
      if (userAnswerListenerRef.current) {
        off(userAnswerListenerRef.current);
        userAnswerListenerRef.current = null;
      }
      
      if (timerListenerRef.current) {
        off(timerListenerRef.current);
        timerListenerRef.current = null;
      }
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [quizId, question, participantId, isHost]);
  
  // Setup timer and correct answer listener separately
  useEffect(() => {
    if (!quizId || !question || !question.id) return;
    
    // Set up timer when question loads
    const syncServerTime = async () => {
      try {
        // Get server time
        const timeRef = ref(db, ".info/serverTimeOffset");
        onValue(timeRef, (snapshot) => {
          const offset = snapshot.val() || 0;
          const serverTimeValue = Date.now() + offset;
          setServerTime(serverTimeValue);
          
          // Start local timer
          startTimer();
        });
        
        timerListenerRef.current = timeRef;
      } catch (error) {
        console.error("Error syncing server time:", error);
        // Fallback to just starting timer without server sync
        startTimer();
      }
    };
    
    const startTimer = () => {
      // If host or no question, don't start timer
      if (isHost || !question) return;
      
      // Calculate time remaining based on question start time
      let timeRemaining = question.timer;
      if (question.startedAt) {
        const elapsedTime = Math.floor((Date.now() - question.startedAt) / 1000);
        timeRemaining = Math.max(0, question.timer - elapsedTime);
      }
      
      setTimer(timeRemaining);
      
      // Lock answer if time is already up
      if (timeRemaining <= 0) {
        setAnswerLocked(true);
        return;
      }
      
      // Start interval for countdown
      timerIntervalRef.current = setInterval(() => {
        setTimer((prevTimer) => {
          const newTime = prevTimer - 1;
          if (newTime <= 0) {
            clearInterval(timerIntervalRef.current);
            setAnswerLocked(true);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    };
    
    syncServerTime();
    
    // Listen for correct answer reveal
    const correctAnswerRef = ref(db, `quizzes/${quizId}/questions/${question.id}/showCorrectAnswer`);
    correctAnswerListenerRef.current = correctAnswerRef;
    
    const correctAnswerListener = onValue(correctAnswerRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val() === true) {
        setShowCorrectAnswer(true);
      }
    });
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [quizId, question, isHost]);
  
  // This effect ONLY sets up a listener for the CURRENT participant's OWN answers
  useEffect(() => {
    if (isHost || !participantId || !question || !question.id) return;
    
    const userAnswerRef = ref(db, `quizzes/${quizId}/answers/${question.id}/${participantId}`);
    userAnswerListenerRef.current = userAnswerRef;
    
    const userAnswerListener = onValue(userAnswerRef, (snapshot) => {
      if (snapshot.exists()) {
        const answerData = snapshot.val();
        // Only update if this is this participant's own data
        setSubmittedAnswer(answerData.answer);
        setIsAnswerSubmitted(true);
      }
    });
    
    return () => {
      off(userAnswerRef, userAnswerListener);
    };
  }, [quizId, question, participantId, isHost]);

  const handleSelectAnswer = (index) => {
    if (isAnswerSubmitted || timer === 0 || answerLocked) return;
    // Update only the local selection state - never touches Firebase
    setLocalSelectedAnswer(index);
  };

  const handleSubmitAnswer = async () => {
    // Use localSelectedAnswer here because it represents the current selection
    if (localSelectedAnswer === null || isAnswerSubmitted || timer === 0 || answerLocked) return;
    
    try {
      // Lock the answer to prevent double submission
      setAnswerLocked(true);
      
      // Record submission time
      const submissionTime = Date.now();
      answerSentAtRef.current = submissionTime;
      
      // Check if the answer is correct
      const isCorrect = 
        (question.type === "multiple-choice" && localSelectedAnswer === question.correctAnswer) ||
        (question.type === "fill-in-blank" && localSelectedAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim());
      
      let scoreEarned = 0;
      
      if (isCorrect) {
        // Get the base points for the question
        const basePoints = question.points || 100;
        
        if (question.difficulty === "tie-breaker") {
          // For tie-breaker questions, calculate score based on answer order
          try {
            // Get all answers for this question to determine order
            const answersRef = ref(db, `quizzes/${quizId}/answers/${question.id}`);
            const snapshot = await get(answersRef);
            
            let answerPosition = 1; // Default position if no other answers
            
            if (snapshot.exists()) {
              const answersData = snapshot.val();
              
              // Filter for correct answers only
              const correctAnswers = [];
              Object.entries(answersData).forEach(([pid, answerData]) => {
                // Skip the current participant's answer we're processing
                if (pid === participantId) return;
                
                // Check if this answer is correct
                const isAnswerCorrect = 
                  (question.type === "multiple-choice" && answerData.answer === question.correctAnswer) ||
                  (question.type === "fill-in-blank" && answerData.answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim());
                
                if (isAnswerCorrect && answerData.scoreEarned > 0) {
                  correctAnswers.push({
                    timestamp: answerData.timestamp
                  });
                }
              });
              
              // The current participant's position is the number of previous correct answers + 1
              answerPosition = correctAnswers.length + 1;
            }
            
            // Calculate score: basePoints - ((position - 1) * 5)
            // First position gets full points, each subsequent position gets 5 fewer points
            scoreEarned = Math.max(0, basePoints - ((answerPosition - 1) * 5));
            
          } catch (error) {
            console.error("Error calculating tie-breaker score:", error);
            // Fallback to full points if we can't determine position
            scoreEarned = basePoints;
          }
        } else {
          // For regular difficulties, just use the base points
          scoreEarned = basePoints;
        }
      }
      
      // Show score animation if points were earned
      if (scoreEarned > 0) {
        setScoreAnimation({ show: true, score: scoreEarned });
        setTimeout(() => setScoreAnimation({ show: false, score: 0 }), 3000);
      }
      
      // Update local state BEFORE Firebase to avoid any delay
      // This makes UI feel more responsive
      setSubmittedAnswer(localSelectedAnswer);
      setIsAnswerSubmitted(true);
      
      // Save answer to database
      // This only affects this particular participant and question
      await update(ref(db, `quizzes/${quizId}/answers/${question.id}/${participantId}`), {
        answer: localSelectedAnswer,
        scoreEarned,
        isCorrect,
        timeRemaining: timer,
        timestamp: serverTimestamp()
      });
      
      // Update participant's total score
      if (scoreEarned > 0) {
        const participantRef = ref(db, `quizzes/${quizId}/participants/${participantId}`);
        const snapshot = await get(participantRef);
        
        if (snapshot.exists()) {
          const currentData = snapshot.val();
          const currentScore = currentData.score || 0;
          
          await update(participantRef, {
            score: currentScore + scoreEarned,
            lastAnswerAt: serverTimestamp()
          });
        }
      }
      
      toast.success("Answer submitted!");
      
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("Failed to submit answer. Please try again.");
      setAnswerLocked(false);
      setIsAnswerSubmitted(false);
    }
  };

  // If no question is provided, show a placeholder
  if (!question) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md text-center animate-pulse">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-300"></div>
        <div className="h-4 w-3/4 mx-auto mb-2 rounded bg-gray-300"></div>
        <div className="h-4 w-1/2 mx-auto rounded bg-gray-300"></div>
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      {/* Progress bar for time */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-200">
        <motion.div 
          className={`h-full ${timer < 10 ? "bg-red-500" : "bg-primary"}`}
          initial={{ width: "100%" }}
          animate={{ width: `${(timer / question.timer) * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
        ></motion.div>
      </div>
      
      {/* Difficulty badge and timer */}
      <div className="flex justify-between items-center mb-6 mt-2">
        <div 
          className="relative"
          onMouseEnter={() => setDifficultyTooltip(true)}
          onMouseLeave={() => setDifficultyTooltip(false)}
        >
          <div className={`px-3 py-1.5 rounded-full ${difficultyDetails[question.difficulty]?.color || "bg-gray-500"} text-white flex items-center gap-2`}>
            <span className="text-xs font-bold">{difficultyDetails[question.difficulty]?.label || "Standard"}</span>
            <span>{difficultyDetails[question.difficulty]?.icon || "⭐"}</span>
          </div>
          
          {/* Tooltip for difficulty explanation */}
          <AnimatePresence>
            {difficultyTooltip && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 mt-2 bg-white p-3 rounded-lg shadow-lg z-10 w-64"
              >
                <p className="text-sm font-semibold mb-1">{difficultyDetails[question.difficulty]?.label || "Standard"} Difficulty</p>
                {question.difficulty === "tie-breaker" ? (
                  <p className="text-xs text-gray-600">Tie-breaker: First correct answer gets full points. Each subsequent correct answer gets 5 fewer points.</p>
                ) : (
                  <p className="text-xs text-gray-600">Correct answer: {question.points} points. Incorrect: 0 points.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <motion.div 
          animate={{ scale: timer < 10 ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 0.5, repeat: timer < 10 ? Infinity : 0 }}
          className={`px-4 py-2 rounded-full ${timer < 10 ? "bg-red-500" : "bg-primary"} text-white flex items-center gap-2`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          <span className="font-bold">{timer}</span>
        </motion.div>
      </div>
      
      {/* Question */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{question.text}</h2>
        <div className="text-gray-500 flex items-center">
          <span className="font-medium">{question.points} points</span>
          {question.difficulty === "tie-breaker" && (
            <span className="ml-2 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
              Tie-breaker
            </span>
          )}
        </div>
      </div>
      
      {/* Options - Multiple Choice */}
      {question.type === "multiple-choice" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {question.options.map((option, index) => (
            <motion.button
              key={index}
              onClick={() => handleSelectAnswer(index)}
              disabled={isAnswerSubmitted || timer === 0 || answerLocked}
              whileHover={{ scale: isAnswerSubmitted || timer === 0 || answerLocked ? 1 : 1.02 }}
              whileTap={{ scale: isAnswerSubmitted || timer === 0 || answerLocked ? 1 : 0.98 }}
              className={`p-4 rounded-lg text-left relative overflow-hidden transition-all ${
                selectedAnswer === index
                  ? "bg-primary text-white"
                  : showCorrectAnswer && index === question.correctAnswer
                  ? "bg-green-500 text-white"
                  : showCorrectAnswer && selectedAnswer === index
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              {/* Option letter badge */}
              <span className="absolute left-0 top-0 bg-black/10 h-full w-10 flex items-center justify-center text-lg font-bold">
                {String.fromCharCode(65 + index)}
              </span>
              
              <div className="ml-8">{option}</div>
              
              {/* Show checkmark or X icon when correct answer is revealed */}
              {showCorrectAnswer && (
                <span className="absolute right-3 top-3">
                  {index === question.correctAnswer ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : selectedAnswer === index ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : null}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      )}
      
      {/* Fill in the blank */}
      {question.type === "fill-in-blank" && (
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Your answer"
              value={isAnswerSubmitted ? submittedAnswer || "" : localSelectedAnswer || ""}
              onChange={(e) => !isAnswerSubmitted && setLocalSelectedAnswer(e.target.value)}
              disabled={isAnswerSubmitted || timer === 0 || answerLocked}
              className="w-full p-4 pr-12 border-2 border-primary/30 focus:border-primary rounded-lg transition-all text-lg"
            />
            {localSelectedAnswer && !isAnswerSubmitted && (
              <button 
                onClick={() => setLocalSelectedAnswer("")} 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isAnswerSubmitted || timer === 0 || answerLocked}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
          
          {showCorrectAnswer && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <p className="font-bold text-green-700 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Correct answer:
              </p>
              <p className="bg-green-100 p-3 rounded-lg border border-green-200 mt-1 font-medium">{question.correctAnswer}</p>
            </motion.div>
          )}
        </div>
      )}
      
      {/* Host view of question */}
      {isHost && (
        <div className="border-t mt-6 pt-4">
          <div className="font-bold mb-2 text-primary">Host Information</div>
          <p className="bg-gray-100 p-3 rounded-lg">Correct answer: {
            question.type === "multiple-choice" 
              ? `Option ${String.fromCharCode(65 + question.correctAnswer)}: ${question.options[question.correctAnswer]}`
              : question.correctAnswer
          }</p>
          
          {question.difficulty === "tie-breaker" && (
            <div className="mt-2 text-sm text-gray-600 bg-purple-50 p-2 rounded">
              <p className="font-semibold">Tie-breaker scoring:</p>
              <p>First correct answer: {question.points} points</p>
              <p>Second correct answer: {question.points - 5} points</p>
              <p>Third correct answer: {question.points - 10} points</p>
              <p>And so on (-5 points per position)</p>
            </div>
          )}
        </div>
      )}
      
      {/* Submit button */}
      {!isHost && !isAnswerSubmitted && timer > 0 && !answerLocked && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            onClick={handleSubmitAnswer}
            disabled={localSelectedAnswer === null}
            className="w-full bg-gradient-to-r from-primary to-secondary py-3 text-lg"
          >
            Submit Answer
          </Button>
        </motion.div>
      )}
      
      {/* Results */}
      {isAnswerSubmitted && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-center p-6 rounded-lg border-2 ${submittedAnswer === question.correctAnswer ? "bg-green-100 border-green-300" : "bg-red-100 border-red-300"}`}
        >
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3 ${submittedAnswer === question.correctAnswer ? "bg-green-500" : "bg-red-500"} text-white`}>
            {submittedAnswer === question.correctAnswer ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <p className="text-xl font-bold">
            {submittedAnswer === question.correctAnswer ? "Correct! 🎉" : "Incorrect"}
          </p>
          {submittedAnswer === question.correctAnswer && scoreAnimation.score > 0 && (
            <div className="mt-2 text-lg text-green-700 font-medium">
              <span className="bg-green-200 px-2 py-1 rounded">{scoreAnimation.score} points earned</span>
            </div>
          )}
          <p className="mt-3">
            {showCorrectAnswer && submittedAnswer !== question.correctAnswer &&
              <span className="text-red-700 font-medium">
                The correct answer is: {
                  question.type === "multiple-choice" 
                    ? question.options[question.correctAnswer]
                    : question.correctAnswer
                }
              </span>
            }
          </p>
        </motion.div>
      )}
      
      {/* Animated score popup */}
      <AnimatePresence>
        {scoreAnimation.show && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: -60, scale: 1.2 }}
            exit={{ opacity: 0, y: -120, scale: 0.8 }}
            transition={{ duration: 1.5 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          >
            <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-full font-bold text-xl shadow-lg">
              +{scoreAnimation.score} points!
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 