import { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { ref, onValue, get } from 'firebase/database';

/**
 * TieBreakerStats displays information about who answered tie-breaker questions first
 * @param {Object} props - Component props
 * @param {string} props.quizId - ID of the current quiz
 */
export default function TieBreakerStats({ quizId }) {
  const [tieBreakerData, setTieBreakerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!quizId) {
      setLoading(false);
      return;
    }

    const fetchTieBreakerData = async () => {
      try {
        setLoading(true);
        
        // Get questions to find tie-breaker questions
        const questionsRef = ref(db, `quizzes/${quizId}/questions`);
        const questionsSnapshot = await get(questionsRef);
        
        if (!questionsSnapshot.exists()) {
          setTieBreakerData([]);
          setLoading(false);
          return;
        }
        
        const questionsData = questionsSnapshot.val();
        const tieBreakerQuestions = [];
        
        // Create an array of tie-breaker questions
        Object.entries(questionsData).forEach(([id, questionData]) => {
          if (questionData.difficulty === 'tie-breaker') {
            tieBreakerQuestions.push({
              id,
              text: questionData.text,
              answerData: []
            });
          }
        });
        
        if (tieBreakerQuestions.length === 0) {
          setTieBreakerData([]);
          setLoading(false);
          return;
        }
        
        // Get participants for name lookup
        const participantsRef = ref(db, `quizzes/${quizId}/participants`);
        const participantsSnapshot = await get(participantsRef);
        const participantsData = participantsSnapshot.exists() ? participantsSnapshot.val() : {};
        
        // Get answers for each tie-breaker question
        for (const question of tieBreakerQuestions) {
          const answersRef = ref(db, `quizzes/${quizId}/answers/${question.id}`);
          const answersSnapshot = await get(answersRef);
          
          if (answersSnapshot.exists()) {
            const answersData = answersSnapshot.val();
            
            // Filter for correct answers only
            const correctAnswers = [];
            Object.entries(answersData).forEach(([participantId, answerData]) => {
              if (answerData.scoreEarned > 0) { // This means the answer was correct
                const participant = participantsData[participantId] || { name: `Unknown (${participantId.slice(-4)})` };
                
                correctAnswers.push({
                  participantId,
                  name: participant.name,
                  team: participant.team,
                  timestamp: answerData.timestamp,
                  timeRemaining: answerData.timeRemaining
                });
              }
            });
            
            // Sort correct answers by timestamp (earliest first)
            correctAnswers.sort((a, b) => a.timestamp - b.timestamp);
            
            // Add sorted answers to the question data
            question.answerData = correctAnswers;
          }
        }
        
        setTieBreakerData(tieBreakerQuestions);
      } catch (err) {
        console.error("Error fetching tie-breaker data:", err);
        setError("Failed to load tie-breaker statistics");
      } finally {
        setLoading(false);
      }
    };

    fetchTieBreakerData();
    
    // Set up subscription for live updates
    const questionsRef = ref(db, `quizzes/${quizId}/questions`);
    const unsubscribe = onValue(questionsRef, () => {
      fetchTieBreakerData();
    });
    
    return () => unsubscribe();
  }, [quizId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (tieBreakerData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-2">Tie-Breaker Statistics</h2>
        <p className="text-gray-500">No tie-breaker questions available in this quiz.</p>
      </div>
    );
  }

  // Format timestamp (unix timestamp in ms)
  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-bold mb-4">Tie-Breaker Statistics</h2>
      <p className="text-sm text-gray-600 mb-4">
        In case of a tie in scores, participants are ranked by who answered tie-breaker questions correctly first.
      </p>
      
      {tieBreakerData.map((question, index) => (
        <div key={question.id} className="mb-6">
          <h3 className="font-semibold mb-2">
            Tie-Breaker Question {index + 1}: {question.text}
          </h3>
          
          {question.answerData.length === 0 ? (
            <p className="text-sm text-gray-500">No correct answers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Order</th>
                    <th className="p-2 text-left">Participant</th>
                    <th className="p-2 text-left">Team</th>
                    <th className="p-2 text-right">Time Remaining</th>
                    <th className="p-2 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {question.answerData.map((answer, idx) => (
                    <tr 
                      key={answer.participantId} 
                      className={`border-t ${idx === 0 ? 'bg-green-50' : ''}`}
                    >
                      <td className="p-2 font-bold">
                        {idx === 0 ? '🥇 First' : idx === 1 ? '🥈 Second' : idx === 2 ? '🥉 Third' : `${idx + 1}th`}
                      </td>
                      <td className="p-2">{answer.name}</td>
                      <td className="p-2">{answer.team || 'N/A'}</td>
                      <td className="p-2 text-right">{answer.timeRemaining || 'N/A'} sec</td>
                      <td className="p-2 text-right">{formatTime(answer.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 