import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaHistory } from 'react-icons/fa';
import History from '@/components/quiz/History';
import Layout from '@/components/Layout';
import { db } from '@/firebase/config';
import { ref, get } from 'firebase/database';

/**
 * HistoryPage component that serves as the container for the History component
 */
export default function HistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [quizId, setQuizId] = useState(null);
  const [error, setError] = useState(null);
  const [quizExists, setQuizExists] = useState(false);

  useEffect(() => {
    // Get quiz ID from URL params or session storage
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('quizId') || sessionStorage.getItem('quizCode');

    if (!id) {
      setError('Quiz ID is required. Please go back and try again.');
      return;
    }

    console.log("History page - Quiz ID:", id);
    
    // Verify that the quiz exists in Firebase
    const checkQuiz = async () => {
      try {
        const quizRef = ref(db, `quizzes/${id}`);
        const snapshot = await get(quizRef);
        
        if (snapshot.exists()) {
          console.log("Quiz exists in Firebase:", id);
          setQuizExists(true);
          setQuizId(id);
        } else {
          console.error("Quiz not found in Firebase:", id);
          setError(`Quiz with ID ${id} not found. It may have been deleted.`);
        }
      } catch (err) {
        console.error("Error checking quiz:", err);
        setError("Error loading quiz: " + err.message);
      }
    };
    
    checkQuiz();
  }, [location]);

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-lg mx-auto bg-red-50 rounded-lg p-6 text-center">
            <FaHistory className="text-red-400 text-5xl mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading History</h1>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!quizExists && !error) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-80">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {quizId && <History quizId={quizId} />}
      </div>
    </Layout>
  );
} 