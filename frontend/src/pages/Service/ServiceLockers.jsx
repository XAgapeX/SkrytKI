import { useEffect, useState } from "react";
import "./ServiceLockers.css";

const STATUS_LABELS = {
    free: "Wolna",
    open: "Otwarta",
    reserved: "Zarezerwowana",
    occupied: "Zajęta",
    broken: "Uszkodzona",
};

export default function ServiceLockers() {
    const [groups, setGroups] = useState([]);
    const [lockers, setLockers] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState("");
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

            if (!groupsRes.ok || !lockersRes.ok) {
                throw new Error("Błąd ładowania danych");
            }

            const groupsData = await groupsRes.json();
            const lockersData = await lockersRes.json();

            setGroups(groupsData.groups || []);
            setLockers(lockersData.lockers || []);

            if (groupsData.groups?.length && selectedGroup === "") {
                setSelectedGroup(groupsData.groups[0].id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function markBroken(id) {
        await fetch("http://localhost:3001/api/lockers/broken", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id }),
        });

        loadData();
    }

    async function markRepaired(id) {
        await fetch("http://localhost:3001/api/lockers/repaired", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id }),
        });

        loadData();
    }

    async function forceOpen(id) {
        await fetch("http://localhost:3001/api/lockers/force-open", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id }),
        });

        loadData();
    }

    async function closeLocker(id) {
        await fetch("http://localhost:3001/api/lockers/close", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id }),
        });

        loadData();
    }

    async function forceOpenAll() {
        if (!selectedGroup) return;

        const freeCount = filteredLockers.filter(
            (l) => l.status === "free"
        ).length;

        if (freeCount === 0) return;

        await fetch("http://localhost:3001/api/lockers/force-open-all", {
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

    const filteredLockers =
        selectedGroup === ""
            ? []
            : lockers.filter((l) => l.groupId === Number(selectedGroup));

    const freeCount = filteredLockers.filter(
        (l) => l.status === "free"
    ).length;

    return (
        <div className="service-lockers">
            <div className="service-lockers__sidebar">
                <select
                    className="city-select"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                >
                    <option value="">Wybierz miasto</option>
                    {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="service-lockers__content">
                <div className="service-lockers__grid service-lockers__header">
                    <div>ID</div>
                    <div>Skrytka</div>
                    <div>Status</div>
                    <div>Akcje</div>
                </div>

                {filteredLockers.map((l) => (
                    <div
                        key={l.id}
                        className="service-lockers__grid service-lockers__row"
                    >
                        <div>{l.id}</div>
                        <div>{l.groupId}</div>
                        <div className={`status status--${l.status}`}>
                            {STATUS_LABELS[l.status]}
                        </div>
                        <div className="actions-cell">
                            {l.status === "free" && (
                                <button
                                    className="primary-btn small"
                                    onClick={() => markBroken(l.id)}
                                >
                                    Oznacz uszkodzoną
                                </button>
                            )}

                            {l.status === "broken" && (
                                <button
                                    className="primary-btn small"
                                    onClick={() => markRepaired(l.id)}
                                >
                                    Naprawiona
                                </button>
                            )}

                            {(l.status === "occupied" ||
                                l.status === "reserved") && (
                                <button
                                    className="primary-btn small danger"
                                    onClick={() => forceOpen(l.id)}
                                >
                                    Otwórz awaryjnie
                                </button>
                            )}

                            {l.status === "open" && (
                                <button
                                    className="primary-btn small"
                                    onClick={() => closeLocker(l.id)}
                                >
                                    Zamknij skrytkę
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {selectedGroup && (
                    <div className="service-lockers__footer">
                        <button
                            className="primary-btn danger big"
                            disabled={freeCount === 0}
                            onClick={forceOpenAll}
                        >
                            Otwórz wszystkie wolne skrytki
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
