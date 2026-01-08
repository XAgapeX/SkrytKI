import { useState, useContext } from "react";
import { AuthContext } from "../AuthContext";
import Navbar from "../components/Navbar";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./Login.css";

export default function Login() {
    const { login } = useContext(AuthContext);

    const [loginValue, setLoginValue] = useState("");
    const [password, setPassword] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setMsg("");
        setLoading(true);

        try {
            await login(loginValue, password);
            navigate("/panel");
        } catch (err) {
            setMsg(err?.response?.data?.error || "Nie udało się zalogować");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <Navbar />

            <main className="center">
                <form className="login-card" onSubmit={handleSubmit}>
                    <div className="avatar">
                        <img src={logo} alt="SkrytKI logo" className="avatar-logo" />
                    </div>

                    <h2 className="title">LOGIN</h2>

                    <input
                        className="field"
                        value={loginValue}
                        placeholder="Login"
                        onChange={(e) => setLoginValue(e.target.value)}
                        autoComplete="username"
                        required
                    />

                    <input
                        className="field"
                        type="password"
                        value={password}
                        placeholder="Hasło"
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                    />

                    <button className="primary-btn" type="submit" disabled={loading}>
                        {loading ? "LOGOWANIE..." : "LOGIN"}
                    </button>

                    <div className="hint">
                        Nie posiadasz konta? <Link to="/register">Zarejestruj się tutaj</Link>
                    </div>

                    {msg ? <p className="msg">{msg}</p> : null}
                </form>
            </main>
        </div>
    );
}
