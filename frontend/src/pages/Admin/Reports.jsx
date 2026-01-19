import "./Reports.css";

export default function Reports() {
    const handleGenerateReport = async (type) => {
        try {
            const res = await fetch(
                `http://localhost:3001/api/admin/reports/${type}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                }
            );

            if (!res.ok) {
                throw new Error("Report generation failed");
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;

            const filenames = {
                packages: "raport_paczki.csv",
                lockers: "raport_skrytki.csv",
                failures: "raport_awarie.csv",
                activity: "raport_aktywnosc.csv",
            };

            a.download = filenames[type] || "raport.csv";
            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert("Nie udało się wygenerować raportu");
        }
    };

    return (
        <div className="ad-grid">
            <button
                className="ad-tile ad-tile--big"
                type="button"
                onClick={() => handleGenerateReport("packages")}
            >
                <div className="ad-title">RAPORT PACZEK</div>
            </button>

            <button
                className="ad-tile ad-tile--big"
                type="button"
                onClick={() => handleGenerateReport("lockers")}
            >
                <div className="ad-title">RAPORT SKRYTEK</div>
            </button>

            <button
                className="ad-tile ad-tile--big"
                type="button"
                onClick={() => handleGenerateReport("failures")}
            >
                <div className="ad-title">RAPORT AWARII</div>
            </button>

            <button
                className="ad-tile ad-tile--big"
                type="button"
                onClick={() => handleGenerateReport("activity")}
            >
                <div className="ad-title">RAPORT AKTYWNOŚCI</div>
            </button>
        </div>
    );
}
