import { useState } from "react";
import { loginWithEmail, loginWithGoogle, signupWithEmail } from "../../lib/firebase/client.js";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    try {
      if (mode === "login") {
        await loginWithEmail(email, password);
      } else {
        await signupWithEmail(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h2>Aivon AI</h2>
        <p>Sign in to continue.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error ? <div className="error-banner">{error}</div> : null}
        <button onClick={handleSubmit}>{mode === "login" ? "Log in" : "Sign up"}</button>
        <button className="ghost" onClick={() => loginWithGoogle()}>
          Continue with Google
        </button>
        <button className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
        </button>
      </div>
    </div>
  );
}