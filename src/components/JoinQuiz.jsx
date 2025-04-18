import { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { ref, set, get, onValue } from 'firebase/database';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { v4 as uuidv4 } from 'uuid';

/**
 * JoinQuiz component allows participants to join a quiz by entering a code
 * and their information
 */
export default function JoinQuiz() {
  const navigate = useNavigate();
  const location = useLocation();
  const [quizCode, setQuizCode] = useState('');
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load data from session storage if available
  useEffect(() => {
    const savedName = sessionStorage.getItem('participantName');
    const savedTeam = sessionStorage.getItem('participantTeam');
    
    if (savedName) setName(savedName);
    if (savedTeam) setTeam(savedTeam);
  }, []);

  // Validate quiz code
  const handleSubmitCode = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!quizCode.trim()) {
      setError('Please enter a quiz code');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Check if the quiz exists
      const quizRef = ref(db, `quizzes/${quizCode}`);
      const quizSnapshot = await get(quizRef);
      
      if (!quizSnapshot.exists()) {
        setError('Quiz not found. Please check the code and try again.');
        setIsSubmitting(false);
        return;
      }
      
      // Check if the quiz is accepting participants
      const quizData = quizSnapshot.val();
      if (quizData.status !== 'waiting') {
        setError('This quiz is no longer accepting participants.');
        setIsSubmitting(false);
        return;
      }
      
      // Quiz exists and is accepting participants, proceed to next step
      setStep(2);
      
    } catch (error) {
      console.error('Error checking quiz code:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle participant info submission
  const handleSubmitInfo = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate inputs - require both name and team
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!team.trim()) {
      setError('Please enter your team name');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Generate unique participant ID
      const participantId = uuidv4();
      
      // Save participant info in session storage
      sessionStorage.setItem('participantId', participantId);
      sessionStorage.setItem('participantName', name);
      sessionStorage.setItem('participantTeam', team);
      sessionStorage.setItem('quizCode', quizCode);
      
      // Add participant to the quiz with clear name and team values to prevent fallbacks
      const participantRef = ref(db, `quizzes/${quizCode}/participants/${participantId}`);
      
      // Store trimmed values with an extra space if needed to ensure they're never empty strings
      // This prevents other components from thinking they need to add a fallback
      const nameToStore = name.trim() || ' '; 
      const teamToStore = team.trim() || ' ';
      
      await set(participantRef, {
        id: participantId,
        name: nameToStore,
        team: teamToStore,
        joinedAt: Date.now(),
        score: 0
      });
      
      console.log(`Participant joined: ID=${participantId}, Name=${nameToStore}, Team=${teamToStore}`);
      toast.success('Successfully joined the quiz!');
      
      // Redirect to participant waiting room
      navigate(`/participant/waiting?code=${quizCode}`);
      
    } catch (error) {
      console.error('Error joining quiz:', error);
      setError('Failed to join the quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form and go back to step 1
  const handleBack = () => {
    setStep(1);
    setError('');
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4 text-center">
        {step === 1 ? 'Join a Quiz' : 'Enter Your Information'}
      </h2>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4">
          {error}
        </div>
      )}
      
      {step === 1 ? (
        <form onSubmit={handleSubmitCode} className="space-y-4">
          <div>
            <label htmlFor="quizCode" className="block mb-1 font-medium">
              Quiz Code
            </label>
            <Input
              id="quizCode"
              value={quizCode}
              onChange={(e) => setQuizCode(e.target.value)}
              placeholder="Enter the quiz code"
              required
              className="w-full"
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Loading...' : 'Continue'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSubmitInfo} className="space-y-4">
          <div>
            <label htmlFor="name" className="block mb-1 font-medium">
              Your Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be displayed on the leaderboard
            </p>
          </div>
          
          <div>
            <label htmlFor="team" className="block mb-1 font-medium">
              Team Name
            </label>
            <Input
              id="team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="Enter your team name"
              required
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Teams will be used for grouping on the leaderboard
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleBack}
              className="flex-1"
            >
              Back
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Loading...' : 'Join Quiz'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
} 