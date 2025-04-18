import { useState, useEffect } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "@/firebase/config";
import Button from "@/components/Button";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import { useNavigate } from "react-router-dom";

export default function WinnerCelebration({ quizId, onBack }) {
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { width, height } = useWindowSize();
  const navigate = useNavigate();

  useEffect(() => {
    if (!quizId) {
      console.log("WinnerCelebration: No quizId provided");
      setLoading(false);
      return;
    }

    console.log(`WinnerCelebration: Loading winners for quiz ${quizId}`);
    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const participantsData = snapshot.val();
          console.log("WinnerCelebration: Raw participant data:", participantsData);
          
          // Convert to array with proper fallbacks - updated to be less aggressive
          let participantsArray = Object.keys(participantsData).map(key => {
            const participant = participantsData[key] || {};
            
            // For each participant, prioritize their stored data
            // Only use fallbacks for completely missing data (null/undefined)
            return {
              id: key,
              // Only use fallback if name is completely missing
              name: participant.name !== undefined && participant.name !== null ? participant.name : "Anonymous",
              // Only use fallback if team is completely missing
              team: participant.team !== undefined && participant.team !== null ? participant.team : "No Team",
              score: participant.score || 0,
              ...participant
            };
          });
          
          // Check if any participants have truly missing name or team and update them
          participantsArray.forEach(async (participant) => {
            const needsNameUpdate = participantsData[participant.id].name === undefined || 
                                   participantsData[participant.id].name === null;
            const needsTeamUpdate = participantsData[participant.id].team === undefined || 
                                   participantsData[participant.id].team === null;
            
            if (needsNameUpdate || needsTeamUpdate) {
              // Update Firebase with the fallback values only if data is completely missing
              const updates = {};
              if (needsNameUpdate) {
                updates.name = "Anonymous";
              }
              if (needsTeamUpdate) {
                updates.team = "No Team";
              }
              
              if (Object.keys(updates).length > 0) {
                console.log(`Updating participant ${participant.id} with defaults:`, updates);
                await update(ref(db, `quizzes/${quizId}/participants/${participant.id}`), updates);
              }
            }
          });
          
          // Sort by score in descending order (highest first)
          participantsArray.sort((a, b) => b.score - a.score);
          
          // Take top 3 participants or less if fewer exist
          const topWinners = participantsArray.slice(0, Math.min(3, participantsArray.length));
          console.log("WinnerCelebration: Top winners:", topWinners);
          
          setWinners(topWinners);
          setError(null);
        } else {
          console.log("WinnerCelebration: No participants found");
          setWinners([]);
        }
      } catch (err) {
        console.error("WinnerCelebration: Error processing winners", err);
        setError(err.message);
        setWinners([]);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("WinnerCelebration: Firebase error", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [quizId]);

  // Debug output
  console.log("WinnerCelebration rendering. State:", { 
    quizId, loading, winnerCount: winners.length, error 
  });

  const handleGoHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Loading winners...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Error: {error}</p>
        <div className="flex justify-center space-x-4 mt-4">
          <Button onClick={() => navigate('/')} variant="primary">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (winners.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-600">No participants found</p>
        <div className="flex justify-center space-x-4 mt-4">
          {onBack && (
            <Button onClick={onBack} variant="secondary">
              Back to Leaderboard
            </Button>
          )}
          <Button onClick={handleGoHome} variant="primary">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // First place is gold, second is silver
  const firstPlace = winners[0];
  const secondPlace = winners.length > 1 ? winners[1] : null;
  const thirdPlace = winners.length > 2 ? winners[2] : null;

  return (
    <div className="celebration p-4">
      <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />
      
      <h1 className="text-4xl font-bold text-center text-blue-600 mb-8">
        Congratulations to our Winners!
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Champion */}
        <div className="bg-yellow-300 rounded-lg p-6 shadow-lg text-center">
          <img 
            src="/medals/gold.svg" 
            alt="Gold Medal" 
            className="w-20 h-20 mx-auto mb-4"
            onError={(e) => {
              console.log("Medal image failed to load, using fallback");
              e.target.style.display = 'none';
            }}
          />
          <h2 className="text-2xl font-bold mb-4">Champion</h2>
          
          <div className="mb-4 text-lg font-semibold">
            {firstPlace.name}
          </div>
          
          <div className="flex justify-center items-center mb-2">
            <span className="bg-yellow-100 px-3 py-1 rounded-full text-yellow-800">
              {firstPlace.team}
            </span>
          </div>
          
          <div className="text-2xl font-bold">
            {firstPlace.score} points
          </div>
        </div>
        
        {/* Runner up */}
        {secondPlace && (
          <div className="bg-gray-300 rounded-lg p-6 shadow-lg text-center">
            <img 
              src="/medals/silver.svg" 
              alt="Silver Medal" 
              className="w-20 h-20 mx-auto mb-4"
              onError={(e) => {
                console.log("Medal image failed to load, using fallback");
                e.target.style.display = 'none';
              }}
            />
            <h2 className="text-2xl font-bold mb-4">Runner-up</h2>
            
            <div className="mb-4 text-lg font-semibold">
              {secondPlace.name}
            </div>
            
            <div className="flex justify-center items-center mb-2">
              <span className="bg-gray-100 px-3 py-1 rounded-full text-gray-800">
                {secondPlace.team}
              </span>
            </div>
            
            <div className="text-2xl font-bold">
              {secondPlace.score} points
            </div>
          </div>
        )}
      </div>
      
      {/* Third place (optional) */}
      {thirdPlace && (
        <div className="mt-6">
          <div className="bg-amber-200 rounded-lg p-4 shadow-md text-center max-w-sm mx-auto">
            <img 
              src="/medals/bronze.svg" 
              alt="Bronze Medal" 
              className="w-14 h-14 mx-auto mb-2"
              onError={(e) => {
                console.log("Medal image failed to load, using fallback");
                e.target.style.display = 'none';
              }}
            />
            <h2 className="text-xl font-bold mb-2">Third Place</h2>
            
            <div className="mb-2 font-semibold">
              {thirdPlace.name}
            </div>
            
            <div className="flex justify-center items-center mb-1">
              <span className="bg-amber-100 px-2 py-0.5 rounded-full text-amber-800 text-sm">
                {thirdPlace.team}
              </span>
            </div>
            
            <div className="text-lg font-bold">
              {thirdPlace.score} points
            </div>
          </div>
        </div>
      )}
      
      <div className="text-center mt-10 mb-6">
        <h3 className="text-xl font-semibold text-blue-700">
          Thank you all for participating!
        </h3>
      </div>
      
      {/* Navigation buttons - always show these buttons */}
      <div className="flex justify-center space-x-4 mt-6 mb-10">
        {onBack && (
          <Button onClick={onBack} variant="secondary" className="px-4 py-2">
            Back to Results
          </Button>
        )}
        <Button onClick={handleGoHome} variant="primary" className="px-4 py-2">
          Back to Home
        </Button>
      </div>
    </div>
  );
} 