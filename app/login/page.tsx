'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, STUDENT_AVATARS } from '@/lib/auth';
import { useApp } from '@/components/AppContext';
import styles from '@/styles/components/LoginPage.module.css';
import { 
  Sparkles, 
  LogIn, 
  UserPlus, 
  Eye, 
  EyeOff, 
  User, 
  Lock, 
  Mail,
  GraduationCap
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { addNotification } = useApp();
  
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState('grad');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignup && !name)) {
      addNotification('Please fill in all required fields.', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        const { user, error } = await auth.signUp(email, password, name, avatarId);
        if (error) {
          addNotification(error, 'error');
        } else {
          addNotification(`Welcome, ${name}! Your account has been created.`, 'success');
          router.replace('/');
        }
      } else {
        const { user, error } = await auth.signIn(email, password);
        if (error) {
          addNotification(error, 'error');
        } else {
          addNotification(`Welcome back, ${user?.name}!`, 'success');
          router.replace('/');
        }
      }
    } catch (err) {
      addNotification('An unexpected error occurred during authentication.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Guest Bypass
  const handleGuestMode = async () => {
    setLoading(true);
    try {
      await auth.signInGuest();
      addNotification('Logged in as Guest Scholar (Simulated Mode)', 'info');
      router.replace('/');
    } catch (err) {
      addNotification('Failed to enter Guest Mode', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.perspective}>
        <div className={`${styles.cardInner} ${isSignup ? styles.cardInnerFlipped : ''}`}>
          
          {/* FRONT FACE: SIGN IN */}
          <div className={`${styles.cardFace} ${styles.cardFront}`}>
            <div className={styles.header}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--gradient-brand)', borderRadius: '16px', color: 'white', marginBottom: '14px' }}>
                <GraduationCap size={32} />
              </div>
              <h2 className={styles.title}>Smart Campus Hub</h2>
              <p className={styles.subtitle}>Log in to access your dashboard, schedules & notes</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>University Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="email" 
                    placeholder="student@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '44px' }}
                    required
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '44px', paddingRight: '44px' }}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
              >
                <LogIn size={18} />
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              </button>
            </form>

            <div className={styles.divider}>or</div>

            <button 
              onClick={handleGuestMode}
              className={styles.guestBtn}
              disabled={loading}
            >
              <Sparkles size={18} />
              <span>Explore as Guest (Judge Bypass)</span>
            </button>

            <div className={styles.footer}>
              New to the campus hub?{' '}
              <button className={styles.toggleBtn} onClick={() => setIsSignup(true)}>
                Create Account
              </button>
            </div>
          </div>

          {/* BACK FACE: SIGN UP */}
          <div className={`${styles.cardFace} ${styles.cardBack}`}>
            <div className={styles.header}>
              <h2 className={styles.title}>Register Account</h2>
              <p className={styles.subtitle}>Join your virtual campus workspace</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Alex Morgan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '44px' }}
                    required={isSignup}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="email" 
                    placeholder="alex@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '44px' }}
                    required={isSignup}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '44px', paddingRight: '44px' }}
                    required={isSignup}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Select Avatar</label>
                <div className={styles.avatarGrid}>
                  {STUDENT_AVATARS.map((avatar) => (
                    <div 
                      key={avatar.id}
                      onClick={() => setAvatarId(avatar.id)}
                      className={`${styles.avatarItem} ${avatarId === avatar.id ? styles.avatarActive : ''}`}
                      title={avatar.label}
                    >
                      <span>{avatar.emoji}</span>
                      <span className={styles.avatarLabel}>{avatar.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
              >
                <UserPlus size={18} />
                <span>{loading ? 'Creating...' : 'Register'}</span>
              </button>
            </form>

            <div className={styles.footer}>
              Already have an account?{' '}
              <button className={styles.toggleBtn} onClick={() => setIsSignup(false)}>
                Sign In
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
