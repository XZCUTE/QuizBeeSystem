import { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { ref, onValue, get } from 'firebase/database';
import { FaUsers, FaTrophy } from 'react-icons/fa';

/**
 * TiedParticipants displays participants who have the same scores
 * @param {Object} props - Component props
 * @param {string} props.quizId - ID of the current quiz
 */
export default function TiedParticipants({ quizId }) {
  const [tiedGroups, setTiedGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!quizId) {
      setLoading(false);
      setError("Quiz ID is required");
      return;
    }

    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const participantsData = snapshot.val();
          
          // Convert to array and add necessary fields
          const participantsArray = Object.keys(participantsData).map(key => ({
            id: key,
            ...participantsData[key],
            name: participantsData[key].name || "Anonymous",
            team: participantsData[key].team || "No Team",
            score: participantsData[key].score || 0
          }));
          
          // Group participants by score
          const scoreGroups = {};
          
          participantsArray.forEach(participant => {
            const score = participant.score;
            if (!scoreGroups[score]) {
              scoreGroups[score] = [];
            }
            scoreGroups[score].push(participant);
          });
          
          // Filter for groups with more than one participant (tied scores)
          const tiedGroupsArray = Object.entries(scoreGroups)
            .filter(([_, participants]) => participants.length > 1)
            .map(([score, participants]) => ({
              score: parseInt(score),
              participants
            }))
            .sort((a, b) => b.score - a.score); // Sort by score (highest first)
          
          setTiedGroups(tiedGroupsArray);
          setError(null);
        } else {
          setTiedGroups([]);
        }
      } catch (err) {
        console.error("Error processing participants data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [quizId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="ml-3 text-primary font-medium">Finding tied participants...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error:</p>
        <p>{error}</p>
      </div>
    );
  }

  if (tiedGroups.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <FaTrophy className="mx-auto text-5xl text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Tied Scores</h2>
        <p className="text-gray-600">
          All participants have unique scores! No tie-breaker is needed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-primary">Tied Participants</h2>
        <p className="text-gray-600 mt-1">
          The following participants have identical scores and may require tie-breakers
        </p>
      </div>
      
      <div className="divide-y divide-gray-200">
        {tiedGroups.map((group) => (
          <div key={group.score} className="p-5 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold text-gray-800">
                Score: <span className="text-primary">{group.score}</span>
              </h3>
              <div className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                {group.participants.length} participants tied
              </div>
            </div>
            
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {group.participants.map((participant) => (
                    <tr key={participant.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center group relative">
                          <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={participant.name}>
                            {participant.name}
                          </div>
                          <div className="absolute left-0 bottom-full hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-50">
                            {participant.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-500 truncate max-w-[150px] group relative" title={participant.team}>
                          {participant.team}
                          <div className="absolute left-0 bottom-full hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-50">
                            {participant.team}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-bold text-primary">{participant.score}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 