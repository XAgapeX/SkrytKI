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

    const [info, setInfo] = useState("");
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setInfo("");

        if (
            !firstName.trim() ||
            !lastName.trim() ||
            !email.trim() ||
            !password ||
            !password2 ||
            !phone.trim()
        ) {
            setInfo("Uzupełnij wszystkie pola");
            return;
        }

        if (password.length < 8) {
            setInfo("Hasło musi mieć co najmniej 8 znaków");
            return;
        }

        if (password !== password2) {
            setInfo("Hasła muszą być takie same");
            return;
        }

        if (!acceptTerms || !acceptPrivacy) {
            setInfo("Musisz zaakceptować regulamin i politykę prywatności");
            return;
        }

        if (!email.toLowerCase().endsWith("@skrytki.pl")) {
            setInfo("Email musi kończyć się na @skrytki.pl");
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
                setInfo("Błąd rejestracji");
            }
        } catch (err) {
            setInfo(err.response?.data?.error || "Registration failed");
        }
    }

    return (
        <div className="register-page">
            <Navbar />

            <main className="register-main">
                <section className="register-left">
                    <img
                        src={logo}
                        alt="SkrytKI logo"
                        className="register-biglogo"
                    />
                    <div className="register-brand">SkrytKI</div>
                </section>

                <section className="register-right">
                    <form
                        className="register-card"
                        onSubmit={handleSubmit}
                        noValidate
                    >
                        <h2 className="register-title">REJESTRACJA</h2>

                        <input
                            className="field"
                            placeholder="Imię"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                        />

                        <input
                            className="field"
                            placeholder="Nazwisko"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                        />

                        <input
                            className="field"
                            placeholder="Email (@skrytki.pl)"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <input
                            className="field"
                            type="password"
                            placeholder="Hasło"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <input
                            className="field"
                            type="password"
                            placeholder="Potwierdź hasło"
                            value={password2}
                            onChange={(e) => setPassword2(e.target.value)}
                        />

                        <input
                            className="field"
                            placeholder="Numer telefonu"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />

                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={acceptTerms}
                                    onChange={(e) =>
                                        setAcceptTerms(e.target.checked)
                                    }
                                />
                                Akceptuję{" "}
                                <a
                                    href="/regulamin"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    regulamin
                                </a>
                            </label>

                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={acceptPrivacy}
                                    onChange={(e) =>
                                        setAcceptPrivacy(e.target.checked)
                                    }
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
                                    onChange={(e) =>
                                        setMarketing(e.target.checked)
                                    }
                                />
                                Zgoda marketingowa (opcjonalnie)
                            </label>
                        </div>

                        <button className="primary-btn" type="submit">
                            ZAREJESTRUJ
                        </button>

                        {info && <p className="password-hint">{info}</p>}
                    </form>
                </section>
            </main>
        </div>
    );
}
