import { useEffect, useState } from "react";
import "./History.css";

const STATUS_LABELS = {
    received: "Odebrana",
    cancelled: "Anulowana",
};

export default function History() {
    const [sent, setSent] = useState([]);
    const [received, setReceived] = useState([]);
    const [groups, setGroups] = useState([]);

    const token = localStorage.getItem("token");

    async function loadData() {
        try {
            const [pkgRes, groupsRes] = await Promise.all([
                fetch("http://localhost:3001/api/packages/history", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch("http://localhost:3001/api/lockerGroups", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            const pkgData = await pkgRes.json();
            const groupsData = await groupsRes.json();

            const userId = JSON.parse(
                atob(token.split(".")[1])
            ).id;

            const sentPkgs = [];
            const receivedPkgs = [];

            for (const p of pkgData.packages || []) {
                if (p.senderId === userId) sentPkgs.push(p);
                if (p.recipientId === userId) receivedPkgs.push(p);
            }

            setSent(sentPkgs);
            setReceived(receivedPkgs);
            setGroups(groupsData.groups || []);
        } catch (err) {
            console.error("History load error:", err);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    function groupName(id) {
        const g = groups.find((g) => g.id === id);
        return g ? g.name.split(" - ")[0] : `#${id}`;
    }

    function renderTable(packages) {
        if (packages.length === 0) {
            return (
                <p className="history-empty">
                    Brak paczek
                </p>
            );
        }

        return (
            <table className="history-table">
                <thead>
                <tr>
                    <th>Paczka</th>
                    <th>Status</th>
                    <th>Skąd</th>
                    <th>Dokąd</th>
                    <th>Data</th>
                </tr>
                </thead>
                <tbody>
                {packages.map((p) => (
                    <tr key={p.id}>
                        <td>
                            {p.packageName || p.packageId}
                        </td>

                        <td>
                                <span
                                    className={`status status--${p.status}`}
                                >
                                    {STATUS_LABELS[p.status]}
                                </span>
                        </td>

                        <td>
                            {groupName(p.originGroupId)}
                        </td>

                        <td>
                            {groupName(p.destinationGroupId)}
                        </td>

                        <td>
                            {new Date(p.updatedAt).toLocaleString()}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        );
    }

    return (
        <div className="history-page">
            <section className="history-section">
                <h3 className="history-subtitle">
                    Nadane przeze mnie
                </h3>
                {renderTable(sent)}
            </section>

            <section className="history-section">
                <h3 className="history-subtitle">
                    Odebrane przeze mnie
                </h3>
                {renderTable(received)}
            </section>
        </div>
    );
}
