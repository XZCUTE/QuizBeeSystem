import { useState, useEffect } from "react";
import { db } from "@/firebase/config";
import { ref, onValue, update, get } from "firebase/database";

/**
 * Leaderboard component that displays participants ranked by score
 * @param {Object} props - Component props
 * @param {string} props.quizId - ID of the current quiz
 */
export default function Leaderboard({ quizId }) {
  const [participants, setParticipants] = useState([]);
  const [teamScores, setTeamScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to enforce name and team requirements - updated to be less aggressive with fallbacks
  const enforceNameAndTeam = async (participantId, participantData) => {
    try {
      // We will now only add fallbacks if the data is completely missing (null/undefined)
      // We will NOT update existing names even if they're empty strings
      const needsNameUpdate = participantData.name === undefined || participantData.name === null;
      const needsTeamUpdate = participantData.team === undefined || participantData.team === null;
      
      if (needsNameUpdate || needsTeamUpdate) {
        console.log(`Leaderboard: Participant ${participantId} missing name or team data`);
        
        // Get the participant reference
        const participantRef = ref(db, `quizzes/${quizId}/participants/${participantId}`);
        const updates = {};
        
        // Generate fallbacks ONLY if data is completely missing
        if (needsNameUpdate) {
          updates.name = `Participant-${participantId.slice(-4)}`;
          console.log(`Leaderboard: Setting name for ${participantId}: ${updates.name}`);
        }
        
        if (needsTeamUpdate) {
          // Only use fallback team if team is completely missing
          updates.team = `Team-${needsNameUpdate ? updates.name.split(' ')[0] : participantData.name.split(' ')[0]}`;
          console.log(`Leaderboard: Setting team for ${participantId}: ${updates.team}`);
        }
        
        // Apply updates if needed
        if (Object.keys(updates).length > 0) {
          await update(participantRef, updates);
          console.log(`Leaderboard: Updated participant ${participantId} with:`, updates);
        }
      }
    } catch (err) {
      console.error(`Leaderboard: Error enforcing name/team for ${participantId}:`, err);
    }
  };

  useEffect(() => {
    if (!quizId) {
      console.log("Leaderboard: No quizId provided");
      setLoading(false);
      return;
    }

    console.log(`Leaderboard: Loading data for quiz ${quizId}`);
    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    
    const unsubscribe = onValue(participantsRef, async (snapshot) => {
      try {
        if (snapshot.exists()) {
          const participantsData = snapshot.val();
          console.log("Leaderboard: Raw participant data:", participantsData);
          
          // Process each participant to ensure name and team
          for (const [id, data] of Object.entries(participantsData)) {
            await enforceNameAndTeam(id, data);
          }
          
          // Re-fetch to get updated data after any enforcements
          const updatedSnapshot = await get(participantsRef);
          const updatedData = updatedSnapshot.val() || {};
          
          // Get questions to find tie-breaker questions
          const questionsRef = ref(db, `quizzes/${quizId}/questions`);
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
          
          // Convert to array for sorting
          let participantsArray = Object.keys(updatedData).map(key => ({
            id: key,
            ...updatedData[key],
            score: updatedData[key].score || 0,
            tieBreakerRank: null // Will be populated if needed
          }));
          
          // If there are tie-breaker questions, fetch answer data for them
          if (tieBreakerQuestionIds.length > 0) {
            for (const questionId of tieBreakerQuestionIds) {
              const answersRef = ref(db, `quizzes/${quizId}/answers/${questionId}`);
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
          
          console.log("Leaderboard: Processed participants:", participantsArray);
          
          // Enhanced sorting function that considers:
          // 1. Score (highest first)
          // 2. Tie-breaker rank (lowest first, if available)
          // 3. Last answer time (earliest first, as a fallback)
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
          
          // Calculate team scores
          const teams = {};
          participantsArray.forEach(p => {
            if (p.team) {
              if (!teams[p.team]) {
                teams[p.team] = {
                  name: p.team,
                  members: [],
                  totalScore: 0
                };
              }
              teams[p.team].members.push(p.name);
              teams[p.team].totalScore += p.score;
            }
          });
          
          // Convert teams to array and sort by total score
          const teamsArray = Object.values(teams);
          teamsArray.sort((a, b) => b.totalScore - a.totalScore);
          
          setParticipants(participantsArray);
          setTeamScores(teamsArray);
          setError(null);
        } else {
          console.log("Leaderboard: No participants found");
          setParticipants([]);
          setTeamScores([]);
        }
      } catch (err) {
        console.error("Leaderboard: Error processing participants", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("Leaderboard: Firebase error", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [quizId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        <p>Error loading leaderboard: {error}</p>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-lg text-gray-600">No participants available.</p>
      </div>
    );
  }

  // Helper for rank emojis
  const getRankEmoji = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}.`;
  };

  return (
    <div className="leaderboard p-4">
      {/* Individual rankings */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-3">Individual Rankings</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Rank</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Team</th>
                <th className="p-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant, index) => (
                <tr 
                  key={participant.id} 
                  className={`border-t ${index < 3 ? 'font-bold' : ''}`}
                >
                  <td className="p-2">
                    <span className="inline-block min-w-6">{getRankEmoji(index)}</span>
                  </td>
                  <td className="p-2">{participant.name}</td>
                  <td className="p-2">{participant.team}</td>
                  <td className="p-2 text-right">{participant.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Team rankings */}
      {teamScores.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-3">Team Rankings</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Rank</th>
                  <th className="p-2 text-left">Team</th>
                  <th className="p-2 text-left">Members</th>
                  <th className="p-2 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody>
                {teamScores.map((team, index) => (
                  <tr 
                    key={team.name} 
                    className={`border-t ${index < 3 ? 'font-bold' : ''}`}
                  >
                    <td className="p-2">
                      <span className="inline-block min-w-6">{getRankEmoji(index)}</span>
                    </td>
                    <td className="p-2">{team.name}</td>
                    <td className="p-2 text-sm">
                      {team.members.join(', ')}
                    </td>
                    <td className="p-2 text-right">{team.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 