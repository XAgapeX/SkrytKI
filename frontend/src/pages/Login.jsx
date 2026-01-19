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
    const [info, setInfo] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setInfo("");
        setLoading(true);

        if (!loginValue.trim() || !password) {
            setInfo("Uzupełnij login i hasło");
            setLoading(false);
            return;
        }

        try {
            const user = await login(loginValue, password);

            if (user.role === "admin") navigate("/admin");
            else if (user.role === "courier") navigate("/courier");
            else if (user.role === "service") navigate("/service");
            else navigate("/panel");
        } catch {
            setInfo("Błędny login lub hasło");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <Navbar />

            <main className="center">
                <form
                    className="login-card"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <div className="avatar">
                        <img
                            src={logo}
                            alt="SkrytKI logo"
                            className="avatar-logo"
                        />
                    </div>

                    <h2 className="title">LOGIN</h2>

                    <input
                        className="field"
                        placeholder="Login"
                        value={loginValue}
                        onChange={(e) => setLoginValue(e.target.value)}
                        autoComplete="username"
                    />

                    <input
                        className="field"
                        type="password"
                        placeholder="Hasło"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                    />

                    <button
                        className="primary-btn"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? "LOGOWANIE..." : "LOGIN"}
                    </button>

                    {info && <p className="password-hint">{info}</p>}

                    <div className="hint">
                        Nie posiadasz konta?{" "}
                        <Link to="/register">Zarejestruj się tutaj</Link>
                    </div>
                </form>
            </main>
        </div>
    );
}
