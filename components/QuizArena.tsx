'use client';

import React, { useState } from 'react';
import styles from '@/styles/components/QuizArena.module.css';
import { 
  Trophy, 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  Info, 
  CheckCircle2, 
  XCircle,
  RotateCcw
} from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface QuizArenaProps {
  quiz: QuizQuestion[];
  onComplete?: (score: number) => void;
}

export default function QuizArena({ quiz, onComplete }: QuizArenaProps) {
  const [gameState, setGameState] = useState<'intro' | 'active' | 'complete'>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  // Play audio code (synthesized sound effects)
  const playSound = (type: 'correct' | 'incorrect' | 'complete') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

      if (type === 'correct') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'incorrect') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); // low buzz
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
      } else if (type === 'complete') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        oscillator.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
      }
    } catch (e) {
      console.log('Audio synthesising is not supported');
    }
  };

  const startQuiz = () => {
    setScore(0);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setGameState('active');
  };

  const selectOption = (idx: number) => {
    if (selectedAnswer !== null) return; // lock inputs
    setSelectedAnswer(idx);

    const isCorrect = idx === quiz[currentIndex].answerIndex;
    if (isCorrect) {
      setScore(prev => prev + 1);
      playSound('correct');
    } else {
      playSound('incorrect');
    }
  };

  const nextQuestion = () => {
    setSelectedAnswer(null);
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setGameState('complete');
      playSound('complete');
      if (onComplete) onComplete(score);
    }
  };

  if (!quiz || quiz.length === 0) {
    return (
      <div className={`${styles.introCard} glass-panel`}>
        <HelpCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 className={styles.title}>No quiz items available</h3>
        <p className={styles.desc}>Summarize this lecture to extract multiple choice quiz questions.</p>
      </div>
    );
  }

  const currentQuestion = quiz[currentIndex];
  const progressPercent = ((currentIndex + 1) / quiz.length) * 100;

  // Final grade evaluation
  const scorePercent = (score / quiz.length) * 100;
  const getFeedbackMessage = () => {
    if (scorePercent === 100) return 'Perfect Score! You are a Campus Genius! 🌟';
    if (scorePercent >= 80) return 'Excellent Work! You know these concepts inside out! 🚀';
    if (scorePercent >= 50) return 'Good Job! Review your note summaries to get 100% next time.';
    return 'Keep Studying! Go back and study the flashcards before retrying. 📚';
  };

  return (
    <div className={styles.container}>
      {gameState === 'intro' && (
        <div className={`${styles.introCard} glass-panel animate-fade-in`}>
          <Trophy size={48} style={{ color: 'var(--accent-secondary)', marginBottom: '16px' }} />
          <h3 className={styles.title}>AI Study Challenge</h3>
          <p className={styles.desc}>
            Test your comprehension of this lecture. We've compiled <strong>{quiz.length} key questions</strong> based on your notes.
          </p>
          <button onClick={startQuiz} className="btn-primary">
            <Sparkles size={16} /> Start Quiz Game
          </button>
        </div>
      )}

      {gameState === 'active' && (
        <div className={`${styles.quizCard} glass-panel animate-fade-in`}>
          {/* Progress Header */}
          <div className={styles.progressHeader}>
            <span>Question {currentIndex + 1} of {quiz.length}</span>
            <span>Current Score: {score}/{currentIndex}</span>
          </div>
          
          <div className={styles.progressBarOuter}>
            <div className={styles.progressBarInner} style={{ width: `${progressPercent}%` }} />
          </div>

          {/* Question Text */}
          <h3 className={styles.question}>{currentQuestion.question}</h3>

          {/* Options grid */}
          <div className={styles.optionsGrid}>
            {currentQuestion.options.map((option, idx) => {
              // Styling flags
              const isSelected = selectedAnswer === idx;
              const isCorrectIndex = idx === currentQuestion.answerIndex;
              
              let optionStyle = '';
              if (selectedAnswer !== null) {
                if (isCorrectIndex) {
                  optionStyle = styles.optionCorrect;
                } else if (isSelected) {
                  optionStyle = styles.optionIncorrect;
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => selectOption(idx)}
                  disabled={selectedAnswer !== null}
                  className={`${styles.optionBtn} ${optionStyle}`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {/* Explanation revealed */}
          {selectedAnswer !== null && (
            <div className={styles.explanationBox}>
              <div className={styles.explanationTitle}>
                {selectedAnswer === currentQuestion.answerIndex ? (
                  <>
                    <CheckCircle2 size={16} style={{ color: 'var(--accent-tertiary)' }} />
                    <span>Correct Answer</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} style={{ color: 'var(--color-urgent-important)' }} />
                    <span>Incorrect Answer</span>
                  </>
                )}
              </div>
              <p className={styles.explanationText}>
                <strong>Explanation:</strong> {currentQuestion.explanation}
              </p>
            </div>
          )}

          {/* Next control */}
          {selectedAnswer !== null && (
            <button 
              onClick={nextQuestion} 
              className="btn-primary" 
              style={{ alignSelf: 'flex-end' }}
            >
              <span>{currentIndex === quiz.length - 1 ? 'Finish Challenge' : 'Next Question'}</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      {gameState === 'complete' && (
        <div className={`${styles.completeCard} glass-panel animate-fade-in`}>
          <Trophy size={64} style={{ color: 'var(--color-not-urgent-important)', marginBottom: '16px' }} />
          <h3 className={styles.title}>Challenge Completed!</h3>
          
          <div className={styles.scoreCircleWrapper}>
            <span className={styles.scoreValue}>{score} / {quiz.length}</span>
          </div>

          <p className={styles.desc} style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600 }}>
            {getFeedbackMessage()}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={startQuiz} className="btn-primary">
              <RotateCcw size={16} /> Restart Challenge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
