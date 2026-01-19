import { useEffect, useState } from "react";
import "./ServiceDiagnostics.css";

const STATUS_LABELS = {
    free: "Wolne",
    open: "Otwarte",
    reserved: "Zarezerwowane",
    occupied: "Zajęte",
    broken: "Uszkodzone",
    blocked: "Zablokowane",
};

export default function ServiceDiagnostics() {
    const [health, setHealth] = useState(null);
    const [lockers, setLockers] = useState([]);
    const [loading, setLoading] = useState(true);

    const token = localStorage.getItem("token");

    async function loadData() {
        try {
            setLoading(true);

            const [healthRes, lockersRes] = await Promise.all([
                fetch("http://localhost:3001/api/health"),
                fetch("http://localhost:3001/api/lockers", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            const healthData = await healthRes.json();
            const lockersData = await lockersRes.json();

            setHealth(healthData);
            setLockers(lockersData.lockers || []);
        } catch (err) {
            console.error("Diagnostics error:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    if (loading) return null;

    const byStatus = lockers.reduce((acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
    }, {});

    const lastActions = lockers
        .filter((l) => l.lastAction)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 10);

    return (
        <div className="service-diagnostics">
            <section className="diag-card">
                <h3>Status backendu</h3>
                <p>
                    <strong>Status:</strong>{" "}
                    <span className="ok">OK</span>
                </p>
                <p>
                    <strong>Czas serwera:</strong>{" "}
                    {new Date(health.time).toLocaleString()}
                </p>
            </section>

            <section className="diag-card">
                <h3>Skrytki – podsumowanie</h3>
                <div className="diag-grid">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <div key={key} className="diag-tile">
                            <div className={`status-dot status--${key}`} />
                            <div>{label}</div>
                            <strong>{byStatus[key] || 0}</strong>
                        </div>
                    ))}
                </div>
            </section>

            <section className="diag-card">
                <h3>Ostatnie akcje</h3>

                {lastActions.length === 0 ? (
                    <p>Brak danych</p>
                ) : (
                    <table className="diag-table">
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>Grupa</th>
                            <th>Status</th>
                            <th>Akcja</th>
                            <th>Czas</th>
                        </tr>
                        </thead>
                        <tbody>
                        {lastActions.map((l) => (
                            <tr key={l.id}>
                                <td>{l.id}</td>
                                <td>{l.groupId}</td>
                                <td>
                                        <span
                                            className={`status status--${l.status}`}
                                        >
                                            {STATUS_LABELS[l.status]}
                                        </span>
                                </td>
                                <td>{l.lastAction}</td>
                                <td>
                                    {new Date(
                                        l.updatedAt
                                    ).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}
