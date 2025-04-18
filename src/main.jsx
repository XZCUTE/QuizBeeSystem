import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PlayerContextProvider } from '@/context/player';
import { SocketContextProvider } from '@/context/socket';
import { QuizProvider } from '@/context/quiz';
import { AudioProvider } from '@/contexts/AudioContext';
import App from '@/App';
import '@/styles/globals.css';
import Toaster from '@/components/Toaster';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SocketContextProvider>
      <PlayerContextProvider>
        <QuizProvider>
          <AudioProvider>
            <Router>
              <App />
            </Router>
            <Toaster />
          </AudioProvider>
        </QuizProvider>
      </PlayerContextProvider>
    </SocketContextProvider>
  </React.StrictMode>
); 