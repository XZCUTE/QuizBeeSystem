import React, { useState, useEffect } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "@/firebase/config";
import { FaMedal } from "react-icons/fa";

export default function Leaderboard({ quizId, teamFilter = null }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(teamFilter);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!quizId) {
      console.log("Leaderboard: No quizId provided");
      setLoading(false);
      return;
    }

    console.log(`Leaderboard: Loading data for quiz ${quizId}`);
    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const participantsData = snapshot.val();
          console.log("Leaderboard: Raw participant data:", participantsData);
          
          // Convert to array with proper fallbacks
          let participantsArray = Object.keys(participantsData).map(key => {
            const participant = participantsData[key] || {};
            // Ensure all necessary fields have fallbacks
            return {
              id: key,
              name: participant.name || "Anonymous",
              team: participant.team || "No Team",
              score: participant.score || 0,
              // Include any other fields from original data
              ...participant
            };
          });
          
          // Check if any participants have missing name or team and update them
          participantsArray.forEach(async (participant) => {
            if (!participantsData[participant.id].name || !participantsData[participant.id].team) {
              // Update Firebase with the fallback values to ensure consistency
              const updates = {};
              if (!participantsData[participant.id].name) {
                updates.name = "Anonymous";
              }
              if (!participantsData[participant.id].team) {
                updates.team = "No Team";
              }
              
              if (Object.keys(updates).length > 0) {
                console.log(`Updating participant ${participant.id} with defaults:`, updates);
                await update(ref(db, `quizzes/${quizId}/participants/${participant.id}`), updates);
              }
            }
          });
          
          // Extract unique teams
          const uniqueTeams = [...new Set(
            participantsArray
              .map(p => p.team)
              .filter(Boolean)
          )];
          setTeams(uniqueTeams);
          
          // Apply team filter if specified
          if (selectedTeam) {
            participantsArray = participantsArray.filter(p => p.team === selectedTeam);
          }
          
          // Sort by score in descending order (highest first)
          participantsArray.sort((a, b) => b.score - a.score);
          
          console.log("Leaderboard: Processed participants:", participantsArray);
          setParticipants(participantsArray);
          setError(null);
        } else {
          console.log("Leaderboard: No participants found");
          setParticipants([]);
        }
      } catch (err) {
        console.error("Leaderboard: Error processing participants", err);
        setError(err.message);
        setParticipants([]);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("Leaderboard: Firebase error", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [quizId, selectedTeam]);

  // Apply team filter directly
  useEffect(() => {
    setSelectedTeam(teamFilter);
  }, [teamFilter]);

  // Debug output
  console.log("Leaderboard rendering. State:", { 
    quizId, loading, participantCount: participants.length, error 
  });

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-600">
          {selectedTeam 
            ? `No participants in team "${selectedTeam}"` 
            : "No participants have joined yet"}
        </p>
      </div>
    );
  }

  // Helper function to get medal for top positions
  const getMedal = (index) => {
    if (index === 0) return <FaMedal className="text-yellow-500" title="1st Place" />;
    if (index === 1) return <FaMedal className="text-slate-400" title="2nd Place" />;
    if (index === 2) return <FaMedal className="text-amber-700" title="3rd Place" />;
    return null;
  };

  return (
    <div className="leaderboard">
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Rank
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Team
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Score
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {participants.map((participant, index) => (
              <tr key={participant.id} className={index < 3 ? "bg-opacity-50 hover:bg-gray-50" : "hover:bg-gray-50"}>
                <td className="whitespace-nowrap px-4 py-2">
                  <div className="flex items-center">
                    {getMedal(index) || <span className="ml-1 text-gray-600">{index + 1}</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">
                  {participant.name || "Anonymous"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                  {participant.team || "No Team"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-bold text-primary">
                  {participant.score || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
