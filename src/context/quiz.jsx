import { createContext, useContext, useReducer } from "react";

// Quiz Context
const QuizContext = createContext();

// Initial State
const initialState = {
  quizId: null,
  isHost: false,
  activeQuestion: null,
  questions: [],
  participants: [],
  status: "idle", // idle, waiting, active, completed
  title: "",
  currentQuestionIndex: 0,
};

// Reducer
function quizReducer(state, action) {
  switch (action.type) {
    case "CREATE_QUIZ":
      return {
        ...state,
        isHost: true,
        title: action.payload.title,
        questions: action.payload.questions,
        status: "waiting",
      };
    case "SET_QUIZ_ID":
      return {
        ...state,
        quizId: action.payload,
      };
    case "JOIN_QUIZ":
      return {
        ...state,
        quizId: action.payload.quizId,
        title: action.payload.title,
        status: "waiting",
        isHost: false,
      };
    case "UPDATE_PARTICIPANTS":
      return {
        ...state,
        participants: action.payload,
      };
    case "START_QUIZ":
      return {
        ...state,
        status: "active",
        currentQuestionIndex: 0,
      };
    case "SET_ACTIVE_QUESTION":
      return {
        ...state,
        activeQuestion: action.payload,
        currentQuestionIndex: action.payload.index,
      };
    case "NEXT_QUESTION":
      return {
        ...state,
        currentQuestionIndex: state.currentQuestionIndex + 1,
      };
    case "FINISH_QUIZ":
      return {
        ...state,
        status: "completed",
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// Provider Component
export function QuizProvider({ children }) {
  const [state, dispatch] = useReducer(quizReducer, initialState);

  return (
    <QuizContext.Provider value={{ state, dispatch }}>
      {children}
    </QuizContext.Provider>
  );
}

// Hook
export function useQuizContext() {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error("useQuizContext must be used within a QuizProvider");
  }
  return context;
} 