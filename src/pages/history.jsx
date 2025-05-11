import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db } from "@/firebase/config";
import { ref, get } from "firebase/database";
import Button from "@/components/Button";
import toast from "react-hot-toast";
import * as XLSX from 'xlsx';

export default function History() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [quizCode] = useState(searchParams.get("code") || "");
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [participantHistory, setParticipantHistory] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Generate random positions for background particles (matching the app style)
  const generateParticles = (count) => {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        id: i,
        size: Math.random() * 20 + 5,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDuration: `${Math.random() * 20 + 20}s`,
        animationDelay: `${Math.random() * 5}s`,
        opacity: Math.random() * 0.3 + 0.1
      });
    }
    return particles;
  };

  const particles = generateParticles(15);

  useEffect(() => {
    // Set loaded state after a small delay for entrance animation
    const timer = setTimeout(() => setIsLoaded(true), 100);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!quizCode) {
      setError("No quiz code provided");
      setLoading(false);
      return;
    }

    const fetchQuizData = async () => {
      try {
        // Get quiz data
        const quizRef = ref(db, `quizzes/${quizCode}`);
        const quizSnapshot = await get(quizRef);

        if (!quizSnapshot.exists()) {
          setError("Quiz not found");
          setLoading(false);
          return;
        }

        const quiz = quizSnapshot.val();
        setQuizData(quiz);

        // Get participants data
        if (quiz.participants) {
          // Create an array of participant objects with their basic info
          const participantsArray = Object.keys(quiz.participants).map(key => ({
            id: key,
            ...quiz.participants[key]
          }));

          // Get the questions array
          const questions = quiz.questions || [];
          
          // For each participant, get their answers and calculate correct answers count
          for (const participant of participantsArray) {
            let correctAnswersCount = 0;
            
            // For each question, check if the participant answered correctly
            for (const question of questions) {
              const answerRef = ref(db, `quizzes/${quizCode}/answers/${question.id}/${participant.id}`);
              const answerSnapshot = await get(answerRef);
              
              if (answerSnapshot.exists()) {
                const answerData = answerSnapshot.val();
                if (answerData.isCorrect) {
                  correctAnswersCount++;
                }
              }
            }
            
            // Add the correct answers count to the participant object
            participant.correctAnswers = correctAnswersCount;
          }

          setParticipants(participantsArray);

          // Extract teams from participants
          const uniqueTeams = [...new Set(participantsArray.map(p => p.team))].filter(Boolean);
          setTeams(uniqueTeams);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching quiz data:", err);
        setError("Failed to load quiz data");
        setLoading(false);
      }
    };

    fetchQuizData();
  }, [quizCode]);

  const handleTeamSelect = (team) => {
    setSelectedTeam(team === selectedTeam ? null : team);
    setSelectedParticipant(null);
    setParticipantHistory(null);
  };

  const handleParticipantSelect = async (participant) => {
    if (selectedParticipant && selectedParticipant.id === participant.id) {
      // Clicking the same participant again deselects them
      setSelectedParticipant(null);
      setParticipantHistory(null);
      return;
    }

    setSelectedParticipant(participant);
    await fetchParticipantHistory(participant.id);
  };

  const fetchParticipantHistory = async (participantId) => {
    try {
      setLoading(true);
      
      // Get all questions from the quiz
      const questions = quizData.questions || [];
      
      // Get all answers for this participant
      const answersData = {};
      
      // For each question, get the participant's answer
      for (const question of questions) {
        const answerRef = ref(db, `quizzes/${quizCode}/answers/${question.id}/${participantId}`);
        const answerSnapshot = await get(answerRef);
        
        if (answerSnapshot.exists()) {
          const answerData = answerSnapshot.val();
          answersData[question.id] = {
            question,
            answer: answerData.answer,
            isCorrect: answerData.isCorrect,
            scoreEarned: answerData.score || 0,
            submittedAt: answerData.submittedAt
          };
        } else {
          // If no answer found, the participant didn't answer this question
          answersData[question.id] = {
            question,
            answer: null,
            isCorrect: false,
            scoreEarned: 0,
            submittedAt: null
          };
        }
      }
      
      // Calculate total points earned
      const totalPoints = Object.values(answersData).reduce(
        (total, data) => total + (data.scoreEarned || 0), 
        0
      );
      
      // Calculate correct answers count
      const correctAnswersCount = Object.values(answersData).filter(
        data => data.isCorrect
      ).length;
      
      setParticipantHistory({
        questions: answersData,
        totalPoints,
        correctAnswersCount,
        totalQuestions: questions.length
      });
      
      setLoading(false);
    } catch (err) {
      console.error("Error fetching participant history:", err);
      toast.error("Failed to load participant history");
      setLoading(false);
    }
  };

  const handlePrintReport = () => {
    // Open print dialog
    window.print();
  };

  // New function for Excel export - All participants summary
  const exportToExcelSummary = () => {
    try {
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      
      // Prepare data for export
      const summaryData = [
        // Header row with merged cells for the title
        ["ICCT QUIZBEE SUMMARY REPORT"],
        [""],  // Empty row for spacing
        ["Quiz Title:", quizData?.title || "Quiz History"],
        ["Date Generated:", new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()],
        ["Total Participants:", participants.length.toString()],
        ["Teams:", teams.length.toString()],
        [""],  // Empty row for spacing
        // Column headers
        ["Team Name", "Participant Name", "Total Score", "Total Correct Answers", "Total Questions", "Percentage Score"]
      ];
      
      // Add data rows
      participants.forEach(participant => {
        // Calculate percentage score
        const totalScore = participant.score || 0;
        const correctAnswers = participant.correctAnswers || 0;
        const totalQuestions = quizData?.questions?.length || 0;
        const percentageScore = totalQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
        
        summaryData.push([
          participant.team || "No Team",
          participant.name,
          totalScore.toString(),
          correctAnswers.toString(),
          totalQuestions.toString(),
          percentageScore + "%"
        ]);
      });
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths
      const colWidths = [
        { wch: 20 }, // Team Name
        { wch: 25 }, // Participant Name
        { wch: 15 }, // Total Score
        { wch: 20 }, // Total Correct Answers
        { wch: 20 }, // Total Questions
        { wch: 20 }  // Percentage Score
      ];
      ws['!cols'] = colWidths;
      
      // Merge cells for title header
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } } // Merge first row across all columns
      ];
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Summary Report");
      
      // Generate Excel file and trigger download
      const fileName = `ICCT_QuizBee_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success("Summary report exported successfully!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export summary report");
    }
  };
  
  // New function for Excel export - Individual participant
  const exportToExcelParticipantReport = () => {
    if (!selectedParticipant || !participantHistory) {
      toast.error("Please select a participant first");
      return;
    }
    
    try {
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      
      // Prepare data headers
      const reportData = [
        ["ICCT QUIZBEE PARTICIPANT REPORT"],
        [""],  // Empty row for spacing
        ["Participant:", selectedParticipant.name],
        ["Team:", selectedParticipant.team || "No Team"],
        ["Quiz Title:", quizData?.title || "Quiz History"],
        ["Date Generated:", new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()],
        ["Total Score:", (participantHistory?.totalPoints || 0).toString()],
        ["Correct Answers:", `${participantHistory?.correctAnswersCount || 0} of ${participantHistory?.totalQuestions || 0}`],
        [""],  // Empty row for spacing
        // Column headers
        ["Question", "Selected Answer", "Correct Answer", "Result", "Score"]
      ];
      
      // Add data rows for each question
      quizData?.questions?.forEach((question, index) => {
        const history = participantHistory.questions[question.id];
        if (!history) return;
        
        // Format the selected answer based on question type
        let formattedAnswer = "Not answered";
        if (history.answer !== null) {
          if (question.type === "multiple-choice" || question.type === "true-false") {
            // Map numeric index back to letter option
            const optionLetters = ["A", "B", "C", "D"];
            formattedAnswer = optionLetters[history.answer] || history.answer;
            
            // Add the text of the selected option if available
            if (question.options && question.options[history.answer]) {
              formattedAnswer += ` - ${question.options[history.answer]}`;
            }
          } else if (question.type === "fill-in-blank") {
            formattedAnswer = history.answer;
          }
        }
        
        // Format the correct answer
        let correctAnswer = "";
        if (question.type === "multiple-choice" || question.type === "true-false") {
          const optionLetters = ["A", "B", "C", "D"];
          correctAnswer = optionLetters[question.correctAnswer] || question.correctAnswer;
          
          // Add the text of the correct option if available
          if (question.options && question.options[question.correctAnswer]) {
            correctAnswer += ` - ${question.options[question.correctAnswer]}`;
          }
        } else if (question.type === "fill-in-blank") {
          correctAnswer = question.correctAnswer;
        }
        
        reportData.push([
          question.text,
          formattedAnswer,
          correctAnswer,
          history.isCorrect ? "Correct" : "Incorrect",
          `${history.scoreEarned} / ${question.points || 100}`
        ]);
      });
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(reportData);
      
      // Set column widths
      const colWidths = [
        { wch: 40 }, // Question
        { wch: 30 }, // Selected Answer
        { wch: 30 }, // Correct Answer
        { wch: 15 }, // Result
        { wch: 15 }  // Score
      ];
      ws['!cols'] = colWidths;
      
      // Merge cells for title header
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } } // Merge first row across all columns
      ];
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Participant Report");
      
      // Generate Excel file and trigger download
      const fileName = `ICCT_QuizBee_${selectedParticipant.name.replace(/\s+/g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success("Participant report exported successfully!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export participant report");
    }
  };

  const handleBack = () => {
    // If a participant is selected, go back to participant list
    if (selectedParticipant) {
      setSelectedParticipant(null);
      setParticipantHistory(null);
      return;
    }
    
    // Otherwise close the page
    window.close();
  };

  if (loading && !participantHistory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800">
        <div className="w-16 h-16 border-t-4 border-primary border-solid rounded-full animate-spin mb-4"></div>
        <p className="text-xl">Loading quiz history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
          <p className="mb-6">{error}</p>
          <Button onClick={() => window.close()}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-hidden transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <img 
          src="https://i.imgur.com/fz9GJPU.jpeg" 
          className="w-full h-full object-cover" 
          alt="background" 
        />
      </div>
      
      {/* Background overlay for better readability */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900/30 to-gray-800/30 z-0"></div>
      
      {/* Background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-10">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-primary animate-float"
            style={{
              width: particle.size,
              height: particle.size,
              left: particle.left,
              top: particle.top,
              opacity: particle.opacity,
              animationDuration: particle.animationDuration,
              animationDelay: particle.animationDelay
            }}
          />
        ))}
      </div>
      
      {/* Enhanced Print-only layout that will appear on printed pages */}
      <div className="hidden print:block">
        {/* Clean header for print */}
        <div className="print-header">
          <img src="https://i.imgur.com/7OSw7In.png" alt="ICCT Logo" className="logo" />
          <h1>ICCT QUIZ BEE SYSTEM</h1>
          <p>History Report</p>
        </div>
        
        <hr style={{ border: "1px solid #000", margin: "20px 0" }} />
        
        {/* Report metadata */}
        <div className="report-meta">
          <div>
            <span className="report-meta-label">Quiz Title:</span>
            <span>{quizData?.title || "Quiz History"}</span>
          </div>
          <div>
            <span className="report-meta-label">Date Generated:</span>
            <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
          </div>
          
          {selectedParticipant && (
            <>
              <div>
                <span className="report-meta-label">Participant Name:</span>
                <span>{selectedParticipant.name}</span>
              </div>
              <div>
                <span className="report-meta-label">Team:</span>
                <span>{selectedParticipant.team || "No Team"}</span>
              </div>
              <div>
                <span className="report-meta-label">Total Score:</span>
                <span>{participantHistory?.totalPoints || 0} points</span>
              </div>
              <div>
                <span className="report-meta-label">Correct Answers:</span>
                <span>{participantHistory?.correctAnswersCount || 0} of {participantHistory?.totalQuestions || 0}</span>
              </div>
            </>
          )}
          
          {!selectedParticipant && (
            <>
              <div>
                <span className="report-meta-label">Total Participants:</span>
                <span>{participants.length}</span>
              </div>
              {teams.length > 0 && (
                <div>
                  <span className="report-meta-label">Teams:</span>
                  <span>{teams.length}</span>
                </div>
              )}
            </>
          )}
      </div>
      
        {/* Print content - either participant history or summary */}
        {selectedParticipant && participantHistory ? (
          <>
            <div className="print-title">Individual Participant Report</div>
            
            <table>
                    <thead>
                      <tr>
                        <th width="5%">No.</th>
                        <th width="45%">Question</th>
                        <th width="20%">Selected Answer</th>
                        <th width="20%">Correct Answer</th>
                        <th width="10%">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quizData?.questions?.map((question, index) => {
                        const history = participantHistory.questions[question.id];
                        if (!history) return null;
                        
                        // Format the selected answer based on question type
                        let formattedAnswer = "Not answered";
                        if (history.answer !== null) {
                          if (question.type === "multiple-choice" || question.type === "true-false") {
                            // Map numeric index back to letter option
                            const optionLetters = ["A", "B", "C", "D"];
                            formattedAnswer = optionLetters[history.answer] || history.answer;
                            
                            // Add the text of the selected option if available
                            if (question.options && question.options[history.answer]) {
                              formattedAnswer += ` - ${question.options[history.answer]}`;
                            }
                          } else if (question.type === "fill-in-blank") {
                            formattedAnswer = history.answer;
                          }
                        }
                        
                        // Format the correct answer
                        let correctAnswer = "";
                        if (question.type === "multiple-choice" || question.type === "true-false") {
                          const optionLetters = ["A", "B", "C", "D"];
                          correctAnswer = optionLetters[question.correctAnswer] || question.correctAnswer;
                          
                          // Add the text of the correct option if available
                          if (question.options && question.options[question.correctAnswer]) {
                            correctAnswer += ` - ${question.options[question.correctAnswer]}`;
                          }
                        } else if (question.type === "fill-in-blank") {
                          correctAnswer = question.correctAnswer;
                        }

                        return (
                          <tr key={question.id} className={history.isCorrect ? "bg-green-50" : ""}>
                            <td>{index + 1}</td>
                            <td>{question.text}</td>
                            <td className={history.isCorrect ? "text-green-600" : "text-red-600"}>
                              {formattedAnswer}
                            </td>
                            <td className="text-green-600">{correctAnswer}</td>
                            <td>{history.scoreEarned} / {question.points || 100}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="4" className="text-right font-bold">Total Points:</td>
                        <td className="font-bold">{participantHistory.totalPoints}</td>
                      </tr>
                    </tfoot>
                  </table>
          </>
        ) : (
          <>
            <div className="print-title">Quiz Summary Report</div>
            
            <table>
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Participant Name</th>
                  <th>Total Score</th>
                  <th>Correct Answers</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {participants
                  .filter(p => !selectedTeam || p.team === selectedTeam)
                  .map(participant => {
                    // Calculate percentage
                    const totalQuestions = quizData?.questions?.length || 0;
                    const correctAnswers = participant.correctAnswers || 0;
                    const percentageScore = totalQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
                    
                    return (
                      <tr key={participant.id}>
                        <td>{participant.team || "No Team"}</td>
                        <td>{participant.name}</td>
                        <td>{participant.score || 0}</td>
                        <td>{participant.correctAnswers || 0} / {quizData?.questions?.length || 0}</td>
                        <td>{percentageScore}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </>
        )}
        
        <hr style={{ border: "1px solid #000", margin: "20px 0" }} />
        
        {/* Footer with page information */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10pt' }}>
          <p>ICCT Quiz Bee System © {new Date().getFullYear()}</p>
        </div>
      </div>
      
      {/* Main content */}
      <div className="relative z-20 min-h-screen">
        <div className="container mx-auto px-4 py-4">
          {/* Header with page title */}
          <div className="text-center py-6">
            <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-24 mx-auto animate-float" alt="ICCT School Logo" />
            <h1 className="text-3xl font-bold mb-6 text-center text-white" style={{ textShadow: '0 0 10px #06BEE1' }}>
              ICCT Quiz Bee System
            </h1>
            <h2 className="text-xl text-gray-200">Quiz History</h2>
          </div>

          {/* Main content area */}
          <div className="max-w-6xl mx-auto pb-20 print:p-0">
            {/* Header with navigation - hidden when printing */}
            <div className="flex items-center justify-between mb-6 print:hidden">
              <Button 
                onClick={handleBack}
                className="flex items-center gap-2 bg-white/80 text-primary border-2 border-primary/50 px-4 py-2 rounded-lg font-bold shadow-md hover:bg-white hover:shadow-lg transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Back
              </Button>
              
              <div className="flex gap-2">
                <Button
                  onClick={selectedParticipant ? exportToExcelParticipantReport : exportToExcelSummary}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-green-700 hover:shadow-lg transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Export to Excel
                </Button>
                
                <Button
                  onClick={handlePrintReport}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-4 py-2 rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                  </svg>
                  Print Report
                </Button>
              </div>
            </div>
            
            {/* Quiz title */}
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 mb-6 print:hidden">
              <h2 className="text-xl font-semibold">{quizData?.title || "Quiz History"}</h2>
              <p className="text-gray-600">
                Total Participants: {participants.length}
                {teams.length > 0 && ` • Teams: ${teams.length}`}
              </p>
            </div>
            
            {/* Participant history or participants list */}
            {selectedParticipant && participantHistory ? (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Participant details header */}
                <div className="bg-gradient-to-r from-primary to-secondary p-4 text-white print:hidden">
                  <h2 className="text-xl font-semibold">
                    {selectedParticipant.name}
                  </h2>
                  <p>
                    Team: {selectedParticipant.team || "No Team"}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Correct: {participantHistory.correctAnswersCount}/{participantHistory.totalQuestions}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Total Points: {participantHistory.totalPoints}
                    </span>
                  </div>
                </div>
                
                {/* Questions and answers - Enhanced for print */}
                <div className="divide-y divide-gray-200">
                  {/* Print-only table header - Remove since we have a dedicated print layout */}
                  <div className="print:hidden">
                    {quizData?.questions?.map((question, index) => {
                      const history = participantHistory.questions[question.id];
                      if (!history) return null;
                      
                      // Format the selected answer based on question type
                      let formattedAnswer = "Not answered";
                      if (history.answer !== null) {
                        if (question.type === "multiple-choice" || question.type === "true-false") {
                          // Map numeric index back to letter option
                          const optionLetters = ["A", "B", "C", "D"];
                          formattedAnswer = optionLetters[history.answer] || history.answer;
                          
                          // Add the text of the selected option if available
                          if (question.options && question.options[history.answer]) {
                            formattedAnswer += ` - ${question.options[history.answer]}`;
                          }
                        } else if (question.type === "fill-in-blank") {
                          formattedAnswer = history.answer;
                        }
                      }
                      
                      // Format the correct answer
                      let correctAnswer = "";
                      if (question.type === "multiple-choice" || question.type === "true-false") {
                        const optionLetters = ["A", "B", "C", "D"];
                        correctAnswer = optionLetters[question.correctAnswer] || question.correctAnswer;
                        
                        // Add the text of the correct option if available
                        if (question.options && question.options[question.correctAnswer]) {
                          correctAnswer += ` - ${question.options[question.correctAnswer]}`;
                        }
                      } else if (question.type === "fill-in-blank") {
                        correctAnswer = question.correctAnswer;
                      }
                      
                      return (
                        <div key={question.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-medium">
                                Question {index + 1}: {question.text}
                              </h3>
                              
                              {/* Options for multiple choice */}
                              {question.type === "multiple-choice" && question.options && (
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {question.options.map((option, i) => (
                                    <div 
                                      key={i}
                                      className={`px-3 py-2 rounded-md border ${
                                        history.answer === i 
                                          ? history.isCorrect 
                                            ? 'border-green-500 bg-green-50' 
                                            : 'border-red-500 bg-red-50'
                                          : i === question.correctAnswer
                                            ? 'border-green-300 bg-green-50'
                                            : 'border-gray-200'
                                      }`}
                                    >
                                      {["A", "B", "C", "D"][i]}: {option}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Answer information */}
                              <div className="mt-3 text-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <div>
                                    <span className="font-medium">Selected Answer:</span>{" "}
                                    <span className={history.isCorrect ? "text-green-600" : "text-red-600"}>
                                      {formattedAnswer}
                                    </span>
                                  </div>
                                  
                                  <div>
                                    <span className="font-medium">Correct Answer:</span>{" "}
                                    <span className="text-green-600">{correctAnswer}</span>
                                  </div>
                                  
                                  <div>
                                    <span className="font-medium">Points:</span>{" "}
                                    <span>{history.scoreEarned} of {question.points || 100}</span>
                                  </div>
                                  
                                  <div>
                                    <span className="font-medium">Result:</span>{" "}
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      history.isCorrect 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {history.isCorrect ? "Correct" : "Incorrect"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6">
                {/* Teams list */}
                {teams.length > 0 && (
                  <div className="md:w-1/4 print:hidden">
                    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                      <h2 className="text-lg font-semibold mb-3">Teams</h2>
                      <div className="space-y-2">
                        <button
                          onClick={() => setSelectedTeam(null)}
                          className={`w-full text-left px-3 py-2 rounded-md transition ${
                            selectedTeam === null
                              ? 'bg-primary text-white'
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          All Teams
                        </button>
                        {teams.map(team => (
                          <button
                            key={team}
                            onClick={() => handleTeamSelect(team)}
                            className={`w-full text-left px-3 py-2 rounded-md transition ${
                              selectedTeam === team
                                ? 'bg-primary text-white'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            {team}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Participants list */}
                <div className={teams.length > 0 ? "md:w-3/4" : "w-full"}>
                  <div className="bg-white rounded-lg shadow-md p-4">
                    <h2 className="text-lg font-semibold mb-3 print:text-center print:text-xl print:border-bottom print:pb-2">
                      {selectedTeam ? `Team ${selectedTeam} Participants` : "All Participants"}
                    </h2>
                    
                    {participants.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No participants found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-black">
                                Name
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-black">
                                Team
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-black">
                                Score
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:text-black">
                                Correct Answers
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider print:hidden">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {participants
                              .filter(p => !selectedTeam || p.team === selectedTeam)
                              .map(participant => (
                                <tr 
                                  key={participant.id}
                                  className="hover:bg-gray-50 transition-colors"
                                >
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-gray-900 print:text-black">{participant.name}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-gray-500 print:text-black">{participant.team || "No Team"}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-gray-500 print:text-black">{participant.score || 0}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-gray-500 print:text-black">{participant.correctAnswers || 0} / {quizData?.questions?.length || 0}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right print:hidden">
                                    <Button 
                                      onClick={() => handleParticipantSelect(participant)}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                                    >
                                      View History
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 