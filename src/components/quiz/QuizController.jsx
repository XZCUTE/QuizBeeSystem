import { useState, useEffect } from "react";
import { db } from "@/firebase/config";
import { ref, update, get, onValue, set, serverTimestamp } from "firebase/database";
import { useNavigate } from "react-router-dom";
import Button from "@/components/Button";
import QuizQuestion from "./QuizQuestion";
import Leaderboard from "./Leaderboard";
import ParticipantMonitor from "./ParticipantMonitor";
import WinnerCelebration from "./WinnerCelebration";
import TieBreakerStats from "./TieBreakerStats";
import toast from "react-hot-toast";
import Countdown from './Countdown';
import Confetti from 'react-confetti';
import { useAudio } from "@/contexts/AudioContext";

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
  const [showConfetti, setShowConfetti] = useState(false);
  const { playSound } = useAudio();

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

  // Combined function to handle moving to the next question
  const handleNextQuestion = async () => {
    playSound('click');
    
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
    
    // Update the current question index in the database
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
    setShowWinners(true);
  };
  
  const handleBackToQuiz = () => {
    setShowWinners(false);
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

  const startTimer = async (seconds) => {
    playSound('click');
    
    // Set timer value
    await update(ref(db, `quizzes/${quizId}/timer`), seconds);
    
    // Start the timer
    await update(ref(db, `quizzes/${quizId}/timerRunning`), true);
    
    toast.success(`Timer started: ${seconds} seconds`);
  };

  const stopTimer = async () => {
    playSound('click');
    
    // Stop the timer
    await update(ref(db, `quizzes/${quizId}/timerRunning`), false);
    
    toast.success('Timer stopped');
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
        {showConfetti && (
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={true}
            numberOfPieces={200}
            colors={['#03256C', '#2541B2', '#1768AC', '#06BEE1', '#FFFFFF', '#FFD700']}
          />
        )}
        {showWinners ? (
          <WinnerCelebration quizId={quizId} onBack={handleBackToQuiz} />
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
                Tie-Breakers
              </Button>
            </div>
            <div className="mb-6">
              <Button 
                onClick={handleShowWinners} 
                className="bg-gradient-to-r from-primary to-secondary text-white w-full py-3 text-xl"
                onMouseEnter={() => setShowConfetti(true)}
                onMouseLeave={() => setShowConfetti(false)}
              >
                🏆 Show Winners 🏆
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
              {showLeaderboard && <Leaderboard quizId={quizId} />}
              {showParticipants && <ParticipantMonitor quizId={quizId} teamFilter={selectedTeam} />}
              {showTieBreakerStats && <TieBreakerStats quizId={quizId} />}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {quiz.status === "active" && currentQuestion && (
        <>
          {/* Controller Header */}
          {renderHeader()}
          
          {/* Main section with question, controls, and stats */}
          <div className="bg-white rounded-b-lg shadow-lg p-4 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left sidebar for controls */}
              <div className="lg:col-span-1 bg-gray-50 rounded-lg p-4 h-full">
                <h3 className="text-lg font-bold text-gray-700 mb-4">Quiz Controls</h3>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-sm font-medium text-gray-600">Start Timer</div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => startTimer(10)} variant="timerShort">10s</Button>
                      <Button onClick={() => startTimer(20)} variant="timerShort">20s</Button>
                      <Button onClick={() => startTimer(30)} variant="timerMedium">30s</Button>
                      <Button onClick={() => startTimer(60)} variant="timerLong">60s</Button>
                      <Button onClick={() => startTimer(120)} variant="timerLong">2m</Button>
                    </div>
                  </div>
                  
                  {timerRunning && (
                    <div className="text-center">
                      <Button 
                        onClick={stopTimer} 
                        variant="danger"
                        className="px-4 py-2 w-full"
                      >
                        Stop Timer
                      </Button>
                    </div>
                  )}
                  
                  {timer && (
                    <div className="flex justify-center">
                      <Countdown 
                        initialSeconds={timer} 
                        isRunning={timerRunning} 
                      />
                    </div>
                  )}
                  
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
                        Tie-Breakers
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
                
                {/* Stats and Participants */}
                <h3 className="text-lg font-bold mb-4">
                  {showLeaderboard ? "Leaderboard" : showParticipants ? "Participants" : "Tie-Breaker Stats"}
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
                {showLeaderboard && <Leaderboard quizId={quizId} />}
                {showParticipants && <ParticipantMonitor quizId={quizId} teamFilter={selectedTeam} />}
                {showTieBreakerStats && <TieBreakerStats quizId={quizId} />}
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