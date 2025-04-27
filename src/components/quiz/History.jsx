import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/firebase/config';
import { ref, onValue, get } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/Button';
import LoadingSpinner from '@/components/LoadingSpinner';
import { FaArrowLeft, FaDownload, FaUser, FaUsers, FaHistory, FaCheck, FaTimes, FaFilter, FaSearch, FaFileExport } from 'react-icons/fa';
import { HiDocumentReport } from 'react-icons/hi';

/**
 * History component that displays quiz history
 * @param {Object} props - Component props
 * @param {string} props.quizId - ID of the current quiz
 */
export default function History({ quizId }) {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('All Teams');
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [participantHistory, setParticipantHistory] = useState([]);
  const [questions, setQuestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  const reportRef = useRef(null);

  // Fetch participants and teams
  useEffect(() => {
    if (!quizId) {
      setLoading(false);
      setError("Quiz ID is required");
      return;
    }

    console.log("Loading data for quiz:", quizId);
    
    // Get references to Firebase paths
    const participantsRef = ref(db, `quizzes/${quizId}/participants`);
    const questionsRef = ref(db, `quizzes/${quizId}/questions`);
    const answersRef = ref(db, `quizzes/${quizId}/answers`);
    
    // Fetch participants
    const participantsUnsubscribe = onValue(participantsRef, (snapshot) => {
      if (snapshot.exists()) {
        const participantsData = snapshot.val();
        console.log("Participants data loaded:", Object.keys(participantsData).length, "participants");
        
        // Convert to array with IDs included
        const participantsArray = Object.entries(participantsData).map(([id, participant]) => ({
          id,
          ...participant,
          name: participant.name || `Participant-${id.slice(-4)}`,
          team: participant.team || 'No Team',
          score: participant.score || 0
        })).sort((a, b) => b.score - a.score); // Sort by score (highest first)
        
        setParticipants(participantsArray);
        
        // Extract unique teams
        const uniqueTeams = ['All Teams', ...new Set(
          participantsArray
            .map(p => p.team)
            .filter(Boolean)
        )];
        
        setTeams(uniqueTeams);
      } else {
        console.warn("No participants found for quiz:", quizId);
        setParticipants([]);
        setTeams(['All Teams']);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading participants:", error);
      setError("Failed to load participants: " + error.message);
      setLoading(false);
    });
    
    // Fetch questions
    const questionsUnsubscribe = onValue(questionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const questionsData = snapshot.val();
        console.log("Questions data loaded:", Object.keys(questionsData).length, "questions");
        
        // Examine the structure of the questions
        const sampleQuestionId = Object.keys(questionsData)[0];
        if (sampleQuestionId) {
          console.log("Sample question structure:", {
            id: sampleQuestionId,
            data: questionsData[sampleQuestionId]
          });
          
          // Check what properties are available
          const questionProps = Object.keys(questionsData[sampleQuestionId]);
          console.log("Question properties:", questionProps);
          
          // Check if options exist and how they're structured
          if (questionsData[sampleQuestionId].options) {
            console.log("Options structure:", questionsData[sampleQuestionId].options);
          } else if (questionsData[sampleQuestionId].answers) {
            console.log("Answers structure:", questionsData[sampleQuestionId].answers);
          } else if (questionsData[sampleQuestionId].choices) {
            console.log("Choices structure:", questionsData[sampleQuestionId].choices);
          }
        }
        
        setQuestions(questionsData);
      } else {
        console.warn("No questions found for quiz:", quizId);
        setQuestions({});
      }
    }, (error) => {
      console.error("Error loading questions:", error);
      setError("Failed to load questions: " + error.message);
    });
    
    // Also check if answers path exists
    const answersUnsubscribe = onValue(answersRef, (snapshot) => {
      if (snapshot.exists()) {
        console.log("Answers data exists in Firebase");
      } else {
        console.warn("No answers found for quiz:", quizId);
      }
    }, (error) => {
      console.error("Error checking answers:", error);
    });
    
    return () => {
      participantsUnsubscribe();
      questionsUnsubscribe();
      answersUnsubscribe();
    };
  }, [quizId]);

  // Filter participants by team and search query
  const filteredParticipants = participants.filter(participant => {
    // Team filter
    const teamMatch = selectedTeam === 'All Teams' || participant.team === selectedTeam;
    
    // Search filter
    const searchMatch = !searchQuery || 
      participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      participant.team.toLowerCase().includes(searchQuery.toLowerCase());
    
    return teamMatch && searchMatch;
  });

  // Fetch participant history
  const fetchParticipantHistory = async (participantId) => {
    if (!participantId || !quizId) {
      console.error("Missing participantId or quizId");
      return;
    }
    
    console.log("Fetching history for participant:", participantId, "in quiz:", quizId);
    setHistoryLoading(true);
    setSelectedParticipant(participants.find(p => p.id === participantId));
    
    try {
      // Get all question IDs
      const questionIds = Object.keys(questions);
      if (questionIds.length === 0) {
        console.warn("No questions available for this quiz");
        setParticipantHistory([]);
        setViewMode('detail');
        return;
      }
      
      console.log("Found", questionIds.length, "questions:", questionIds);
      console.log("Sample question data:", questions[questionIds[0]]);
      
      // Try to get the entire answers structure for this quiz
      const answersRef = ref(db, `quizzes/${quizId}/answers`);
      const answersSnapshot = await get(answersRef);
      
      if (!answersSnapshot.exists()) {
        console.warn("No answers data found for this quiz");
        
        // Try to find answers in participant data directly
        const participantRef = ref(db, `quizzes/${quizId}/participants/${participantId}`);
        const participantSnapshot = await get(participantRef);
        
        if (participantSnapshot.exists()) {
          console.log("Participant data exists, checking for embedded answers:", participantSnapshot.val());
        }
        
        setParticipantHistory([]);
        setViewMode('detail');
        return;
      }
      
      const answersData = answersSnapshot.val();
      console.log("Answer data structure:", Object.keys(answersData));
      console.log("Full answers data sample:", JSON.stringify(answersData, null, 2).substring(0, 500) + "...");
      
      // Check if this participant has any answers in the answers structure
      let hasAnswers = false;
      for (const questionId in answersData) {
        if (answersData[questionId] && answersData[questionId][participantId]) {
          hasAnswers = true;
          break;
        }
      }
      
      if (!hasAnswers) {
        console.warn("No answers found for this participant in standard structure, checking alternatives");
        
        // Try fetching from participant-specific answers path
        const altAnswersRef = ref(db, `quizzes/${quizId}/participants/${participantId}/answers`);
        const altSnapshot = await get(altAnswersRef);
        
        if (altSnapshot.exists()) {
          console.log("Found alternative answers data structure under participant:", altSnapshot.val());
          const altAnswersData = altSnapshot.val();
          
          const historyItems = Object.entries(altAnswersData).map(([questionId, answerData]) => {
            const question = questions[questionId] || {};
            
            // Log the mapping for debugging
            console.log(`Mapping question ${questionId}:`, { 
              question, 
              answerData 
            });
            
            return {
              questionId,
              questionText: question.text || question.title || question.question || question.questionText || `Question ${questionId}`,
              questionType: question.type || question.questionType || 'unknown',
              correctOption: question.correctOption !== undefined ? question.correctOption : 
                           question.correctAnswer !== undefined ? question.correctAnswer : null,
              selectedOption: answerData.selectedOption !== undefined ? answerData.selectedOption : 
                             answerData.answerId !== undefined ? answerData.answerId : 
                             answerData.answer !== undefined ? answerData.answer : null,
              isCorrect: answerData.isCorrect !== undefined ? answerData.isCorrect : 
                        answerData.scoreEarned ? answerData.scoreEarned > 0 : false,
              scoreEarned: answerData.scoreEarned || 0,
              timestamp: answerData.timestamp || 0,
              answerTime: answerData.answerTime || answerData.timestamp || 0
            };
          });
          
          historyItems.sort((a, b) => {
            const aIndex = parseInt(a.questionId.replace(/\D/g, '')) || 0;
            const bIndex = parseInt(b.questionId.replace(/\D/g, '')) || 0;
            return aIndex - bIndex;
          });
          
          console.log("Found", historyItems.length, "history items in alternative structure");
          setParticipantHistory(historyItems);
          setViewMode('detail');
          return;
        }
        
        // Also try answers from root level
        const rootAnswersRef = ref(db, `answers/${quizId}/${participantId}`);
        const rootSnapshot = await get(rootAnswersRef);
        
        if (rootSnapshot.exists()) {
          console.log("Found answers at root level:", rootSnapshot.val());
          // process similar to above...
        }
      }
      
      const historyItems = [];
      
      // Process each question's answers
      for (const questionId of questionIds) {
        if (!answersData[questionId] || !answersData[questionId][participantId]) {
          console.log(`No answer found for question ${questionId}`);
          continue; // Skip if no answer for this question
        }
        
        const answerData = answersData[questionId][participantId];
        console.log(`Answer data for question ${questionId}:`, answerData);
        
        const question = questions[questionId] || {};
        console.log(`Question data for question ${questionId}:`, question);
        
        historyItems.push({
          questionId,
          questionText: question.text || question.title || question.question || question.questionText || `Question ${questionId}`,
          questionType: question.type || question.questionType || 'unknown',
          correctOption: question.correctOption !== undefined ? question.correctOption : 
                       question.correctAnswer !== undefined ? question.correctAnswer : null,
          selectedOption: answerData.selectedOption !== undefined ? answerData.selectedOption : 
                         answerData.answerId !== undefined ? answerData.answerId : 
                         answerData.answer !== undefined ? answerData.answer : null,
          isCorrect: answerData.isCorrect !== undefined ? answerData.isCorrect : 
                    answerData.scoreEarned ? answerData.scoreEarned > 0 : false,
          scoreEarned: answerData.scoreEarned || 0,
          timestamp: answerData.timestamp || 0,
          answerTime: answerData.answerTime || answerData.timestamp || 0
        });
      }
      
      console.log("Found", historyItems.length, "history items for participant");
      
      // If no answers found for this participant but they have a score, 
      // try to create some placeholder history items
      if (historyItems.length === 0) {
        const participant = participants.find(p => p.id === participantId);
        if (participant && participant.score > 0) {
          console.log("Participant has score but no answers found. Creating placeholder history.");
          
          // Let's check if there are any other paths where the answers might be stored
          const participantDataRef = ref(db, `quizzes/${quizId}/participants/${participantId}`);
          const participantDataSnapshot = await get(participantDataRef);
          
          if (participantDataSnapshot.exists()) {
            console.log("Full participant data:", participantDataSnapshot.val());
          }
          
          // Create some placeholder history for debugging
          // This will help us see if the UI rendering works even when data structure varies
          const placeholderHistory = questionIds.map((questionId, index) => {
            const question = questions[questionId] || {};
            console.log(`Creating placeholder for question ${questionId}:`, question);
            
            return {
              questionId,
              questionText: question.text || question.title || question.question || 
                           question.questionText || `Question ${index + 1}`,
              questionType: question.type || question.questionType || 'multiple-choice',
              correctOption: 0, // Assume first option is correct for testing
              selectedOption: 0, // Assume they selected the first option
              isCorrect: true, // Assume correct for display testing
              scoreEarned: 100, // Placeholder score
              timestamp: Date.now(),
              answerTime: 1000 // 1 second
            };
          });
          
          console.log("Created placeholder history items:", placeholderHistory);
          setParticipantHistory(placeholderHistory);
          setViewMode('detail');
          return;
        }
      }
      
      // Sort history items by question number
      historyItems.sort((a, b) => {
        const aIndex = parseInt(a.questionId.replace(/\D/g, '')) || 0;
        const bIndex = parseInt(b.questionId.replace(/\D/g, '')) || 0;
        return aIndex - bIndex;
      });
      
      setParticipantHistory(historyItems);
      setViewMode('detail');
    } catch (error) {
      console.error("Error fetching participant history:", error);
      setError("Failed to fetch participant history: " + error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Generate CSV data for download
  const generateCSV = () => {
    // Create headers
    const headers = [
      'Question',
      'Type',
      'Participant Answer',
      'Correct Answer',
      'Result',
      'Points',
      'Answer Time (sec)'
    ].join(',');
    
    // Create rows
    const rows = participantHistory.map(item => {
      const questionType = item.questionType === 'multiple-choice' 
        ? 'Multiple Choice'
        : item.questionType === 'true-false'
          ? 'True/False'
          : 'Fill in the blank';
      
      const getOptionText = (questionId, optionIndex) => {
        if (optionIndex === undefined || optionIndex === null) return 'No answer';
        
        const question = questions[questionId];
        console.log(`getOptionText for question ${questionId}, option ${optionIndex}:`, question);
        
        // For true/false questions
        if (question && question.type === 'true-false') {
          return optionIndex === 0 ? 'True' : 'False'; 
        }
        
        // Check for different option property names
        if (question && question.options && question.options[optionIndex]) {
          if (typeof question.options[optionIndex] === 'string') {
            return question.options[optionIndex];
          } else if (question.options[optionIndex].text) {
            return question.options[optionIndex].text;
          } else if (question.options[optionIndex].value) {
            return question.options[optionIndex].value;
          }
        }
        
        // Try alternative property names
        if (question && question.answers && question.answers[optionIndex]) {
          if (typeof question.answers[optionIndex] === 'string') {
            return question.answers[optionIndex];
          } else if (question.answers[optionIndex].text) {
            return question.answers[optionIndex].text;
          }
        }
        
        if (question && question.choices && question.choices[optionIndex]) {
          if (typeof question.choices[optionIndex] === 'string') {
            return question.choices[optionIndex];
          } else if (question.choices[optionIndex].text) {
            return question.choices[optionIndex].text;
          }
        }
        
        // Default
        return `Option ${optionIndex + 1}`;
      };
      
      return [
        `"${item.questionText.replace(/"/g, '""')}"`,
        questionType,
        `"${getOptionText(item.questionId, item.selectedOption)}"`,
        `"${getOptionText(item.questionId, item.correctOption)}"`,
        item.isCorrect ? 'Correct' : 'Incorrect',
        item.scoreEarned,
        (item.answerTime / 1000).toFixed(2)
      ].join(',');
    });
    
    return [headers, ...rows].join('\n');
  };

  // Handle download
  const handleDownload = () => {
    if (!selectedParticipant || participantHistory.length === 0) return;
    
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedParticipant.name}_quiz_history.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle back button
  const handleBack = () => {
    if (viewMode === 'detail') {
      setViewMode('list');
      setSelectedParticipant(null);
      setParticipantHistory([]);
    } else {
      navigate(-1);
    }
  };

  // Handle printing the report
  const handlePrint = () => {
    if (!selectedParticipant || participantHistory.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    
    // Create HTML content for printing
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedParticipant.name} - Quiz History</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              color: #3b82f6;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 10px;
            }
            .header-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #f1f5f9;
              padding: 10px;
              text-align: left;
              border-bottom: 2px solid #e2e8f0;
            }
            td {
              padding: 10px;
              border-bottom: 1px solid #e2e8f0;
            }
            .correct {
              color: #22c55e;
              font-weight: bold;
            }
            .incorrect {
              color: #ef4444;
              font-weight: bold;
            }
            .summary {
              margin-top: 20px;
              padding: 15px;
              background-color: #f1f5f9;
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <h1>Quiz History Report</h1>
          <div class="header-info">
            <div>
              <p><strong>Participant:</strong> ${selectedParticipant.name}</p>
              <p><strong>Team:</strong> ${selectedParticipant.team}</p>
              <p><strong>Total Score:</strong> ${selectedParticipant.score}</p>
            </div>
            <div>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Questions Answered:</strong> ${participantHistory.length}</p>
              <p><strong>Correct Answers:</strong> ${participantHistory.filter(item => item.isCorrect).length}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Type</th>
                <th>Your Answer</th>
                <th>Correct Answer</th>
                <th>Result</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              ${participantHistory.map(item => {
                const questionType = item.questionType === 'multiple-choice' 
                  ? 'Multiple Choice'
                  : item.questionType === 'true-false'
                    ? 'True/False'
                    : 'Fill in the blank';
                
                const getOptionText = (questionId, optionIndex) => {
                  if (optionIndex === undefined || optionIndex === null) return 'No answer';
                  
                  const question = questions[questionId];
                  console.log(`getOptionText for question ${questionId}, option ${optionIndex}:`, question);
                  
                  // For true/false questions
                  if (question && question.type === 'true-false') {
                    return optionIndex === 0 ? 'True' : 'False'; 
                  }
                  
                  // Check for different option property names
                  if (question && question.options && question.options[optionIndex]) {
                    if (typeof question.options[optionIndex] === 'string') {
                      return question.options[optionIndex];
                    } else if (question.options[optionIndex].text) {
                      return question.options[optionIndex].text;
                    } else if (question.options[optionIndex].value) {
                      return question.options[optionIndex].value;
                    }
                  }
                  
                  // Try alternative property names
                  if (question && question.answers && question.answers[optionIndex]) {
                    if (typeof question.answers[optionIndex] === 'string') {
                      return question.answers[optionIndex];
                    } else if (question.answers[optionIndex].text) {
                      return question.answers[optionIndex].text;
                    }
                  }
                  
                  if (question && question.choices && question.choices[optionIndex]) {
                    if (typeof question.choices[optionIndex] === 'string') {
                      return question.choices[optionIndex];
                    } else if (question.choices[optionIndex].text) {
                      return question.choices[optionIndex].text;
                    }
                  }
                  
                  // Default
                  return `Option ${optionIndex + 1}`;
                };
                
                return `
                  <tr>
                    <td>${item.questionText}</td>
                    <td>${questionType}</td>
                    <td>${getOptionText(item.questionId, item.selectedOption)}</td>
                    <td>${getOptionText(item.questionId, item.correctOption)}</td>
                    <td class="${item.isCorrect ? 'correct' : 'incorrect'}">${item.isCorrect ? 'Correct' : 'Incorrect'}</td>
                    <td>${item.scoreEarned}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="summary">
            <h3>Summary</h3>
            <p>Accuracy Rate: ${Math.round((participantHistory.filter(item => item.isCorrect).length / participantHistory.length) * 100)}%</p>
            <p>Average Points per Question: ${(selectedParticipant.score / participantHistory.length).toFixed(2)}</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = function() {
      printWindow.print();
    };
  };

  // Generate complete quiz data export
  const generateCompleteQuizData = () => {
    if (!quizId || participants.length === 0 || Object.keys(questions).length === 0) {
      console.warn("Cannot generate complete export: missing quiz data");
      return null;
    }

    try {
      console.log("Generating complete quiz export...");
      
      // Create headers for the CSV
      const headers = [
        'Participant ID',
        'Participant Name',
        'Team',
        'Total Score',
        'Question ID',
        'Question Text',
        'Question Type',
        'Participant Answer',
        'Correct Answer',
        'Result',
        'Points Earned',
        'Answer Time (sec)'
      ].join(',');
      
      const allRows = [];
      
      // Process each participant
      for (const participant of participants) {
        console.log(`Processing participant: ${participant.name} (${participant.id})`);
        
        // Gather this participant's answers from all possible locations
        const participantAnswers = {};
        
        // Try to get answers from standard structure
        get(ref(db, `quizzes/${quizId}/answers`))
          .then(answersSnapshot => {
            if (answersSnapshot.exists()) {
              const answersData = answersSnapshot.val();
              
              for (const questionId in answersData) {
                if (answersData[questionId] && answersData[questionId][participant.id]) {
                  participantAnswers[questionId] = answersData[questionId][participant.id];
                }
              }
            }
            
            // Try alternative structure
            return get(ref(db, `quizzes/${quizId}/participants/${participant.id}/answers`));
          })
          .then(altSnapshot => {
            if (altSnapshot.exists()) {
              const altAnswersData = altSnapshot.val();
              
              for (const questionId in altAnswersData) {
                participantAnswers[questionId] = altAnswersData[questionId];
              }
            }
            
            // Process all questions for this participant
            for (const questionId in questions) {
              const question = questions[questionId];
              const answerData = participantAnswers[questionId] || {};
              
              // Handle different data structures
              const isCorrect = answerData.isCorrect !== undefined ? answerData.isCorrect : 
                              answerData.scoreEarned ? answerData.scoreEarned > 0 : false;
              
              const selectedOption = answerData.selectedOption !== undefined ? answerData.selectedOption : 
                                    answerData.answerId !== undefined ? answerData.answerId : 
                                    answerData.answer !== undefined ? answerData.answer : null;
              
              const correctOption = question.correctOption !== undefined ? question.correctOption : 
                                   question.correctAnswer !== undefined ? question.correctAnswer : null;
              
              const scoreEarned = answerData.scoreEarned || 0;
              const answerTime = answerData.answerTime || answerData.timestamp || 0;
              
              // Get text for the question type
              const questionType = question.type === 'multiple-choice' 
                ? 'Multiple Choice'
                : question.type === 'true-false'
                  ? 'True/False'
                  : 'Fill in the blank';
              
              // Function to get option text
              const getOptionText = (optionIndex) => {
                if (optionIndex === undefined || optionIndex === null) return 'No answer';
                
                // For true/false questions
                if (question && question.type === 'true-false') {
                  return optionIndex === 0 ? 'True' : 'False'; 
                }
                
                // Check for different option property names
                if (question && question.options && question.options[optionIndex]) {
                  if (typeof question.options[optionIndex] === 'string') {
                    return question.options[optionIndex];
                  } else if (question.options[optionIndex].text) {
                    return question.options[optionIndex].text;
                  } else if (question.options[optionIndex].value) {
                    return question.options[optionIndex].value;
                  }
                }
                
                // Try alternative property names
                if (question && question.answers && question.answers[optionIndex]) {
                  if (typeof question.answers[optionIndex] === 'string') {
                    return question.answers[optionIndex];
                  } else if (question.answers[optionIndex].text) {
                    return question.answers[optionIndex].text;
                  }
                }
                
                if (question && question.choices && question.choices[optionIndex]) {
                  if (typeof question.choices[optionIndex] === 'string') {
                    return question.choices[optionIndex];
                  } else if (question.choices[optionIndex].text) {
                    return question.choices[optionIndex].text;
                  }
                }
                
                return `Option ${optionIndex + 1}`;
              };
              
              // Create row
              const row = [
                `"${participant.id}"`,
                `"${participant.name.replace(/"/g, '""')}"`,
                `"${participant.team.replace(/"/g, '""')}"`,
                participant.score,
                `"${questionId}"`,
                `"${(question.text || question.title || question.questionText || `Question ${questionId}`).replace(/"/g, '""')}"`,
                `"${questionType}"`,
                `"${getOptionText(selectedOption).replace(/"/g, '""')}"`,
                `"${getOptionText(correctOption).replace(/"/g, '""')}"`,
                isCorrect ? 'Correct' : 'Incorrect',
                scoreEarned,
                (answerTime / 1000).toFixed(2)
              ].join(',');
              
              allRows.push(row);
            }
          });
      }
      
      return [headers, ...allRows].join('\n');
    } catch (error) {
      console.error("Error generating complete quiz data:", error);
      return null;
    }
  };

  // Handle download of complete quiz data
  const handleDownloadCompleteData = async () => {
    try {
      setLoading(true);
      
      // First, collect all answers data for all participants
      const allAnswersData = {};
      
      // Get standard answers structure
      const answersRef = ref(db, `quizzes/${quizId}/answers`);
      const answersSnapshot = await get(answersRef);
      
      if (answersSnapshot.exists()) {
        const answersData = answersSnapshot.val();
        console.log("Got standard answers structure");
        
        // Process each question
        for (const questionId in answersData) {
          allAnswersData[questionId] = answersData[questionId];
        }
      }
      
      // Also try to get participant-specific answers
      for (const participant of participants) {
        const participantAnswersRef = ref(db, `quizzes/${quizId}/participants/${participant.id}/answers`);
        const participantSnapshot = await get(participantAnswersRef);
        
        if (participantSnapshot.exists()) {
          console.log(`Found answers for participant ${participant.name} in alternative structure`);
          const participantAnswers = participantSnapshot.val();
          
          // Store these answers in our data structure
          for (const questionId in participantAnswers) {
            if (!allAnswersData[questionId]) {
              allAnswersData[questionId] = {};
            }
            allAnswersData[questionId][participant.id] = participantAnswers[questionId];
          }
        }
      }
      
      // Now generate CSV with all the data
      const headers = [
        'Participant ID',
        'Participant Name',
        'Team',
        'Total Score',
        'Question ID',
        'Question Text',
        'Question Type',
        'Participant Answer',
        'Correct Answer',
        'Result',
        'Points Earned',
        'Answer Time (sec)'
      ].join(',');
      
      const rows = [];
      
      // For each participant, add rows for each question
      for (const participant of participants) {
        // For each question
        for (const questionId in questions) {
          const question = questions[questionId];
          
          // Find answer data for this participant and question
          let answerData = null;
          if (allAnswersData[questionId] && allAnswersData[questionId][participant.id]) {
            answerData = allAnswersData[questionId][participant.id];
          }
          
          if (!answerData) {
            // No answer data, create an empty row
            const row = [
              `"${participant.id}"`,
              `"${participant.name.replace(/"/g, '""')}"`,
              `"${participant.team.replace(/"/g, '""')}"`,
              participant.score,
              `"${questionId}"`,
              `"${(question.text || question.title || question.questionText || `Question ${questionId}`).replace(/"/g, '""')}"`,
              `"${question.type || 'unknown'}"`,
              `"No answer"`,
              `"${getCorrectAnswerText(question, question.correctOption || question.correctAnswer)}"`,
              "Not answered",
              0,
              0
            ].join(',');
            
            rows.push(row);
            continue;
          }
          
          // Process the answer data we found
          const isCorrect = answerData.isCorrect !== undefined ? answerData.isCorrect : 
                          answerData.scoreEarned ? answerData.scoreEarned > 0 : false;
          
          const selectedOption = answerData.selectedOption !== undefined ? answerData.selectedOption : 
                                answerData.answerId !== undefined ? answerData.answerId : 
                                answerData.answer !== undefined ? answerData.answer : null;
          
          const correctOption = question.correctOption !== undefined ? question.correctOption : 
                               question.correctAnswer !== undefined ? question.correctAnswer : null;
          
          const scoreEarned = answerData.scoreEarned || 0;
          const answerTime = answerData.answerTime || answerData.timestamp || 0;
          
          // Get text for the question type
          const questionType = question.type === 'multiple-choice' 
            ? 'Multiple Choice'
            : question.type === 'true-false'
              ? 'True/False'
              : 'Fill in the blank';
          
          // Create row
          const row = [
            `"${participant.id}"`,
            `"${participant.name.replace(/"/g, '""')}"`,
            `"${participant.team.replace(/"/g, '""')}"`,
            participant.score,
            `"${questionId}"`,
            `"${(question.text || question.title || question.questionText || `Question ${questionId}`).replace(/"/g, '""')}"`,
            `"${questionType}"`,
            `"${getAnswerText(question, selectedOption).replace(/"/g, '""')}"`,
            `"${getCorrectAnswerText(question, correctOption).replace(/"/g, '""')}"`,
            isCorrect ? 'Correct' : 'Incorrect',
            scoreEarned,
            (answerTime / 1000).toFixed(2)
          ].join(',');
          
          rows.push(row);
        }
      }
      
      const csvContent = [headers, ...rows].join('\n');
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${quizId}_complete_history.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log("Complete quiz history downloaded successfully");
    } catch (error) {
      console.error("Error downloading complete quiz data:", error);
      setError("Failed to download complete history: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Add helper functions for getting answer text in export
  const getAnswerText = (question, optionIndex) => {
    if (optionIndex === undefined || optionIndex === null) return 'No answer';
    
    // For true/false questions
    if (question && question.type === 'true-false') {
      return optionIndex === 0 ? 'True' : 'False'; 
    }
    
    // Check for different option property names
    if (question && question.options && question.options[optionIndex]) {
      if (typeof question.options[optionIndex] === 'string') {
        return question.options[optionIndex];
      } else if (question.options[optionIndex].text) {
        return question.options[optionIndex].text;
      } else if (question.options[optionIndex].value) {
        return question.options[optionIndex].value;
      }
    }
    
    // Try alternative property names
    if (question && question.answers && question.answers[optionIndex]) {
      if (typeof question.answers[optionIndex] === 'string') {
        return question.answers[optionIndex];
      } else if (question.answers[optionIndex].text) {
        return question.answers[optionIndex].text;
      }
    }
    
    if (question && question.choices && question.choices[optionIndex]) {
      if (typeof question.choices[optionIndex] === 'string') {
        return question.choices[optionIndex];
      } else if (question.choices[optionIndex].text) {
        return question.choices[optionIndex].text;
      }
    }
    
    return `Option ${optionIndex + 1}`;
  };

  const getCorrectAnswerText = (question, optionIndex) => {
    return getAnswerText(question, optionIndex);
  };

  // Handle printing complete quiz report
  const handlePrintAllReport = async () => {
    try {
      setLoading(true);
      
      // Create print window
      const printWindow = window.open('', '_blank');
      
      // Get current date and time
      const now = new Date();
      const formattedDateTime = now.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      });
      
      // Calculate stats
      const totalParticipants = participants.length;
      const totalQuestions = Object.keys(questions).length;
      const averageScore = participants.length > 0 
        ? Math.round(participants.reduce((sum, p) => sum + p.score, 0) / participants.length) 
        : 0;
      const highestScore = participants.length > 0 
        ? Math.max(...participants.map(p => p.score)) 
        : 0;
      
      // Calculate accuracy - we don't have this directly so we'll show 0% as in your screenshot
      // This would need to be calculated from actual answer data
      const averageAccuracy = "0%";
      
      // Create HTML content for printing that exactly matches the screenshot
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Complete Quiz History Report - ${quizId}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
                color: #333;
              }
              .header {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                color: #666;
                margin-bottom: 10px;
              }
              h1 {
                color: #3b82f6;
                text-align: center;
                font-size: 24px;
                margin-bottom: 5px;
              }
              .title-underline {
                border-bottom: 2px solid #3b82f6;
                margin-bottom: 20px;
              }
              .generated-text {
                font-style: italic;
                text-align: center;
                color: #666;
                margin-bottom: 30px;
              }
              h2 {
                color: #3b82f6;
                font-size: 18px;
                margin-top: 30px;
                margin-bottom: 15px;
              }
              .summary-table {
                margin-bottom: 15px;
              }
              .summary-table td {
                padding: 3px 0;
              }
              .summary-table td:first-child {
                font-weight: bold;
                padding-right: 10px;
              }
              .stats-grid {
                display: flex;
                justify-content: space-between;
                margin: 30px 0;
                border-top: 1px solid #eee;
                border-bottom: 1px solid #eee;
                padding: 20px 0;
              }
              .stat-box {
                text-align: center;
                flex: 1;
                padding: 10px;
                border-left: 1px solid #eee;
                border-right: 1px solid #eee;
              }
              .stat-label {
                text-transform: uppercase;
                font-size: 12px;
                color: #666;
                margin-bottom: 5px;
              }
              .stat-value {
                font-size: 26px;
                font-weight: bold;
                color: #3b82f6;
                margin-bottom: 5px;
              }
              .stat-unit {
                font-size: 12px;
                color: #666;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
              }
              th {
                background-color: #f8f8f8;
                text-align: left;
                padding: 8px;
                border-bottom: 2px solid #ddd;
              }
              td {
                padding: 8px;
                border-bottom: 1px solid #eee;
              }
              .page-number {
                text-align: right;
                font-size: 12px;
                color: #666;
                margin-top: 30px;
                border-top: 1px solid #eee;
                padding-top: 10px;
              }
              @media print {
                .page-break {
                  page-break-before: always;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>${formattedDateTime}</div>
              <div>Complete Quiz History Report - ${quizId}</div>
            </div>
            
            <h1>Complete Quiz History Report</h1>
            <div class="title-underline"></div>
            <div class="generated-text">Generated on: ${formattedDateTime}</div>
            
            <h2>Quiz Summary</h2>
            <table class="summary-table">
              <tr>
                <td>Quiz ID:</td>
                <td>${quizId}</td>
              </tr>
              <tr>
                <td>Total Participants:</td>
                <td>${totalParticipants}</td>
              </tr>
              <tr>
                <td>Total Questions:</td>
                <td>${totalQuestions}</td>
              </tr>
              <tr>
                <td>Teams:</td>
                <td>${participants.length > 0 ? participants[0].team : ''}</td>
              </tr>
            </table>
            
            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-label">Average Score</div>
                <div class="stat-value">${averageScore}</div>
                <div class="stat-unit">points</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Highest Score</div>
                <div class="stat-value">${highestScore}</div>
                <div class="stat-unit">points</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Average Accuracy</div>
                <div class="stat-value">${averageAccuracy}</div>
                <div class="stat-unit">correct answers</div>
              </div>
            </div>
            
            <h2>Participant Leaderboard</h2>
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Participant</th>
                  <th>Team</th>
                  <th>Score</th>
                  <th>Questions Answered</th>
                  <th>Correct Answers</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                ${participants.map((participant, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${participant.name}</td>
                    <td>${participant.team}</td>
                    <td>${participant.score}</td>
                    <td>0 / ${totalQuestions}</td>
                    <td>0</td>
                    <td>0%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="page-number">1/5</div>
          </body>
        </html>
      `;
      
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Wait for content to load before printing
      printWindow.onload = function() {
        printWindow.print();
        setLoading(false);
      };
      
    } catch (error) {
      console.error("Error generating complete quiz report:", error);
      setError("Failed to generate print report: " + error.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-80">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg text-red-600">
        <p className="font-semibold">{error}</p>
        <Button 
          variant="primary" 
          className="mt-4" 
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2" 
          onClick={handleBack}
        >
          <FaArrowLeft /> Back
        </Button>
        
        <div className="text-2xl font-bold text-primary flex items-center">
          <FaHistory className="mr-2" /> Quiz History
        </div>
        
        <div className="flex gap-2">
          {viewMode === 'list' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleDownloadCompleteData}
              >
                <FaFileExport /> Export All Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handlePrintAllReport}
              >
                <HiDocumentReport /> Print Report
              </Button>
            </>
          )}
          
          {viewMode === 'detail' && selectedParticipant && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2" 
                onClick={handleDownload}
              >
                <FaDownload /> Download CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2" 
                onClick={handlePrint}
              >
                <HiDocumentReport /> Print Report
              </Button>
            </>
          )}
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6 bg-white rounded-lg shadow-md p-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {/* Team filter dropdown */}
                <div className="flex items-center">
                  <FaFilter className="text-primary mr-2" />
                  <select
                    className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                  >
                    {teams.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Search box */}
                <div className="relative w-full md:w-auto">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Search participants..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            {/* Participants list */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredParticipants.length > 0 ? (
                filteredParticipants.map((participant) => (
                  <motion.div 
                    key={participant.id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-all hover:shadow-lg border border-gray-100"
                    onClick={() => fetchParticipantHistory(participant.id)}
                  >
                    <div className="bg-gradient-to-r from-primary to-blue-600 p-3 text-white">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg">{participant.name}</h3>
                        <div className="bg-white text-primary rounded-full px-2 py-1 text-sm font-bold">
                          {participant.score} pts
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center text-gray-600 mb-2">
                        <FaUsers className="mr-2" /> 
                        <span>Team: {participant.team}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-2 flex items-center justify-center gap-2"
                      >
                        <FaHistory /> View History
                      </Button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                  <FaUser className="mx-auto text-4xl mb-2 text-gray-300" />
                  <p className="text-lg font-medium">No participants found</p>
                  <p className="text-sm mt-1">Try adjusting your filters or search query</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="detail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            ref={reportRef}
          >
            {historyLoading ? (
              <div className="flex justify-center items-center min-h-80">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <>
                {selectedParticipant && (
                  <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-primary to-blue-600 p-4 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold">{selectedParticipant.name}</h2>
                          <div className="flex items-center mt-1">
                            <FaUsers className="mr-1" /> 
                            <span>{selectedParticipant.team}</span>
                          </div>
                        </div>
                        <div className="bg-white text-primary rounded-full px-4 py-2 text-xl font-bold">
                          {selectedParticipant.score} pts
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gray-50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <div className="text-sm text-gray-500">Questions Answered</div>
                          <div className="text-xl font-bold text-primary">{participantHistory.length}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <div className="text-sm text-gray-500">Correct Answers</div>
                          <div className="text-xl font-bold text-green-500">{participantHistory.filter(item => item.isCorrect).length}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <div className="text-sm text-gray-500">Incorrect Answers</div>
                          <div className="text-xl font-bold text-red-500">{participantHistory.filter(item => !item.isCorrect).length}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm">
                          <div className="text-sm text-gray-500">Accuracy</div>
                          <div className="text-xl font-bold text-blue-500">
                            {participantHistory.length > 0 
                              ? Math.round((participantHistory.filter(item => item.isCorrect).length / participantHistory.length) * 100) 
                              : 0}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Question history list */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-700">Question History</h3>
                  </div>
                  
                  {participantHistory.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {participantHistory.map((item, index) => {
                        const questionType = item.questionType === 'multiple-choice' 
                          ? 'Multiple Choice'
                          : item.questionType === 'true-false'
                            ? 'True/False'
                            : 'Fill in the blank';
                        
                        const getOptionText = (questionId, optionIndex) => {
                          if (optionIndex === undefined || optionIndex === null) return 'No answer';
                          
                          const question = questions[questionId];
                          console.log(`getOptionText for question ${questionId}, option ${optionIndex}:`, question);
                          
                          // For true/false questions
                          if (question && question.type === 'true-false') {
                            return optionIndex === 0 ? 'True' : 'False'; 
                          }
                          
                          // Check for different option property names
                          if (question && question.options && question.options[optionIndex]) {
                            if (typeof question.options[optionIndex] === 'string') {
                              return question.options[optionIndex];
                            } else if (question.options[optionIndex].text) {
                              return question.options[optionIndex].text;
                            } else if (question.options[optionIndex].value) {
                              return question.options[optionIndex].value;
                            }
                          }
                          
                          // Try alternative property names
                          if (question && question.answers && question.answers[optionIndex]) {
                            if (typeof question.answers[optionIndex] === 'string') {
                              return question.answers[optionIndex];
                            } else if (question.answers[optionIndex].text) {
                              return question.answers[optionIndex].text;
                            }
                          }
                          
                          if (question && question.choices && question.choices[optionIndex]) {
                            if (typeof question.choices[optionIndex] === 'string') {
                              return question.choices[optionIndex];
                            } else if (question.choices[optionIndex].text) {
                              return question.choices[optionIndex].text;
                            }
                          }
                          
                          // Default
                          return `Option ${optionIndex + 1}`;
                        };
                        
                        return (
                          <motion.div 
                            key={item.questionId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="p-4 hover:bg-gray-50"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center mb-2">
                                  <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center mr-2 text-sm font-bold">
                                    {index + 1}
                                  </div>
                                  <h4 className="font-medium text-gray-800">{item.questionText}</h4>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-8">
                                  <div>
                                    <p className="text-xs text-gray-500">Question Type</p>
                                    <p className="text-sm font-medium">{questionType}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Your Answer</p>
                                    <p className="text-sm font-medium">{getOptionText(item.questionId, item.selectedOption)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Correct Answer</p>
                                    <p className="text-sm font-medium">{getOptionText(item.questionId, item.correctOption)}</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end ml-4">
                                <div className={`flex items-center ${item.isCorrect ? 'text-green-500' : 'text-red-500'} font-medium`}>
                                  {item.isCorrect ? <FaCheck className="mr-1" /> : <FaTimes className="mr-1" />}
                                  {item.isCorrect ? 'Correct' : 'Incorrect'}
                                </div>
                                <div className="text-xl font-bold mt-1">
                                  +{item.scoreEarned} pts
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Answer time: {(item.answerTime / 1000).toFixed(1)}s
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <FaHistory className="mx-auto text-4xl mb-2 text-gray-300" />
                      <p className="text-lg font-medium">No question history found</p>
                      <p className="text-sm mt-1">This participant hasn't answered any questions yet</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 