import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import clsx from 'clsx';
import Home from '@/pages/Home';
import Host from '@/pages/host';
import Participant from '@/pages/participant';
import JoinQuiz from "@/components/JoinQuiz";
import History from '@/pages/history';
import Audience from '@/pages/Audience';

export default function App() {
  // Set document title and favicon
  useEffect(() => {
    // Set document title
    document.title = 'ICCT Quiz Bee System';
    
    // Create or update favicon link
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'shortcut icon';
      document.head.appendChild(link);
    }
    link.href = '/icon.svg';
  }, []);

  return (
    <>
      <main className="text-base-[8px] flex flex-col min-h-screen font-montserrat">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/participant" element={<Participant />} />
          <Route path="/host" element={<Host />} />
          <Route path="/join" element={<JoinQuiz />} />
          <Route path="/participant/waiting" element={<Participant />} />
          <Route path="/history" element={<History />} />
          <Route path="/audience" element={<Audience />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
} 