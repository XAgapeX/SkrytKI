import "./CourierOverview.css";
import { useEffect, useState, useCallback } from "react";

export default function CourierOverview() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem("token");

    const load = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("http://localhost:3001/api/lockerGroups", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            if (!data.ok) throw new Error("Failed to load locker groups");

            const enriched = await Promise.all(
                data.groups.map(async (g) => {
                    try {
                        const r = await fetch(
                            "http://localhost:3001/api/courier/statusByGroup",
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ groupId: g.id }),
                            }
                        );

                        const s = await r.json();

                        if (!r.ok) {
                            return { ...g, pickup: 0, toDeliver: 0 };
                        }

                        return {
                            ...g,
                            pickup: s.pickupReady?.length || 0,
                            toDeliver: s.toDeliver?.length || 0,
                        };
                    } catch {
                        return { ...g, pickup: 0, toDeliver: 0 };
                    }
                })
            );

            setGroups(enriched);
        } catch (err) {
            console.error("Failed to load courier overview", err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="courier-page">
            <div className="courier-content">
                <div className="courier-left">
                    <h2>Skrytka kuriera</h2>
                    <p>Stan paczek w poszczególnych miastach</p>

                    {loading && <div className="courier-loading">Ładowanie danych</div>}

                    {!loading && groups.length === 0 && (
                        <div className="courier-loading">Brak paczek do wyświetlenia</div>
                    )}

                    {!loading &&
                        groups.map((g) => (
                            <div key={g.id} className="courier-row">
                                <span className="courier-name">{g.name}</span>
                                <div className="courier-stats">
                                    <span>Do odbioru: {g.pickup}</span>
                                    <span>W drodze: {g.toDeliver}</span>
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}
