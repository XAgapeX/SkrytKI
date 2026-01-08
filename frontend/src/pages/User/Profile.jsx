import { useState } from "react";
import "./Profile.css";

export default function Profile() {
    const [isEditing, setIsEditing] = useState(false);

    return (
        <div className="profile-page">
            <div className="profile-content">

                {/* LEWA KOLUMNA */}
                <div className="profile-left-column">
                    <div className="profile-left">
                        <h3 className="profile-title-left">Moje Dane:</h3>

                        <p><strong>Imię:</strong><br />Anna</p>
                        <p><strong>Nazwisko:</strong><br />Nowak</p>
                        <p><strong>Login:</strong><br />user@skrytki.pl</p>
                        <p><strong>Hasło:</strong><br />************</p>
                        <p><strong>Numer telefonu:</strong><br />12345678</p>

                        <button
                            className="primary-btn"
                            onClick={() => setIsEditing(true)}
                        >
                            Edytuj dane
                        </button>
                    </div>
                </div>

                {/* PRAWA KOLUMNA */}
                <div className={`profile-right ${isEditing ? "visible" : "hidden"}`}>
                    <button
                        className="profile-close"
                        onClick={() => setIsEditing(false)}
                    >
                        X
                    </button>

                    <h3 className="profile-title-right">Edytuj Dane</h3>

                    <input className="field" placeholder="Imię" />
                    <input className="field" placeholder="Nazwisko" />
                    <input className="field" placeholder="Login" />
                    <input className="field" type="password" placeholder="Nowe hasło" />
                    <input className="field" type="password" placeholder="Podaj hasło ponownie" />
                    <input className="field" placeholder="Numer telefonu" />

                    <button
                        className="primary-btn profile-save"
                        onClick={() => setIsEditing(false)}
                    >
                        Zapisz
                    </button>
                </div>

            </div>
        </div>
    );
}
