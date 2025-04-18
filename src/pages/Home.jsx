import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button';
import { useSocketContext } from '@/context/socket';
import toast from 'react-hot-toast';
import useSound from '@/hooks/useSound';

export default function Home() {
  const navigate = useNavigate();
  const { socket } = useSocketContext();
  const [isLoaded, setIsLoaded] = useState(false);
  const sound = useSound({ 
    pageType: 'home', 
    playBackgroundMusic: true,
    playEntranceSound: true
  });

  useEffect(() => {
    // Set loaded state after a small delay for entrance animation
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    
    socket.on('game:errorMessage', (message) => {
      toast.error(message);
      sound.playError();
    });

    return () => {
      socket.off('game:errorMessage');
      clearTimeout(timer);
    };
  }, [socket, sound]);

  const handleHostClick = () => {
    sound.playClick();
    sound.play('transition');
    navigate('/host');
  };

  const handleParticipantClick = () => {
    sound.playClick();
    sound.play('transition');
    navigate('/participant');
  };

  // Generate random positions for background particles
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

  return (
    <section className="flex min-h-screen w-full flex-col items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#03256C] to-[#06BEE1]">
        {/* Animated waves */}
        <div className="absolute bottom-0 left-0 right-0 h-64 overflow-hidden">
          <div className="absolute bottom-[-10px] left-0 right-0 h-64 bg-[#06BEE1] opacity-20"
               style={{
                 transform: 'translateX(-50%) rotate(0deg) translateY(10px)',
                 animation: 'wave 15s ease-in-out infinite',
               }}
          />
          <div className="absolute bottom-[-15px] left-0 right-0 h-64 bg-[#1768AC] opacity-15"
               style={{
                 transform: 'translateX(-25%) rotate(0deg) translateY(10px)',
                 animation: 'wave 17s ease-in-out infinite reverse',
               }}
          />
        </div>
        
        {/* Floating particles */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-white"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: particle.left,
              top: particle.top,
              opacity: particle.opacity,
              animation: `float ${particle.animationDuration} infinite ease-in-out`,
              animationDelay: particle.animationDelay,
            }}
          />
        ))}
      </div>
      
      {/* Content with entrance animations */}
      <div className={`transition-all duration-1000 ease-out transform ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        <img 
          src="https://i.imgur.com/7OSw7In.png" 
          className="mb-8 h-40 mx-auto animate-float" 
          alt="ICCT School Logo" 
        />
        
        <h1 
          className="text-center text-6xl font-bold mb-12 text-white"
          style={{ 
            textShadow: '0 0 10px #06BEE1, 0 0 20px #06BEE1, 0 0 30px #06BEE1',
            WebkitTextStroke: '1px #06BEE1',
            animation: 'pulse 2s infinite ease-in-out'
          }}
        >
          ICCT QuizBee
        </h1>
        
        <div className={`flex flex-col gap-8 w-full max-w-lg px-4 transition-all duration-1000 delay-300 ease-out transform ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          <Button 
            onClick={handleHostClick} 
            className="py-10 text-3xl font-bold relative overflow-hidden transition-transform duration-300 hover:scale-105 text-white"
            onMouseEnter={() => sound.playHover()}
            style={{
              backgroundImage: "url('https://i.pinimg.com/1200x/b6/8d/4f/b68d4f33dca9c343219a204927ac67e6.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              borderRadius: "8px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
            }}
          >
            <span className="relative z-10">HOST</span>
          </Button>
          
          <Button 
            onClick={handleParticipantClick} 
            className="py-10 text-3xl font-bold relative overflow-hidden transition-transform duration-300 hover:scale-105 text-white"
            onMouseEnter={() => sound.playHover()}
            style={{
              backgroundImage: "url('https://i.pinimg.com/1200x/54/13/26/541326d8aa1808c5c607fdd74c187eef.jpg')",
              backgroundSize: "cover", 
              backgroundPosition: "center",
              borderRadius: "8px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
            }}
          >
            <span className="relative z-10">PARTICIPANT</span>
          </Button>
        </div>
      </div>
      
      {/* Floating Elements - now with more animation */}
      <div className="fixed top-20 left-20 w-16 h-16 bg-primary-light rounded-full opacity-20 animate-pulse-float"></div>
      <div className="fixed bottom-20 right-20 w-20 h-20 bg-accent rounded-full opacity-20 animate-pulse-float-reverse" style={{animationDelay: '1s'}}></div>
      <div className="fixed top-1/3 right-1/4 w-8 h-8 bg-secondary rounded-full opacity-10 animate-pulse-float-slow" style={{animationDelay: '0.5s'}}></div>
    </section>
  );
} 