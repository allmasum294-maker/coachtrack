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

        // Note: Supabase trigger might handle profile creation, 
        // but we'll do it manually here if not set up in DB.
        const profile = {
            id: data.user.id,
            display_name: displayName,
            email: email,
            role: 'tutor',
            is_approved: true,
        };

        const { error: profileError } = await supabase
            .from('users')
            .upsert(profile);

        if (profileError) console.error('Error creating profile:', profileError);

        setUserProfile(profile);
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
            return;
        }

        console.log('[Auth Profile] Fetching for user:', user.id);
        
        // Timeout for the query
        const queryPromise = supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile query timed out')), 5000)
        );

        try {
            const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

            if (error) {
                console.error('[Auth Profile] Error:', error.message, error.details);
                if (error.code === 'PGRST116') { // No profile found
                    console.log('[Auth Profile] No profile found, creating one...');
                    const newProfile = {
                        id: user.id,
                        email: user.email,
                        displayName: user.user_metadata?.full_name || user.user_metadata?.name || 'Tutor',
                        role: 'tutor',
                        is_approved: true,
                        created_at: new Date().toISOString()
                    };
                    
                    const { error: insertError } = await supabase.from('users').upsert(newProfile);
                    if (insertError) {
                        console.error('[Auth Profile] Insert error:', insertError);
                        throw insertError;
                    }
                    setUserProfile(newProfile);
                } else {
                    throw error;
                }
            } else {
                console.log('[Auth Profile] Profile loaded successfully');
                setUserProfile(data);
            }
        } catch (err) {
            console.error('[Auth Profile] Unexpected error:', err.message);
            // Fallback: Use minimal profile if DB fails but user is authenticated
            setUserProfile({
                id: user.id,
                email: user.email,
                displayName: user.user_metadata?.full_name || 'Teacher',
                role: 'tutor',
                is_approved: true
            });
        }
    }

    useEffect(() => {
        let isMounted = true;
        
        // Safety timeout to prevent infinite spinner
        const safetyTimeout = setTimeout(() => {
            if (isMounted) {
                console.warn('Auth initialization taking too long, forcing loading to false');
                setLoading(false);
            }
        }, 3000);

        async function initAuth() {
            try {
                // 1. Get initial session
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user ?? null;
                
                if (isMounted) {
                    setCurrentUser(user);
                    if (user) {
                        await fetchUserProfile(user);
                    }
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
            } finally {
                if (isMounted) {
                    setLoading(false);
                    clearTimeout(safetyTimeout);
                }
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
                    await fetchUserProfile(user);
                } else if (event === 'SIGNED_OUT') {
                    setUserProfile(null);
                }
                
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
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
