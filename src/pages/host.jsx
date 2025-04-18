import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { db } from "@/firebase/config"
import { ref, push, set, onValue, remove, get } from "firebase/database"
import { v4 as uuidv4 } from "uuid"
import Button from "@/components/Button"
import Input from "@/components/Input"
import toast from "react-hot-toast"
import QuizController from "@/components/quiz/QuizController"
import useSound from "@/hooks/useSound"
import SoundButton from "@/components/SoundButton"

export default function Host() {
  const navigate = useNavigate()
  const [step, setStep] = useState("create-questions") // create-questions, view-participants, quiz-started
  const [quizCode, setQuizCode] = useState("")
  const [quiz, setQuiz] = useState({
    title: "",
    questions: []
  })
  const [currentQuestion, setCurrentQuestion] = useState({
    id: uuidv4(),
    text: "",
    type: "multiple-choice", // multiple-choice, fill-in-blank
    options: ["", "", "", ""],
    correctAnswer: 0,
    timer: 30, // seconds
    points: 100,
    difficulty: "easy" // easy, intermediate, hard, difficult, tie-breaker
  })
  const [participants, setParticipants] = useState([])
  const [countdown, setCountdown] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const sound = useSound({ 
    pageType: 'host', 
    step,
    playBackgroundMusic: true,
    playEntranceSound: true
  })

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
    
    // If quiz code is set, listen for participants
    if (quizCode) {
      const participantsRef = ref(db, `quizzes/${quizCode}/participants`);
      const unsubscribe = onValue(participantsRef, (snapshot) => {
        if (snapshot.exists()) {
          const participantsData = snapshot.val();
          const participantsArray = Object.keys(participantsData).map(key => ({
            id: key,
            ...participantsData[key]
          }));
          
          // Play a sound when a new participant joins
          if (participantsArray.length > participants.length) {
            sound.playSuccess();
          }
          
          setParticipants(participantsArray);
        } else {
          setParticipants([]);
        }
      });

      // Also listen for quiz status changes
      const quizRef = ref(db, `quizzes/${quizCode}`);
      const quizUnsubscribe = onValue(quizRef, (snapshot) => {
        if (snapshot.exists()) {
          const quizData = snapshot.val();
          if (quizData.status === "active" && step === "view-participants") {
            setStep("quiz-started");
          }
        }
      });

      return () => {
        unsubscribe();
        quizUnsubscribe();
        clearTimeout(timer);
      };
    }
    
    return () => clearTimeout(timer);
  }, [quizCode, step, participants.length, sound]);

  const handleCreateQuiz = () => {
    if (!quiz.title) {
      toast.error("Please enter a quiz title");
      sound.playError();
      return;
    }
    
    if (quiz.questions.length === 0) {
      toast.error("Please add at least one question");
      sound.playError();
      return;
    }
    
    // Generate a unique code for the quiz
    const newQuizCode = Math.floor(100000 + Math.random() * 900000).toString();
    setQuizCode(newQuizCode);
    
    // Save quiz to Firebase
    const quizRef = ref(db, `quizzes/${newQuizCode}`);
    set(quizRef, {
      ...quiz,
      createdAt: new Date().toISOString(),
      status: "waiting", // waiting, active, completed
    });
    
    sound.playSuccess();
    sound.play('transition');
    toast.success(`Quiz created! Code: ${newQuizCode}`);
    setStep("view-participants");
  }

  const handleAddQuestion = () => {
    if (!currentQuestion.text) {
      toast.error("Question text is required");
      sound.playError();
      return;
    }
    
    if (currentQuestion.type === "multiple-choice") {
      // Check if at least 2 options are filled
      const filledOptions = currentQuestion.options.filter(opt => opt.trim() !== "");
      if (filledOptions.length < 2) {
        toast.error("Please add at least 2 options");
        sound.playError();
        return;
      }
      
      // Check if correct answer is selected
      if (currentQuestion.correctAnswer === null) {
        toast.error("Please select the correct answer");
        sound.playError();
        return;
      }
    } else if (currentQuestion.type === "fill-in-blank" && !currentQuestion.correctAnswer) {
      toast.error("Please enter the correct answer");
      sound.playError();
      return;
    }
    
    setQuiz({
      ...quiz,
      questions: [...quiz.questions, currentQuestion]
    });
    
    // Reset current question with a new ID
    setCurrentQuestion({
      id: uuidv4(),
      text: "",
      type: "multiple-choice",
      options: ["", "", "", ""],
      correctAnswer: 0,
      timer: 30,
      points: 100,
      difficulty: "easy"
    });
    
    sound.playSuccess();
    toast.success("Question added");
  }

  const handleRemoveQuestion = (id) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.filter(q => q.id !== id)
    });
    sound.play('click');
    toast.success("Question removed");
  }

  const handleStartQuiz = async () => {
    if (participants.length === 0) {
      toast.error("No participants have joined yet");
      sound.playError();
      return;
    }
    
    try {
      // First, get the current quiz data to preserve participants
      const quizRef = ref(db, `quizzes/${quizCode}`);
      const snapshot = await get(quizRef);
      
      if (!snapshot.exists()) {
        toast.error("Quiz not found");
        return;
      }
      
      const currentQuizData = snapshot.val();
      
      // Preserve the participants data while updating other properties
      await set(quizRef, {
        ...currentQuizData,  // Keep all existing data, especially participants
        title: quiz.title,
        questions: quiz.questions,
        status: "active",
        currentQuestionIndex: 0,
        startedAt: new Date().toISOString()
      });
      
      console.log("Starting quiz with participants:", currentQuizData.participants);
      
      // Start countdown
      setCountdown(3);
      sound.play('countdown');
      
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          // Play countdown sound for each tick
          if (prev > 1) {
            sound.play('countdown');
          } else if (prev === 1) {
            sound.play('countdownFinish');
          }
          
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setStep("quiz-started");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Error starting quiz:", error);
      toast.error("Failed to start quiz");
      sound.playError();
    }
  }

  const handleOptionChange = (index, value) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion({ ...currentQuestion, options: newOptions });
  }

  const moveToNextQuestion = () => {
    sound.playClick();
  };

  const showResults = () => {
    sound.playSuccess();
  };

  return (
    <section className="min-h-screen w-full flex flex-col items-center justify-center overflow-hidden relative">
      {/* Background Image */}
      <div className="fixed inset-0 -z-10">
        <img 
          src="https://i.imgur.com/NSkjBnJ.jpeg" 
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

      {step === "create-questions" && (
        <div className={`max-w-3xl mx-auto transition-all duration-700 ease-out transform ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-24 mx-auto animate-float" alt="ICCT School Logo" />
          <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>Create Quiz</h1>
          
          <div className="mb-6 bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-lg">
            <label className="block text-primary text-lg font-bold mb-2">
              Quiz Title
            </label>
            <Input
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              placeholder="Enter quiz title"
              className="w-full text-lg font-medium border-2 border-primary/30 focus:border-primary/70 transition-all"
            />
          </div>
          
          {quiz.questions.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4">Questions ({quiz.questions.length})</h2>
              <ul className="space-y-4">
                {quiz.questions.map((q, index) => (
                  <li key={q.id} className="bg-gray-100 p-4 rounded-lg">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-bold">#{index + 1}</span> {q.text}
                        <div className="text-sm text-gray-500 mt-1">
                          {q.type === "multiple-choice" ? "Multiple Choice" : "Fill in the Blank"} | 
                          {q.timer}s | {q.points} pts | {q.difficulty}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveQuestion(q.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-primary">Add New Question</h2>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Question Text
              </label>
              <Input
                value={currentQuestion.text}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
                placeholder="Enter question text"
                className="w-full"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Question Type
              </label>
              <select
                value={currentQuestion.type}
                onChange={(e) => setCurrentQuestion({ 
                  ...currentQuestion, 
                  type: e.target.value,
                  options: e.target.value === "fill-in-blank" ? [] : ["", "", "", ""],
                  correctAnswer: e.target.value === "fill-in-blank" ? "" : 0
                })}
                className="w-full p-2 border rounded"
              >
                <option value="multiple-choice">Multiple Choice</option>
                <option value="fill-in-blank">Fill in the Blank</option>
              </select>
            </div>
            
            {currentQuestion.type === "multiple-choice" && (
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Options (Check the correct one)
                </label>
                <div className="space-y-2">
                  {currentQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center">
                      <input
                        type="radio"
                        checked={currentQuestion.correctAnswer === index}
                        onChange={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: index })}
                        className="mr-2"
                      />
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {currentQuestion.type === "fill-in-blank" && (
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Correct Answer
                </label>
                <Input
                  value={currentQuestion.correctAnswer}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                  placeholder="Enter correct answer"
                  className="w-full"
                />
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Timer (seconds)
                </label>
                <Input
                  type="number"
                  value={currentQuestion.timer}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, timer: Number(e.target.value) })}
                  min="5"
                  max="120"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Points
                </label>
                <Input
                  type="number"
                  value={currentQuestion.points}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, points: Number(e.target.value) })}
                  min="10"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Difficulty
                </label>
                <select
                  value={currentQuestion.difficulty}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, difficulty: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  <option value="easy">Easy</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="hard">Hard</option>
                  <option value="difficult">Difficult</option>
                  <option value="tie-breaker">Tie-Breaker</option>
                </select>
              </div>
            </div>
            
            <SoundButton 
              onClick={handleAddQuestion} 
              className="w-full bg-gradient-to-r from-primary to-secondary text-white py-3 rounded-lg font-bold text-lg shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all"
            >
              Add Question
            </SoundButton>
          </div>
          
          <div className="flex justify-between">
            <Button 
              onClick={() => {
                sound.playClick();
                navigate("/");
              }} 
              variant="secondary"
              className="bg-white/80 text-primary border-2 border-primary/50 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all"
              onMouseEnter={() => sound.playHover()}
            >
              Back to Home
            </Button>
            <SoundButton 
              onClick={handleCreateQuiz} 
              disabled={quiz.questions.length === 0}
              className={`bg-gradient-to-r from-primary to-secondary text-white px-8 py-3 rounded-lg font-bold shadow-md transition-all ${quiz.questions.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:scale-105'}`}
              onMouseEnter={() => sound.playHover()}
            >
              Create Quiz
            </SoundButton>
          </div>
        </div>
      )}
      
      {step === "view-participants" && (
        <div className={`max-w-3xl mx-auto transition-all duration-700 ease-out transform ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-24 mx-auto animate-float" alt="ICCT School Logo" />
          <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>Waiting for Participants</h1>
          
          <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-6 mb-6 transition-all duration-300 hover:shadow-glow">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Quiz Code</h2>
              <div className="text-4xl font-bold text-primary animate-pulse">{quizCode}</div>
              <p className="text-gray-500 mt-2">Share this code with your participants</p>
            </div>
            
            <h2 className="text-xl font-bold mb-4">Participants ({participants.length})</h2>
            
            {participants.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p>No participants yet...</p>
                <p className="text-sm mt-2">Waiting for people to join...</p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {participants.map((participant, index) => (
                  <li 
                    key={participant.id} 
                    className="bg-gray-100 p-3 rounded-lg flex justify-between items-center transition-all duration-300 hover:bg-gray-200"
                    style={{
                      animation: 'fadeIn 0.5s ease forwards',
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    <div className="flex items-center group relative">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white mr-3">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate max-w-[250px]">
                        <span className="font-bold" title={participant.name}>{participant.name}</span>
                        {participant.team && (
                          <span className="text-gray-600 ml-2 truncate inline-block" title={participant.team}>
                            ({participant.team})
                          </span>
                        )}
                        <div className="absolute left-0 bottom-full hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-50">
                          {participant.name} {participant.team ? `(${participant.team})` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(participant.joinedAt).toLocaleTimeString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="flex justify-between">
            <Button 
              onClick={() => {
                sound.playClick();
                navigate("/");
              }} 
              variant="secondary"
              className="bg-white/80 text-primary border-2 border-primary/50 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all"
              onMouseEnter={() => sound.playHover()}
            >
              Cancel Quiz
            </Button>
            <SoundButton 
              onClick={handleStartQuiz} 
              disabled={participants.length === 0}
              className={`bg-gradient-to-r from-primary to-secondary text-white px-8 py-3 rounded-lg font-bold shadow-md transition-all ${participants.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:scale-105 animate-pulse-slow'}`}
              onMouseEnter={() => participants.length > 0 && sound.playHover()}
            >
              Start Quiz
            </SoundButton>
          </div>
        </div>
      )}
      
      {step === "quiz-started" && (
        <div className="w-full max-w-4xl transition-all duration-700 ease-out transform">
          <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-16 mx-auto" alt="ICCT School Logo" />
          <QuizController quizId={quizCode} />
        </div>
      )}
      
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
    </section>
  )
} 