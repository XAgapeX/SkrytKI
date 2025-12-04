import { useState } from "react";
import API from "../api";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await API.post("/register", { email, password });
      setMsg(res.data.ok ? "Registered successfully!" : "Error");
    } catch (err) {
      setMsg(err.response?.data?.error || "Registration failed");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Register</h2>
      <input
        value={email}
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <button>Register</button>
      <p>{msg}</p>
    </form>
  );
}