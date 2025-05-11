import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { db } from "@/firebase/config"
import { ref, push, set, onValue, remove, get } from "firebase/database"
import { v4 as uuidv4 } from "uuid"
import Button from "@/components/Button"
import Input from "@/components/Input"
import toast from "react-hot-toast"
import QuizController from "@/components/quiz/QuizController"
import HistoryButton from "@/components/HistoryButton"
import usePreventQuizExit from "@/hooks/usePreventQuizExit"

export default function Host() {
  const navigate = useNavigate()
  const [step, setStep] = useState("create-questions") // create-questions, view-participants, countdown, quiz-started
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
  const [quizCompleted, setQuizCompleted] = useState(false)
  const countdownIntervalRef = useRef(null) // Ref to store interval ID

  // Prevent page exit during active quiz session
  const isActiveQuiz = step === "quiz-started" || step === "countdown" || step === "view-participants";
  const customExitMessage = quizCompleted 
    ? "Are you sure you want to leave? The quiz results page will close."
    : "Warning: Leaving this page will end the quiz session for all participants. Are you sure you want to exit?";
  
  // Use the prevention hook with different messages based on quiz state
  usePreventQuizExit(
    isActiveQuiz || quizCompleted,
    customExitMessage
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
          // Handle transitions to active state
          if (quizData.status === "active" && (step === "view-participants" || step === "countdown")) {
            setStep("quiz-started");
          }
          
          // Update countdown value if in countdown state
          if (quizData.status === "countdown" && quizData.countdownValue !== undefined) {
            setCountdown(quizData.countdownValue);
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
  }, [quizCode, step, participants.length]);

  // Check if the quiz is completed when the component mounts or quizCode changes
  useEffect(() => {
    if (quizCode) {
      const quizRef = ref(db, `quizzes/${quizCode}`);
      const unsubscribe = onValue(quizRef, (snapshot) => {
        if (snapshot.exists()) {
          const quizData = snapshot.val();
          if (quizData.status === "completed") {
            setQuizCompleted(true);
          }
        }
      });
      
      return () => unsubscribe();
    }
  }, [quizCode]);

  const handleCreateQuiz = () => {
    if (!quiz.title) {
      toast.error("Please enter a quiz title");
      return;
    }
    
    if (quiz.questions.length === 0) {
      toast.error("Please add at least one question");
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
    
    toast.success(`Quiz created! Code: ${newQuizCode}`);
    setStep("view-participants");
  }

  const handleAddQuestion = () => {
    if (!currentQuestion.text) {
      toast.error("Question text is required");
      return;
    }
    
    if (currentQuestion.type === "multiple-choice") {
      // Check if at least 2 options are filled
      const filledOptions = currentQuestion.options.filter(opt => opt.trim() !== "");
      if (filledOptions.length < 2) {
        toast.error("Please add at least 2 options");
        return;
      }
      
      // Check if correct answer is selected
      if (currentQuestion.correctAnswer === null) {
        toast.error("Please select the correct answer");
        return;
      }
    } else if (currentQuestion.type === "true-false") {
      // For true-false, ensure the correct answer is either 0 (true) or 1 (false)
      if (currentQuestion.correctAnswer !== 0 && currentQuestion.correctAnswer !== 1) {
        toast.error("Please select either True or False as the correct answer");
        return;
      }
    } else if (currentQuestion.type === "fill-in-blank" && !currentQuestion.correctAnswer) {
      toast.error("Please enter the correct answer");
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
    
    toast.success("Question added");
  }

  const handleRemoveQuestion = (id) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.filter(q => q.id !== id)
    });
    toast.success("Question removed");
  }

  const handleStartQuiz = async () => {
    if (participants.length === 0) {
      toast.error("No participants have joined yet");
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
      
      // Set the quiz to countdown state first
      await set(quizRef, {
        ...currentQuizData,  // Keep all existing data, especially participants
        title: quiz.title,
        questions: quiz.questions,
        status: "countdown",  // Use a new status for countdown
        countdownValue: 3,    // Start with 3
        startedAt: new Date().toISOString()
      });
      
      console.log("Starting countdown with participants:", currentQuizData.participants);
      
      // Set local state to countdown
      setStep("countdown");
      setCountdown(3);
      
      // Clear any existing interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      
      // Handle the countdown timer
      countdownIntervalRef.current = setInterval(async () => {
        // Decrement local countdown
        setCountdown(prevCount => {
          const newCount = prevCount - 1;
          
          // If countdown reaches 0, clear interval and move to quiz-started
          if (newCount <= 0) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            
            // Update Firebase to active status after countdown
            set(quizRef, {
              ...currentQuizData,
              title: quiz.title,
              questions: quiz.questions,
              status: "active",
              countdownValue: 0,
              currentQuestionIndex: 0,
              startedAt: new Date().toISOString()
            });
            
            // Transition to quiz-started state
            setStep("quiz-started");
          } else {
            // Update countdown value in Firebase for participants
            set(ref(db, `quizzes/${quizCode}/countdownValue`), newCount);
          }
          
          return newCount;
        });
      }, 1000);
      
    } catch (error) {
      console.error("Error starting quiz:", error);
      toast.error("Failed to start quiz");
    }
  }

  const handleOptionChange = (index, value) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion({ ...currentQuestion, options: newOptions });
  }

  const moveToNextQuestion = () => {
  };

  const showResults = () => {
  };

  // Clean up the interval when component unmounts
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // Add new function for handling quiz export
  const handleExportQuiz = () => {
    // Validate quiz data
    if (!quiz.title) {
      toast.error("Please enter a quiz title");
      return;
    }
    
    if (quiz.questions.length === 0) {
      toast.error("Please add at least one question to export");
      return;
    }
    
    try {
      // Create quiz data object for export
      const quizData = {
        title: quiz.title,
        questions: quiz.questions,
        exportedAt: new Date().toISOString(),
        version: "1.0"
      };
      
      // Convert to JSON string
      const jsonData = JSON.stringify(quizData, null, 2);
      
      // Create blob and download file
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      // Create download link and trigger click
      const link = document.createElement("a");
      link.href = url;
      // Generate filename with quiz title and timestamp
      const safeTitle = quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${safeTitle}_quiz_${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Quiz exported successfully!");
    } catch (error) {
      console.error("Error exporting quiz:", error);
      toast.error("Failed to export quiz");
    }
  };
  
  // Add new function for handling quiz import
  const handleImportQuiz = (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Validate the imported data
        if (!importedData.title || !importedData.questions || !Array.isArray(importedData.questions)) {
          toast.error("Invalid quiz file format");
          return;
        }
        
        // Ensure each question has the required fields
        const validQuestions = importedData.questions.map(q => {
          // Ensure each question has an ID, or generate a new one
          const questionWithId = { ...q, id: q.id || uuidv4() };
          
          // Validate and set defaults for required fields
          return {
            ...questionWithId,
            type: q.type || "multiple-choice",
            options: q.options || (q.type === "multiple-choice" ? ["", "", "", ""] : []),
            correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : "",
            timer: q.timer || 30,
            points: q.points || 100,
            difficulty: q.difficulty || "easy"
          };
        });
        
        // Update quiz state with imported data
        setQuiz({
          title: importedData.title,
          questions: validQuestions
        });
        
        toast.success(`Quiz "${importedData.title}" imported with ${validQuestions.length} questions`);
        
        // Reset file input
        event.target.value = null;
      } catch (error) {
        console.error("Error importing quiz:", error);
        toast.error("Failed to import quiz: Invalid file format");
        
        // Reset file input
        event.target.value = null;
      }
    };
    
    reader.onerror = () => {
      toast.error("Error reading file");
      
      // Reset file input
      event.target.files = null;
    };
    
    reader.readAsText(file);
  };

  return (
    <>
      {/* History Button - only visible after quiz ends */}
      <HistoryButton quizCode={quizCode} visible={quizCompleted} />
    
      <div className={`min-h-screen relative overflow-hidden ${isLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}>
        
        {/* Background Image */}
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
        
        {/* Countdown overlay */}
        {step === "countdown" && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"></div>
            <div className="relative z-10 text-blue-500 text-9xl font-bold animate-pulse" style={{ textShadow: '0 0 15px #06BEE1' }}>
              {countdown}
            </div>
          </div>
        )}
        
        {/* Main content */}
        <div className="relative z-20 min-h-screen">
          <div className="container mx-auto px-4 py-4">
          
          {/* Remove the duplicate header when in quiz-started step */}
          {step !== "quiz-started" && (
            <div className="text-center py-6">
              <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>
                ICCT Quiz Bee System
              </h1>
                <h2 className="text-xl text-gray-200">Host Dashboard</h2>
            </div>
          )}

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
                          {q.type === "multiple-choice" ? "Multiple Choice" : q.type === "true-false" ? "True or False" : "Identification"} | 
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
                  options: e.target.value === "fill-in-blank" 
                    ? [] 
                    : e.target.value === "true-false"
                      ? ["True", "False"] 
                      : ["", "", "", ""],
                  correctAnswer: e.target.value === "fill-in-blank" 
                    ? "" 
                    : 0
                })}
                className="w-full p-2 border rounded"
              >
                <option value="multiple-choice">Multiple Choice</option>
                <option value="true-false">True or False</option>
                <option value="fill-in-blank">Identification</option>
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
            
            {currentQuestion.type === "true-false" && (
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Select the correct answer
                </label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      checked={currentQuestion.correctAnswer === 0}
                      onChange={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: 0 })}
                      className="mr-2"
                    />
                    <div className="w-full p-2 border rounded bg-gray-50">True</div>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      checked={currentQuestion.correctAnswer === 1}
                      onChange={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: 1 })}
                      className="mr-2"
                    />
                    <div className="w-full p-2 border rounded bg-gray-50">False</div>
                  </div>
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
            
            <Button 
              onClick={handleAddQuestion} 
              className="w-full bg-gradient-to-r from-primary to-secondary text-white py-3 rounded-lg font-bold text-lg shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all mb-6"
            >
              Add Question
            </Button>
            
            <div className="flex justify-between items-center flex-wrap gap-4">
              <Button 
                onClick={() => {
                  navigate("/");
                }} 
                variant="secondary"
                className="bg-white/80 text-primary border-2 border-primary/50 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all"
              >
                Back to Home
              </Button>
              
              <div className="flex gap-2">
                {/* Import Quiz Button */}
                <div className="relative">
                  <Button 
                    onClick={() => document.getElementById('import-quiz-input').click()}
                    className="bg-white/80 text-primary border-2 border-primary/50 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Import Quiz
                  </Button>
                  <input
                    id="import-quiz-input"
                    type="file"
                    accept=".json"
                    onChange={handleImportQuiz}
                    style={{ display: 'none' }}
                  />
                </div>
                
                {/* Export Quiz Button */}
                <Button 
                  onClick={handleExportQuiz} 
                  disabled={quiz.questions.length === 0}
                  className={`bg-white/80 text-primary border-2 border-primary/50 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all flex items-center gap-2 ${quiz.questions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 3.293a1 1 0 011.414 0L10 5.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Export Quiz
                </Button>
                
                {/* Create Quiz Button */}
                <Button 
                  onClick={handleCreateQuiz} 
                  disabled={quiz.questions.length === 0}
                  className={`bg-gradient-to-r from-primary to-secondary text-white px-8 py-3 rounded-lg font-bold shadow-md transition-all ${quiz.questions.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:scale-105'}`}
                >
                  Start Quiz
                </Button>
              </div>
            </div>
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
                navigate("/");
              }} 
              variant="secondary"
              className="bg-white/80 text-primary border-2 border-primary/50 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all"
            >
              Cancel Quiz
            </Button>
            <Button 
              onClick={handleStartQuiz} 
              disabled={participants.length === 0}
              className={`bg-gradient-to-r from-primary to-secondary text-white px-8 py-3 rounded-lg font-bold shadow-md transition-all ${participants.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:scale-105 animate-pulse-slow'}`}
            >
              Start Quiz
            </Button>
          </div>
        </div>
      )}
      
      {step === "quiz-started" && (
        <div className="w-full max-w-4xl transition-all duration-700 ease-out transform mx-auto">
          <QuizController quizId={quizCode} />
        </div>
      )}
          </div>
        </div>
      </div>
    </>
  )
} 