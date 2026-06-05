'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, Lecture } from '@/lib/db';
import { useApp } from '@/components/AppContext';
import QuizArena from '@/components/QuizArena';
import styles from '@/styles/components/LecturesPage.module.css';
import { 
  Plus, 
  Mic, 
  Square, 
  FileText, 
  Upload, 
  BookOpen, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  RotateCw,
  Trash2,
  Send,
  HelpCircle
} from 'lucide-react';

export default function LecturesPage() {
  const { userApiKey, addNotification } = useApp();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'flashcards' | 'quiz' | 'chat'>('summary');
  
  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [textNotes, setTextNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Audio Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Note Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Flashcards state
  const [cardIndex, setCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Load lectures
  useEffect(() => {
    async function load() {
      try {
        const fetched = await db.getLectures();
        setLectures(fetched);
        if (fetched.length > 0) {
          setSelectedLecture(fetched[0]);
        }
      } catch (err) {
        addNotification('Could not load lecture summaries', 'error');
      }
    }
    load();
  }, [addNotification]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto clean intervals
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Format record timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all media tracks
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        addNotification('Lecture recording captured! Processing audio...', 'info');
        
        // Process the audio blob
        await processAudioLecture(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      
      timerIntervalRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      addNotification('Microphone access denied or unsupported format.', 'error');
    }
  };

  // Stop Voice Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  // Convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Process voice/audio blob
  const processAudioLecture = async (audioBlob: Blob) => {
    setProcessing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const lectureTitle = title.trim() || `Lecture ${new Date().toLocaleDateString()}`;

      const res = await fetch('/api/summarize-lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          mimeType: audioBlob.type,
          title: lectureTitle,
          customKey: userApiKey
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Save processed lecture
      const created = await db.addLecture({
        title: lectureTitle,
        created_at: new Date().toISOString(),
        summary: data.summary || 'Summary generation failed.',
        transcript: data.transcript || '',
        flashcards: data.flashcards || [],
        quiz: data.quiz || []
      });

      setLectures(prev => [created, ...prev]);
      setSelectedLecture(created);
      setIsCreating(false);
      setTitle('');
      addNotification('Lecture audio transcribed and summarized!', 'success');
      setActiveTab('summary');

    } catch (err: any) {
      addNotification(`Audio processing failed: ${err.message || 'Check your Gemini key'}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Process text notes / PDF
  const handleProcessTextLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !textNotes.trim()) {
      addNotification('Please enter a title and paste some notes', 'warning');
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/summarize-lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textNotes,
          title: title,
          customKey: userApiKey
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const created = await db.addLecture({
        title: title,
        created_at: new Date().toISOString(),
        summary: data.summary || 'Summary generation failed.',
        flashcards: data.flashcards || [],
        quiz: data.quiz || []
      });

      setLectures(prev => [created, ...prev]);
      setSelectedLecture(created);
      setIsCreating(false);
      setTitle('');
      setTextNotes('');
      addNotification('Notes summarized successfully!', 'success');
      setActiveTab('summary');

    } catch (err: any) {
      addNotification(`Processing failed: ${err.message || 'Check your Gemini key'}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Handle PDF file upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      addNotification('Please upload a PDF file', 'warning');
      return;
    }

    setProcessing(true);
    addNotification('Uploading and parsing PDF...', 'info');

    try {
      const base64Pdf = await blobToBase64(file);
      const lectureTitle = title.trim() || file.name.replace('.pdf', '');

      const res = await fetch('/api/summarize-lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Pdf,
          mimeType: 'application/pdf',
          title: lectureTitle,
          customKey: userApiKey
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const created = await db.addLecture({
        title: lectureTitle,
        created_at: new Date().toISOString(),
        summary: data.summary || 'Summary generation failed.',
        flashcards: data.flashcards || [],
        quiz: data.quiz || []
      });

      setLectures(prev => [created, ...prev]);
      setSelectedLecture(created);
      setIsCreating(false);
      setTitle('');
      addNotification('PDF lecture slide notes processed!', 'success');
      setActiveTab('summary');

    } catch (err: any) {
      addNotification(`PDF analysis failed: ${err.message || 'Check your Gemini key'}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Delete lecture
  const handleDeleteLecture = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const success = await db.deleteLecture(id);
      if (success) {
        setLectures(prev => prev.filter(l => l.id !== id));
        if (selectedLecture?.id === id) {
          const remaining = lectures.filter(l => l.id !== id);
          setSelectedLecture(remaining.length > 0 ? remaining[0] : null);
        }
        addNotification('Lecture summary deleted', 'success');
      }
    } catch (err) {
      addNotification('Could not delete summary', 'error');
    }
  };

  // Submit Note Chat Message
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedLecture) return;

    const userMsg = { role: 'user' as const, content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const contextMaterial = `
        ${selectedLecture.summary}
        ${selectedLecture.transcript ? `\nFull Transcript:\n${selectedLecture.transcript}` : ''}
      `;

      const res = await fetch('/api/chat-lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lectureTitle: selectedLecture.title,
          lectureContent: contextMaterial,
          messages: [...chatMessages, userMsg],
          customKey: userApiKey
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (err: any) {
      addNotification(`Chat failed: ${err.message}`, 'error');
    } finally {
      setChatLoading(false);
    }
  };

  // Reset chat messages when switching lectures
  useEffect(() => {
    setChatMessages([
      { role: 'assistant', content: "Hi! I'm your note-grounded tutor. Ask me anything about this lecture's topics, and I'll explain it using details from your notes." }
    ]);
    setCardIndex(0);
    setIsCardFlipped(false);
  }, [selectedLecture]);

  // Render basic markdown formatting manually
  const renderMarkdown = (md: string) => {
    if (!md) return null;
    
    // Simple parser for headings and list items
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx}>{line.substring(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx}>{line.substring(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx}>{line.substring(4)}</h3>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        // Simple bold parser
        const text = line.substring(2);
        return <li key={idx} dangerouslySetInnerHTML={{ __html: parseBold(text) }} />;
      }
      return <p key={idx} dangerouslySetInnerHTML={{ __html: parseBold(line) }} />;
    });
  };

  // Bold text helper
  const parseBold = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, background: 'var(--gradient-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Lecture Companion
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Transcribe live lectures, summarize reading notes, study flashcards, and chat with an AI academic tutor.</p>
      </div>

      <div className={styles.container}>
        {/* Left Column: Lectures list */}
        <div className={styles.leftCol}>
          <button 
            onClick={() => setIsCreating(true)}
            className={styles.newLectureBtn}
          >
            <Plus size={20} />
            <span>Add Lecture Note</span>
          </button>

          <div className={styles.lecturesList}>
            {lectures.map((lecture) => (
              <div 
                key={lecture.id}
                onClick={() => {
                  setSelectedLecture(lecture);
                  setIsCreating(false);
                }}
                className={`${styles.lectureItem} glass-panel ${selectedLecture?.id === lecture.id && !isCreating ? styles.lectureItemActive : ''}`}
              >
                <BookOpen className={styles.lectureItemIcon} size={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.lectureTitle}>{lecture.title}</div>
                  <div className={styles.lectureDate}>
                    {new Date(lecture.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <button 
                  onClick={(e) => handleDeleteLecture(lecture.id, e)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Creation Panel or Detail Panel */}
        <div className={styles.rightCol}>
          {isCreating ? (
            /* Creator panel UI */
            <div className={`${styles.creatorCard} glass-panel`}>
              <div className={styles.creatorHeader}>
                <h2 className={styles.creatorTitle}>Process New Lecture Notes</h2>
                <button className="btn-secondary" onClick={() => setIsCreating(false)}>Cancel</button>
              </div>

              <div>
                <input 
                  type="text" 
                  placeholder="Lecture Title (e.g. CS101: Big O Notation)" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                  style={{ marginBottom: '16px' }}
                  required
                />
              </div>

              {/* Toggle record or text input */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Voice Recorder */}
                <div className={styles.recorderSection}>
                  <Mic size={32} style={{ color: 'var(--accent-secondary)' }} />
                  <div>
                    <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Record Lecture Audio</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Record lectures directly from your browser microphone.</p>
                  </div>

                  {isRecording ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-urgent-important)' }}>
                        {formatTime(recordDuration)}
                      </span>
                      <div className={styles.audioWaveform}>
                        {[...Array(6)].map((_, i) => (
                          <span key={i} className={`${styles.waveBar} ${styles.waveBarActive}`} style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                      <button 
                        onClick={stopRecording}
                        className={`${styles.recordBtn} ${styles.recordBtnActive}`}
                      >
                        <Square size={24} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={startRecording}
                      disabled={processing}
                      className={styles.recordBtn}
                    >
                      <Mic size={24} />
                    </button>
                  )}
                </div>

                {/* Text / PDF Importer */}
                <div className={styles.recorderSection} style={{ padding: '30px' }}>
                  <FileText size={32} style={{ color: 'var(--accent-tertiary)' }} />
                  <div>
                    <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Upload Lecture Slide PDF</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Import raw text notes or slide PDF decks.</p>
                  </div>
                  
                  <label className="btn-secondary" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', marginBottom: '10px' }}>
                    <Upload size={16} />
                    <span>Choose PDF File</span>
                    <input 
                      type="file" 
                      accept=".pdf" 
                      onChange={handlePdfUpload} 
                      style={{ display: 'none' }}
                      disabled={processing}
                    />
                  </label>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0' }}>— OR PASTE TEXT NOTES —</div>

                  <form onSubmit={handleProcessTextLecture} style={{ width: '100%' }}>
                    <textarea 
                      placeholder="Paste your raw copy-pasted reading notes or class transcript here..." 
                      value={textNotes}
                      onChange={(e) => setTextNotes(e.target.value)}
                      className="form-input"
                      style={{ minHeight: '80px', fontSize: '12px', marginBottom: '12px' }}
                    />
                    <button 
                      type="submit" 
                      disabled={processing}
                      className="btn-primary" 
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Sparkles size={16} />
                      <span>Summarize Notes</span>
                    </button>
                  </form>
                </div>
              </div>

              {processing && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px' }}>
                  <span className={styles.loadingSpinner} style={{ width: '30px', height: '30px' }} />
                  <span style={{ fontSize: '14px', color: 'var(--accent-primary)', fontWeight: 600 }}>Gemini AI is analyzing your lecture resources...</span>
                </div>
              )}
            </div>
          ) : selectedLecture ? (
            /* Selected Lecture View (Tabs) */
            <div className="glass-panel" style={{ padding: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800 }}>{selectedLecture.title}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Processed on {new Date(selectedLecture.created_at).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                </div>
              </div>

              {/* Tab Header */}
              <div className={styles.tabHeader}>
                <button 
                  onClick={() => setActiveTab('summary')}
                  className={`${styles.tabBtn} ${activeTab === 'summary' ? styles.tabBtnActive : ''}`}
                >
                  Summary
                </button>
                <button 
                  onClick={() => setActiveTab('flashcards')}
                  className={`${styles.tabBtn} ${activeTab === 'flashcards' ? styles.tabBtnActive : ''}`}
                >
                  Flashcards
                </button>
                <button 
                  onClick={() => setActiveTab('quiz')}
                  className={`${styles.tabBtn} ${activeTab === 'quiz' ? styles.tabBtnActive : ''}`}
                >
                  Quiz Challenge
                </button>
                <button 
                  onClick={() => setActiveTab('chat')}
                  className={`${styles.tabBtn} ${activeTab === 'chat' ? styles.tabBtnActive : ''}`}
                >
                  Chat with Notes
                </button>
              </div>

              {/* Tab Content */}
              <div className={styles.tabContent}>
                {activeTab === 'summary' && (
                  <div className={styles.markdownContent}>
                    {renderMarkdown(selectedLecture.summary)}
                  </div>
                )}

                {activeTab === 'flashcards' && (
                  <div className={styles.flashcardContainer}>
                    {selectedLecture.flashcards && selectedLecture.flashcards.length > 0 ? (
                      <>
                        <div className={styles.cardPerspective}>
                          <div 
                            onClick={() => setIsCardFlipped(!isCardFlipped)}
                            className={`${styles.cardInner} ${isCardFlipped ? styles.cardInnerFlipped : ''}`}
                          >
                            {/* Front */}
                            <div className={`${styles.cardFace} ${styles.cardFront}`}>
                              <span className={styles.cardLabel}>Question {cardIndex + 1} of {selectedLecture.flashcards.length}</span>
                              <p className={styles.cardText}>{selectedLecture.flashcards[cardIndex].front}</p>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RotateCw size={12} /> Click to flip
                              </span>
                            </div>

                            {/* Back */}
                            <div className={`${styles.cardFace} ${styles.cardBack}`}>
                              <span className={styles.cardLabel}>Answer</span>
                              <p className={styles.cardText}>{selectedLecture.flashcards[cardIndex].back}</p>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RotateCw size={12} /> Click to flip back
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={styles.navControls}>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '8px 16px' }}
                            disabled={cardIndex === 0}
                            onClick={() => {
                              setCardIndex(cardIndex - 1);
                              setIsCardFlipped(false);
                            }}
                          >
                            <ChevronLeft size={16} /> Prev
                          </button>
                          <span style={{ fontSize: '14px', fontWeight: 600 }}>
                            {cardIndex + 1} / {selectedLecture.flashcards.length}
                          </span>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '8px 16px' }}
                            disabled={cardIndex === selectedLecture.flashcards.length - 1}
                            onClick={() => {
                              setCardIndex(cardIndex + 1);
                              setIsCardFlipped(false);
                            }}
                          >
                            Next <ChevronRight size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No flashcards generated for this lecture.</p>
                    )}
                  </div>
                )}

                {activeTab === 'quiz' && (
                  <QuizArena quiz={selectedLecture.quiz || []} />
                )}

                {activeTab === 'chat' && (
                  <div className={styles.chatContainer}>
                    <div className={styles.messagesList}>
                      {chatMessages.map((msg, idx) => (
                        <div 
                          key={idx} 
                          className={`${styles.chatBubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot}`}
                        >
                          <div dangerouslySetInnerHTML={{ __html: parseBold(msg.content).replace(/\n/g, '<br/>') }} />
                        </div>
                      ))}
                      {chatLoading && (
                        <div className={`${styles.chatBubble} ${styles.bubbleBot}`} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span className={styles.loadingSpinner} style={{ width: '12px', height: '12px' }} />
                          <span>AI Coach is reading note context...</span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendChatMessage} className={styles.chatInputArea}>
                      <input 
                        type="text" 
                        placeholder="Ask about formulas, concepts, or details in these notes..." 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="form-input"
                        disabled={chatLoading}
                      />
                      <button 
                        type="submit" 
                        disabled={chatLoading || !chatInput.trim()}
                        className="btn-primary" 
                        style={{ padding: '12px' }}
                      >
                        <Send size={18} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h2 style={{ marginBottom: '8px' }}>No lecture notes processed yet</h2>
              <p style={{ marginBottom: '20px' }}>Record lectures or upload course materials to begin generating summaries and flashcards.</p>
              <button className="btn-primary" onClick={() => setIsCreating(true)}>
                <Plus size={16} /> Add Lecture Note
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
