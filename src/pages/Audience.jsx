import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/firebase/config";
import { ref, onValue, get } from "firebase/database";
import Button from "@/components/Button";
import Input from "@/components/Input";
import toast from "react-hot-toast";
import { FaTrophy, FaMedal, FaStar, FaUsers, FaUserAlt } from "react-icons/fa";
import QuizQuestion from "@/components/quiz/QuizQuestion";
import EnhancedLeaderboard from "@/components/quiz/EnhancedLeaderboard";
import usePreventQuizExit from "@/hooks/usePreventQuizExit";
import ReactConfetti from "react-confetti";
import { useWindowSize } from "react-use";
import { AnimatePresence, motion } from "framer-motion";

export default function Audience() {
  const navigate = useNavigate();
  const [step, setStep] = useState("enter-code"); // enter-code, viewing-leaderboard, viewing-quiz
  const [quizCode, setQuizCode] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [teamScores, setTeamScores] = useState([]);
  const [activeTab, setActiveTab] = useState("individual");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const { width, height } = useWindowSize();

  // Prevent page exit when actively viewing a quiz (improved condition)
  const isActiveViewing = (step === "viewing-leaderboard" && quiz?.status === "active") || step === "viewing-quiz";
  usePreventQuizExit(
    isActiveViewing,
    "Warning: Leaving this page will end your view of the quiz. Are you sure you want to exit?"
  );

  // Generate random positions for background particles
  const generateParticles = (count) => {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        id: i,
        size: Math.random() * 20 + 5,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDuration: `${Math.random() * 20 + 20}s`,
        animationDelay: `${Math.random() * 5}s`,
        opacity: Math.random() * 0.3 + 0.1
      });
    }
    return particles;
  };

  const particles = generateParticles(15);

  useEffect(() => {
    // Set loaded state after a small delay for entrance animation
    const timer = setTimeout(() => setIsLoaded(true), 100);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!quizCode || step === "enter-code") return;

    // Listen for quiz changes
    const quizRef = ref(db, `quizzes/${quizCode}`);
    const unsubscribe = onValue(quizRef, async (snapshot) => {
      if (snapshot.exists()) {
        const quizData = snapshot.val();
        setQuiz(quizData);
        
        // Update current question index if available
        if (quizData.currentQuestionIndex !== undefined) {
          setCurrentQuestionIndex(quizData.currentQuestionIndex);
        }
        
        // Update total questions count
        if (quizData.questions) {
          setTotalQuestions(quizData.questions.length);
        }
        
        // If the quiz doesn't exist or is still in "waiting" status
        if (!quizData || quizData.status === "waiting") {
          setError("Quiz is not active yet.");
          return;
        }
        
        // Get participants data for leaderboard
        if (quizData.participants) {
          try {
            // Get questions to find tie-breaker questions
            const questionsRef = ref(db, `quizzes/${quizCode}/questions`);
            const questionsSnapshot = await get(questionsRef);
            
            // Find tie-breaker question IDs
            const tieBreakerQuestionIds = [];
            if (questionsSnapshot.exists()) {
              const questionsData = questionsSnapshot.val();
              Object.entries(questionsData).forEach(([id, questionData]) => {
                if (questionData.difficulty === 'tie-breaker') {
                  tieBreakerQuestionIds.push(id);
                }
              });
            }
            
            // Convert to array for sorting
            let participantsArray = Object.keys(quizData.participants).map(key => ({
              id: key,
              ...quizData.participants[key],
              name: quizData.participants[key].name || "Anonymous",
              team: quizData.participants[key].team || "No Team",
              score: quizData.participants[key].score || 0,
              tieBreakerRank: null // Will be populated if needed
            }));
            
            // If there are tie-breaker questions, fetch answer data for them
            if (tieBreakerQuestionIds.length > 0) {
              for (const questionId of tieBreakerQuestionIds) {
                const answersRef = ref(db, `quizzes/${quizCode}/answers/${questionId}`);
                const answersSnapshot = await get(answersRef);
                
                if (answersSnapshot.exists()) {
                  const answersData = answersSnapshot.val();
                  
                  // Filter for correct answers only and sort by timestamp
                  const correctAnswers = [];
                  Object.entries(answersData).forEach(([participantId, answerData]) => {
                    if (answerData.scoreEarned > 0) {
                      correctAnswers.push({
                        participantId,
                        timestamp: answerData.timestamp
                      });
                    }
                  });
                  
                  // Sort correct answers by timestamp (earliest first)
                  correctAnswers.sort((a, b) => a.timestamp - b.timestamp);
                  
                  // Assign rank based on answer timestamp for correct answers
                  correctAnswers.forEach((answer, index) => {
                    const participant = participantsArray.find(p => p.id === answer.participantId);
                    if (participant) {
                      // Lower rank is better (1st correct gets rank 1)
                      // If a participant already has a tie-breaker rank, keep the better one
                      const newRank = index + 1;
                      if (participant.tieBreakerRank === null || newRank < participant.tieBreakerRank) {
                        participant.tieBreakerRank = newRank;
                      }
                    }
                  });
                }
              }
            }
            
            // Enhanced sorting function
            participantsArray.sort((a, b) => {
              // First, sort by score (highest first)
              const scoreDiff = b.score - a.score;
              if (scoreDiff !== 0) {
                return scoreDiff;
              }
              
              // If scores are tied and both have tie-breaker ranks, use those
              if (a.tieBreakerRank !== null && b.tieBreakerRank !== null) {
                return a.tieBreakerRank - b.tieBreakerRank; // Lower rank is better
              }
              
              // If only one has a tie-breaker rank, they win
              if (a.tieBreakerRank !== null) return -1;
              if (b.tieBreakerRank !== null) return 1;
              
              // As a last resort, use lastAnswerAt timestamp if available
              if (a.lastAnswerAt && b.lastAnswerAt) {
                return a.lastAnswerAt - b.lastAnswerAt; // Earlier timestamp wins
              }
              
              return 0; // No way to break the tie
            });
            
            // Assign ranks to participants
            let currentRank = 1;
            let currentScore = participantsArray.length > 0 ? participantsArray[0].score : 0;
            
            participantsArray.forEach((participant, index) => {
              // If this participant has a different score than the previous one
              if (participant.score !== currentScore) {
                // Set the rank to the current position (1-indexed)
                currentRank = index + 1;
                currentScore = participant.score;
              }
              
              // Assign the calculated rank
              participant.displayRank = currentRank;
            });
            
            setParticipants(participantsArray);
            
            // Calculate team scores
            const teams = {};
            participantsArray.forEach(p => {
              if (p.team) {
                if (!teams[p.team]) {
                  teams[p.team] = {
                    name: p.team,
                    members: [],
                    totalScore: 0,
                    averageScore: 0
                  };
                }
                teams[p.team].members.push({
                  id: p.id,
                  name: p.name,
                  score: p.score
                });
                teams[p.team].totalScore += p.score;
              }
            });
            
            // Calculate average scores and convert teams to array
            const teamsArray = Object.values(teams).map(team => {
              team.averageScore = team.members.length > 0
                ? Math.round(team.totalScore / team.members.length)
                : 0;
              team.memberCount = team.members.length;
              return team;
            });
            
            // Sort teams by total score
            teamsArray.sort((a, b) => b.totalScore - a.totalScore);
            
            // Assign ranks to teams
            let teamRank = 1;
            let teamScore = teamsArray.length > 0 ? teamsArray[0].totalScore : 0;
            
            teamsArray.forEach((team, index) => {
              if (team.totalScore !== teamScore) {
                teamRank = index + 1;
                teamScore = team.totalScore;
              }
              
              team.displayRank = teamRank;
            });
            
            setTeamScores(teamsArray);
          } catch (err) {
            console.error("Error processing participants:", err);
            toast.error("Failed to load participants data");
          }
        }
      } else {
        // Quiz doesn't exist
        setError("Quiz not found");
        toast.error("Quiz not found");
      }
    });

    return () => unsubscribe();
  }, [quizCode, step]);

  useEffect(() => {
    if (quiz?.status === "completed" && !showCelebration) {
      setShowCelebration(true);
      // Play celebration sound if appropriate
      const celebrationSound = new Audio("/sounds/celebration.mp3");
      celebrationSound.volume = 0.5;
      celebrationSound.play().catch(err => console.log("Audio playback error:", err));
      
      // Hide celebration after some time
      const timer = setTimeout(() => {
        setShowCelebration(false);
      }, 15000); // 15 seconds of celebration
      
      return () => clearTimeout(timer);
    }
  }, [quiz?.status, showCelebration]);

  const handleSubmitCode = async () => {
    if (!quizCode) {
      toast.error("Please enter a quiz code");
      return;
    }

    setError(null);
    
    try {
      // Check if quiz exists
      const quizRef = ref(db, `quizzes/${quizCode}`);
      const snapshot = await get(quizRef);
      
      if (!snapshot.exists()) {
        setError("Quiz not found");
        toast.error("Quiz not found");
        return;
      }
      
      const quizData = snapshot.val();
      setQuiz(quizData);
      
      // Move to viewing leaderboard
      setStep("viewing-leaderboard");
    } catch (err) {
      console.error("Error checking quiz:", err);
      setError("Failed to connect to server");
      toast.error("Failed to connect to server");
    }
  };

  // Rank indicator component for consistency
  const RankIndicator = ({ rank }) => {
    if (rank === 1) {
      return <FaTrophy className="text-5xl text-yellow-500" aria-label="1st Place" />;
    } else if (rank === 2) {
      return <FaMedal className="text-5xl text-gray-400" aria-label="2nd Place" />;
    } else if (rank === 3) {
      return <FaMedal className="text-5xl text-amber-700" aria-label="3rd Place" />;
    } else {
      return <div className="text-4xl font-bold">{rank}</div>;
    }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden ${isLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}>
      {/* Background Image - same as host page */}
      <div className="fixed inset-0 z-0">
        <img 
          src="https://i.imgur.com/NSkjBnJ.jpeg" 
          className="w-full h-full object-cover" 
          alt="background" 
        />
      </div>
      
      {/* Background overlay for better readability */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900/30 to-gray-800/30 z-0"></div>
      
      {/* Background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-10">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-primary animate-float"
            style={{
              width: particle.size,
              height: particle.size,
              left: particle.left,
              top: particle.top,
              opacity: particle.opacity,
              animationDuration: particle.animationDuration,
              animationDelay: particle.animationDelay
            }}
          />
        ))}
      </div>
      
      {/* Celebration Effects */}
      <AnimatePresence>
        {showCelebration && (
          <>
            {/* Confetti */}
            <ReactConfetti
              width={width}
              height={height}
              recycle={true}
              numberOfPieces={500}
              gravity={0.15}
              colors={['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4']}
            />
            
            {/* Fireworks animation */}
            <div className="fixed inset-0 z-50 pointer-events-none">
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  initial={{ 
                    x: Math.random() * width, 
                    y: height, 
                    scale: 0 
                  }}
                  animate={{ 
                    y: Math.random() * height * 0.7,
                    scale: 1,
                    opacity: [0, 1, 0]
                  }}
                  transition={{ 
                    duration: 2 + Math.random() * 3,
                    delay: i * 0.3,
                    repeat: 2,
                    repeatType: "reverse"
                  }}
                >
                  <div className="firework" style={{ 
                    '--color': `hsl(${Math.random() * 360}, 100%, 50%)`,
                    '--size': `${30 + Math.random() * 70}px`
                  }}></div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </AnimatePresence>
      
      {/* Main content */}
      <div className="relative z-20 min-h-screen">
        <div className="container mx-auto px-4 py-4">
          {/* Header */}
          <div className="text-center py-6">
            <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-24 mx-auto animate-float" alt="ICCT School Logo" />
            <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>
              ICCT Quiz Bee System
            </h1>
            <h2 className="text-xl text-gray-200">
              {step === "enter-code" ? "Audience View" : quiz?.title || "Live Leaderboard"}
            </h2>
          </div>
          
          {/* Content based on step */}
          {step === "enter-code" ? (
            <div className="max-w-md mx-auto bg-white/90 backdrop-blur-sm rounded-lg p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-6 text-center text-primary">Enter Quiz Code</h2>
              
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Quiz Code
                </label>
                <Input
                  value={quizCode}
                  onChange={(e) => setQuizCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full text-center text-2xl tracking-wider font-bold"
                  maxLength={6}
                />
              </div>
              
              {error && (
                <div className="mb-4 text-red-500 text-center font-bold">
                  {error}
                </div>
              )}
              
              <Button 
                onClick={handleSubmitCode}
                className="w-full py-3 text-xl font-bold bg-primary hover:bg-primary-dark text-white rounded-lg shadow-md transition-all"
              >
                Join as Audience
              </Button>
              
              <div className="mt-4 text-center">
                <Button 
                  onClick={() => navigate('/')}
                  className="text-primary hover:underline"
                >
                  Back to Home
                </Button>
              </div>
            </div>
          ) : step === "viewing-leaderboard" ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden">
              {/* Current Question Indicator */}
              {quiz?.status === "active" && totalQuestions > 0 && (
                <div className="bg-gradient-to-r from-blue-500 to-blue-700 text-white p-4 text-center">
                  <div className="text-3xl font-bold mb-2 animate-pulse">
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                  </div>
                  <div className="w-full bg-blue-800 rounded-full h-2.5">
                    <div 
                      className="bg-blue-300 h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Leaderboard tabs - styled for TV display */}
              <div className="flex text-2xl font-bold border-b-2 border-gray-200">
                <button
                  onClick={() => setActiveTab("individual")}
                  className={`flex-1 py-6 px-8 flex justify-center items-center gap-3 transition-colors ${
                    activeTab === "individual"
                      ? "bg-primary text-white"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <FaUserAlt /> Individual Rankings
                </button>
                {teamScores.length > 0 && (
                  <button
                    onClick={() => setActiveTab("team")}
                    className={`flex-1 py-6 px-8 flex justify-center items-center gap-3 transition-colors ${
                      activeTab === "team"
                        ? "bg-primary text-white"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <FaUsers /> Team Rankings
                  </button>
                )}
              </div>
              
              {/* TV-optimized leaderboard display - Table Format */}
              <div className="p-6">
                {activeTab === "individual" ? (
                  <>
                    <h3 className="text-4xl font-bold mb-8 text-center">Individual Leaderboard</h3>
                    
                    {participants.length === 0 ? (
                      <p className="text-2xl text-center py-10">No participants yet</p>
                    ) : (
                      <div className="overflow-hidden">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-blue-500 to-blue-700 text-white">
                              <th className="py-5 px-6 text-3xl text-center w-1/6">Rank</th>
                              <th className="py-5 px-6 text-3xl text-left w-2/6">Name</th>
                              <th className="py-5 px-6 text-3xl text-left w-2/6">Team</th>
                              <th className="py-5 px-6 text-3xl text-right w-1/6">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {participants.map((participant, index) => (
                              <tr 
                                key={participant.id}
                                className={`border-b border-gray-200 transition-colors ${
                                  participant.displayRank <= 3 
                                    ? participant.displayRank === 1 
                                      ? 'bg-yellow-50' 
                                      : participant.displayRank === 2 
                                        ? 'bg-gray-50' 
                                        : 'bg-amber-50'
                                    : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                }`}
                              >
                                <td className="py-5 px-6 text-center">
                                  <div className="flex justify-center">
                                    {participant.displayRank <= 3 ? (
                                      <RankIndicator rank={participant.displayRank} />
                                    ) : (
                                      <span className="text-3xl font-bold">{participant.displayRank}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-5 px-6 text-3xl font-semibold">
                                  {participant.name}
                                </td>
                                <td className="py-5 px-6 text-2xl text-gray-700">
                                  {participant.team}
                                </td>
                                <td className="py-5 px-6 text-4xl font-bold text-right text-blue-600">
                                  {participant.score}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-4xl font-bold mb-8 text-center">Team Leaderboard</h3>
                    
                    {teamScores.length === 0 ? (
                      <p className="text-2xl text-center py-10">No teams yet</p>
                    ) : (
                      <div className="overflow-hidden">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-blue-500 to-blue-700 text-white">
                              <th className="py-5 px-6 text-3xl text-center w-1/6">Rank</th>
                              <th className="py-5 px-6 text-3xl text-left w-3/6">Team</th>
                              <th className="py-5 px-6 text-3xl text-center w-1/6">Members</th>
                              <th className="py-5 px-6 text-3xl text-right w-1/6">Total Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamScores.map((team, index) => (
                              <tr 
                                key={team.name}
                                className={`border-b border-gray-200 transition-colors ${
                                  team.displayRank <= 3 
                                    ? team.displayRank === 1 
                                      ? 'bg-yellow-50' 
                                      : team.displayRank === 2 
                                        ? 'bg-gray-50' 
                                        : 'bg-amber-50'
                                    : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                }`}
                              >
                                <td className="py-5 px-6 text-center">
                                  <div className="flex justify-center">
                                    {team.displayRank <= 3 ? (
                                      <RankIndicator rank={team.displayRank} />
                                    ) : (
                                      <span className="text-3xl font-bold">{team.displayRank}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-5 px-6 text-3xl font-semibold">
                                  {team.name}
                                </td>
                                <td className="py-5 px-6 text-3xl text-center text-gray-700">
                                  {team.memberCount}
                                </td>
                                <td className="py-5 px-6 text-4xl font-bold text-right text-blue-600">
                                  {team.totalScore}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Footer section with status and buttons */}
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-6 flex justify-between items-center">
                <div className="text-2xl">
                  <span className="font-bold">Status:</span> 
                  <span className={`ml-2 ${
                    quiz?.status === "active" 
                      ? "text-green-600" 
                      : quiz?.status === "completed" 
                        ? "text-blue-600" 
                        : "text-yellow-600"
                  }`}>
                    {quiz?.status === "active" 
                      ? "Quiz in progress" 
                      : quiz?.status === "completed" 
                        ? "Quiz completed" 
                        : "Waiting"}
                  </span>
                </div>
                <div className="flex gap-4">
                  <Button 
                    onClick={() => navigate('/')}
                    className="px-6 py-3 text-xl bg-secondary text-white rounded-lg shadow-md hover:bg-secondary-dark transition-colors"
                  >
                    Back to Home
                  </Button>
                  <Button 
                    onClick={() => setStep("enter-code")}
                    className="px-6 py-3 text-xl bg-primary text-white rounded-lg shadow-md hover:bg-primary-dark transition-colors"
                  >
                    Change Quiz
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden">
              {/* Current Question Indicator */}
              {quiz?.status === "active" && totalQuestions > 0 && (
                <div className="bg-gradient-to-r from-blue-500 to-blue-700 text-white p-4 text-center">
                  <div className="text-3xl font-bold mb-2 animate-pulse">
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                  </div>
                  <div className="w-full bg-blue-800 rounded-full h-2.5">
                    <div 
                      className="bg-blue-300 h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Leaderboard tabs - styled for TV display */}
              <div className="flex text-2xl font-bold border-b-2 border-gray-200">
                <button
                  onClick={() => setActiveTab("individual")}
                  className={`flex-1 py-6 px-8 flex justify-center items-center gap-3 transition-colors ${
                    activeTab === "individual"
                      ? "bg-primary text-white"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <FaUserAlt /> Individual Rankings
                </button>
                {teamScores.length > 0 && (
                  <button
                    onClick={() => setActiveTab("team")}
                    className={`flex-1 py-6 px-8 flex justify-center items-center gap-3 transition-colors ${
                      activeTab === "team"
                        ? "bg-primary text-white"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <FaUsers /> Team Rankings
                  </button>
                )}
              </div>
              
              {/* TV-optimized leaderboard display - Table Format */}
              <div className="p-6">
                {activeTab === "individual" ? (
                  <>
                    <h3 className="text-4xl font-bold mb-8 text-center">Individual Leaderboard</h3>
                    
                    {participants.length === 0 ? (
                      <p className="text-2xl text-center py-10">No participants yet</p>
                    ) : (
                      <div className="overflow-hidden">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-blue-500 to-blue-700 text-white">
                              <th className="py-5 px-6 text-3xl text-center w-1/6">Rank</th>
                              <th className="py-5 px-6 text-3xl text-left w-2/6">Name</th>
                              <th className="py-5 px-6 text-3xl text-left w-2/6">Team</th>
                              <th className="py-5 px-6 text-3xl text-right w-1/6">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {participants.map((participant, index) => (
                              <tr 
                                key={participant.id}
                                className={`border-b border-gray-200 transition-colors ${
                                  participant.displayRank <= 3 
                                    ? participant.displayRank === 1 
                                      ? 'bg-yellow-50' 
                                      : participant.displayRank === 2 
                                        ? 'bg-gray-50' 
                                        : 'bg-amber-50'
                                    : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                }`}
                              >
                                <td className="py-5 px-6 text-center">
                                  <div className="flex justify-center">
                                    {participant.displayRank <= 3 ? (
                                      <RankIndicator rank={participant.displayRank} />
                                    ) : (
                                      <span className="text-3xl font-bold">{participant.displayRank}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-5 px-6 text-3xl font-semibold">
                                  {participant.name}
                                </td>
                                <td className="py-5 px-6 text-2xl text-gray-700">
                                  {participant.team}
                                </td>
                                <td className="py-5 px-6 text-4xl font-bold text-right text-blue-600">
                                  {participant.score}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-4xl font-bold mb-8 text-center">Team Leaderboard</h3>
                    
                    {teamScores.length === 0 ? (
                      <p className="text-2xl text-center py-10">No teams yet</p>
                    ) : (
                      <div className="overflow-hidden">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-blue-500 to-blue-700 text-white">
                              <th className="py-5 px-6 text-3xl text-center w-1/6">Rank</th>
                              <th className="py-5 px-6 text-3xl text-left w-3/6">Team</th>
                              <th className="py-5 px-6 text-3xl text-center w-1/6">Members</th>
                              <th className="py-5 px-6 text-3xl text-right w-1/6">Total Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamScores.map((team, index) => (
                              <tr 
                                key={team.name}
                                className={`border-b border-gray-200 transition-colors ${
                                  team.displayRank <= 3 
                                    ? team.displayRank === 1 
                                      ? 'bg-yellow-50' 
                                      : team.displayRank === 2 
                                        ? 'bg-gray-50' 
                                        : 'bg-amber-50'
                                    : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                }`}
                              >
                                <td className="py-5 px-6 text-center">
                                  <div className="flex justify-center">
                                    {team.displayRank <= 3 ? (
                                      <RankIndicator rank={team.displayRank} />
                                    ) : (
                                      <span className="text-3xl font-bold">{team.displayRank}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-5 px-6 text-3xl font-semibold">
                                  {team.name}
                                </td>
                                <td className="py-5 px-6 text-3xl text-center text-gray-700">
                                  {team.memberCount}
                                </td>
                                <td className="py-5 px-6 text-4xl font-bold text-right text-blue-600">
                                  {team.totalScore}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Footer section with status and buttons */}
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-6 flex justify-between items-center">
                <div className="text-2xl">
                  <span className="font-bold">Status:</span> 
                  <span className={`ml-2 ${
                    quiz?.status === "active" 
                      ? "text-green-600" 
                      : quiz?.status === "completed" 
                        ? "text-blue-600" 
                        : "text-yellow-600"
                  }`}>
                    {quiz?.status === "active" 
                      ? "Quiz in progress" 
                      : quiz?.status === "completed" 
                        ? "Quiz completed" 
                        : "Waiting"}
                  </span>
                </div>
                <div className="flex gap-4">
                  <Button 
                    onClick={() => navigate('/')}
                    className="px-6 py-3 text-xl bg-secondary text-white rounded-lg shadow-md hover:bg-secondary-dark transition-colors"
                  >
                    Back to Home
                  </Button>
                  <Button 
                    onClick={() => setStep("enter-code")}
                    className="px-6 py-3 text-xl bg-primary text-white rounded-lg shadow-md hover:bg-primary-dark transition-colors"
                  >
                    Change Quiz
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 