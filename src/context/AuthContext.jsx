import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext();

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    async function register(email, password, displayName) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName,
                },
            },
        });

        if (error) throw error;
        
        // We no longer manually upsert here.
        // The 'handle_new_user' trigger in the database handles this automatically
        // and safely bypasses RLS during registration.

        return data;
    }

    async function login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', data.user.id);

        return data;
    }

    async function loginWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/coachtrack`,
            },
        });
        if (error) throw error;
        return data;
    }

    function logout() {
        return supabase.auth.signOut();
    }

    async function fetchUserProfile(user) {
        if (!user) {
            setUserProfile(null);
            sessionStorage.removeItem('ct_profile');
            return;
        }

        // Try to load from cache first for instant UI
        const cached = sessionStorage.getItem('ct_profile');
        if (cached) {
            try {
                setUserProfile(JSON.parse(cached));
            } catch (e) {
                console.warn('[Snapshot] Cache corrupt');
            }
        }

        console.log('[Auth Profile] Syncing for user:', user.id);
        
        const queryPromise = supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile query timed out')), 8000)
        );

        try {
            const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

            if (error) {
                if (error.code === 'PGRST116') { // No profile found
                    const profileData = {
                        id: user.id,
                        email: user.email,
                        display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || 'Tutor',
                        role: 'tutor',
                        is_approved: true,
                        created_at: new Date().toISOString()
                    };
                    
                    const { error: insertError } = await supabase.from('users').upsert(profileData);
                    if (insertError) throw insertError;
                    
                    setUserProfile(profileData);
                    sessionStorage.setItem('ct_profile', JSON.stringify(profileData));
                } else {
                    throw error;
                }
            } else {
                setUserProfile(data);
                sessionStorage.setItem('ct_profile', JSON.stringify(data));
            }
        } catch (err) {
            console.error('[Auth Profile] Sync fallback:', err.message);
            
            // If we don't even have a cached profile, set a basic one from metadata
            if (!sessionStorage.getItem('ct_profile')) {
                const basicProfile = {
                    id: user.id,
                    email: user.email,
                    display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || 'Teacher',
                    role: 'tutor',
                    is_approved: true
                };
                setUserProfile(basicProfile);
                sessionStorage.setItem('ct_profile', JSON.stringify(basicProfile));
            }
        }
    }

    useEffect(() => {
        let isMounted = true;
        
        async function initAuth() {
            try {
                // 1. Get initial session
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user ?? null;
                
                if (isMounted) {
                    setCurrentUser(user);
                    // Set loading false immediately to allow app rendering
                    setLoading(false);
                    
                    if (user) {
                        // Fetch/Sync profile in background
                        fetchUserProfile(user);
                    }
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
                if (isMounted) setLoading(false);
            }
        }

        initAuth();

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth event:', event);
            const user = session?.user ?? null;
            
            if (isMounted) {
                setCurrentUser(user);
                
                if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                    fetchUserProfile(user);
                } else if (event === 'SIGNED_OUT') {
                    setUserProfile(null);
                    sessionStorage.removeItem('ct_profile');
                }
                
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const value = {
        currentUser,
        userProfile,
        loading,
        register,
        login,
        loginWithGoogle,
        logout,
        fetchUserProfile,
        isAdmin: userProfile?.role === 'admin',
        isApproved: userProfile?.is_approved === true,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
