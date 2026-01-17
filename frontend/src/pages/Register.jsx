import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import Navbar from "../components/Navbar";
import logo from "../assets/logo.png";
import "./Register.css";

export default function Register() {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [phone, setPhone] = useState("");

    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptPrivacy, setAcceptPrivacy] = useState(false);
    const [marketing, setMarketing] = useState(false);

    const [msg, setMsg] = useState("");
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setMsg("");

        if (password !== password2) {
            setMsg("Hasła nie są takie same");
            return;
        }

        if (!acceptTerms || !acceptPrivacy) {
            setMsg("Musisz zaakceptować regulamin i politykę prywatności");
            return;
        }

        if (!email.toLowerCase().endsWith("@skrytki.pl")) {
            setMsg("Email musi kończyć się na @skrytki.pl");
            return;
        }

        try {
            const res = await API.post("/register", {
                firstName,
                lastName,
                email,
                password,
                phone,
                acceptTerms,
                acceptPrivacy,
                marketing,
            });

            if (res.data.ok) {
                navigate("/register-success");
            } else {
                setMsg("Błąd rejestracji");
            }
        } catch (err) {
            setMsg(err.response?.data?.error || "Registration failed");
        }
    }

    return (
        <div className="register-page">
            <Navbar />

            <main className="register-main">
                <section className="register-left">
                    <img src={logo} alt="SkrytKI logo" className="register-biglogo" />
                    <div className="register-brand">SkrytKI</div>
                </section>

                <section className="register-right">
                    <form className="register-card" onSubmit={handleSubmit}>
                        <h2 className="register-title">REJESTRACJA</h2>

                        <input
                            className="field"
                            value={firstName}
                            placeholder="Imię"
                            onChange={(e) => setFirstName(e.target.value)}
                        />

                        <input
                            className="field"
                            value={lastName}
                            placeholder="Nazwisko"
                            onChange={(e) => setLastName(e.target.value)}
                        />

                        <input
                            className="field"
                            value={email}
                            placeholder="Email (@skrytki.pl)"
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        <input
                            className="field"
                            type="password"
                            value={password}
                            placeholder="Hasło"
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <input
                            className="field"
                            type="password"
                            value={password2}
                            placeholder="Potwierdź hasło"
                            onChange={(e) => setPassword2(e.target.value)}
                            required
                        />

                        <input
                            className="field"
                            value={phone}
                            placeholder="Numer telefonu"
                            onChange={(e) => setPhone(e.target.value)}
                        />

                        {/* CHECKBOXY */}
                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={acceptTerms}
                                    onChange={(e) => setAcceptTerms(e.target.checked)}
                                    required
                                />
                                Akceptuję{" "}
                                <a href="/regulamin" target="_blank" rel="noreferrer">
                                    regulamin
                                </a>
                            </label>

                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={acceptPrivacy}
                                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                                    required
                                />
                                Akceptuję{" "}
                                <a
                                    href="/polityka-prywatnosci"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    politykę prywatności
                                </a>
                            </label>

                            <label className="checkbox-label optional">
                                <input
                                    type="checkbox"
                                    checked={marketing}
                                    onChange={(e) => setMarketing(e.target.checked)}
                                />
                                Wyrażam zgodę na otrzymywanie informacji marketingowych
                                (opcjonalnie)
                            </label>
                        </div>

                        <button className="primary-btn" type="submit">
                            ZAREJESTRUJ
                        </button>

                        {msg && <p className="msg">{msg}</p>}
                    </form>
                </section>
            </main>
        </div>
    );
}
