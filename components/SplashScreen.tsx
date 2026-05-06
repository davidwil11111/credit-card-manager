import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [textVisible, setTextVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);

  useEffect(() => {
    const textTimer = setTimeout(() => {
      setTextVisible(true);
    }, 300);

    const subtitleTimer = setTimeout(() => {
      setSubtitleVisible(true);
    }, 600);

    const fadeOutTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(subtitleTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #3730a3 100%)'
      }}
    >
      <div className="text-center px-8">
        <h1 
          className={`text-4xl font-bold text-white mb-4 transition-all duration-700 ${
            textVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
          }`}
          style={{
            textShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            letterSpacing: '2px'
          }}
        >
          信用卡管理大师
        </h1>
        
        <p 
          className={`text-lg text-white/90 transition-all duration-700 delay-100 ${
            subtitleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{
            letterSpacing: '4px',
            fontWeight: 300
          }}
        >
          CARD MASTER
        </p>

        <div 
          className={`mt-12 transition-all duration-700 delay-200 ${
            subtitleVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>

      <div 
        className={`absolute bottom-16 text-white/70 text-sm transition-all duration-700 delay-300 ${
          subtitleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        智能管理 · 轻松掌控
      </div>
    </div>
  );
};
