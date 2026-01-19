import { useEffect, useRef, useState } from "react";
import "./Send.css";
import lockerImg from "/lockers/0.png";
import Lottie from "lottie-react";
import boxAnim from "/src/assets/empty-box.json";

export default function Send() {
    const [groups, setGroups] = useState([]);

    const [packageName, setPackageName] = useState("");
    const [sendGroupId, setSendGroupId] = useState("");
    const [destinationGroupId, setDestinationGroupId] = useState("");
    const [recipientEmail, setRecipientEmail] = useState("");

    const [previewLockerId, setPreviewLockerId] = useState(null);
    const [lockerId, setLockerId] = useState(null);
    const [expiresAt, setExpiresAt] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);
    const [error, setError] = useState("");

    const [loadingOpen, setLoadingOpen] = useState(false);
    const [loadingSend, setLoadingSend] = useState(false);

    const lottieRef = useRef(null);
    const token = localStorage.getItem("token");

    useEffect(() => {
        if (!token) return;

        fetch("http://localhost:3001/api/lockerGroups", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.ok) setGroups(data.groups);
            });
    }, [token]);

    useEffect(() => {
        if (!sendGroupId || !token) {
            setPreviewLockerId(null);
            return;
        }

        fetch(`http://localhost:3001/api/lockers/preview/${sendGroupId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setPreviewLockerId(data.lockerId);
            });
    }, [sendGroupId, token]);

    const handleOpenLocker = async () => {
        if (!sendGroupId || !destinationGroupId || !recipientEmail || !previewLockerId) {
            setError("Uzupełnij wszystkie pola");
            return;
        }

        setLoadingOpen(true);
        setError("");

        try {
            const res = await fetch("http://localhost:3001/api/lockers/open", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ sendGroupId: Number(sendGroupId) }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Nie udało się otworzyć skrytki");
                return;
            }

            setLockerId(data.lockerId);
            setExpiresAt(data.reservationExpiresAt);
            setSendSuccess(false);
            setShowModal(true);

            setTimeout(() => {
                if (lottieRef.current) {
                    lottieRef.current.setDirection(1);
                    lottieRef.current.goToAndPlay(0, true);
                }
            }, 100);
        } finally {
            setLoadingOpen(false);
        }
    };

    const handleSend = async () => {
        if (!lockerId) return;

        setLoadingSend(true);
        setError("");

        try {
            const res = await fetch("http://localhost:3001/api/lockers/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    lockerId,
                    destinationGroupId: Number(destinationGroupId),
                    recipientEmail,
                    packageName,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Rezerwacja wygasła");
                return;
            }

            setSendSuccess(true);

            if (lottieRef.current) {
                const total = lottieRef.current.getDuration(true);
                lottieRef.current.setDirection(-1);
                lottieRef.current.goToAndPlay(total, true);
            }
        } finally {
            setLoadingSend(false);
        }
    };

    const handleCancel = async () => {
        if (lockerId) {
            await fetch("http://localhost:3001/api/lockers/cancel", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ lockerId }),
            });
        }

        setShowModal(false);
        setLockerId(null);
        setSendSuccess(false);
        setExpiresAt(null);
        setError("");
    };

    const handleCloseSuccess = () => {
        setShowModal(false);
        setSendSuccess(false);
        setLockerId(null);
        setPreviewLockerId(null);
        setSendGroupId("");
        setDestinationGroupId("");
        setRecipientEmail("");
        setPackageName("");
        setExpiresAt(null);
        setError("");
    };

    return (
        <div className="send-page">
            <div className="send-content">
                <div className="send-left">
                    <h3>Nadaj paczkę</h3>

                    <div className={`send-error ${error ? "visible" : ""}`}>
                        {error || ""}
                    </div>
                    <input
                        className="field"
                        placeholder="Nazwa paczki"
                        value={packageName}
                        onChange={(e) => setPackageName(e.target.value)}
                    />

                    <select
                        className="field"
                        value={sendGroupId}
                        onChange={(e) => setSendGroupId(e.target.value)}
                    >
                        <option value="">Miasto nadania</option>
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </select>

                    <input
                        className="field"
                        disabled
                        value={
                            previewLockerId
                                ? `Skrytka nr ${previewLockerId}`
                                : sendGroupId
                                    ? "Brak wolnych skrytek"
                                    : "Skrytka nr"
                        }
                    />

                    <select
                        className="field"
                        value={destinationGroupId}
                        onChange={(e) => setDestinationGroupId(e.target.value)}
                    >
                        <option value="">Miasto docelowe</option>
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </select>

                    <input
                        className="field"
                        placeholder="Email odbiorcy"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                    />

                    <button className="primary-btn" onClick={handleOpenLocker}>
                        OTWÓRZ SKRYTKĘ
                    </button>
                </div>

                <div className="send-right">
                    <img src={lockerImg} className="send-locker-img" alt="lockers" />
                </div>
            </div>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <div className="modal-lottie">
                            <Lottie
                                lottieRef={lottieRef}
                                animationData={boxAnim}
                                loop
                                autoplay={false}
                            />
                        </div>

                        {!sendSuccess ? (
                            <>
                                <h2>Włóż paczkę</h2>
                                <p>Skrytka nr {lockerId}</p>
                                {expiresAt && <p>Rezerwacja do: {expiresAt}</p>}

                                <button
                                    className="primary-btn"
                                    onClick={handleSend}
                                    disabled={loadingSend}
                                >
                                    {loadingSend ? "Wysyłanie..." : "NADAJ PACZKĘ"}
                                </button>

                                <button className="primary-btn" onClick={handleCancel}>
                                    ANULUJ
                                </button>
                            </>
                        ) : (
                            <>
                                <h2>Paczka nadana</h2>
                                <button className="primary-btn" onClick={handleCloseSuccess}>
                                    ZAMKNIJ
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
