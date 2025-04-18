import React from 'react';
import EnhancedLeaderboard from './EnhancedLeaderboard';

/**
 * MiniLeaderboard - A compact version of the leaderboard for sidebar or dashboard usage
 * 
 * @param {Object} props
 * @param {string} props.quizId - ID of the quiz
 * @param {string} props.participantId - Current participant ID (optional)
 * @param {boolean} props.animateEntrance - Whether to animate entrance (default: true)
 * @param {string} props.className - Additional CSS classes (optional)
 */
export default function MiniLeaderboard({ 
  quizId, 
  participantId = null, 
  animateEntrance = true,
  className = ''
}) {
  if (!quizId) {
    return (
      <div className={`p-4 text-center rounded-lg border border-gray-200 ${className}`}>
        <p className="text-gray-500 text-sm">No quiz selected</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <EnhancedLeaderboard
        quizId={quizId}
        participantId={participantId}
        showTeams={false}
        animateEntrance={animateEntrance}
        compact={true}
      />
    </div>
  );
} 