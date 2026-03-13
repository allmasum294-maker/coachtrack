import { createContext, useContext, useState, useEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

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
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });

        const profile = {
            displayName,
            email,
            role: 'teacher',
            isApproved: false,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
        };

        await setDoc(doc(db, 'users', cred.user.uid), profile);
        setUserProfile({ ...profile, uid: cred.user.uid });
        return cred;
    }

    async function login(email, password) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await setDoc(
            doc(db, 'users', cred.user.uid),
            { lastLogin: serverTimestamp() },
            { merge: true }
        );
        return cred;
    }

    function logout() {
        return signOut(auth);
    }

    async function fetchUserProfile(user) {
        if (!user) {
            setUserProfile(null);
            return;
        }
        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
                setUserProfile({ uid: user.uid, ...snap.data() });
            } else {
                setUserProfile(null);
            }
        } catch (err) {
            console.error('Error fetching user profile:', err);
            setUserProfile(null);
        }
    }

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            await fetchUserProfile(user);
            setLoading(false);
        });
        return unsub;
    }, []);

    const value = {
        currentUser,
        userProfile,
        loading,
        register,
        login,
        logout,
        fetchUserProfile,
        isAdmin: userProfile?.role === 'admin',
        isApproved: userProfile?.isApproved === true,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
