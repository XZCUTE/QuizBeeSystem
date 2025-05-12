import { useState, useEffect, useRef } from "react";
import { db } from "@/firebase/config";
import { ref, update, get, serverTimestamp, onValue, off, set } from "firebase/database";
import Button from "@/components/Button";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import CentralizedTimer from "./CentralizedTimer";

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
  const [localSelectedAnswer, setLocalSelectedAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [answerLocked, setAnswerLocked] = useState(true);
  const [timerExpired, setTimerExpired] = useState(false);
  const [scoreAnimation, setScoreAnimation] = useState({ show: false, score: 0 });
  const [difficultyTooltip, setDifficultyTooltip] = useState(false);

  // New state to track local confirmation for fill-in-blank answers
  const [answerLocallyConfirmed, setAnswerLocallyConfirmed] = useState(false);
  // Store pending answer data for fill-in-blank questions
  const [pendingAnswer, setPendingAnswer] = useState(null);

  // References to keep track of Firebase listeners
  const correctAnswerListenerRef = useRef(null);
  const userAnswerListenerRef = useRef(null);
  const timerListenerRef = useRef(null);
  const submitPendingAnswersListenerRef = useRef(null);
  
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
    setLocalSelectedAnswer("");
    setSubmittedAnswer("");
    setIsAnswerSubmitted(false);
    setShowCorrectAnswer(false);
    setAnswerLocked(true);
    setTimerExpired(false);
    setScoreAnimation({ show: false, score: 0 });
    setAnswerLocallyConfirmed(false); // Reset local confirmation state
    setPendingAnswer(null); // Reset pending answer data
    
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
      
      if (submitPendingAnswersListenerRef.current) {
        off(submitPendingAnswersListenerRef.current);
        submitPendingAnswersListenerRef.current = null;
      }
    };
  }, [quizId, question, participantId, isHost]);
  
  // Monitor the centralized timer for this question
  useEffect(() => {
    if (!quizId || !question || !question.id) return;
    
    // Listen for the centralized timer status
    const timerRef = ref(db, `quizzes/${quizId}/questionTimers/${question.id}`);
    timerListenerRef.current = timerRef;
    
    const timerListener = onValue(timerRef, (snapshot) => {
      if (snapshot.exists()) {
        const timerData = snapshot.val();
        
        if (timerData.isActive && timerData.startTime && timerData.duration) {
          // Timer is active - allow answering
          const now = Date.now();
          const elapsedSeconds = Math.floor((now - timerData.startTime) / 1000);
          const remainingSeconds = Math.max(0, timerData.duration - elapsedSeconds);
          
          // If timer has expired, lock answers
          if (remainingSeconds <= 0) {
            setAnswerLocked(true);
            setTimerExpired(true);
            
            // Remove auto-submission of fill-in-blank answers when timer expires
            // Now answers will only be submitted when the host clicks "Reveal Answer"
          } else {
            // Timer is still running - ensure answers are unlocked
            if (!isAnswerSubmitted) {
              setAnswerLocked(false);
              setTimerExpired(false);
            }
          }
        } else {
          // Timer is not active or paused - lock answers
          if (!isAnswerSubmitted) {
            setAnswerLocked(true);
          }
          
          // If timer explicitly marked as expired, set expired state
          if (timerData.expired) {
            setTimerExpired(true);
            
            // Remove auto-submission of fill-in-blank answers when timer expires
            // Now answers will only be submitted when the host clicks "Reveal Answer"
          }
        }
      } else {
        // No timer data exists - lock answers by default
        if (!isAnswerSubmitted) {
          setAnswerLocked(true);
        }
      }
    });
    
    // Listen for correct answer reveal - use the specific path
    const correctAnswerRef = ref(db, `quizzes/${quizId}/questions/${question.id}/showCorrectAnswer`);
    correctAnswerListenerRef.current = correctAnswerRef;
    
    const correctAnswerListener = onValue(correctAnswerRef, (snapshot) => {
      console.log("Received showCorrectAnswer update:", snapshot.exists() ? snapshot.val() : "does not exist");
      if (snapshot.exists() && snapshot.val() === true) {
        // Always show the correct answer when the flag is set to true
        setShowCorrectAnswer(true);
        console.log("Showing correct answer for question:", question.id);
        
        // For identification questions, if we have a non-submitted answer, make sure it's set as pending
        if (question.type === "fill-in-blank" && !isAnswerSubmitted && !pendingAnswer && localSelectedAnswer) {
          // Check if the answer is correct
          const answerToSubmit = localSelectedAnswer.trim();
          const isCorrect = answerToSubmit.toLowerCase() === question.correctAnswer.toLowerCase().trim();
          
          // Calculate score if correct
          let score = 0;
          if (isCorrect) {
            if (question.difficulty === "tie-breaker") {
              score = question.points || 500;
            } else {
              score = question.points || 1000;
            }
          }
          
          // Store as a pending answer
          setPendingAnswer({
            databaseAnswer: answerToSubmit,
            isCorrect,
            score,
            submissionTime: Date.now()
          });
        }
      }
    });
    
    return () => {
      off(timerRef, timerListener);
      off(correctAnswerRef, correctAnswerListener);
    };
  }, [quizId, question, isAnswerSubmitted, pendingAnswer, localSelectedAnswer]);
  
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

  // Add a new useEffect to listen for the submitPendingAnswers flag
  useEffect(() => {
    if (!quizId || !question || !question.id || isHost) return;
    
    // Listen for the submitPendingAnswers flag at the new path
    const submitPendingAnswersRef = ref(db, `quizzes/${quizId}/pendingAnswerSubmissions/${question.id}`);
    submitPendingAnswersListenerRef.current = submitPendingAnswersRef;
    
    const submitPendingAnswersListener = onValue(submitPendingAnswersRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val().submitPendingAnswers === true) {
        console.log("Participant received submitPendingAnswers signal", pendingAnswer);
        
        // For identification questions, show the correct answer to all participants
        if (question.type === "fill-in-blank") {
          // Always show the correct answer when revealed by host
          setShowCorrectAnswer(true);
          
          // If there's a pending answer and the participant hasn't submitted yet, submit it now
          if (pendingAnswer && !isAnswerSubmitted) {
            console.log("Submitting pending answer", pendingAnswer);
            
            // Double-check the score calculation for correctness
            let verifiedScore = pendingAnswer.score;
            
            // Additional check to ensure score is correct
            if (pendingAnswer.isCorrect && verifiedScore <= 0) {
              console.warn("Correcting score for correct answer that had 0 points");
              verifiedScore = question.points || 1000;
            }
            
            submitAnswerToDatabase(
              pendingAnswer.databaseAnswer, 
              pendingAnswer.isCorrect, 
              verifiedScore, 
              pendingAnswer.submissionTime
            );
            
            // Update UI state to reflect the submitted answer
            setIsAnswerSubmitted(true);
            
            // Toast notification if there was a substantive answer
            if (pendingAnswer.databaseAnswer) {
              toast.success(
                pendingAnswer.isCorrect 
                  ? `Correct answer! +${verifiedScore} points` 
                  : "Your answer has been submitted!",
                { 
                  duration: 2000,
                  icon: pendingAnswer.isCorrect ? "🎯" : "🚀",
                  style: {
                    borderRadius: '10px',
                    background: pendingAnswer.isCorrect ? '#22c55e' : '#333',
                    color: '#fff',
                  },
                }
              );
            }
          } 
          // If there's no pending answer and the participant hasn't submitted, create and submit a blank answer
          else if (!pendingAnswer && !isAnswerSubmitted) {
            console.log("Auto-submitting blank answer");
            
            // Create a blank answer
            const blankAnswer = {
              databaseAnswer: "",
              isCorrect: false,
              score: 0,
              submissionTime: Date.now()
            };
            
            // Submit the blank answer
            submitAnswerToDatabase(
              blankAnswer.databaseAnswer, 
              blankAnswer.isCorrect, 
              blankAnswer.score, 
              blankAnswer.submissionTime
            );
            
            // Update UI state to reflect the submitted answer
            setIsAnswerSubmitted(true);
          }
        }
      }
    });
    
    return () => {
      if (submitPendingAnswersListenerRef.current) {
        off(submitPendingAnswersListenerRef.current, submitPendingAnswersListener);
        submitPendingAnswersListenerRef.current = null;
      }
    };
  }, [quizId, question, pendingAnswer, isAnswerSubmitted, isHost]);

  // Define a single function that handles both selection and submission for multiple-choice questions
  const handleSelectAnswer = (answer) => {
    // Don't allow selection if timer isn't active or has expired
    if (answerLocked || timerExpired || isAnswerSubmitted) return;
    
    if (question.type === "multiple-choice" || question.type === "true-false") {
      // For multiple choice and true-false, auto-submit when selected
      setLocalSelectedAnswer(answer);
      handleSubmitAnswer(answer); // Auto-submit the answer
    } else {
      // For fill-in-blank, just update the local selection
      setLocalSelectedAnswer(answer);
    }
  };

  // Function to send answer data to database (for fill-in-blank)
  const submitAnswerToDatabase = async (databaseAnswer, isCorrect, score, submissionTime) => {
    try {
      // Validate the score for correct answers - defensive programming
      if (isCorrect && score <= 0) {
        console.warn("Correcting invalid score for correct answer:", score);
        score = question.points || 1000; // Set a proper score if it was incorrectly calculated
      }
      
      console.log(`Submitting answer: "${databaseAnswer}", isCorrect: ${isCorrect}, score: ${score}`);
      
      // Save answer to database
      const thisParticipantAnswerRef = ref(
        db,
        `quizzes/${quizId}/answers/${question.id}/${participantId}`
      );
      
      // Update the answer in the database
      await update(thisParticipantAnswerRef, {
        answer: databaseAnswer, 
        isCorrect,
        score,
        submittedAt: submissionTime,
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
          
          console.log(`Updating participant score from ${currentTotalScore} to ${newTotalScore}`);
          
          // Update the participant's total score
          await update(participantRef, {
            score: newTotalScore,
            lastUpdated: submissionTime
          });
        } else {
          console.error("Participant data not found for ID:", participantId);
        }
      }
      
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
      
      // Show correct answer if enabled at the question level
      if (question.showCorrectAnswer) {
        setShowCorrectAnswer(true);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("Failed to submit answer. Please try again.");
    }
  };

  // Modified submitAnswer function 
  const handleSubmitAnswer = async (answerValue = null) => {
    if (isAnswerSubmitted || answerLocked || timerExpired) return;
    
    // Get the actual answer value based on question type with type safety
    const finalAnswer = question.type === "multiple-choice" || question.type === "true-false"
      ? answerValue !== null ? answerValue : selectedAnswer
      : typeof localSelectedAnswer === 'string' ? localSelectedAnswer.trim() : "";
    
    // Convert letter option (A,B,C,D) to numeric index (0,1,2,3) for database storage
    let databaseAnswer = finalAnswer;
    if (question.type === "multiple-choice" || question.type === "true-false") {
      // Convert letter to index
      const optionMap = { "A": 0, "B": 1, "C": 2, "D": 3 };
      databaseAnswer = optionMap[finalAnswer] !== undefined ? optionMap[finalAnswer] : finalAnswer;
    }
      
    // Record submission time
    const submissionTime = Date.now();
    
    // Check if answer is correct using the consistent approach
    let isCorrect = false;
    if (question.type === "multiple-choice" || question.type === "true-false") {
      // For database comparison, we need to check numeric values against the stored numeric correct answer
      if (Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0) {
        // Multiple correct answers case (rare)
        isCorrect = question.correctAnswers.includes(databaseAnswer);
      } else {
        // Single correct answer - most common case
        isCorrect = databaseAnswer === question.correctAnswer;
      }
    } else if (question.type === "fill-in-blank") {
      // For fill in the blank, we need to do a case-insensitive comparison
      const correctAnswerNormalized = question.correctAnswer.toLowerCase().trim();
      const userAnswerNormalized = finalAnswer.toLowerCase().trim();
      isCorrect = userAnswerNormalized === correctAnswerNormalized;
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
    
    // For fill-in-blank, we'll store the answer locally and wait for host to reveal
    if (question.type === "fill-in-blank") {
      // Store answer locally only
      setPendingAnswer({
        databaseAnswer,
        isCorrect,
        score,
        submissionTime
      });
      
      // Update local state to reflect pending submission
      setAnswerLocallyConfirmed(true);
      setSubmittedAnswer(finalAnswer);
      
      // Lock the input to prevent changes
      setAnswerLocked(true);
      
      // Show toast that answer is saved locally
      toast.success(
        "Answer saved! It will be submitted when the host reveals the answer.",
        { 
          duration: 2000,
          icon: "✅",
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        }
      );
      
      return;
    }
    
    try {
      // For multiple-choice/true-false, submit immediately
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
        submittedAt: submissionTime,
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
            lastUpdated: submissionTime
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
        "Answer auto-submitted!",
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
      
      // Show correct answer if enabled at the question level
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
    if (isAnswerSubmitted || answerLocked || timerExpired) return;
    setLocalSelectedAnswer(e.target.value);
  };

  // For fill-in-blank questions
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && localSelectedAnswer && !isAnswerSubmitted && !answerLocked && !timerExpired) {
      handleSubmitAnswer(localSelectedAnswer);
    }
  };

  // Handler for when the timer expires
  const handleTimerExpired = () => {
    setAnswerLocked(true);
    setTimerExpired(true);
    
    // Auto-submit fill-in-blank answers when the timer expires
    if (question.type === "fill-in-blank" && !isAnswerSubmitted) {
      // If the participant typed something but didn't submit, use what they typed
      // If they didn't type anything, submit a blank answer
      const answerToSubmit = localSelectedAnswer ? localSelectedAnswer.trim() : "";
      
      // Check if the answer is correct using case-insensitive comparison
      const correctAnswerNormalized = question.correctAnswer.toLowerCase().trim();
      const userAnswerNormalized = answerToSubmit.toLowerCase().trim();
      const isCorrect = userAnswerNormalized === correctAnswerNormalized;
      
      // Calculate score if correct
      let score = 0;
      if (isCorrect) {
        if (question.difficulty === "tie-breaker") {
          score = question.points || 500;
        } else {
          score = question.points || 1000;
        }
      }
      
      // Store answer as pending for later submission when host reveals answer
      setPendingAnswer({
        databaseAnswer: answerToSubmit,
        isCorrect,
        score,
        submissionTime: Date.now()
      });
      
      // Update UI to show the answer is saved but not submitted yet
      setAnswerLocallyConfirmed(true);
      
      console.log(`Auto-saved answer: "${answerToSubmit}", isCorrect: ${isCorrect}, score: ${score}`);
      
      // Show a toast message if they had an answer
      if (answerToSubmit) {
        toast.info(
          "Your answer has been auto-saved and will be submitted when the host reveals the answer.",
          { 
            duration: 3000,
            icon: "🕒",
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
            },
          }
        );
      }
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

  // Add a visual overlay when answers are locked but timer hasn't started
  return (
    <div className="p-6 relative">
      {/* Add an overlay when answers are locked */}
      {answerLocked && !timerExpired && !isAnswerSubmitted && !isHost && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 p-3 rounded-t-lg text-center z-10">
          <p className="text-amber-600 font-medium flex items-center justify-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Waiting for timer to start...
          </p>
        </div>
      )}
      
      {/* Centralized timer display - visible to all */}
      <div className="absolute top-0 left-0 w-full flex justify-center items-center py-2">
        <CentralizedTimer 
          quizId={quizId} 
          questionId={question.id} 
          initialTime={question.timer || 30}
          onTimeUp={handleTimerExpired}
        />
      </div>
      
      {/* Difficulty badge */}
      <div className="flex justify-between items-center mb-6 mt-12">
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
        
        {timerExpired && !isHost && (
          <div className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold animate-pulse">
            Time's up!
          </div>
        )}
      </div>
      
      {/* Question Title and Type Indicator */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">{question.title || question.questionText || question.text || "Unknown Question"}</h2>
        <div className="flex items-center">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            question.type === "multiple-choice" 
              ? "bg-primary/10 text-primary" 
              : question.type === "true-false"
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
          }`}>
            {question.type === "multiple-choice" 
              ? "Multiple Choice" 
              : question.type === "true-false"
                ? "True or False"
                : "Identification"
            }
          </div>
          {(question.type === "multiple-choice" || question.type === "true-false") && (
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
      
      {/* Display question image if provided */}
      {question.imageUrl && (
        <div className="bg-gray-50 p-2 rounded-lg mb-5">
          <img src={question.imageUrl} alt="Question" className="mx-auto max-h-64 object-contain rounded" />
        </div>
      )}
      
      {/* Score animation */}
      <AnimatePresence>
        {scoreAnimation.show && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 0 }}
            animate={{ scale: 1.2, opacity: 1, y: -20 }}
            exit={{ scale: 0.5, opacity: 0, y: -50 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <div className="bg-green-500 text-white font-bold py-2 px-4 rounded-full text-xl flex items-center gap-2">
              <span>+{scoreAnimation.score}</span>
              <span>🎯</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Multiple choice options */}
      {question.type === "multiple-choice" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {question.options.map((option, index) => {
            // Convert index to letter
            const letter = String.fromCharCode(65 + index); // A, B, C, D
            
            // Determine if this option is selected
            const isSelected = selectedAnswer === letter;
            
            // Determine if this is the correct answer (only show after submission)
            const isCorrectAnswer = showCorrectAnswer && 
              ((typeof question.correctAnswer === 'number' && index === question.correctAnswer) || 
               (question.correctAnswer === letter) ||
               (Array.isArray(question.correctAnswers) && 
                (question.correctAnswers.includes(index) || question.correctAnswers.includes(letter))));
            
            // Determine if this is incorrect (only if selected AND submitted AND showing correct answer)
            const isIncorrectSelected = showCorrectAnswer && isSelected && !isCorrectAnswer;
            
            // Animation variants for choice buttons
            let buttonVariant = "default";
            if (isSelected && !isAnswerSubmitted) {
              buttonVariant = "selected";
            } else if (isCorrectAnswer && showCorrectAnswer) {
              buttonVariant = "correct";
            } else if (isIncorrectSelected) {
              buttonVariant = "incorrect";
            }
            
            const buttonVariants = {
              default: {
                borderColor: "rgba(79, 70, 229, 0.3)",
                backgroundColor: "white"
              },
              selected: {
                borderColor: "rgb(79, 70, 229)",
                backgroundColor: "rgba(79, 70, 229, 0.1)"
              },
              correct: {
                borderColor: "rgb(34, 197, 94)",
                backgroundColor: "rgba(34, 197, 94, 0.1)"
              },
              incorrect: {
                borderColor: "rgb(239, 68, 68)",
                backgroundColor: "rgba(239, 68, 68, 0.1)"
              }
            };
              
              return (
                <motion.button
                key={index}
                onClick={() => handleSelectAnswer(letter)}
                disabled={isAnswerSubmitted || answerLocked || timerExpired}
                className={`p-4 rounded-lg border-2 font-medium text-left flex items-start relative transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed
                  ${isSelected && !isAnswerSubmitted ? "border-primary bg-primary/10" : ""}
                  ${isCorrectAnswer && showCorrectAnswer ? "border-green-500 bg-green-50" : ""}
                  ${isIncorrectSelected ? "border-red-500 bg-red-50" : ""}
                `}
                animate={buttonVariant}
                variants={buttonVariants}
                initial="default"
                whileHover={isAnswerSubmitted || answerLocked || timerExpired ? {} : { scale: 1.01 }}
                whileTap={isAnswerSubmitted || answerLocked || timerExpired ? {} : { scale: 0.99 }}
              >
                <span className={`flex justify-center items-center min-w-[36px] h-9 rounded-full mr-3 text-white font-bold
                  ${isCorrectAnswer && showCorrectAnswer ? "bg-green-500" : isIncorrectSelected ? "bg-red-500" : "bg-primary"}`}
                >
                  {letter}
                </span>
                <span className="flex-grow">{option}</span>
                
                {/* Show check or X icon if submitted */}
                {showCorrectAnswer && (
                  <div className="absolute right-4 top-4">
                    {isCorrectAnswer ? (
                      <CheckCircleIcon className="w-6 h-6 text-green-500" />
                    ) : isIncorrectSelected ? (
                      <XCircleIcon className="w-6 h-6 text-red-500" />
                    ) : null}
                  </div>
              )}
            </motion.button>
              );
            })}
          </div>
      )}
      
      {/* True/False options */}
      {question.type === "true-false" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {question.options.map((option, index) => {
            // Convert index to letter
            const letter = String.fromCharCode(65 + index); // A, B (True, False)
            
            // Determine if this option is selected
            const isSelected = selectedAnswer === letter;
            
            // Determine if this is the correct answer (only show after submission)
            const isCorrectAnswer = showCorrectAnswer && 
              ((typeof question.correctAnswer === 'number' && index === question.correctAnswer) || 
               (question.correctAnswer === letter));
            
            // Determine if this is incorrect (only if selected AND submitted AND showing correct answer)
            const isIncorrectSelected = showCorrectAnswer && isSelected && !isCorrectAnswer;
            
            // Animation variants for choice buttons
            let buttonVariant = "default";
            if (isSelected && !isAnswerSubmitted) {
              buttonVariant = "selected";
            } else if (isCorrectAnswer && showCorrectAnswer) {
              buttonVariant = "correct";
            } else if (isIncorrectSelected) {
              buttonVariant = "incorrect";
            }
            
            const buttonVariants = {
              default: {
                borderColor: "rgba(79, 70, 229, 0.3)",
                backgroundColor: "white"
              },
              selected: {
                borderColor: "rgb(79, 70, 229)",
                backgroundColor: "rgba(79, 70, 229, 0.1)"
              },
              correct: {
                borderColor: "rgb(34, 197, 94)",
                backgroundColor: "rgba(34, 197, 94, 0.1)"
              },
              incorrect: {
                borderColor: "rgb(239, 68, 68)",
                backgroundColor: "rgba(239, 68, 68, 0.1)"
              }
            };
            
            return (
              <motion.button
                key={letter}
                variants={buttonVariants}
                initial="default"
                animate={buttonVariant}
                onClick={() => handleSelectAnswer(letter)}
                disabled={isAnswerSubmitted || answerLocked || timerExpired}
                className={`
                  relative p-4 rounded-lg border-2 transition-all hover:shadow-md 
                  flex items-center ${isAnswerSubmitted || answerLocked || timerExpired ? 'opacity-80 cursor-not-allowed' : 'hover:scale-102'}
                `}
              >
                {/* Option indicator (A, B) */}
                <div className={`
                  w-8 h-8 rounded-full mr-3 flex items-center justify-center text-lg font-semibold 
                  ${isSelected ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'}
                `}>
                  {letter}
                </div>
                
                {/* Option text */}
                <span className="text-lg font-medium">
                  {option}
                </span>
                
                {/* Correct/incorrect indicators (shown when appropriate) */}
                {showCorrectAnswer && isCorrectAnswer && (
                  <div className="ml-auto flex items-center text-green-500">
                    <CheckCircleIcon className="h-6 w-6" />
                  </div>
                )}
                
                {showCorrectAnswer && isIncorrectSelected && (
                  <div className="ml-auto flex items-center text-red-500">
                    <XCircleIcon className="h-6 w-6" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}
      
      {/* Identification input field */}
      {question.type === "fill-in-blank" && (
        <div className="mt-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Type your answer here..." 
              value={localSelectedAnswer || ''}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isAnswerSubmitted || answerLocked || timerExpired}
              className="w-full p-4 pr-12 border-2 border-primary/30 focus:border-primary rounded-lg transition-all text-lg"
            />
            
            {/* Clear button */}
            {localSelectedAnswer && !isAnswerSubmitted && !answerLocked && !timerExpired && (
              <button 
                onClick={() => setLocalSelectedAnswer("")} 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isAnswerSubmitted || answerLocked || timerExpired}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Show correct answer after submission */}
          {showCorrectAnswer && (
            <div className={`mt-4 p-3 rounded-lg ${
              isAnswerSubmitted && 
              submittedAnswer && 
              typeof submittedAnswer === 'string' && 
              submittedAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim() 
                ? "bg-green-50 border border-green-500" 
                : "bg-yellow-50 border border-yellow-500"
            }`}>
              <p className="text-sm font-medium mb-1">Correct answer:</p>
              <p className="font-bold text-lg">
                {question.correctAnswer}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Submit button for Identification */}
      {question.type === "fill-in-blank" && !isAnswerSubmitted && !answerLocked && !timerExpired && (
        <div className="mt-6">
          <Button
            variant="primary"
            className={`w-full py-3 text-lg ${(!localSelectedAnswer || localSelectedAnswer.trim() === "" || answerLocallyConfirmed) ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => handleSubmitAnswer(localSelectedAnswer)}
            disabled={!localSelectedAnswer || localSelectedAnswer.trim() === "" || answerLocallyConfirmed}
          >
            Save Answer
            <ArrowRightIcon className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-xs text-center mt-2 text-gray-500">
            {answerLocallyConfirmed 
              ? "Your answer has been saved and cannot be changed." 
              : "Your answer will be submitted when the host reveals the answer."
            }
          </p>
        </div>
      )}
      
      {/* Answer locally confirmed message */}
      {question.type === "fill-in-blank" && answerLocallyConfirmed && !isAnswerSubmitted && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <div className="flex items-center justify-center gap-2">
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
            <p className="text-green-600 font-bold">Your answer has been saved!</p>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            The answer will be submitted when the host reveals the correct answer.
          </p>
        </div>
      )}
      
      {/* Answer submitted confirmation */}
      {isAnswerSubmitted && (
        <div className="mt-6 p-4 bg-primary/10 rounded-lg text-center">
          <div className="flex items-center justify-center gap-2">
            <CheckCircleIcon className="w-6 h-6 text-primary" />
            <p className="text-primary font-bold">Your answer has been submitted!</p>
          </div>
          {!showCorrectAnswer && (
            <p className="text-sm text-gray-600 mt-2">
              Wait until the host reveals the correct answer.
            </p>
          )}
        </div>
      )}
      
      {/* Add a message to show when answers are locked because timer hasn't started */}
      {!isHost && answerLocked && !timerExpired && !isAnswerSubmitted && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <p className="text-amber-600 font-medium">Waiting for the host to start the timer...</p>
          <p className="text-xs text-gray-600 mt-1">You'll be able to answer once the timer starts.</p>
        </div>
      )}
      
      {/* Host view (only for host) */}
      {isHost && (
        <div className="mt-8 border-t border-gray-200 pt-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Host Information</h3>
            <p className="mb-2">
              <span className="font-medium">Correct Answer:</span>{" "}
              {question.type === "multiple-choice" 
                ? (Array.isArray(question.correctAnswers) 
                   ? question.correctAnswers.map(ans => typeof ans === 'number' ? String.fromCharCode(65 + ans) : ans).join(", ") 
                   : (typeof question.correctAnswer === 'number' 
                      ? String.fromCharCode(65 + question.correctAnswer) 
                      : question.correctAnswer))
                : question.correctAnswer}
            </p>
            <p>
              <span className="font-medium">Points:</span> {question.points || 1000}
            </p>
            {question.difficulty === "tie-breaker" && (
              <p className="text-sm text-gray-600 mt-2">
                For tie-breakers, participants who answer correctly will be ranked by time. 
                First correct answer gets full points, others get fewer points based on order.
              </p>
            )}
          </div>
            </div>
      )}
    </div>
  );
} 