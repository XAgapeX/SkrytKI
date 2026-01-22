import { useEffect, useState } from "react";
import "./Users.css";

export default function Users() {
    const [email, setEmail] = useState("");
    const [user, setUser] = useState(null);
    const [error, setError] = useState("");

    const [deleteRequests, setDeleteRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);

    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const token = localStorage.getItem("token");

    const clearSelectedUser = () => {
        setUser(null);
        setEmail("");
        setError("");
    };

    const handleSearch = async () => {
        setError("");
        setUser(null);

        if (!email.trim()) {
            setError("Podaj email użytkownika");
            return;
        }

        try {
            const res = await fetch(
                `http://localhost:3001/api/admin/users?email=${encodeURIComponent(email)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!res.ok) throw new Error();

            const data = await res.json();
            setUser(data.user);
        } catch {
            setError("Nie znaleziono użytkownika");
        }
    };

    const loadUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await fetch(
                "http://localhost:3001/api/admin/users/all",
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const data = await res.json();
            if (res.ok) setUsers(data.users || []);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleDelete = async (userId) => {
        try {
            const res = await fetch(
                `http://localhost:3001/api/admin/users/${userId}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!res.ok) return;

            clearSelectedUser();
            loadUsers();
            loadDeleteRequests();
        } catch {
            // opcjonalnie toast
        }
    };

    const loadDeleteRequests = async () => {
        setLoadingRequests(true);
        try {
            const res = await fetch(
                "http://localhost:3001/api/admin/delete-requests",
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const data = await res.json();
            if (res.ok) setDeleteRequests(data.requests || []);
        } finally {
            setLoadingRequests(false);
        }
    };

    const rejectRequest = async (requestId) => {
        try {
            await fetch(
                `http://localhost:3001/api/admin/delete-requests/${requestId}/reject`,
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            loadDeleteRequests();
        } catch {
            // opcjonalnie toast
        }
    };

    useEffect(() => {
        loadUsers();
        loadDeleteRequests();
    }, []);

    return (
        <div className="users-layout">
            <div className="users-left">
                <h3>Zarządzaj użytkownikami</h3>

                <input
                    type="email"
                    className="field"
                    placeholder="user@skrytki.pl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <button className="primary-btn" onClick={handleSearch}>
                    Wyszukaj użytkownika
                </button>

                {error && <p className="users-error">{error}</p>}

                {user && (
                    <div className="users-card">
                        <button
                            className="users-card__close"
                            onClick={clearSelectedUser}
                        >
                            ×
                        </button>

                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Rola:</strong> {user.role}</p>

                        <button
                            className="primary-btn primary-btn--danger"
                            onClick={() => handleDelete(user.id)}
                        >
                            Usuń konto
                        </button>
                    </div>
                )}

                <hr className="users-divider" />

                <h3>Prośby o usunięcie konta</h3>

                {loadingRequests && <p>Ładowanie...</p>}

                {!loadingRequests &&
                    deleteRequests.map((r) => (
                        <div key={r.id} className="delete-request">
                            <p><strong>Email:</strong> {r.email}</p>
                            <p>
                                <strong>Data:</strong>{" "}
                                {new Date(r.createdAt).toLocaleString()}
                            </p>
                            {r.reason && (
                                <p><strong>Powód:</strong> {r.reason}</p>
                            )}

                            <div className="delete-actions">
                                {/* 🔴 TU BYŁ BUG */}
                                <button
                                    className="btn-danger"
                                    onClick={() => handleDelete(r.userId)}
                                >
                                    Usuń konto
                                </button>

                                <button
                                    className="btn-secondary"
                                    onClick={() => rejectRequest(r.id)}
                                >
                                    Odrzuć
                                </button>
                            </div>
                        </div>
                    ))}
            </div>

            <div className="users-right">
                <h3 className="users-table-title">Wszyscy użytkownicy</h3>

                <div className="users-table">
                    <div className="users-table__header">
                        <div>ID</div>
                        <div>Email</div>
                        <div>Rola</div>
                        <div>Akcje</div>
                    </div>

                    {loadingUsers && <p>Ładowanie...</p>}

                    {!loadingUsers &&
                        users.map((u) => (
                            <div key={u.id} className="users-table__row">
                                <div>{u.id}</div>
                                <div>{u.email}</div>
                                <div>
                                    <span className={`status status--${u.role}`}>
                                        {u.role}
                                    </span>
                                </div>
                                <div>
                                    <button
                                        className="primary-btn small primary-btn--danger"
                                        onClick={() => handleDelete(u.id)}
                                    >
                                        Usuń
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}
