import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '@/firebase/config';
import { ref, onValue, update, get } from 'firebase/database';
import { toast } from 'react-hot-toast';
import Button from '@/components/Button';
import QuizQuestion from '@/components/quiz/QuizQuestion';
import QuizResults from '@/components/quiz/QuizResults';
import LoadingSpinner from '@/components/LoadingSpinner';
import Layout from '@/components/Layout';
import ParticipantWaiting from '@/components/participant/ParticipantWaiting';
import { FaHistory } from 'react-icons/fa';

// Component to display participant info in the header
function ParticipantInfo({ name, team }) {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-3 shadow-md fixed top-4 left-4 z-50 max-w-xs border-2 border-white/30">
      <div className="mb-1">
        <div className="text-xs text-blue-100 uppercase font-medium">Participant</div>
        <div className="font-bold text-lg">{name}</div>
      </div>
      <div>
        <div className="text-xs text-purple-100 uppercase font-medium">Team</div>
        <div className="font-bold text-lg">{team}</div>
      </div>
    </div>
  );
}

// Component to display history button
function HistoryButton({ quizCode }) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    // Open in new tab instead of navigating in the current tab
    window.open(`/history?quizId=${quizCode}`, '_blank', 'noopener,noreferrer');
  };
  
  return (
    <button
      onClick={handleClick}
      className="fixed top-4 right-4 z-50 bg-white rounded-full p-3 shadow-md text-primary hover:bg-primary hover:text-white transition-colors duration-300 border-2 border-primary/30"
      title="View Quiz History"
    >
      <FaHistory className="text-xl" />
    </button>
  );
}

export default function Participant() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quizCode, setQuizCode] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [participantName, setParticipantName] = useState(null);
  const [participantTeam, setParticipantTeam] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [results, setResults] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    // Get quiz code from URL params or session storage
    const searchParams = new URLSearchParams(location.search);
    const code = searchParams.get('code') || sessionStorage.getItem('quizCode');
    const pId = sessionStorage.getItem('participantId');
    const pName = sessionStorage.getItem('participantName');
    const pTeam = sessionStorage.getItem('participantTeam');

    if (!code || !pId || !pName || !pTeam) {
      // Required information is missing, redirect to join quiz
      navigate('/join');
      return;
    }

    setQuizCode(code);
    setParticipantId(pId);
    setParticipantName(pName);
    setParticipantTeam(pTeam);

    // Listen for quiz data updates
    const quizRef = ref(db, `quizzes/${code}`);
    const unsubscribe = onValue(quizRef, (snapshot) => {
      if (!snapshot.exists()) {
        setError('Quiz not found');
        setLoading(false);
        return;
      }

      const quizData = snapshot.val();
      setQuiz(quizData);
      setQuizStatus(quizData.status);

      // Check if the participant exists in the quiz
      if (!quizData.participants || !quizData.participants[pId]) {
        // Participant not found in quiz, redirect to join
        toast.error('You are not registered for this quiz');
        navigate('/join');
        return;
      }
      
      // Make sure the participant data in Firebase matches the session storage data
      // This prevents other components from overriding with generated fallbacks
      const participantData = quizData.participants[pId];
      if (participantData && 
          (participantData.name !== pName || participantData.team !== pTeam)) {
        console.log(`Syncing participant data from session storage: Name=${pName}, Team=${pTeam}`);
        // Update Firebase with the original session data (as a precaution)
        update(ref(db, `quizzes/${code}/participants/${pId}`), {
          name: pName,
          team: pTeam
        });
      }

      // Handle current question if quiz is in progress
      if (quizData.status === 'in_progress' && quizData.currentQuestion) {
        setCurrentQuestion(quizData.currentQuestion);
        setTimeLeft(quizData.timeLeft);
      } else {
        setCurrentQuestion(null);
      }

      // Handle results if quiz is completed
      if (quizData.status === 'completed' && quizData.results) {
        setResults(quizData.results);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate, location]);

  // Make sure the participant data in Firebase stays synchronized with the session storage
  useEffect(() => {
    if (!quizCode || !participantId || !participantName || !participantTeam) return;
    
    // This effect runs separately to ensure the data stays in sync
    const participantRef = ref(db, `quizzes/${quizCode}/participants/${participantId}`);
    
    // Get current data once
    const syncData = async () => {
      try {
        const snapshot = await get(participantRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          
          // If the name or team was changed to something else, restore it
          if (data.name !== participantName || data.team !== participantTeam) {
            console.log('Synchronizing participant data with session data');
            await update(participantRef, {
              name: participantName,
              team: participantTeam
            });
          }
        }
      } catch (err) {
        console.error('Error syncing participant data:', err);
      }
    };
    
    syncData();
    
    // Also listen for changes
    const unsubscribe = onValue(participantRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // If someone changed the data, change it back
        if (data.name !== participantName || data.team !== participantTeam) {
          console.log('Data changed, restoring from session');
          update(participantRef, {
            name: participantName,
            team: participantTeam
          });
        }
      }
    });
    
    return () => unsubscribe();
  }, [quizCode, participantId, participantName, participantTeam]);

  // Handle answering a question
  const handleAnswer = async (questionId, answerId) => {
    if (!quizCode || !participantId || answeredQuestions.includes(questionId)) {
      return;
    }

    try {
      // Record the participant's answer
      const answerRef = ref(db, `quizzes/${quizCode}/answers/${questionId}/${participantId}`);
      await update(answerRef, {
        answerId,
        timestamp: Date.now()
      });

      // Update local state to prevent multiple answers
      setAnsweredQuestions([...answeredQuestions, questionId]);
      toast.success('Answer submitted');
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Failed to submit answer');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center p-6">
          <h2 className="text-2xl font-bold mb-4 text-red-600">{error}</h2>
          <p className="mb-4">The quiz you're looking for couldn't be found.</p>
          <Button onClick={() => navigate('/join')}>Join Another Quiz</Button>
        </div>
      </Layout>
    );
  }

  // Render based on quiz status
  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-4">
        {/* Always show participant info at the top */}
        {participantName && participantTeam && (
          <ParticipantInfo name={participantName} team={participantTeam} />
        )}
        
        {/* Always show history button if we have a quiz code */}
        {quizCode && <HistoryButton quizCode={quizCode} />}
        
        {quizStatus === 'waiting' && (
          <ParticipantWaiting 
            quizCode={quizCode}
            participantName={participantName}
            participantTeam={participantTeam}
          />
        )}

        {quizStatus === 'in_progress' && currentQuestion && (
          <QuizQuestion
            question={currentQuestion}
            timeLeft={timeLeft}
            onAnswer={handleAnswer}
            answered={answeredQuestions.includes(currentQuestion.id)}
          />
        )}

        {quizStatus === 'completed' && results && (
          <QuizResults 
            results={results} 
            participantId={participantId}
            quizData={quiz}
          />
        )}
      </div>
    </Layout>
  );
} 