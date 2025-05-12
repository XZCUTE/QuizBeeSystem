import React, { useState, useEffect } from "react";
import { ref, onValue, get } from "firebase/database";
import { db } from "@/firebase/config";
import { FaTrophy, FaMedal, FaStar, FaUsers, FaUserAlt } from "react-icons/fa";

/**
 * EnhancedLeaderboard component with modern UI and animations
 * 
 * @param {Object} props
 * @param {string} props.quizId - ID of the quiz
 * @param {string} props.participantId - Current participant's ID (optional)
 * @param {boolean} props.showTeams - Whether to show team rankings (default: true)
 * @param {boolean} props.animateEntrance - Whether to animate the leaderboard entrance (default: true)
 * @param {boolean} props.compact - Whether to show a compact version (default: false)
 */
export default function EnhancedLeaderboard({ 
  quizId, 
  participantId = null,
  showTeams = true, 
  animateEntrance = true,
  compact = false
}) {
  const [participants, setParticipants] = useState([]);
  const [teamScores, setTeamScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("individual");
  const [userRank, setUserRank] = useState(null);

  useEffect(() => {
    if (!quizId) {
      console.log("EnhancedLeaderboard: No quizId provided");
      setLoading(false);
      setError("Quiz ID is required");
      return;
    }

    console.log(`EnhancedLeaderboard: Loading data for quiz ${quizId}`);
    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    
    const unsubscribe = onValue(participantsRef, async (snapshot) => {
      try {
        if (snapshot.exists()) {
          const participantsData = snapshot.val();
          
          // Get questions to find tie-breaker questions
          const questionsRef = ref(db, `quizzes/${quizId}/questions`);
          const questionsSnapshot = await get(questionsRef);
          
          // Find tie-breaker question IDs
          const tieBreakerQuestionIds = [];
          if (questionsSnapshot.exists()) {
            const questionsData = questionsSnapshot.val();
            Object.entries(questionsData).forEach(([id, questionData]) => {
              if (questionData.difficulty === 'tie-breaker') {
                tieBreakerQuestionIds.push(id);
              }
            });
          }
          
          // Convert to array for sorting
          let participantsArray = Object.keys(participantsData).map(key => ({
            id: key,
            ...participantsData[key],
            name: participantsData[key].name || "Anonymous",
            team: participantsData[key].team || "No Team",
            score: participantsData[key].score || 0,
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
                  if (answerData.scoreEarned > 0) {
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
          
          // Enhanced sorting function
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
          
          // Assign ranks to participants (same rank for tied scores)
          let currentRank = 1;
          let currentScore = participantsArray.length > 0 ? participantsArray[0].score : 0;
          let tieBreakerGroup = {};
          
          participantsArray.forEach((participant, index) => {
            // If this participant has a different score than the previous one
            if (participant.score !== currentScore) {
              // Set the rank to the current position (1-indexed)
              currentRank = index + 1;
              currentScore = participant.score;
              tieBreakerGroup = {};
            } else if (participant.tieBreakerRank !== null) {
              // For participants with same score, check tie-breakers
              if (!tieBreakerGroup[currentScore]) {
                tieBreakerGroup[currentScore] = {
                  rankCounter: currentRank,
                  participants: []
                };
              }
              
              // Add participant to the tie-breaker group
              tieBreakerGroup[currentScore].participants.push(participant);
            }
            
            // Assign the calculated rank
            participant.displayRank = currentRank;
          });
          
          // Find user's rank if participantId is provided
          if (participantId) {
            const userParticipant = participantsArray.find(p => p.id === participantId);
            if (userParticipant) {
              setUserRank(userParticipant.displayRank);
            }
          }
          
          // Calculate team scores
          if (showTeams) {
            const teams = {};
            participantsArray.forEach(p => {
              if (p.team) {
                if (!teams[p.team]) {
                  teams[p.team] = {
                    name: p.team,
                    members: [],
                    totalScore: 0,
                    averageScore: 0
                  };
                }
                teams[p.team].members.push({
                  id: p.id,
                  name: p.name,
                  score: p.score
                });
                teams[p.team].totalScore += p.score;
              }
            });
            
            // Calculate average scores and convert teams to array
            const teamsArray = Object.values(teams).map(team => {
              team.averageScore = team.members.length > 0
                ? Math.round(team.totalScore / team.members.length)
                : 0;
              team.memberCount = team.members.length;
              return team;
            });
            
            // Sort teams by total score
            teamsArray.sort((a, b) => b.totalScore - a.totalScore);
            
            // Assign ranks to teams with same logic as participants
            let currentRank = 1;
            let currentScore = teamsArray.length > 0 ? teamsArray[0].totalScore : 0;
            
            teamsArray.forEach((team, index) => {
              // If this team has a different score than the previous one
              if (team.totalScore !== currentScore) {
                // Set the rank to the current position (1-indexed)
                currentRank = index + 1;
                currentScore = team.totalScore;
              }
              
              // Assign the calculated rank
              team.displayRank = currentRank;
            });
            
            setTeamScores(teamsArray);
          }
          
          setParticipants(participantsArray);
          setError(null);
        } else {
          setParticipants([]);
          setTeamScores([]);
        }
      } catch (err) {
        console.error("EnhancedLeaderboard: Error processing data", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("EnhancedLeaderboard: Firebase error", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [quizId, participantId, showTeams]);

  // Rank indicator component for consistency
  const RankIndicator = ({ rank, small = false }) => {
    if (rank === 1) {
      return <FaTrophy className={`${small ? 'text-xl' : 'text-2xl md:text-3xl'} text-yellow-500`} aria-label="1st Place" />;
    } else if (rank === 2) {
      return <FaMedal className={`${small ? 'text-lg' : 'text-xl md:text-2xl'} text-slate-400`} aria-label="2nd Place" />;
    } else if (rank === 3) {
      return <FaMedal className={`${small ? 'text-lg' : 'text-xl md:text-2xl'} text-amber-700`} aria-label="3rd Place" />;
    } else if (rank <= 5) {
      return <FaStar className={`${small ? 'text-sm' : 'text-lg md:text-xl'} text-purple-500`} aria-label={`${rank}th Place`} />;
    }
    return <span className={`text-gray-600 ${small ? 'text-base' : 'text-lg md:text-xl font-semibold'}`}>{rank}</span>;
  };

  // Helper to get a row style based on rank and whether it's the current user
  const getRowStyle = (index, isCurrentUser) => {
    let baseStyle = "transition-all duration-300 ease-in-out";
    
    // Animation delay for entrance effect
    if (animateEntrance) {
      baseStyle += ` animate-fadeIn opacity-0`;
      baseStyle += ` [animation-delay:${index * 0.05}s]`;
    }
    
    // Special styling for top 3
    if (index < 3) {
      if (index === 0) {
        baseStyle += " bg-yellow-50 border-yellow-200";
      } else if (index === 1) {
        baseStyle += " bg-slate-50 border-slate-200";
      } else if (index === 2) {
        baseStyle += " bg-amber-50 border-amber-200";
      }
    } else {
      baseStyle += " bg-white hover:bg-gray-50";
    }
    
    // Current user highlight
    if (isCurrentUser) {
      baseStyle += " border-l-4 border-primary font-bold relative";
    } else {
      baseStyle += " border-l-4 border-transparent";
    }
    
    return baseStyle;
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full py-8 flex flex-col items-center justify-center glass-panel animate-pulse">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="mt-4 text-primary font-medium">Loading Scoreboard...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  // Empty state
  if (participants.length === 0) {
    return (
      <div className="w-full py-8 text-center glass-panel">
        <FaUsers className="mx-auto text-5xl text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium">No participants have joined yet.</p>
      </div>
    );
  }

  // Compact view
  if (compact) {
    return (
      <div className={`glass-panel p-4 rounded-xl overflow-hidden ${animateEntrance ? 'anim-show' : ''}`}>
        <h3 className="text-xl font-bold mb-3 text-center text-primary">Top Performers</h3>
        <div className="space-y-2">
          {participants.slice(0, 5).map((participant, index) => {
            const isCurrentUser = participantId && participant.id === participantId;
            return (
              <div 
                key={participant.id}
                className={`flex items-center justify-between p-2 rounded-lg ${getRowStyle(index, isCurrentUser)}`}
              >
                <div className="flex items-center">
                  <div className="mr-3 flex-shrink-0 w-8">
                    <RankIndicator rank={index + 1} small={true} />
                  </div>
                  <div className="truncate max-w-[180px]" title={participant.name}>{participant.name}</div>
                </div>
                <div className="font-bold text-primary">{participant.score}</div>
              </div>
            );
          })}
        </div>
        {userRank && userRank > 5 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
              <div className="flex items-center">
                <div className="mr-3 text-primary font-bold">{userRank}</div>
                <div className="font-medium">You</div>
              </div>
              <div className="font-bold text-primary">{participants[userRank-1]?.score || 0}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view with tabs
  return (
    <div className={`glass-panel p-4 rounded-xl ${animateEntrance ? 'anim-show' : ''}`}>
      {/* Tab navigation for individual/team views */}
      {showTeams && teamScores.length > 0 && (
        <div className="flex rounded-lg overflow-hidden mb-4 border border-gray-200">
          <button 
            className={`flex-1 py-2 px-4 font-medium text-sm transition-all ${activeTab === 'individual' 
              ? 'bg-primary text-white shadow-md' 
              : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveTab('individual')}
          >
            <FaUserAlt className="inline mr-2" /> Individual
          </button>
          <button 
            className={`flex-1 py-2 px-4 font-medium text-sm transition-all ${activeTab === 'team' 
              ? 'bg-primary text-white shadow-md' 
              : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveTab('team')}
          >
            <FaUsers className="inline mr-2" /> Team
          </button>
        </div>
      )}
      
      {/* Individual rankings tab - IMPROVED OVERFLOW HANDLING */}
      {activeTab === 'individual' && (
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="w-[60px] py-3 px-3 text-left text-sm font-bold uppercase tracking-wider text-primary">
                  Rank
                </th>
                <th scope="col" className="w-[40%] py-3 px-3 text-left text-sm font-bold uppercase tracking-wider text-primary">
                  Name
                </th>
                {showTeams && (
                  <th scope="col" className="w-[25%] py-3 px-3 text-left text-sm font-bold uppercase tracking-wider text-primary">
                    Team
                  </th>
                )}
                <th scope="col" className="w-[80px] py-3 px-3 text-right text-sm font-bold uppercase tracking-wider text-primary">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {participants.map((participant, index) => {
                const isCurrentUser = participantId && participant.id === participantId;
                return (
                  <tr 
                    key={participant.id} 
                    className={getRowStyle(index, isCurrentUser)}
                  >
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <RankIndicator rank={participant.displayRank || index + 1} />
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center group relative">
                        <span className="font-medium text-sm truncate max-w-[150px] sm:max-w-[180px] md:max-w-[250px]" title={participant.name}>{participant.name}</span>
                        {isCurrentUser && (
                          <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary text-white">
                            You
                          </span>
                        )}
                        <div className="absolute left-0 bottom-full hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-50">
                          {participant.name}
                        </div>
                      </div>
                    </td>
                    {showTeams && (
                      <td className="py-3 px-3 whitespace-nowrap text-gray-700 group relative">
                        <span className="truncate block text-sm max-w-[100px] sm:max-w-[120px] md:max-w-[180px]" title={participant.team}>{participant.team}</span>
                        <div className="absolute left-0 bottom-full hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-50">
                          {participant.team}
                        </div>
                      </td>
                    )}
                    <td className="py-3 px-3 whitespace-nowrap text-right font-bold text-lg text-primary">
                      {participant.score}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Team rankings tab - IMPROVED OVERFLOW HANDLING */}
      {activeTab === 'team' && teamScores && teamScores.length > 0 && (
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="w-[60px] py-3 px-3 text-left text-sm font-bold uppercase tracking-wider text-primary">
                  Rank
                </th>
                <th scope="col" className="w-[40%] py-3 px-3 text-left text-sm font-bold uppercase tracking-wider text-primary">
                  Team
                </th>
                <th scope="col" className="w-[70px] py-3 px-3 text-center text-sm font-bold uppercase tracking-wider text-primary">
                  Members
                </th>
                <th scope="col" className="w-[80px] py-3 px-3 text-right text-sm font-bold uppercase tracking-wider text-primary">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {teamScores.map((team, index) => {
                const isUserTeam = participantId && team.members.some(m => m.id === participantId);
                return (
                  <tr 
                    key={team.name} 
                    className={getRowStyle(index, isUserTeam)}
                  >
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <RankIndicator rank={index + 1} />
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center group relative">
                        <span className="font-medium text-sm truncate max-w-[150px] sm:max-w-[180px] md:max-w-[250px]" title={team.name}>{team.name}</span>
                        {isUserTeam && (
                          <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary text-white">
                            Your Team
                          </span>
                        )}
                        <div className="absolute left-0 bottom-full hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-50">
                          {team.name}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-700">{team.memberCount}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-lg text-primary">{team.totalScore}</span>
                        <span className="text-gray-500 text-xs">Avg: {team.averageScore}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {activeTab === 'team' && (!teamScores || teamScores.length === 0) && (
        <div className="p-6 text-center bg-gray-50 rounded-lg border border-gray-200">
          <FaUsers className="mx-auto text-4xl text-gray-300 mb-3" />
          <p className="text-gray-500">No teams available</p>
        </div>
      )}
    </div>
  );
} 