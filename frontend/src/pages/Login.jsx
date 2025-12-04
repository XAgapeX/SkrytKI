import { useState, useContext } from "react";
import { AuthContext } from "../AuthContext";

export default function Login() {
  const { login, user } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await login(email, password);
      setMsg("Logged in!");
    } catch (err) {
      setMsg(err.response?.data?.error || "Login failed");
    }
  }

  if (user)
    return (
      <div>
        <h3>Welcome, {user.email} ({user.role})</h3>
      </div>
    );

  return (
    <form onSubmit={handleSubmit}>
      <h2>Login</h2>
      <input value={email} placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      <button>Login</button>
      <p>{msg}</p>
    </form>
  );
}