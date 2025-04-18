import { useState, useEffect, useRef } from "react";
import { db } from "@/firebase/config";
import { ref, update, get, serverTimestamp, onValue, off, set } from "firebase/database";
import Button from "@/components/Button";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

// Define SVG components to replace Heroicons
const CheckCircleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArrowRightIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

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

  // Define a single function that handles both selection and submission for multiple-choice questions
  const handleSelectAnswer = (answer) => {
    if (question.type === "multiple-choice") {
      // For multiple choice, auto-submit when selected
      setLocalSelectedAnswer(answer);
      handleSubmitAnswer(answer); // Auto-submit the answer
    } else {
      // For fill-in-blank, just update the local selection
      setLocalSelectedAnswer(answer);
    }
  };

  // Original submitAnswer function still used for fill-in-the-blank questions
  const handleSubmitAnswer = async (answerValue = null) => {
    if (isAnswerSubmitted || timer === 0 || answerLocked) return;
    
    // Lock answer to prevent double submission
      setAnswerLocked(true);
    
    // Get the actual answer value based on question type
    const finalAnswer = question.type === "multiple-choice" 
      ? answerValue !== null ? answerValue : selectedAnswer
      : localSelectedAnswer.trim();
    
    // Convert letter option (A,B,C,D) to numeric index (0,1,2,3) for database storage
    let databaseAnswer = finalAnswer;
    if (question.type === "multiple-choice") {
      // Convert letter to index
      const optionMap = { "A": 0, "B": 1, "C": 2, "D": 3 };
      databaseAnswer = optionMap[finalAnswer] !== undefined ? optionMap[finalAnswer] : finalAnswer;
    }
      
      // Record submission time
      const submissionTime = Date.now();
    const serverTimeDiff = serverTime ? submissionTime - serverTime : 0;
    const adjustedSubmissionTime = Date.now() - serverTimeDiff;
    
    // Check if answer is correct using the consistent approach
    let isCorrect = false;
    if (question.type === "multiple-choice") {
      // For database comparison, we need to check numeric values against the stored numeric correct answer
      if (Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0) {
        // Convert correct answers from numbers to letters if needed for comparison
        const letterToIndex = { "A": 0, "B": 1, "C": 2, "D": 3 };
        const indexToLetter = { 0: "A", 1: "B", 2: "C", 3: "D" };
        
        // Handle both cases - correctAnswers could be array of indices or letters
        const normalizedCorrectAnswers = question.correctAnswers.map(ans => {
          if (typeof ans === 'number') {
            // Return the letter for UI comparison with finalAnswer
            return indexToLetter[ans];
          } else if (letterToIndex[ans] !== undefined) {
            // Already a letter format
            return ans;
          }
          return ans; // If it's something else, leave it unchanged
        });
        
        isCorrect = normalizedCorrectAnswers.includes(finalAnswer);
      } else if (question.correctAnswer !== undefined) {
        // Handle single correctAnswer case
        if (typeof question.correctAnswer === 'number') {
          // If correctAnswer is a number (index), compare with the databaseAnswer
          isCorrect = databaseAnswer === question.correctAnswer;
        } else {
          // If correctAnswer is a letter, compare directly
          isCorrect = finalAnswer === question.correctAnswer;
        }
      }
    } else {
      // For fill-in-blank, standardize to lowercase and trim
      const correctAnswer = question.correctAnswer ? question.correctAnswer.toLowerCase().trim() : '';
      isCorrect = finalAnswer.toLowerCase().trim() === correctAnswer;
    }
    
    // Calculate score (tie-breaker questions should sort by time for correct answers)
    let score = 0;
    if (isCorrect) {
      if (question.difficulty === "tie-breaker") {
        // For tie-breakers, we'll calculate score in the back-end based on order of correct answers
        score = question.points || 500; // Use question points as base score for tie-breakers
      } else {
        score = question.points || 1000; // Use question points if available
      }
    }
    
    try {
      // Save answer to database
      const thisParticipantAnswerRef = ref(
        db,
        `quizzes/${quizId}/answers/${question.id}/${participantId}`
      );
      
      // Update the answer in the database
      await update(thisParticipantAnswerRef, {
        answer: databaseAnswer, // Use the converted numeric index for database storage
        isCorrect,
        score,
        submittedAt: adjustedSubmissionTime,
      });
      
      // Also update the participant's total score in the quiz
      if (isCorrect && score > 0) {
        // Get the current total score for this participant
        const participantRef = ref(db, `quizzes/${quizId}/participants/${participantId}`);
        const participantSnap = await get(participantRef);
        
        if (participantSnap.exists()) {
          const participantData = participantSnap.val();
          const currentTotalScore = participantData.score || 0;
          const newTotalScore = currentTotalScore + score;
          
          // Update the participant's total score
          await update(participantRef, {
            score: newTotalScore,
            lastUpdated: adjustedSubmissionTime
          });
        }
      }
      
      // Update local state to reflect the submitted answer
      setIsAnswerSubmitted(true);
      setSubmittedAnswer(finalAnswer); // Keep letter format (A,B,C,D) for the UI
      
      // Show score animation for correct answers
      if (isCorrect && score > 0) {
        setScoreAnimation({
          show: true,
          score: score
        });
        
        // Hide score animation after 2 seconds
        setTimeout(() => {
          setScoreAnimation({
            show: false,
            score: 0
          });
        }, 2000);
      }
      
      // Show toast notification that answer was submitted
      toast.success(
        question.type === "multiple-choice" 
          ? "Answer auto-submitted!" 
          : "Answer submitted successfully!",
        { 
          duration: 2000,
          icon: "🚀",
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        }
      );
      
      // Show correct answer if enabled
      if (question.showCorrectAnswer) {
        setShowCorrectAnswer(true);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("Failed to submit answer. Please try again.");
      setAnswerLocked(false);
    }
  };

  // For fill-in-blank questions
  const handleInputChange = (e) => {
    if (isAnswerSubmitted || timer === 0 || answerLocked) return;
    setLocalSelectedAnswer(e.target.value);
  };

  // For fill-in-blank questions
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && localSelectedAnswer && !isAnswerSubmitted && timer > 0 && !answerLocked) {
      handleSubmitAnswer(localSelectedAnswer);
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

  // Get difficulty details if available
  const difficulty = question.difficulty || "intermediate";
  const difficultyInfo = difficultyDetails[difficulty] || difficultyDetails.intermediate;

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
          <div className={`px-3 py-1.5 rounded-full ${difficultyInfo.color || "bg-gray-500"} text-white flex items-center gap-2`}>
            <span className="text-xs font-bold">{difficultyInfo.label || "Standard"}</span>
            <span>{difficultyInfo.icon || "⭐"}</span>
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
                <p className="text-sm font-semibold mb-1">{difficultyInfo.label || "Standard"} Difficulty</p>
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
      
      {/* Question Title and Type Indicator */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">{question.title}</h2>
        <div className="flex items-center">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            question.type === "multiple-choice" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-800"
          }`}>
            {question.type === "multiple-choice" ? "Multiple Choice" : "Fill in the blank"}
          </div>
          {question.type === "multiple-choice" && (
            <motion.div 
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="ml-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-primary text-white text-sm flex items-center shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Auto-submit on click
            </motion.div>
          )}
        </div>
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
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {["A", "B", "C", "D"].map((option, index) => {
              // Skip rendering if the option is not in the question's options
              if (!question.options || !question.options[index]) return null;
              
              const isSelected = localSelectedAnswer === option;
              const isSubmitted = submittedAnswer === option;
              
              // For database comparison
              const indexToLetter = { 0: "A", 1: "B", 2: "C", 3: "D" };
              const letterToIndex = { "A": 0, "B": 1, "C": 2, "D": 3 };
              
              // Check if this option is a correct answer
              let isCorrectOption = false;
              if (Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0) {
                // Map numeric indices to letters for comparison
                const normalizedCorrectAnswers = question.correctAnswers.map(ans => {
                  return typeof ans === 'number' ? indexToLetter[ans] : ans;
                });
                isCorrectOption = normalizedCorrectAnswers.includes(option);
              } else if (question.correctAnswer !== undefined) {
                // If correctAnswer is a number (index), convert it to letter
                const correctLetter = typeof question.correctAnswer === 'number' 
                  ? indexToLetter[question.correctAnswer] 
                  : question.correctAnswer;
                  
                isCorrectOption = option === correctLetter;
              }
              
              // An option is correctly answered if it was submitted and is a correct option
              const isCorrect = submittedAnswer === option && isCorrectOption;
              
              // An option is incorrectly answered if it was submitted but not a correct option
              const isIncorrect = submittedAnswer === option && !isCorrectOption;
              
              // When showing correct answers, we want to highlight all correct options
              const shouldShowAsCorrect = showCorrectAnswer && isCorrectOption;
              
              return (
                <motion.button
                  key={option}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={`relative flex items-center p-4 border-2 rounded-lg shadow-sm transition-all duration-300 ${
                    (isSelected || isSubmitted) ? "border-primary" : "border-gray-200"
                  } ${
                    submittedAnswer ? "cursor-default" : "cursor-pointer hover:border-primary hover:shadow-md"
                  } ${
                    shouldShowAsCorrect ? "bg-green-50 border-green-500" : 
                    isIncorrect ? "bg-red-50 border-red-500" : "bg-white"
                  }`}
                  onClick={() => {
                    if (!submittedAnswer && !answerLocked) {
                      handleSelectAnswer(option);
                    }
                  }}
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  disabled={submittedAnswer || answerLocked}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full mr-4 ${
                    isSelected || isSubmitted ? "bg-primary text-white" : "bg-gray-100 text-gray-700"
                  } ${
                    shouldShowAsCorrect ? "bg-green-500 text-white" : isIncorrect ? "bg-red-500 text-white" : ""
                  }`}>
                    {option}
                  </div>
                  <div className="flex-1 text-left font-medium">
                    {question.options[index]}
                  </div>
                  {((isSelected || isSubmitted) || showCorrectAnswer) && (
                    <div className="absolute right-4">
                      {shouldShowAsCorrect && <CheckCircleIcon className="w-6 h-6 text-green-500" />}
                      {isIncorrect && <XCircleIcon className="w-6 h-6 text-red-500" />}
                      {!submittedAnswer && !shouldShowAsCorrect && <ArrowRightIcon className="w-6 h-6 text-primary animate-pulse" />}
                    </div>
                  )}
                  
                  {/* Added flash animation overlay for when option is clicked */}
                  {!submittedAnswer && !answerLocked && (
                    <motion.div 
                      className="absolute inset-0 bg-primary rounded-lg pointer-events-none"
                      initial={{ opacity: 0 }}
                      whileTap={{ opacity: 0.2, transition: { duration: 0.1 } }}
                      exit={{ opacity: 0 }}
                    />
              )}
            </motion.button>
              );
            })}
          </div>
          
          {/* Note explaining auto-submit behavior */}
          {!submittedAnswer && !answerLocked && (
            <div className="mt-4 text-sm text-gray-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>Your answer will be automatically submitted when you click an option.</span>
        </div>
          )}
        </>
      )}
      
      {/* Fill in the blank */}
      {question.type === "fill-in-blank" && (
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Your answer"
              value={isAnswerSubmitted ? submittedAnswer || "" : localSelectedAnswer || ""}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
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
          <p className="bg-gray-100 p-3 rounded-lg">
            Correct answer: {
            question.type === "multiple-choice" 
                ? (() => {
                    // For database comparison
                    const indexToLetter = { 0: "A", 1: "B", 2: "C", 3: "D" };
                    
                    const correctAnswers = Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0 
                      ? question.correctAnswers 
                      : question.correctAnswer !== undefined 
                        ? [question.correctAnswer]
                        : [];
                    
                    return correctAnswers.map(ans => {
                      // Convert numeric indices to letters if necessary
                      const letterOption = typeof ans === 'number' ? indexToLetter[ans] : ans;
                      
                      // Using the letter option, get the index for retrieving the option text
                      const letterIndex = letterOption.charCodeAt(0) - 65; // A=0, B=1, etc.
                      return `Option ${letterOption}: ${question.options[letterIndex]}`;
                    }).join(", ");
                  })()
              : question.correctAnswer
            }
          </p>
          
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
      
      {/* Submission status and feedback */}
      {isAnswerSubmitted && (
        <div className="mt-6 p-4 bg-blue-100 rounded-lg text-center">
          <p className="text-blue-800 font-medium">
            Your answer has been submitted.
            {showCorrectAnswer && selectedAnswer !== null && (
              (() => {
                // For database comparison
                const indexToLetter = { 0: "A", 1: "B", 2: "C", 3: "D" };
                const letterToIndex = { "A": 0, "B": 1, "C": 2, "D": 3 };
                
                // Check if the selected answer is correct
                let isCorrectAnswer = false;
                
                // For multiple choice, check against the correct answer(s)
                if (question.type === "multiple-choice") {
                  if (Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0) {
                    // Map numeric indices to letters for comparison
                    const normalizedCorrectAnswers = question.correctAnswers.map(ans => {
                      return typeof ans === 'number' ? indexToLetter[ans] : ans;
                    });
                    isCorrectAnswer = normalizedCorrectAnswers.includes(selectedAnswer);
                  } else if (question.correctAnswer !== undefined) {
                    // If correctAnswer is a number (index), convert it to letter for comparison
                    const correctLetter = typeof question.correctAnswer === 'number' 
                      ? indexToLetter[question.correctAnswer] 
                      : question.correctAnswer;
                      
                    isCorrectAnswer = selectedAnswer === correctLetter;
                  }
                } else {
                  // For fill-in-blank
                  const correctAnswer = question.correctAnswer ? question.correctAnswer.toLowerCase().trim() : '';
                  isCorrectAnswer = selectedAnswer.toLowerCase().trim() === correctAnswer;
                }
                
                return isCorrectAnswer 
                  ? <span className="text-green-700 font-bold"> Correct!</span>
                  : <span className="text-red-700 font-bold"> Not correct.</span>
              })()
            )}
          </p>
            </div>
          )}
      
      {/* Time's up message */}
      {timer === 0 && !isAnswerSubmitted && (
        <div className="mt-6 p-4 bg-yellow-100 rounded-lg text-center">
          <p className="text-yellow-800 font-bold">Time's up! You didn't submit an answer in time.</p>
        </div>
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
      
      {/* Submit Button - only show for fill-in-the-blank questions */}
      {question.type === "fill-in-blank" && (
        <button
          className={`mt-6 px-6 py-3 rounded-md bg-primary text-white font-bold shadow-md hover:bg-primary-dark transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
            submittedAnswer ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={() => handleSubmitAnswer(localSelectedAnswer)}
          disabled={submittedAnswer || !localSelectedAnswer || answerLocked}
        >
          {submittedAnswer ? "Answer Submitted" : "Submit Answer"}
        </button>
      )}
    </div>
  );
} 