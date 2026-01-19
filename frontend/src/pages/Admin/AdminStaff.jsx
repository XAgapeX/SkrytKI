import { useEffect, useState } from "react";
import "./AdminStaff.css";

export default function AdminStaff() {
    const [users, setUsers] = useState([]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("courier");

    const token = localStorage.getItem("token");

    const loadUsers = () => {
        fetch("/api/admin/users/all", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then(res => res.json())
            .then(data => {
                if (data.ok) setUsers(data.users || []);
            })
            .catch(() => {
                // brak komunikatu
            });
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const createUser = async e => {
        e.preventDefault();

        try {
            const res = await fetch("/api/admin/create-user", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ email, password, role }),
            });

            const data = await res.json();

            if (!data.ok) return;

            setEmail("");
            setPassword("");
            setRole("courier");
            loadUsers();
        } catch {
            // brak komunikatu
        }
    };

    const changeRole = async (email, newRole) => {
        try {
            const res = await fetch("/api/setRole", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ email, role: newRole }),
            });

            const data = await res.json();

            if (data.ok) loadUsers();
        } catch {
            // brak komunikatu
        }
    };

    const deleteUser = async (id) => {
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await res.json();

            if (data.ok) loadUsers();
        } catch {
            // brak komunikatu
        }
    };

    return (
        <div className="staff-page">
            <h3>Kurierzy i serwisanci</h3>

            <form className="staff-form" onSubmit={createUser}>
                <input
                    className="field"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />

                <input
                    className="field"
                    type="password"
                    placeholder="Hasło"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />

                <select
                    className="field"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                >
                    <option value="courier">Kurier</option>
                    <option value="service">Serwisant</option>
                </select>

                <button className="primary-btn" type="submit">
                    UTWÓRZ KONTO
                </button>
            </form>

            <table className="staff-table">
                <thead>
                <tr>
                    <th>ID</th>
                    <th>Email</th>
                    <th>Rola</th>
                    <th>Akcje</th>
                </tr>
                </thead>
                <tbody>
                {users
                    .filter(
                        u => u.role === "courier" || u.role === "service"
                    )
                    .map(u => (
                        <tr key={u.id}>
                            <td>{u.id}</td>
                            <td>{u.email}</td>
                            <td>
                                    <span
                                        className={`role-badge role-${u.role}`}
                                    >
                                        {u.role === "courier"
                                            ? "Kurier"
                                            : "Serwisant"}
                                    </span>
                            </td>
                            <td className="staff-actions">
                                <button
                                    onClick={() =>
                                        changeRole(
                                            u.email,
                                            u.role === "courier"
                                                ? "service"
                                                : "courier"
                                        )
                                    }
                                >
                                    Zmień rolę
                                </button>

                                <button
                                    className="danger"
                                    onClick={() => deleteUser(u.id)}
                                >
                                    Usuń
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
