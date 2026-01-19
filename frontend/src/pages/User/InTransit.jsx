import { useEffect, useState } from "react";
import "./InTransit.css";

const STATUS_LABELS = {
    created: "Utworzona",
    inTransit: "W drodze",
    delivered: "W paczkomacie docelowym",
    received: "Odebrana przez kuriera",
    cancelled: "Anulowana",
};

export default function InTransit() {
    const [sent, setSent] = useState([]);
    const [incoming, setIncoming] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selected, setSelected] = useState(null);

    const token = localStorage.getItem("token");

    async function loadData() {
        try {
            const [pkgRes, groupsRes] = await Promise.all([
                fetch("http://localhost:3001/api/packages/my", {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }),
                fetch("http://localhost:3001/api/lockerGroups", {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }),
            ]);

            const pkgData = await pkgRes.json();
            const groupsData = await groupsRes.json();

            setSent(pkgData.sent || []);
            setIncoming(pkgData.incoming || []);
            setGroups(groupsData.groups || []);
        } catch (err) {
            console.error("InTransit load error:", err);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    function groupName(id) {
        const g = groups.find((g) => g.id === id);
        return g ? g.name.split(" - ")[0] : `#${id}`;
    }

    function renderPackageButton(pkg) {
        return (
            <button
                key={pkg.id}
                className={`package-btn ${
                    selected?.id === pkg.id ? "active" : ""
                }`}
                onClick={() => setSelected(pkg)}
            >
                {pkg.packageName || pkg.packageId}
            </button>
        );
    }

    return (
        <div className="intransit-page">
            <div className="intransit-content">

                <div className="intransit-left">
                    <div className="intransit-left-left">
                        <h3 className="package-column-title">
                            Paczki nadane przeze mnie
                        </h3>

                        {sent.length === 0 && (
                            <p className="empty">Brak paczek</p>
                        )}

                        {sent.map(renderPackageButton)}
                    </div>

                    <div className="intransit-left-right">
                        <h3 className="package-column-title">
                            Paczki odbierane przeze mnie
                        </h3>

                        {incoming.length === 0 && (
                            <p className="empty">Brak paczek</p>
                        )}

                        {incoming.map(renderPackageButton)}
                    </div>
                </div>

                <div className="intransit-right">
                    {!selected ? (
                        <p className="empty">
                            Wybierz paczkę, aby zobaczyć szczegóły
                        </p>
                    ) : (
                        <>
                            <h3>
                                {selected.packageName || selected.packageId}
                            </h3>

                            <p>
                                <strong>Status:</strong>{" "}
                                {STATUS_LABELS[selected.status]}
                            </p>

                            <p>
                                <strong>Paczkomat startowy:</strong>{" "}
                                {groupName(selected.originGroupId)}
                            </p>

                            <p>
                                <strong>Paczkomat docelowy:</strong>{" "}
                                {groupName(selected.destinationGroupId)}
                            </p>

                            <p>
                                <strong>Nadana:</strong>{" "}
                                {new Date(
                                    selected.createdAt
                                ).toLocaleString()}
                            </p>

                            <p>
                                <strong>Ostatnia zmiana:</strong>{" "}
                                {new Date(
                                    selected.updatedAt
                                ).toLocaleString()}
                            </p>

                            {selected.currentLockerId && (
                                <p>
                                    <strong>Skrytka:</strong>{" "}
                                    {selected.currentLockerId}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
