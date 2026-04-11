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
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error && error.code === 'PGRST116') {
                // Profile not found - create one for OAuth users
                console.log('Profile missing, creating for OAuth user:', user.email);
                const metadata = user.user_metadata || {};
                const newProfile = {
                    id: user.id,
                    display_name: metadata.full_name || metadata.display_name || user.email.split('@')[0],
                    email: user.email,
                    role: 'tutor',
                    is_approved: true,
                    last_login: new Date().toISOString()
                };

                const { error: insertError } = await supabase
                    .from('users')
                    .upsert(newProfile);

                if (insertError) {
                    console.error('Error creating auto-profile:', insertError);
                    setUserProfile(null);
                } else {
                    setUserProfile(newProfile);
                }
            } else if (error) {
                console.error('Error fetching user profile:', error);
                setUserProfile(null);
            } else {
                setUserProfile(data);
            }
        } catch (err) {
            console.error('Unexpected error fetching user profile:', err);
            setUserProfile(null);
        }
    }

    useEffect(() => {
        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            const user = session?.user ?? null;
            setCurrentUser(user);
            fetchUserProfile(user).finally(() => setLoading(false));
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            const user = session?.user ?? null;
            setCurrentUser(user);
            
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
                await fetchUserProfile(user);
            } else if (event === 'SIGNED_OUT') {
                setUserProfile(null);
            }
            
            setLoading(false);
        });

        return () => subscription.unsubscribe();
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
