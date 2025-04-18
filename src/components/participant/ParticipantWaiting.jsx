import { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { ref, onValue, update } from 'firebase/database';

/**
 * ParticipantWaiting component shown to participants while they wait for the quiz to start
 * @param {Object} props
 * @param {string} props.quizCode - Quiz code
 * @param {string} props.participantName - Participant's name
 * @param {string} props.participantTeam - Participant's team name
 */
export default function ParticipantWaiting({ quizCode, participantName, participantTeam }) {
  const [participants, setParticipants] = useState([]);
  const [quizTitle, setQuizTitle] = useState('');
  
  // Fetch quiz data and other participants
  useEffect(() => {
    if (!quizCode) return;

    // Get quiz info
    const quizRef = ref(db, `quizzes/${quizCode}`);
    const unsubscribe = onValue(quizRef, (snapshot) => {
      if (snapshot.exists()) {
        const quizData = snapshot.val();
        setQuizTitle(quizData.title || 'Quiz');
        
        // Get participants
        if (quizData.participants) {
          const participantsArray = Object.entries(quizData.participants).map(([id, data]) => ({
            id,
            name: data.name,
            team: data.team
          }));
          setParticipants(participantsArray);
        }
      }
    });
    
    return () => unsubscribe();
  }, [quizCode]);

  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-6">Waiting for the Quiz to Start</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 text-primary">{quizTitle}</h2>
        
        <div className="border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold mb-2">Your Information</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-500 font-medium">Your Name</div>
              <div className="font-bold text-blue-700">{participantName}</div>
            </div>
            
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-sm text-purple-500 font-medium">Your Team</div>
              <div className="font-bold text-purple-700">{participantTeam}</div>
            </div>
          </div>
          
          <p className="text-sm text-gray-500 mt-1">
            This information will be displayed on the leaderboard
          </p>
        </div>
        
        <div className="text-center py-3 bg-yellow-50 rounded-lg mb-4">
          <p className="text-yellow-700">
            Please wait for the host to start the quiz.
            <br />
            <span className="text-sm">The page will update automatically.</span>
          </p>
        </div>
        
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Other Participants ({participants.length - 1})</h3>
          {participants.length > 1 ? (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {participants.filter(p => p.name !== participantName).map(participant => (
                    <tr key={participant.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">{participant.name}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{participant.team}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">
              You're the only participant so far!
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 