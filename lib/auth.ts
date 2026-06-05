import { supabase, isSupabaseConfigured } from './supabase';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string; // Emoji avatar or description
}

const isBrowser = typeof window !== 'undefined';

// Predefined student-related avatars
export const STUDENT_AVATARS = [
  { id: 'grad', emoji: '🎓', label: 'Scholar' },
  { id: 'code', emoji: '💻', label: 'Techie' },
  { id: 'bio', emoji: '🧬', label: 'Scientist' },
  { id: 'art', emoji: '🎨', label: 'Creative' },
  { id: 'book', emoji: '📚', label: 'Bookworm' },
  { id: 'robot', emoji: '🤖', label: 'AI Builder' }
];

export const auth = {
  async signUp(email: string, password: string, name: string, avatarId: string): Promise<{ user: UserProfile | null; error: string | null }> {
    const avatar = STUDENT_AVATARS.find(a => a.id === avatarId)?.emoji || '🎓';
    
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, avatar }
        }
      });
      if (error) return { user: null, error: error.message };
      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || email,
          name: name,
          avatar: avatar
        };
        return { user: profile, error: null };
      }
    }

    // Simulated LocalStorage authentication
    if (!isBrowser) return { user: null, error: 'Browser environment required.' };

    const localUsersRaw = localStorage.getItem('smart_campus_auth_users');
    const localUsers: Array<UserProfile & { passwordHash: string }> = localUsersRaw ? JSON.parse(localUsersRaw) : [];

    // Check if user already exists
    if (localUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { user: null, error: 'Email already registered.' };
    }

    const newUser = {
      id: Math.random().toString(36).substring(2, 15),
      email,
      name,
      avatar,
      passwordHash: btoa(password) // Basic obfuscation for simulated db
    };

    localUsers.push(newUser);
    localStorage.setItem('smart_campus_auth_users', JSON.stringify(localUsers));

    // Sign in the newly created user
    const sessionUser: UserProfile = { id: newUser.id, email: newUser.email, name: newUser.name, avatar: newUser.avatar };
    localStorage.setItem('smart_campus_auth_session', JSON.stringify(sessionUser));

    return { user: sessionUser, error: null };
  },

  async signIn(email: string, password: string): Promise<{ user: UserProfile | null; error: string | null }> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message };
      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || email,
          name: data.user.user_metadata?.name || email.split('@')[0],
          avatar: data.user.user_metadata?.avatar || '🎓'
        };
        return { user: profile, error: null };
      }
    }

    // Simulated LocalStorage authentication
    if (!isBrowser) return { user: null, error: 'Browser environment required.' };

    const localUsersRaw = localStorage.getItem('smart_campus_auth_users');
    const localUsers: Array<UserProfile & { passwordHash: string }> = localUsersRaw ? JSON.parse(localUsersRaw) : [];

    const matched = localUsers.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === btoa(password)
    );

    if (!matched) {
      return { user: null, error: 'Invalid email or password.' };
    }

    const sessionUser: UserProfile = { id: matched.id, email: matched.email, name: matched.name, avatar: matched.avatar };
    localStorage.setItem('smart_campus_auth_session', JSON.stringify(sessionUser));

    return { user: sessionUser, error: null };
  },

  async signInGuest(): Promise<{ user: UserProfile; error: null }> {
    const guestUser: UserProfile = {
      id: 'guest_user',
      email: 'guest@smartcampus.edu',
      name: 'Guest Scholar',
      avatar: '🎓'
    };

    if (isBrowser) {
      localStorage.setItem('smart_campus_auth_session', JSON.stringify(guestUser));
    }

    return { user: guestUser, error: null };
  },

  async signOut(): Promise<{ error: string | null }> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) return { error: error.message };
    }

    if (isBrowser) {
      localStorage.removeItem('smart_campus_auth_session');
    }
    
    return { error: null };
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        return {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          avatar: user.user_metadata?.avatar || '🎓'
        };
      }
    }

    if (!isBrowser) return null;

    const sessionRaw = localStorage.getItem('smart_campus_auth_session');
    return sessionRaw ? JSON.parse(sessionRaw) : null;
  }
};
