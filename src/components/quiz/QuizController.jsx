import { useState, useEffect, useCallback } from "react";
import { db } from "@/firebase/config";
import { ref, update, get, onValue, set, serverTimestamp, off } from "firebase/database";
import { useNavigate } from "react-router-dom";
import Button from "@/components/Button";
import QuizQuestion from "./QuizQuestion";
import Leaderboard from "./Leaderboard";
import EnhancedLeaderboard from "./EnhancedLeaderboard";
import ParticipantMonitor from "./ParticipantMonitor";
import WinnerCelebration from "./WinnerCelebration";
import TieBreakerStats from "./TieBreakerStats";
import TiedParticipants from "./TiedParticipants";
import toast from "react-hot-toast";
import CentralizedTimer from "./CentralizedTimer";
import { motion, AnimatePresence } from "framer-motion";

export default function QuizController({ quizId }) {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(true); // Always show leaderboard by default
  const [showParticipants, setShowParticipants] = useState(false);
  const [showTieBreakerStats, setShowTieBreakerStats] = useState(false);
  const [showWinners, setShowWinners] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [timer, setTimer] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [winnersLoading, setWinnersLoading] = useState(false);

  // Load quiz data
  useEffect(() => {
    if (!quizId) return;

    const quizRef = ref(db, `quizzes/${quizId}`);
    
    const fetchQuiz = async () => {
      try {
        const snapshot = await get(quizRef);
        if (snapshot.exists()) {
          const quizData = snapshot.val();
          setQuiz(quizData);
          
          // Set current question index
          if (quizData.currentQuestionIndex !== undefined) {
            setCurrentQuestionIndex(quizData.currentQuestionIndex);
          }
          
          if (quizData.status === "completed") {
            setQuizCompleted(true);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Error loading quiz:", error);
        toast.error("Failed to load quiz data");
        setLoading(false);
      }
    };
    
    fetchQuiz();
    
    // Also set up listener for real-time updates
    const unsubscribe = onValue(quizRef, (snapshot) => {
      if (snapshot.exists()) {
        const quizData = snapshot.val();
        setQuiz(quizData);
        
        // Update current question index if it changed
        if (quizData.currentQuestionIndex !== undefined) {
          setCurrentQuestionIndex(quizData.currentQuestionIndex);
        }
        
        if (quizData.status === "completed") {
          setQuizCompleted(true);
        }
      }
    });

    // Get all unique teams
    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    const participantsUnsubscribe = onValue(participantsRef, (snapshot) => {
      if (snapshot.exists()) {
        const participantsData = snapshot.val();
        const teamsList = Object.values(participantsData)
          .map(p => p.team)
          .filter((team, index, self) => team && self.indexOf(team) === index);
        
        setTeams(['All Participants', ...teamsList]);
      }
    });

    return () => {
      unsubscribe();
      participantsUnsubscribe();
    };
  }, [quizId]);

  // Optimized startTimer function to ensure it works reliably and starts instantly
  const startTimer = useCallback(async (seconds) => {
    try {
      if (!quiz || !quiz.questions) return;
      
      const questionId = quiz.questions[currentQuestionIndex].id;
      
      // Ensure any existing timer is properly stopped
      await update(ref(db, `quizzes/${quizId}/questionTimers/${questionId}`), {
        isActive: false
      });
      
      // Update legacy timer for backward compatibility
      await update(ref(db, `quizzes/${quizId}`), {
        timerRunning: false
      });
      
      // Get the current timestamp - use server timestamp for better sync
      const currentTime = Date.now();
      
      // Set the centralized timer in the database and immediately activate it
      await set(ref(db, `quizzes/${quizId}/questionTimers/${questionId}`), {
        duration: seconds,
        startTime: currentTime,
        isActive: true
      });
      
      // Update legacy timer for backward compatibility
      await update(ref(db, `quizzes/${quizId}`), {
        timer: seconds,
        timerRunning: true
      });
      
      // Update local state to reflect timer running
      setTimerRunning(true);
      
      return true;
    } catch (error) {
      console.error("Error starting timer:", error);
      toast.error("Failed to start timer");
      return false;
    }
  }, [quiz, currentQuestionIndex, quizId, setTimerRunning]);

  // Optimized next question handler to start timer immediately
  const handleNextQuestion = async () => {
    if (!quiz || !quiz.questions) return;
    
    const nextIndex = currentQuestionIndex + 1;
    
    // Check if we've reached the end of the quiz
    if (nextIndex >= quiz.questions.length) {
      // End the quiz
      await update(ref(db, `quizzes/${quizId}`), {
        status: "completed",
        completedAt: new Date().toISOString()
      });
      
      setQuizCompleted(true);
      toast.success("Quiz completed!");
      return;
    }
    
    // Update the current question index in the database and start timer immediately
    try {
      // Update question index
      await update(ref(db, `quizzes/${quizId}`), {
        currentQuestionIndex: nextIndex,
        // Mark current time as when the question started
        currentQuestionStartedAt: serverTimestamp()
      });
      
      // Update local state
      setCurrentQuestionIndex(nextIndex);
      
      // Reset timer state
      setTimerRunning(false);
      setTimer(null);
      
      toast.success(`Moving to Question ${nextIndex + 1}`);
      
      // Start timer immediately for the next question - no delays
      if (quiz.questions[nextIndex]) {
        const questionTimer = quiz.questions[nextIndex].timer || 30;
        await startTimer(questionTimer);
      }
    } catch (error) {
      console.error("Error moving to next question:", error);
      toast.error("Failed to move to next question");
    }
  };

  // Optimized auto-start effect to start timer immediately without delay
  useEffect(() => {
    if (quiz && quiz.status === "active" && !timerRunning) {
      // Make sure we have a current question that isn't already being timed
      const currentQ = quiz.questions[currentQuestionIndex];
      
      if (currentQ) {
        // Check if this question already has an active timer
        const checkForExistingTimer = async () => {
          try {
            const timerRef = ref(db, `quizzes/${quizId}/questionTimers/${currentQ.id}`);
            const snapshot = await get(timerRef);
            
            // Only auto-start if there's no active timer for this question
            if (!snapshot.exists() || !snapshot.val().isActive) {
              // Start timer immediately - no delays
              const questionTimer = currentQ.timer || 30;
              await startTimer(questionTimer);
            }
          } catch (error) {
            console.error("Error checking for existing timer:", error);
          }
        };
        
        // Execute immediately
        checkForExistingTimer();
      }
    }
  }, [quiz, currentQuestionIndex, timerRunning, quizId, startTimer]);

  // Optimized function to start the quiz immediately without delays
  const handleStartQuiz = async () => {
    try {
      // Update quiz status to active if it's not already
      if (!quiz || quiz.status === 'active') return;
      
      // Update the quiz status in the database
      await update(ref(db, `quizzes/${quizId}`), {
        status: "active",
        startedAt: serverTimestamp()
      });
      
      // Start timer immediately for the first question - no delays
      if (quiz.questions && quiz.questions.length > 0) {
        const questionTimer = quiz.questions[0].timer || 30;
        await startTimer(questionTimer);
      }
      
      // Toast notification
      toast.success("Quiz started!");
    } catch (error) {
      console.error("Error starting quiz:", error);
      toast.error("Failed to start quiz");
    }
  };

  const handleToggleLeaderboard = () => {
    setShowLeaderboard(true);
    setShowParticipants(false);
    setShowTieBreakerStats(false);
  };

  const handleToggleParticipants = () => {
    setShowLeaderboard(false);
    setShowParticipants(true);
    setShowTieBreakerStats(false);
  };
  
  const handleToggleTieBreakers = () => {
    setShowLeaderboard(false);
    setShowParticipants(false);
    setShowTieBreakerStats(true);
  };
  
  const handleShowWinners = () => {
    setWinnersLoading(true);
    
    // Use requestAnimationFrame to ensure the UI updates before transitioning
    requestAnimationFrame(() => {
      setShowWinners(true);
      setTimeout(() => setWinnersLoading(false), 100);
    });
  };
  
  const handleBackToQuiz = () => {
    console.log("Returning to quiz results from winners view");
    try {
      setShowWinners(false);
    } catch (err) {
      console.error("Error returning from winners view:", err);
      toast.error("Failed to return to results. Please refresh the page.");
    }
  };

  const handleEndQuiz = async () => {
    if (!quiz) return;
    
    if (window.confirm("Are you sure you want to end the quiz early? This cannot be undone.")) {
      // Update quiz status to completed
      await update(ref(db, `quizzes/${quizId}`), {
        status: "completed",
        completedAt: new Date().toISOString()
      });
      
      setQuizCompleted(true);
      toast.success("Quiz ended");
    }
  };

  const handleTeamSelect = (team) => {
    setSelectedTeam(team === 'All Participants' ? null : team);
  };

  useEffect(() => {
    if (!quizId) return;
    
    // Listen for timer updates
    const timerRef = ref(db, `quizzes/${quizId}/timer`);
    const unsubscribeTimer = onValue(timerRef, (snapshot) => {
      if (snapshot.exists()) {
        setTimer(snapshot.val());
      }
    });
    
    // Listen for timer status
    const timerRunningRef = ref(db, `quizzes/${quizId}/timerRunning`);
    const unsubscribeTimerRunning = onValue(timerRunningRef, (snapshot) => {
      if (snapshot.exists()) {
        setTimerRunning(snapshot.val());
      }
    });
    
    // Listen for current question index
    const currentQuestionIndexRef = ref(db, `quizzes/${quizId}/currentQuestionIndex`);
    const unsubscribeQuestionIndex = onValue(currentQuestionIndexRef, (snapshot) => {
      if (snapshot.exists()) {
        setCurrentQuestionIndex(snapshot.val());
      }
    });
    
    return () => {
      unsubscribeTimer();
      unsubscribeTimerRunning();
      unsubscribeQuestionIndex();
    };
  }, [quizId]);

  // Improved stopTimer function to ensure it works reliably
  const stopTimer = async () => {
    try {
      if (!quiz || !quiz.questions) return;
      
      const questionId = quiz.questions[currentQuestionIndex].id;
      
      // Get current timer state to save current time remaining
      const timerRef = ref(db, `quizzes/${quizId}/questionTimers/${questionId}`);
      const snapshot = await get(timerRef);
      let remainingSeconds = 0;
      
      if (snapshot.exists()) {
        const timerData = snapshot.val();
        if (timerData.isActive && timerData.startTime && timerData.duration) {
          const currentTime = Date.now();
          const elapsedSeconds = Math.floor((currentTime - timerData.startTime) / 1000);
          remainingSeconds = Math.max(0, timerData.duration - elapsedSeconds);
        }
      }
      
      // Update the timer to inactive but preserve the remaining time
      await update(ref(db, `quizzes/${quizId}/questionTimers/${questionId}`), {
        isActive: false,
        duration: remainingSeconds, // Save remaining time for if the timer is restarted
        pausedAt: Date.now()
      });
      
      // Also update legacy timer for backward compatibility
      await update(ref(db, `quizzes/${quizId}`), {
        timer: remainingSeconds,
        timerRunning: false
      });
    
      // Update local state immediately
      setTimerRunning(false);
    
      toast.success('Timer stopped');
    } catch (error) {
      console.error("Error stopping timer:", error);
      toast.error("Failed to stop timer");
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Loading quiz data...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Quiz not found</p>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  const renderHeader = () => (
    <div className="p-4 bg-gradient-to-r from-primary to-secondary text-white flex justify-between items-center rounded-t-lg shadow-md">
      <h1 className="text-xl font-bold">{quiz.title}</h1>
      <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full shadow-inner">
        Question {currentQuestionIndex + 1} of {quiz.questions.length}
      </div>
    </div>
  );

  if (quizCompleted) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        {/* Add consistent header */}
        <div className="text-center py-6 mb-4">
          <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-16 mx-auto" alt="ICCT School Logo" />
          <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>
            ICCT Quiz Bee System
          </h1>
          <h2 className="text-xl text-gray-200">Host Dashboard</h2>
        </div>
        
        {showWinners ? (
          <WinnerCelebration 
            quizId={quizId} 
            onBack={handleBackToQuiz} 
          />
        ) : (
          <>
            <h2 className="text-2xl font-bold text-primary mb-6 text-center">Quiz Results</h2>
            <div className="flex justify-center space-x-4 mb-6">
              <Button 
                onClick={handleToggleLeaderboard} 
                className={showLeaderboard ? "bg-primary text-white" : ""}
              >
                Leaderboard
              </Button>
              <Button 
                onClick={handleToggleParticipants} 
                className={showParticipants ? "bg-primary text-white" : ""}
              >
                Participants
              </Button>
              <Button 
                onClick={handleToggleTieBreakers} 
                className={showTieBreakerStats ? "bg-primary text-white" : ""}
              >
                Tie-Breakers & Tied Scores
              </Button>
            </div>
            <div className="mb-6">
              <Button 
                onClick={handleShowWinners} 
                className="bg-gradient-to-r from-primary to-secondary text-white w-full py-3 text-xl"
                disabled={winnersLoading}
              >
                {winnersLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading Winners...
                  </span>
                ) : (
                  <>🏆 Show Winners 🏆</>
                )}
              </Button>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4">
              {selectedTeam && (
                <div className="mb-4 px-3 py-2 bg-blue-100 text-blue-800 rounded-md">
                  <div className="font-semibold">Filtered by team:</div>
                  <div className="text-lg">{selectedTeam}</div>
                </div>
              )}
              
              {!showTieBreakerStats && !showLeaderboard && teams.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleTeamSelect(null)}
                    variant={selectedTeam === null ? "primary" : "secondary"}
                    size="sm"
                  >
                    All Teams
                  </Button>
                  {teams.filter(team => team !== 'All Participants').map(team => (
                    <Button
                      key={team}
                      onClick={() => handleTeamSelect(team)}
                      variant={selectedTeam === team ? "primary" : "secondary"}
                      size="sm"
                    >
                      {team}
                    </Button>
                  ))}
                </div>
              )}
              
              {/* Content based on selected view */}
              <div className="w-full overflow-x-auto overflow-y-auto" style={{ maxHeight: "min(60vh, 500px)" }}>
                {showLeaderboard && <EnhancedLeaderboard quizId={quizId} showTeams={true} animateEntrance={false} />}
                {showParticipants && <ParticipantMonitor quizId={quizId} teamFilter={selectedTeam} />}
                {showTieBreakerStats && <TieBreakerStats quizId={quizId} />}
                {showTieBreakerStats && (
                  <div className="mt-6">
                    <TiedParticipants quizId={quizId} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (quiz && quiz.status !== "active" && !quizCompleted) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        {/* Add consistent header */}
        <div className="text-center py-6 mb-4">
          <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-16 mx-auto" alt="ICCT School Logo" />
          <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>
            ICCT Quiz Bee System
          </h1>
          <h2 className="text-xl text-gray-200">Host Dashboard</h2>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-3xl font-bold text-primary mb-6">{quiz.title}</h1>
          <p className="mb-8 text-gray-700">Ready to start the quiz? Click the button below to begin.</p>
          
          <Button 
            onClick={handleStartQuiz}
            variant="primary"
            className="px-8 py-4 text-xl"
          >
            Start Quiz
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {quiz.status === "active" && currentQuestion && (
        <>
          {/* Add a proper centered header that matches the host page */}
          <div className="text-center py-6 mb-4">
            <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-16 mx-auto" alt="ICCT School Logo" />
            <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>
              ICCT Quiz Bee System
            </h1>
            <h2 className="text-xl text-gray-200">Host Dashboard</h2>
          </div>
          
          {/* Controller Header */}
          {renderHeader()}
          
          {/* Main section with question, controls, and stats */}
          <div className="bg-white rounded-b-lg shadow-lg p-4 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left sidebar for controls - Modified to remove timer controls */}
              <div className="lg:col-span-1 bg-gray-50 rounded-lg p-4 h-full">
                <h3 className="text-lg font-bold text-gray-700 mb-4">Controls</h3>
                <div className="space-y-4">
                  <div className="border-t border-gray-200 pt-4">
                    <div className="mb-2 text-sm font-medium text-gray-600">View Options</div>
                    <div className="space-y-2">
                      <Button 
                        onClick={handleToggleLeaderboard} 
                        className={`w-full ${showLeaderboard ? "bg-primary text-white" : ""}`}
                      >
                        Leaderboard
                      </Button>
                      <Button 
                        onClick={handleToggleParticipants} 
                        className={`w-full ${showParticipants ? "bg-primary text-white" : ""}`}
                      >
                        Participants
                      </Button>
                      <Button 
                        onClick={handleToggleTieBreakers} 
                        className={`w-full ${showTieBreakerStats ? "bg-primary text-white" : ""}`}
                      >
                        Tie-Breakers & Tied Scores
                      </Button>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <Button
                      onClick={handleEndQuiz}
                      variant="danger"
                      className="w-full"
                    >
                      End Quiz Early
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Main content area */}
              <div className="lg:col-span-2">
                {/* Current question display */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-4">Current Question</h3>
                  
                  {currentQuestion ? (
                    <div className="question-display p-4 border border-gray-200 rounded-lg mb-6">
                      {/* Question metadata */}
                      <div className="flex justify-between items-center mb-3">
                        <div className="bg-primary/10 text-primary text-sm font-semibold px-3 py-1 rounded-full">
                          {currentQuestion.difficulty?.charAt(0).toUpperCase() + currentQuestion.difficulty?.slice(1) || 'Normal'}
                        </div>
                        <div className="text-gray-600 font-semibold">
                          Points: {currentQuestion.points || 100}
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold mb-4">{currentQuestion.text || 'No question text available'}</h3>
                      
                      {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                          {currentQuestion.options.map((option, index) => (
                            <div 
                              key={index}
                              className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                                currentQuestion.correctAnswer === index 
                                  ? 'border-green-500 bg-green-50' 
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full mr-3 flex items-center justify-center text-lg font-semibold ${
                                  currentQuestion.correctAnswer === index 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {String.fromCharCode(65 + index)}
                                </div>
                                <span className="text-lg">{option}</span>
                                {currentQuestion.correctAnswer === index && (
                                  <span className="ml-auto text-green-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : currentQuestion.type === 'fill-in-blank' ? (
                        <div className="mt-4 p-4 rounded-lg border-2 border-gray-200">
                          <div className="flex items-center">
                            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold mr-2">
                              Fill in the blank
                            </div>
                            <span className="text-lg">{currentQuestion.correctAnswer}</span>
                          </div>
                        </div>
                      ) : currentQuestion.type === 'true-false' ? (
                        <div className="mt-4">
                          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold inline-block mb-3">
                            True or False
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div
                              className={`p-4 rounded-lg border-2 transition-all ${
                                currentQuestion.correctAnswer === 0
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full mr-3 flex items-center justify-center text-lg font-semibold ${
                                  currentQuestion.correctAnswer === 0
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  A
                                </div>
                                <span className="text-lg">True</span>
                                {currentQuestion.correctAnswer === 0 && (
                                  <span className="ml-auto text-green-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div
                              className={`p-4 rounded-lg border-2 transition-all ${
                                currentQuestion.correctAnswer === 1
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full mr-3 flex items-center justify-center text-lg font-semibold ${
                                  currentQuestion.correctAnswer === 1
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  B
                                </div>
                                <span className="text-lg">False</span>
                                {currentQuestion.correctAnswer === 1 && (
                                  <span className="ml-auto text-green-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 mt-4">No options available for this question</div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center border border-gray-200 rounded-lg">
                      <p>No current question available</p>
                    </div>
                  )}
                </div>
                
                {/* Timer Controls - Modified to remove countdown */}
                <div className="flex flex-col items-center space-y-2 mb-4 relative">
                  <CentralizedTimer 
                    quizId={quizId} 
                    questionId={currentQuestion.id} 
                    initialTime={currentQuestion.timer || 30}
                    onTimeUp={() => {
                      // When time is up, we can handle it here if needed
                      // Auto-update timer status in local state
                      setTimerRunning(false);
                    }}
                  />
                  
                  {/* Manual timer controls for host */}
                  <div className="flex space-x-2 mt-2">
                    <Button 
                      onClick={() => startTimer(currentQuestion.timer || 30)} 
                      className="bg-primary text-white px-4 py-2"
                      disabled={timerRunning}
                    >
                      Restart Timer
                    </Button>
                    <Button 
                      onClick={stopTimer} 
                      className="bg-red-500 text-white px-4 py-2" 
                      disabled={!timerRunning}
                    >
                      Stop Timer
                    </Button>
                  </div>
                </div>
                
                {/* Stats and Participants */}
                <h3 className="text-lg font-bold mb-4">
                  {showLeaderboard ? "Leaderboard" : showParticipants ? "Participants" : "Tie-Breakers & Tied Scores"}
                </h3>
                
                {selectedTeam && showParticipants && (
                  <div className="mb-4 px-3 py-2 bg-blue-100 text-blue-800 rounded-md">
                    <div className="font-semibold">Filtered by team:</div>
                    <div className="text-lg">{selectedTeam}</div>
                  </div>
                )}
                
                {!showTieBreakerStats && !showLeaderboard && teams.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleTeamSelect(null)}
                      variant={selectedTeam === null ? "primary" : "secondary"}
                      size="sm"
                    >
                      All Teams
                    </Button>
                    {teams.filter(team => team !== 'All Participants').map(team => (
                      <Button
                        key={team}
                        onClick={() => handleTeamSelect(team)}
                        variant={selectedTeam === team ? "primary" : "secondary"}
                        size="sm"
                      >
                        {team}
                      </Button>
                    ))}
                  </div>
                )}
                
                {/* Content based on selected view */}
                <div className="w-full overflow-x-auto overflow-y-auto" style={{ maxHeight: "min(60vh, 500px)" }}>
                  {showLeaderboard && <EnhancedLeaderboard quizId={quizId} showTeams={true} animateEntrance={false} />}
                  {showParticipants && <ParticipantMonitor quizId={quizId} teamFilter={selectedTeam} />}
                  {showTieBreakerStats && <TieBreakerStats quizId={quizId} />}
                  {showTieBreakerStats && (
                    <div className="mt-6">
                      <TiedParticipants quizId={quizId} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="mt-6 flex justify-center">
            {isLastQuestion ? (
              <Button 
                onClick={handleEndQuiz} 
                variant="danger"
                className="px-8 py-3 text-lg"
              >
                End Quiz
              </Button>
            ) : (
              <Button 
                onClick={handleNextQuestion} 
                variant="primary"
                className="px-8 py-3 text-lg"
              >
                Next Question
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
} 