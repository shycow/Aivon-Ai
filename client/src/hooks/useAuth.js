import { useEffect, useState } from "react";
import { onAuth, loginWithGoogle, loginWithEmail, signupWithEmail, logout } from "../lib/firebase/client.js";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuth((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return {
    user,
    loading,
    loginWithGoogle,
    loginWithEmail,
    signupWithEmail,
    logout
  };
}