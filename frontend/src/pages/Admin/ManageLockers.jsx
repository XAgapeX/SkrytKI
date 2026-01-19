import { useEffect, useState } from "react";
import "./ManageLockers.css";

const STATUS_LABELS = {
    free: "Wolna",
    open: "Otwarta",
    reserved: "Zarezerwowana",
    occupied: "Zajęta",
    broken: "Uszkodzona",
    blocked: "Zablokowana",
};

export default function ManageLockers() {
    const [groups, setGroups] = useState([]);
    const [lockers, setLockers] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [loading, setLoading] = useState(true);

    const token = localStorage.getItem("token");

    async function loadData() {
        try {
            setLoading(true);

            const [groupsRes, lockersRes] = await Promise.all([
                fetch("http://localhost:3001/api/lockerGroups", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch("http://localhost:3001/api/lockers", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            const groupsData = await groupsRes.json();
            const lockersData = await lockersRes.json();

            setGroups(groupsData.groups || []);
            setLockers(lockersData.lockers || []);

            if (groupsData.groups?.length && selectedGroup === null) {
                setSelectedGroup(groupsData.groups[0].id);
            }
        } finally {
            setLoading(false);
        }
    }

    async function blockLocker(id) {
        await fetch("http://localhost:3001/api/admin/lockers/block", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id }),
        });
        loadData();
    }

    async function unblockLocker(id) {
        await fetch("http://localhost:3001/api/admin/lockers/unblock", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id }),
        });
        loadData();
    }

    async function deleteLocker(id) {
        if (!window.confirm("Czy na pewno chcesz usunąć skrytkę?")) return;

        const res = await fetch(
            `http://localhost:3001/api/admin/lockers/${id}`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        if (res.ok) loadData();
    }

    async function addLocker() {
        await fetch("http://localhost:3001/api/admin/lockers", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ groupId: selectedGroup }),
        });
        loadData();
    }

    useEffect(() => {
        loadData();
    }, []);

    if (loading) return null;

    const filteredLockers = lockers.filter(
        (l) => l.groupId === selectedGroup
    );

    return (
        <div className="manage-lockers-layout">
            <div className="manage-lockers-left">
                <h3>Zarządzaj skrytkami</h3>

                <select
                    className="city-select"
                    value={selectedGroup ?? ""}
                    onChange={(e) =>
                        setSelectedGroup(Number(e.target.value))
                    }
                >
                    {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="manage-lockers-right">
                <h3 className="manage-lockers-table-title">
                    Skrytki w grupie
                </h3>

                <div className="manage-lockers-table">
                    <div className="manage-lockers-table__header">
                        <div>ID</div>
                        <div>Skrytka</div>
                        <div>Status</div>
                        <div>Akcje</div>
                    </div>

                    {filteredLockers.map((l) => (
                        <div
                            key={l.id}
                            className="manage-lockers-table__row"
                        >
                            <div>{l.id}</div>
                            <div>{l.groupId}</div>
                            <div className={`status status--${l.status}`}>
                                {STATUS_LABELS[l.status]}
                            </div>
                            <div className="actions-cell">
                                {l.status !== "blocked" && (
                                    <button
                                        className="primary-btn small"
                                        onClick={() => blockLocker(l.id)}
                                    >
                                        Zablokuj
                                    </button>
                                )}

                                {l.status === "blocked" && (
                                    <button
                                        className="primary-btn small"
                                        onClick={() => unblockLocker(l.id)}
                                    >
                                        Odblokuj
                                    </button>
                                )}

                                {l.status === "free" && (
                                    <button
                                        className="primary-btn small primary-btn--danger"
                                        onClick={() => deleteLocker(l.id)}
                                    >
                                        Usuń
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="manage-lockers-footer">
                    <button
                        className="primary-btn big"
                        onClick={addLocker}
                    >
                        Dodaj skrytkę
                    </button>
                </div>
            </div>
        </div>
    );
}
