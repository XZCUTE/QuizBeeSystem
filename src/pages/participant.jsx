import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { db } from "@/firebase/config"
import { ref, push, set, onValue, get } from "firebase/database"
import Button from "@/components/Button"
import Input from "@/components/Input"
import Form from "@/components/Form"
import toast from "react-hot-toast"
import QuizQuestion from "@/components/quiz/QuizQuestion"
import EnhancedLeaderboard from "@/components/quiz/EnhancedLeaderboard"
import FullScreenConfetti from "@/components/FullScreenConfetti"

export default function Participant() {
  const navigate = useNavigate()
  const [step, setStep] = useState("enter-code") // enter-code, enter-info, waiting, quiz-active, quiz-completed
  const [quizCode, setQuizCode] = useState("")
  const [name, setName] = useState("")
  const [team, setTeam] = useState("")
  const [participantId, setParticipantId] = useState("")
  const [quiz, setQuiz] = useState(null)
  const [countdown, setCountdown] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [participantRank, setParticipantRank] = useState(null)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [score, setScore] = useState(0)
  const [topParticipants, setTopParticipants] = useState([])
  const [isLoaded, setIsLoaded] = useState(false)

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

  // Simplify this useEffect to only handle the isLoaded state
  useEffect(() => {
    // Set loaded state after a small delay for entrance animation
    const timer = setTimeout(() => setIsLoaded(true), 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    // If we have a quiz code and are in waiting or quiz-active state
    if (quizCode && (step === "waiting" || step === "quiz-active" || step === "quiz-completed")) {
      // Listen for quiz status changes
      const quizRef = ref(db, `quizzes/${quizCode}`);
      const unsubscribe = onValue(quizRef, (snapshot) => {
        if (snapshot.exists()) {
          const quizData = snapshot.val();
          setQuiz(quizData);
          
          // If the quiz status changes to active and we're in waiting state
          if (quizData.status === "active" && step === "waiting") {
            // Start countdown
            setCountdown(3);
            const countdownInterval = setInterval(() => {
              setCountdown(prev => {
                if (prev <= 1) {
                  clearInterval(countdownInterval);
                  setStep("quiz-active");
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          }
          
          // If quiz is completed, transition to completed state
          if (quizData.status === "completed" && step !== "quiz-completed") {
            setStep("quiz-completed");
            fetchResults();
          }
          
          // Update current question if in active state
          if (step === "quiz-active" && quizData.currentQuestionIndex !== undefined && quizData.questions) {
            setCurrentQuestion(quizData.questions[quizData.currentQuestionIndex]);
          }
        } else {
          // Quiz doesn't exist anymore
          toast.error("The quiz was cancelled by the host");
          navigate("/");
        }
      });

      return () => unsubscribe();
    }
  }, [quizCode, step, navigate, participantId]);

  // Fetch results for participants when quiz completes
  const fetchResults = async () => {
    if (!quizCode || !participantId) return;
    
    try {
      // Get all participants to determine ranking
      const participantsRef = ref(db, `quizzes/${quizCode}/participants`);
      const snapshot = await get(participantsRef);
      
      // Get questions to find tie-breaker questions
      const questionsRef = ref(db, `quizzes/${quizCode}/questions`);
      const questionsSnapshot = await get(questionsRef);
      
      // Find tie-breaker question IDs
      const tieBreakerQuestionIds = [];
      if (questionsSnapshot.exists()) {
        const questionsData = questionsSnapshot.val();
        // Create an array of tie-breaker question IDs
        Object.entries(questionsData).forEach(([id, questionData]) => {
          if (questionData.difficulty === 'tie-breaker') {
            tieBreakerQuestionIds.push(id);
          }
        });
      }
      
      if (snapshot.exists()) {
        const participantsData = snapshot.val();
        
        // Convert to array and prepare for enhanced sorting
        const participantsArray = Object.keys(participantsData).map(key => ({
          id: key,
          ...participantsData[key],
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
                if (answerData.scoreEarned > 0) { // This means the answer was correct
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
        
        // Enhanced sorting function that considers:
        // 1. Score (highest first)
        // 2. Tie-breaker rank (lowest first, if available)
        // 3. Last answer time (earliest first, as a fallback)
        participantsArray.sort((a, b) => {
          // First, sort by score (highest first)
          const scoreDiff = (b.score || 0) - (a.score || 0);
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
        
        // Find current participant's rank
        const participantIndex = participantsArray.findIndex(p => p.id === participantId);
        setParticipantRank(participantIndex + 1); // Add 1 because index is zero-based
        setTotalParticipants(participantsArray.length);
        
        // Get current participant's score
        const currentParticipant = participantsArray.find(p => p.id === participantId);
        setScore(currentParticipant?.score || 0);
        
        // Get top 3 participants for display
        setTopParticipants(participantsArray.slice(0, 3));
      }
    } catch (error) {
      console.error("Error fetching results:", error);
      toast.error("Failed to load results");
    }
  };

  const handleSubmitCode = () => {
    if (!quizCode) {
      toast.error("Please enter a quiz code");
      return;
    }
    
    // Check if quiz exists
    const quizRef = ref(db, `quizzes/${quizCode}`);
    onValue(quizRef, (snapshot) => {
      if (snapshot.exists()) {
        const quizData = snapshot.val();
        
        if (quizData.status === "active") {
          toast.error("The quiz has already started");
          return;
        }
        
        if (quizData.status === "completed") {
          toast.error("This quiz has already ended");
          return;
        }
        
        setQuiz(quizData);
        setStep("enter-info");
      } else {
        toast.error("Invalid quiz code");
      }
    }, { onlyOnce: true });
  }

  const handleSubmitInfo = () => {
    if (!name) {
      toast.error("Please enter your name");
      return;
    }
    
    // Add participant to the quiz
    const participantsRef = ref(db, `quizzes/${quizCode}/participants`);
    const newParticipantRef = push(participantsRef);
    
    set(newParticipantRef, {
      name,
      team: team || null,
      joinedAt: new Date().toISOString(),
      score: 0
    }).then(() => {
      setParticipantId(newParticipantRef.key);
      setStep("waiting");
      toast.success("Joined successfully!");
    }).catch(error => {
      toast.error("Error joining: " + error.message);
    });
  }

  // Render quiz completion view with participant's rank
  const renderQuizCompletedView = () => {
    // Generate appropriate emoji, badge and message based on rank
    let emoji = "🏆";
    let message = "Congratulations!";
    let badgeColor = "bg-blue-500";
    let achievement = "Participant";
    
    if (participantRank === 1) {
      emoji = "🥇";
      message = "You're the Champion!";
      badgeColor = "bg-yellow-500";
      achievement = "Champion";
    } else if (participantRank === 2) {
      emoji = "🥈";
      message = "Excellent job!";
      badgeColor = "bg-gray-400";
      achievement = "Silver Medalist";
    } else if (participantRank === 3) {
      emoji = "🥉";
      message = "Well done!";
      badgeColor = "bg-amber-600";
      achievement = "Bronze Medalist";
    } else if (participantRank <= 5) {
      emoji = "🌟";
      message = "Great effort!";
      badgeColor = "bg-purple-500";
      achievement = "Top Performer";
    } else if (participantRank <= totalParticipants / 2) {
      emoji = "👍";
      message = "Nice work!";
      badgeColor = "bg-green-500";
      achievement = "Above Average";
    } else {
      emoji = "👍";
      message = "Thanks for participating!";
      badgeColor = "bg-blue-500";
      achievement = "Participant";
    }
    
    // Calculate percentile ranking
    const percentile = Math.round(((totalParticipants - participantRank) / totalParticipants) * 100);
    
    return (
      <div className="max-w-3xl mx-auto flex flex-col relative">
        {participantRank <= 3 && (
          <FullScreenConfetti 
            active={true}
            pieces={participantRank === 1 ? 400 : participantRank === 2 ? 300 : 250}
            recycle={true}
          />
        )}
        
        <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-24 mx-auto animate-float" alt="ICCT School Logo" />
        <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>Quiz Complete!</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal results card */}
          <div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-xl overflow-hidden border-4 border-primary/20 transform transition-all hover:shadow-glow">
            <div className="px-6 pt-6 pb-8 text-center">
              {/* Animated badge */}
              <div className="relative mb-4">
                <div className={`${badgeColor} w-28 h-28 rounded-full mx-auto flex items-center justify-center relative overflow-hidden`}>
                  <div className="animate-pulse-slow absolute inset-0 opacity-30 bg-white"></div>
                  <span className="text-6xl relative z-10">{emoji}</span>
                </div>
                <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 ${badgeColor} text-white text-xs font-bold py-1 px-3 rounded-full shadow-lg`}>
                  {achievement}
                </div>
              </div>
              
              <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{message}</h2>
              
              {/* Position card */}
              <div className="bg-primary/10 rounded-xl p-5 mt-4 relative overflow-hidden">
                {/* Decorative corner shapes */}
                <div className="absolute top-0 left-0 border-t-8 border-l-8 border-primary/20 w-8 h-8 rounded-tl-md"></div>
                <div className="absolute top-0 right-0 border-t-8 border-r-8 border-primary/20 w-8 h-8 rounded-tr-md"></div>
                <div className="absolute bottom-0 left-0 border-b-8 border-l-8 border-primary/20 w-8 h-8 rounded-bl-md"></div>
                <div className="absolute bottom-0 right-0 border-b-8 border-r-8 border-primary/20 w-8 h-8 rounded-br-md"></div>
                
                <div className="relative z-10">
                  <p className="text-lg font-semibold text-primary">Your Position</p>
                  <div className="flex items-center justify-center my-3">
                    <div className="text-5xl font-bold text-primary">
                      {participantRank}<sup className="text-lg">{getRankSuffix(participantRank)}</sup>
                    </div>
                    <div className="ml-3 pl-3 border-l border-gray-300 text-left">
                      <div className="text-sm text-gray-500">out of</div>
                      <div className="text-xl font-semibold">{totalParticipants}</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                    <div 
                      className="bg-gradient-to-r from-primary to-secondary h-2.5 rounded-full" 
                      style={{ width: `${percentile}%` }}
                    ></div>
                  </div>
                  <p className="text-right text-xs text-gray-500">Top {percentile}%</p>
                </div>
              </div>
              
              {/* Score card */}
              <div className="mt-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-5">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-700">Final Score</span>
                  <span className="text-2xl font-bold text-secondary">{score}</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent my-3"></div>
                {team && (
                  <div className="text-center py-1 px-3 bg-white/50 rounded-lg inline-block">
                    <span className="text-gray-700">Team: </span>
                    <span className="font-semibold text-primary">{team}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Leaderboard section */}
          <div className="h-full flex flex-col">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 mb-4 h-full flex flex-col">
              <h3 className="text-xl md:text-2xl font-bold mb-3 text-center text-primary">Leaderboard</h3>
              
              <div className="flex-grow overflow-x-auto overflow-y-auto" style={{ 
                maxHeight: "400px"
              }}>
                <EnhancedLeaderboard 
                  quizId={quizCode} 
                  participantId={participantId} 
                  showTeams={true}
                  animateEntrance={false}
                  compact={false}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <Button 
            onClick={() => navigate("/")} 
            variant="secondary"
            className="bg-white/90 text-primary border-2 border-primary/50 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  };
  
  // Helper to get suffix for ranking (1st, 2nd, 3rd, etc.)
  const getRankSuffix = (rank) => {
    if (rank % 100 === 11 || rank % 100 === 12 || rank % 100 === 13) {
      return "th";
    }
    switch (rank % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  // Add a new function to handle leaving quiz with confirmation
  const handleLeaveQuiz = () => {
    if (window.confirm("Are you sure you want to leave the quiz? This action cannot be undone.")) {
      navigate("/");
    }
  };

  return (
    <section className="min-h-screen w-full flex flex-col items-center justify-center overflow-hidden relative">
      {/* Background Image */}
      <div className="fixed inset-0 -z-10">
        <img 
          src="https://i.imgur.com/2qmTd0f.jpeg" 
          className="w-full h-full object-cover" 
          alt="background" 
        />
        
        {/* Floating particles */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-white"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: particle.left,
              top: particle.top,
              opacity: particle.opacity,
              animation: `float ${particle.animationDuration} infinite ease-in-out`,
              animationDelay: particle.animationDelay,
            }}
          />
        ))}
      </div>
      
      <div className="container mx-auto px-4 py-0 min-h-screen flex flex-col justify-center items-center">
        {step === "enter-code" && (
          <div className={`max-w-md mx-auto transition-all duration-700 ease-out transform ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-24 mx-auto animate-float" alt="ICCT School Logo" />
            <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>Join Quiz</h1>
            
            <Form className="bg-white/90 backdrop-blur-sm rounded-lg p-8 shadow-lg hover:shadow-glow transition-all duration-300 relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-16 h-16 bg-primary/10 rounded-br-3xl"></div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-secondary/10 rounded-bl-3xl"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-secondary/10 rounded-tr-3xl"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-primary/10 rounded-tl-3xl"></div>
              
              <div className="relative z-10">
                <div className="mb-6">
                  <label className="block text-primary text-lg font-bold mb-2">
                    Quiz Code
                  </label>
                  <Input
                    value={quizCode}
                    onChange={(e) => setQuizCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full text-center text-3xl tracking-widest font-bold border-2 border-primary/30 focus:border-primary/70 transition-all"
                  />
                </div>
                
                <Button onClick={handleSubmitCode} className="w-full bg-gradient-to-r from-primary to-secondary text-white py-3 rounded-lg font-bold text-lg shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all">
                  Continue
                </Button>
                
                <Button onClick={() => navigate("/")} variant="secondary" className="w-full mt-4 bg-white/80 text-primary border-2 border-primary/50 py-2 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all">
                  Back to Home
                </Button>
              </div>
            </Form>
          </div>
        )}
        
        {step === "enter-info" && (
          <div className="max-w-md mx-auto">
            <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-24 mx-auto animate-float" alt="ICCT School Logo" />
            <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>Your Information</h1>
            
            <Form className="bg-white/90 backdrop-blur-sm rounded-lg p-8 shadow-lg hover:shadow-glow transition-all duration-300 relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-16 h-16 bg-primary/10 rounded-br-3xl"></div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-secondary/10 rounded-bl-3xl"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-secondary/10 rounded-tr-3xl"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-primary/10 rounded-tl-3xl"></div>
              
              <div className="relative z-10">
                <div className="mb-4">
                  <label className="block text-primary text-lg font-bold mb-2">
                    Your Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full border-2 border-primary/30 focus:border-primary/70 transition-all"
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-primary text-lg font-bold mb-2">
                    Team (Optional)
                  </label>
                  <Input
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="Enter your team name"
                    className="w-full border-2 border-primary/30 focus:border-primary/70 transition-all"
                  />
                </div>
                
                <Button onClick={handleSubmitInfo} className="w-full bg-gradient-to-r from-primary to-secondary text-white py-3 rounded-lg font-bold text-lg shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all">
                  Join Quiz
                </Button>
                
                <Button onClick={() => setStep("enter-code")} variant="secondary" className="w-full mt-4 bg-white/80 text-primary border-2 border-primary/50 py-2 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all">
                  Back
                </Button>
              </div>
            </Form>
          </div>
        )}
        
        {step === "waiting" && (
          <div className="max-w-md mx-auto text-center">
            <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-24 mx-auto animate-float" alt="ICCT School Logo" />
            <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>Waiting for Host</h1>
            
            <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-8 mb-6 transform transition-all hover:shadow-glow relative overflow-hidden">
              {/* Decorative corner elements */}
              <div className="absolute top-0 left-0 w-16 h-16 bg-primary/10 rounded-br-3xl"></div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-secondary/10 rounded-bl-3xl"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-secondary/10 rounded-tr-3xl"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-primary/10 rounded-tl-3xl"></div>
              
              <div className="relative z-10">
                <div className="animate-pulse">
                  <div className="relative">
                    <div className="w-20 h-20 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                        <div className="w-8 h-8 bg-primary/20 rounded-full animate-ping"></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-primary mb-2">Get Ready!</p>
                  <p className="text-gray-600">Waiting for the host to start the quiz...</p>
                </div>
                
                <div className="mt-8 bg-primary/10 rounded-lg p-4">
                  <p className="font-bold text-primary text-lg">{quiz?.title}</p>
                  {team && <p className="text-gray-600 mt-2 font-medium">Team: <span className="text-secondary">{team}</span></p>}
                  <p className="text-gray-600 mt-2 font-medium">Name: <span className="text-secondary">{name}</span></p>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleLeaveQuiz} 
              variant="secondary"
              className="bg-white/80 text-primary border-2 border-primary/50 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all"
            >
              Leave Quiz
            </Button>
          </div>
        )}
        
        {step === "quiz-active" && (
          <div className="max-w-3xl mx-auto w-full">
            <img src="https://i.imgur.com/7OSw7In.png" className="mb-4 h-20 mx-auto animate-float" alt="ICCT School Logo" />
            <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>{quiz?.title}</h1>
            
            <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg overflow-hidden border-4 border-primary/20 transform transition-all hover:shadow-glow">
              {currentQuestion ? (
                <div className="relative">
                  {/* Decorative elements */}
                  <div className="absolute top-0 left-0 w-12 h-12 bg-primary/20 rounded-br-2xl"></div>
                  <div className="absolute top-0 right-0 w-12 h-12 bg-secondary/20 rounded-bl-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-12 h-12 bg-secondary/20 rounded-tr-2xl"></div>
                  <div className="absolute bottom-0 right-0 w-12 h-12 bg-primary/20 rounded-tl-2xl"></div>
                  
                  {/* Animated highlight bar */}
                  <div className="absolute top-0 left-0 h-2 bg-gradient-to-r from-primary via-secondary to-primary w-full animate-gradient-x"></div>
                  
                  <QuizQuestion 
                    question={currentQuestion} 
                    quizId={quizCode} 
                    participantId={participantId} 
                    isHost={false} 
                  />
                </div>
              ) : (
                <div className="p-10 text-center">
                  <div className="relative">
                    <div className="w-24 h-24 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                        <div className="w-12 h-12 bg-primary/20 rounded-full animate-ping"></div>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-primary mb-2">Waiting for next question...</h3>
                  <p className="text-gray-600">The host is preparing the next challenge for you!</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 text-center">
              <Button 
                onClick={handleLeaveQuiz} 
                variant="secondary"
                className="bg-white/80 text-primary border-2 border-primary/50 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all"
              >
                Leave Quiz
              </Button>
            </div>
          </div>
        )}
        
        {step === "quiz-completed" && renderQuizCompletedView()}
        
        {countdown > 0 && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full animate-pulse" 
                  style={{ 
                    filter: 'blur(20px)',
                    transform: 'scale(1.2)'
                  }}
              ></div>
              <div className="bg-white rounded-full w-40 h-40 flex items-center justify-center relative">
                <span className="text-8xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent animate-pulse">
                  {countdown}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
} 