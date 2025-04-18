import { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { ref, onValue } from 'firebase/database';

/**
 * QuestionStats component displays statistics for a specific question
 * @param {Object} props - Component props
 * @param {string} props.quizId - ID of the current quiz
 * @param {string} props.questionId - ID of the current question
 */
export default function QuestionStats({ quizId, questionId }) {
  const [stats, setStats] = useState({
    totalAnswers: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    percentCorrect: 0,
    answersByOption: {},
    participantAnswers: [],
    answerDistribution: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionData, setQuestionData] = useState(null);

  useEffect(() => {
    if (!quizId || !questionId) {
      console.log("QuestionStats: Missing quizId or questionId");
      setLoading(false);
      return;
    }

    console.log(`QuestionStats: Loading data for quiz ${quizId}, question ${questionId}`);
    
    // Get the answers ref
    const answersRef = ref(db, `quizzes/${quizId}/answers/${questionId}`);
    const questionRef = ref(db, `quizzes/${quizId}/questions/${questionId}`);
    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    
    // We need to track three separate subscriptions
    let unsubAnswers, unsubQuestion, unsubParticipants;
    let questionData = null;
    let participantsData = {};
    let answersData = {};
    
    const processAllData = () => {
      // Don't process until we have all the necessary data
      if (!questionData || !Object.keys(participantsData).length) {
        return;
      }
      
      try {
        // Initialize the stats object
        const newStats = {
          totalAnswers: Object.keys(answersData).length,
          correctAnswers: 0,
          incorrectAnswers: 0,
          percentCorrect: 0,
          answersByOption: {},
          participantAnswers: [],
          answerDistribution: []
        };
        
        // If the question has options, initialize the answersByOption
        if (questionData.options) {
          questionData.options.forEach((option, index) => {
            newStats.answersByOption[index] = {
              text: option,
              count: 0,
              percent: 0,
              correct: questionData.correctOption === index
            };
          });
        }
        
        // Process each answer
        Object.entries(answersData).forEach(([participantId, answerData]) => {
          const selectedOption = answerData.selectedOption;
          const isCorrect = selectedOption === questionData.correctOption;
          
          // Get participant info
          const participant = participantsData[participantId] || {
            name: `Participant-${participantId.slice(-4)}`,
            team: 'Unknown Team'
          };
          
          // Increment correct/incorrect counts
          if (isCorrect) {
            newStats.correctAnswers++;
          } else {
            newStats.incorrectAnswers++;
          }
          
          // Track answer by option
          if (selectedOption !== undefined && newStats.answersByOption[selectedOption]) {
            newStats.answersByOption[selectedOption].count++;
          }
          
          // Add to participant answers list
          newStats.participantAnswers.push({
            participantId,
            name: participant.name,
            team: participant.team,
            selectedOption,
            isCorrect,
            answerTime: answerData.timestamp || 0
          });
        });
        
        // Calculate percentages
        if (newStats.totalAnswers > 0) {
          newStats.percentCorrect = Math.round((newStats.correctAnswers / newStats.totalAnswers) * 100);
          
          // Calculate percentages for each option
          Object.keys(newStats.answersByOption).forEach(option => {
            const optionStats = newStats.answersByOption[option];
            optionStats.percent = Math.round((optionStats.count / newStats.totalAnswers) * 100);
          });
        }
        
        // Sort participant answers by time
        newStats.participantAnswers.sort((a, b) => a.answerTime - b.answerTime);
        
        // Prepare answer distribution for chart
        newStats.answerDistribution = Object.entries(newStats.answersByOption).map(([index, data]) => ({
          option: index,
          label: `Option ${Number(index) + 1}`,
          text: data.text,
          count: data.count,
          percent: data.percent,
          isCorrect: data.correct
        }));
        
        console.log("QuestionStats: Processed stats:", newStats);
        setStats(newStats);
        setQuestionData(questionData);
        setLoading(false);
      } catch (err) {
        console.error("QuestionStats: Error processing data:", err);
        setError(err.message);
        setLoading(false);
      }
    };
    
    // Subscribe to answers
    unsubAnswers = onValue(answersRef, (snapshot) => {
      if (snapshot.exists()) {
        answersData = snapshot.val();
      } else {
        answersData = {};
      }
      processAllData();
    }, (err) => {
      console.error("QuestionStats: Error fetching answers:", err);
      setError(err.message);
      setLoading(false);
    });
    
    // Subscribe to question data
    unsubQuestion = onValue(questionRef, (snapshot) => {
      if (snapshot.exists()) {
        questionData = snapshot.val();
      } else {
        setError("Question not found");
        setLoading(false);
      }
      processAllData();
    }, (err) => {
      console.error("QuestionStats: Error fetching question:", err);
      setError(err.message);
      setLoading(false);
    });
    
    // Subscribe to participants
    unsubParticipants = onValue(participantsRef, (snapshot) => {
      if (snapshot.exists()) {
        participantsData = snapshot.val();
      } else {
        participantsData = {};
      }
      processAllData();
    }, (err) => {
      console.error("QuestionStats: Error fetching participants:", err);
      setError(err.message);
      setLoading(false);
    });
    
    // Cleanup subscriptions
    return () => {
      if (unsubAnswers) unsubAnswers();
      if (unsubQuestion) unsubQuestion();
      if (unsubParticipants) unsubParticipants();
    };
  }, [quizId, questionId]);

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
        <p>Error loading question statistics: {error}</p>
      </div>
    );
  }

  if (stats.totalAnswers === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-lg text-gray-600">No answers submitted yet.</p>
      </div>
    );
  }

  return (
    <div className="question-stats p-4">
      <h2 className="text-xl font-bold mb-6">Question Statistics</h2>
      
      {/* Summary */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-gray-600">Total Answers</p>
            <p className="text-2xl font-bold">{stats.totalAnswers}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600">Correct</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.correctAnswers} ({stats.percentCorrect}%)
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-600">Incorrect</p>
            <p className="text-2xl font-bold text-red-600">
              {stats.incorrectAnswers} ({100 - stats.percentCorrect}%)
            </p>
          </div>
        </div>
      </div>
      
      {/* Answer Distribution */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="text-lg font-semibold mb-4">Answer Distribution</h3>
        
        <div className="space-y-4">
          {stats.answerDistribution.map(option => (
            <div key={option.option} className="relative">
              <div className="flex justify-between mb-1">
                <span className="font-medium">
                  Option {Number(option.option) + 1} 
                  {option.isCorrect && <span className="ml-2 text-green-600">✓</span>}
                </span>
                <span>{option.count} ({option.percent}%)</span>
              </div>
              <div className="h-6 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${option.isCorrect ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${option.percent}%` }}
                ></div>
              </div>
              <div className="mt-1 text-sm text-gray-600 overflow-hidden text-ellipsis">
                {option.text}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Participant Answers */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Participant Answers</h3>
          
          {questionData && questionData.difficulty === 'tie-breaker' && (
            <div className="text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded-full">
              Tie-Breaker Question
            </div>
          )}
        </div>
        
        {questionData && questionData.difficulty === 'tie-breaker' && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
            <p className="text-sm">
              <span className="font-bold">Tie-Breaker Rule:</span> In case of tied scores, participants are ranked based on who 
              correctly answered tie-breaker questions first. The first correct answer gets the highest rank.
            </p>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Rank</th>
                <th className="px-4 py-2 text-left">Participant</th>
                <th className="px-4 py-2 text-left">Team</th>
                <th className="px-4 py-2 text-center">Answer</th>
                <th className="px-4 py-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {stats.participantAnswers.map((participant, index) => (
                <tr 
                  key={participant.participantId}
                  className={`border-t ${
                    participant.isCorrect 
                      ? index === 0 && questionData && questionData.difficulty === 'tie-breaker'
                        ? 'bg-green-100' 
                        : 'bg-green-50'
                      : ''
                  }`}
                >
                  <td className="px-4 py-2">
                    {index === 0 && participant.isCorrect && questionData && questionData.difficulty === 'tie-breaker' 
                      ? <span className="text-green-600 font-bold">🥇 First</span>
                      : index + 1}
                  </td>
                  <td className="px-4 py-2 font-medium">{participant.name}</td>
                  <td className="px-4 py-2">{participant.team || 'N/A'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      participant.isCorrect 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                    }`}>
                      {participant.isCorrect ? '✓' : '✗'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {participant.answerTime 
                      ? new Date(participant.answerTime).toLocaleTimeString() 
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {stats.participantAnswers.length === 0 && (
          <p className="text-gray-500 text-center py-4">No answers recorded yet.</p>
        )}
      </div>
    </div>
  );
} 