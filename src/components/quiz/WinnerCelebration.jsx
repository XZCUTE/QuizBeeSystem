import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue, update, get } from "firebase/database";
import { db } from "@/firebase/config";
import { FaTrophy, FaUsers } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import Button from "@/components/Button";
import EnhancedLeaderboard from "./EnhancedLeaderboard";
import FullScreenConfetti from '@/components/FullScreenConfetti';

export default function WinnerCelebration({ quizId, onBack }) {
  const [topWinners, setTopWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const navigate = useNavigate();

  // Debug logging
  console.log("WinnerCelebration rendering with quizId:", quizId, "loading:", loading);

  useEffect(() => {
    console.log("WinnerCelebration useEffect running with quizId:", quizId);
    
    if (!quizId) {
      console.log("No quizId provided to WinnerCelebration");
      setLoading(false);
      setError("Quiz ID is required");
      return;
    }

    console.log("Setting up Firebase listener for quizId:", quizId);
    
    try {
    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    
    const unsubscribe = onValue(participantsRef, (snapshot) => {
        console.log("Firebase onValue triggered for winners");
        
        // Immediately set loading to false once we get a response
        setLoading(false);
        
        try {
          if (!snapshot.exists()) {
            console.log("No participants found");
            setTopWinners([]);
            return;
          }
          
          const participantsData = snapshot.val();
          console.log("Participants data:", participantsData);
          
          // Simplified participant processing
          let participantsArray = Object.keys(participantsData).map(key => ({
              id: key,
            name: participantsData[key].name || "Anonymous",
            team: participantsData[key].team || "No Team",
            score: participantsData[key].score || 0
          }));
          
          console.log("Processed participants array:", participantsArray);
          
          // Sort by score in descending order
          participantsArray.sort((a, b) => b.score - a.score);
          
          // Take top 3 participants
          const winners = participantsArray.slice(0, Math.min(3, participantsArray.length));
          console.log(`Found ${winners.length} winners:`, winners);
          
          setTopWinners(winners);
          setError(null);
          
        } catch (err) {
          console.error("Error processing winners:", err);
          setError(`Error processing results: ${err.message}`);
        }
      }, (error) => {
        // Error callback for onValue
        console.error("Firebase onValue error:", error);
        setLoading(false);
        setError(`Firebase error: ${error.message}`);
      });

      return () => {
        console.log("Cleaning up Firebase listener");
        unsubscribe();
      };
    } catch (err) {
      console.error("Error setting up winners listener:", err);
      setError(`Error: ${err.message}`);
      setLoading(false);
    }
  }, [quizId]);

  const handleGoHome = () => {
    try {
    navigate('/');
    } catch (err) {
      window.location.href = '/';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6 text-center">
        <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-20 mx-auto" alt="ICCT School Logo" />
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-xl font-bold text-primary">Loading winners...</p>
        <p className="text-gray-500 mt-2">Please wait while we gather the results</p>
        <Button 
          onClick={() => setLoading(false)} 
          variant="secondary"
          className="mt-6"
        >
          Skip Loading
        </Button>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-bold">Error: {error}</p>
        <div className="flex justify-center space-x-4 mt-4">
          {onBack && (
            <Button onClick={onBack} variant="secondary">
              Back to Results
            </Button>
          )}
          <Button onClick={handleGoHome} variant="primary">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (topWinners.length === 0) {
    return (
      <div className="p-6 text-center">
        <FaTrophy className="mx-auto text-5xl text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No participants found</h2>
        <p className="text-gray-600 mb-4">
          There are no participants with scores to display.
        </p>
        <div className="flex justify-center space-x-4 mt-4">
          {onBack && (
            <Button onClick={onBack} variant="secondary">
              Back to Results
            </Button>
          )}
          <Button onClick={handleGoHome} variant="primary">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="winner-celebration relative">
      {/* Full screen confetti with the same config as participant page */}
      {showConfetti && (
        <FullScreenConfetti 
          active={true}
          pieces={400}
          recycle={true}
        />
      )}
      
      <div className="mb-4 text-center">
        <h2 className="text-3xl font-bold mb-2 animate-pulse text-primary">
          🏆 Quiz Complete! 🏆
        </h2>
        <p className="text-xl text-gray-700">
          Here are the top performers
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top winners display */}
        <div className="bg-white shadow-lg rounded-xl p-4 border-4 border-primary/20">
          <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent text-center">
            Champions
          </h3>
          
          <div className="space-y-6">
            {topWinners.map((winner, index) => (
              <div key={winner.id} className="relative">
                {/* Award icons */}
                <div className="absolute -left-3 -top-3 w-10 h-10 flex items-center justify-center rounded-full shadow-lg z-10"
                  style={{
                    background: index === 0 
                      ? 'linear-gradient(135deg, #FFD700, #FFC107)' 
                      : index === 1 
                        ? 'linear-gradient(135deg, #C0C0C0, #E0E0E0)' 
                        : 'linear-gradient(135deg, #CD7F32, #B87333)'
                  }}
                >
                  <span className="text-white text-lg font-bold">{index + 1}</span>
                </div>
          
                <div className={`transform transition duration-500 hover:-translate-y-1 hover:shadow-lg
                  p-3 rounded-lg border-2
                  ${index === 0 
                    ? 'bg-yellow-50 border-yellow-300 shadow-yellow-100' 
                    : index === 1 
                      ? 'bg-gray-50 border-gray-300 shadow-gray-100' 
                      : 'bg-amber-50 border-amber-300 shadow-amber-100'
                  }`}
                >
                  <div className="relative group">
                    <h4 className="text-lg font-bold mb-1 truncate" title={winner.name}>
                      {winner.name}
                    </h4>
                    <div className="absolute left-0 -bottom-6 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-50 w-full max-w-xs">
                      {winner.name}
                    </div>
                  </div>
        
                  {winner.team && (
                    <div className="relative group">
                      <p className="text-gray-600 mb-2 truncate text-sm" title={`Team: ${winner.team}`}>
                        Team: {winner.team}
                      </p>
                      <div className="absolute left-0 -bottom-6 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-50">
                        Team: {winner.team}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600 text-xs">Final Score</span>
                    <span className="font-bold text-xl text-primary">{winner.score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Full leaderboard - FIXED DISPLAY ISSUES */}
        <div className="bg-white shadow-lg rounded-xl p-4 overflow-hidden h-full flex flex-col">
          <h3 className="text-lg font-bold mb-2 text-center text-primary">
            Leaderboard
          </h3>
          <div className="overflow-auto flex-grow" style={{ maxHeight: "400px" }}>
            <EnhancedLeaderboard 
              quizId={quizId} 
              showTeams={true}
              animateEntrance={true}
              compact={false}
            />
          </div>
        </div>
      </div>
      
      <div className="text-center mt-6 mb-4">
        <h3 className="text-lg font-semibold text-blue-700">
          Thank you all for participating!
        </h3>
      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-center space-x-4 mt-4 mb-6">
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