import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Wifi, Cloud, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NetworkErrorProps {
  onRetry?: () => void;
  message?: string;
}

export const NetworkError: React.FC<NetworkErrorProps> = ({
  onRetry,
  message = "Unable to connect to the server"
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    if (onRetry) {
      setIsRetrying(true);
      await onRetry();
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      {/* Wi-Fi disconnection animation */}
      <div className="relative mb-8">
        <motion.div
          animate={isOnline ? {} : {
            y: [0, -10, 0],
            opacity: [1, 0.5, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity
          }}
        >
          {isOnline ? (
            <Wifi className="h-16 w-16 text-gray-400" />
          ) : (
            <WifiOff className="h-16 w-16 text-red-500" />
          )}
        </motion.div>

        {/* Signal waves animation */}
        <AnimatePresence>
          {!isOnline && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-red-500"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: 1.5 + i * 0.3,
                    opacity: 0
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.3,
                    repeat: Infinity
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      </div>

      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {isOnline ? 'Connection Error' : 'You\'re Offline'}
      </h2>
      
      <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-md">
        {isOnline ? message : 'Please check your internet connection and try again.'}
      </p>

      <Button
        onClick={handleRetry}
        disabled={isRetrying || !isOnline}
        className="relative"
      >
        <AnimatePresence mode="wait">
          {isRetrying ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
              </motion.div>
              Retrying...
            </motion.div>
          ) : (
            <motion.div
              key="retry"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {/* Connection status indicator */}
      <ConnectionStatus isOnline={isOnline} />
    </div>
  );
};

interface ConnectionStatusProps {
  isOnline: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isOnline }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="fixed bottom-4 right-4 z-50"
    >
      <AnimatePresence mode="wait">
        {isOnline ? (
          <motion.div
            key="online"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="flex items-center gap-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-4 py-2 rounded-full shadow-lg"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 bg-green-500 rounded-full"
            />
            <span className="text-sm font-medium">Online</span>
          </motion.div>
        ) : (
          <motion.div
            key="offline"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="flex items-center gap-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-4 py-2 rounded-full shadow-lg"
          >
            <motion.div
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 bg-red-500 rounded-full"
            />
            <span className="text-sm font-medium">Offline</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Offline dinosaur game component
export const OfflineDinosaurGame: React.FC = () => {
  const [isJumping, setIsJumping] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const jump = () => {
    if (!isJumping && !gameOver) {
      setIsJumping(true);
      setTimeout(() => setIsJumping(false), 500);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isJumping, gameOver]);

  useEffect(() => {
    if (!gameOver) {
      const interval = setInterval(() => {
        setScore(s => s + 1);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [gameOver]);

  return (
    <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
      <div className="absolute inset-0 flex items-end justify-center pb-8">
        {/* Dinosaur */}
        <motion.div
          animate={isJumping ? { y: -60 } : { y: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="relative z-10 cursor-pointer"
          onClick={jump}
        >
          <div className="w-10 h-10 bg-gray-600 dark:bg-gray-400 rounded-md" />
        </motion.div>

        {/* Obstacles */}
        <motion.div
          className="absolute bottom-8 h-8 w-4 bg-green-600"
          animate={{ x: [-300, 300] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear'
          }}
          onAnimationComplete={() => {
            if (!isJumping) {
              setGameOver(true);
            }
          }}
        />
      </div>

      {/* Score */}
      <div className="absolute top-4 right-4 text-2xl font-mono text-gray-600 dark:text-gray-400">
        {String(score).padStart(5, '0')}
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 text-sm text-gray-500">
        Press SPACE or click to jump
      </div>

      {/* Game over */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center"
          >
            <div className="text-white text-center">
              <h3 className="text-2xl font-bold mb-2">Game Over!</h3>
              <p>Score: {score}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setGameOver(false);
                  setScore(0);
                }}
              >
                Play Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};