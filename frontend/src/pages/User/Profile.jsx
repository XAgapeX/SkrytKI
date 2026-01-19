import { useState, useContext, useEffect } from "react";
import "./Profile.css";
import API from "../../api";
import { AuthContext } from "../../AuthContext";

export default function Profile() {
    const { user, refreshProfile } = useContext(AuthContext);

    const [isEditing, setIsEditing] = useState(false);
    const [isSendingDeleteRequest, setIsSendingDeleteRequest] = useState(false);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");

    const [editInfo, setEditInfo] = useState("");
    const [deleteInfo, setDeleteInfo] = useState("");

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            setPhone(user.phone || "");
        }
    }, [user]);

    async function saveProfile() {
        setEditInfo("");

        if (password) {
            if (password.length < 8) {
                setEditInfo("Hasło musi mieć co najmniej 8 znaków");
                return;
            }
            if (password !== password2) {
                setEditInfo("Hasła nie są takie same");
                return;
            }
        }

        const payload = {
            firstName: firstName.trim() || user.firstName,
            lastName: lastName.trim() || user.lastName,
            phone: phone.trim() || user.phone,
        };

        if (password) payload.password = password;

        try {
            await API.put("/profile", payload);
            await refreshProfile();
            setPassword("");
            setPassword2("");
            setIsEditing(false);
            setEditInfo("Dane zostały zapisane");
        } catch {
            setEditInfo("Nie udało się zapisać profilu");
        }
    }

    async function requestDeleteAccount() {
        if (isSendingDeleteRequest) return;

        setDeleteInfo("");
        setIsSendingDeleteRequest(true);

        try {
            await API.post("/profile/delete-request", {
                reason: "Prośba użytkownika",
            });
            setDeleteInfo("Prośba o usunięcie konta została wysłana");
        } catch (err) {
            if (err.response?.status === 409) {
                setDeleteInfo("Prośba o usunięcie konta została już wcześniej wysłana");
            } else {
                setDeleteInfo("Nie udało się wysłać prośby o usunięcie konta");
            }
        } finally {
            setIsSendingDeleteRequest(false);
        }
    }

    if (!user) return null;

    return (
        <div className="profile-page">
            <div className="profile-content">
                <div className="profile-left">
                    <div className="profile-left-header">
                        <h3>Moje dane</h3>
                    </div>

                    <div className="profile-info-slot">
                        {deleteInfo && (
                            <div className="profile-info left">
                                {deleteInfo}
                            </div>
                        )}
                    </div>

                    <div className="profile-readonly">
                        <div className="profile-row">
                            <label>Imię</label>
                            <div className="profile-input">{user.firstName}</div>
                        </div>

                        <div className="profile-row">
                            <label>Nazwisko</label>
                            <div className="profile-input">{user.lastName}</div>
                        </div>

                        <div className="profile-row">
                            <label>Login</label>
                            <div className="profile-input">{user.email}</div>
                        </div>

                        <div className="profile-row">
                            <label>Hasło</label>
                            <div className="profile-input">************</div>
                        </div>

                        <div className="profile-row">
                            <label>Numer telefonu</label>
                            <div className="profile-input">
                                {user.phone || "—"}
                            </div>
                        </div>
                    </div>

                    <div className="profile-actions">
                        <button
                            className="primary-btn"
                            onClick={() => {
                                setEditInfo("");
                                setIsEditing(true);
                            }}
                        >
                            Edytuj dane
                        </button>

                        <button
                            className="primary-btn danger"
                            onClick={requestDeleteAccount}
                            disabled={isSendingDeleteRequest}
                        >
                            {isSendingDeleteRequest
                                ? "Wysyłanie..."
                                : "Poproś o usunięcie"}
                        </button>
                    </div>
                </div>

                <div className={`profile-right ${isEditing ? "visible" : "hidden"}`}>
                    <div className="profile-right-header">
                        <h3>Edytuj dane</h3>
                        <button
                            className="profile-close"
                            onClick={() => setIsEditing(false)}
                        >
                            ✕
                        </button>
                    </div>

                    <div className="profile-info-slot">
                        {editInfo && (
                            <div className="profile-info right">
                                {editInfo}
                            </div>
                        )}
                    </div>

                    <input
                        className="field"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Imię"
                    />

                    <input
                        className="field"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Nazwisko"
                    />

                    <input className="field" value={user.email} disabled />

                    <input
                        className="field"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Nowe hasło"
                    />

                    <input
                        className="field"
                        type="password"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        placeholder="Powtórz hasło"
                    />

                    <input
                        className="field"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Numer telefonu"
                    />

                    <button
                        className="primary-btn profile-save"
                        onClick={saveProfile}
                    >
                        Zapisz
                    </button>
                </div>
            </div>
        </div>
    );
}
