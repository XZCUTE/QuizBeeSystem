import { useState, useEffect } from "react";
import { db } from "@/firebase/config";
import { ref, onValue, off } from "firebase/database";
import LoadingSpinner from "@/components/LoadingSpinner";

/**
 * Participant Monitor Component
 * Displays a list of participants for a quiz, optionally filtered by team name
 * @param {string} quizId - The ID of the quiz
 * @param {string} teamFilter - Optional team name to filter participants
 */
export default function ParticipantMonitor({ quizId, teamFilter }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!quizId) return;

    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    
    onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert to array with IDs included and filter by team if teamFilter is provided
        // IMPORTANT: We prioritize the actual names and teams stored in the database
        // Only use fallbacks in the absolute worst case
        const participantsArray = Object.entries(data).map(([id, participant]) => {
          // Get session storage data if this participant is the current user
          const sessionParticipantId = sessionStorage.getItem('participantId');
          const isCurrentUser = id === sessionParticipantId;
          
          if (isCurrentUser) {
            // If this is the current user, use session storage values as the source of truth
            const sessionName = sessionStorage.getItem('participantName');
            const sessionTeam = sessionStorage.getItem('participantTeam');
            
            return {
              id,
              ...participant,
              name: sessionName || participant.name || `Participant-${id.slice(-4)}`,
              team: sessionTeam || participant.team || `Team-Participant-${id.slice(-4)}`
            };
          }
          
          // For other participants, use the database values directly
          // Only use fallbacks if absolutely necessary (completely missing data)
          return {
            id,
            ...participant,
            name: participant.name || `Participant-${id.slice(-4)}`,
            team: participant.team || `Team-Participant-${id.slice(-4)}`
          };
        })
        .filter(p => !teamFilter || p.team === teamFilter)
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name
        
        setParticipants(participantsArray);
      } else {
        setParticipants([]);
      }
      setLoading(false);
    });

    return () => off(participantsRef);
  }, [quizId, teamFilter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <LoadingSpinner size="md" />
        <span className="ml-2">Loading participants...</span>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {teamFilter ? 
          `No participants found in team "${teamFilter}"` : 
          "No participants have joined this quiz yet"}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-96 mt-2">
      <table className="min-w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Team
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Score
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {participants.map((participant) => (
            <tr key={participant.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {participant.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {participant.team}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                {participant.score || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 