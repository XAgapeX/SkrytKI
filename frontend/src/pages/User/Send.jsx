import { useEffect, useState, useRef } from "react";
import "./Send.css";
import lockerImg from "/public/lockers/0.png";
import Lottie from "lottie-react";
import emptyBoxAnimation from "../../assets/empty-box.json";

export default function Send() {
    const [groups, setGroups] = useState([]);

    const [packageName, setPackageName] = useState("");
    const [sendGroupId, setSendGroupId] = useState("");
    const [destinationGroupId, setDestinationGroupId] = useState("");
    const [recipientEmail, setRecipientEmail] = useState("");

    const [previewLockerId, setPreviewLockerId] = useState(null);
    const [lockerId, setLockerId] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);

    const [loadingOpen, setLoadingOpen] = useState(false);
    const [loadingSend, setLoadingSend] = useState(false);

    const token = localStorage.getItem("token");

    const successLottieRef = useRef(null);
    const reverseIntervalRef = useRef(null);

    // ---------- LOAD LOCKER GROUPS ----------
    useEffect(() => {
        if (!token) return;

        fetch("http://localhost:3001/api/lockerGroups", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.ok) setGroups(data.groups);
            })
            .catch(console.error);
    }, [token]);

    // ---------- PREVIEW FREE LOCKER ----------
    useEffect(() => {
        if (!sendGroupId) {
            setPreviewLockerId(null);
            return;
        }

        fetch(`http://localhost:3001/api/lockers/preview/${sendGroupId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setPreviewLockerId(data.lockerId);
            })
            .catch(console.error);
    }, [sendGroupId, token]);

    // ---------- OPEN LOCKER ----------
    const handleOpenLocker = async () => {
        if (!sendGroupId || !destinationGroupId || !recipientEmail || !previewLockerId) return;

        setLoadingOpen(true);
        try {
            const res = await fetch("http://localhost:3001/api/lockers/open", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    sendGroupId: Number(sendGroupId),
                }),
            });

            const data = await res.json();
            if (!res.ok) return;

            setLockerId(data.lockerId);
            setShowModal(true);
        } finally {
            setLoadingOpen(false);
        }
    };

    // ---------- SEND PACKAGE ----------
    const handleSend = async () => {
        if (!lockerId) return;

        setLoadingSend(true);
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

            if (!res.ok) return;

            setSendSuccess(true);
        } finally {
            setLoadingSend(false);
        }
    };

    // ---------- CANCEL ----------
    const handleCancel = async () => {
        if (reverseIntervalRef.current) {
            clearInterval(reverseIntervalRef.current);
            reverseIntervalRef.current = null;
        }

        if (lockerId) {
            try {
                await fetch("http://localhost:3001/api/lockers/cancel", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ lockerId }),
                });
            } catch (err) {
                console.error(err);
            }
        }

        setLockerId(null);
        setSendSuccess(false);
        setShowModal(false);
    };

    // ---------- CLOSE SUCCESS ----------
    const handleCloseSuccess = () => {
        if (reverseIntervalRef.current) {
            clearInterval(reverseIntervalRef.current);
            reverseIntervalRef.current = null;
        }

        setShowModal(false);
        setSendSuccess(false);
        setLockerId(null);
        setPreviewLockerId(null);
        setSendGroupId("");
        setDestinationGroupId("");
        setRecipientEmail("");
        setPackageName("");
    };

    return (
        <div className="send-page">
            <div className="send-content">
                <div className="send-left">
                    <input
                        className="field"
                        placeholder="Nazwa paczki (opcjonalnie)"
                        value={packageName}
                        onChange={(e) => setPackageName(e.target.value)}
                    />

                    <select
                        className="field"
                        value={sendGroupId}
                        onChange={(e) => {
                            setSendGroupId(e.target.value);
                            setLockerId(null);
                        }}
                    >
                        <option value="">Wybierz miasto nadania</option>
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
                                ? `Skrytka nr: ${previewLockerId}`
                                : sendGroupId
                                    ? "Brak wolnych skrytek"
                                    : "Skrytka nr:"
                        }
                    />

                    <select
                        className="field"
                        value={destinationGroupId}
                        onChange={(e) => setDestinationGroupId(e.target.value)}
                    >
                        <option value="">Wybierz miasto docelowe</option>
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

                    <button
                        className="primary-btn"
                        onClick={handleOpenLocker}
                        disabled={!previewLockerId || loadingOpen}
                    >
                        OTWÓRZ SKRYTKĘ
                    </button>
                </div>

                <div className="send-right">
                    <img src={lockerImg} alt="Skrytki" className="send-locker-img" />
                </div>
            </div>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal">
                        {!sendSuccess && (
                            <div className="modal-lottie">
                                <Lottie animationData={emptyBoxAnimation} autoplay loop />
                            </div>
                        )}

                        {sendSuccess && (
                            <div className="modal-lottie">
                                <Lottie
                                    lottieRef={successLottieRef}
                                    animationData={emptyBoxAnimation}
                                    autoplay={false}
                                    loop={false}
                                    onDOMLoaded={() => {
                                        const anim = successLottieRef.current;
                                        if (!anim) return;

                                        anim.setDirection(-1);
                                        anim.setSpeed(1);

                                        const durationMs =
                                            anim.getDuration(true) * (1000 / 60);

                                        const playReverse = () => {
                                            anim.goToAndPlay(
                                                anim.getDuration(true),
                                                true
                                            );
                                        };

                                        playReverse();

                                        reverseIntervalRef.current = setInterval(
                                            playReverse,
                                            durationMs
                                        );
                                    }}
                                />
                            </div>
                        )}

                        {!sendSuccess ? (
                            <>
                                <h2>Włóż paczkę do skrytki</h2>
                                <p>Skrytka nr: {lockerId}</p>

                                <button
                                    className="primary-btn"
                                    onClick={handleSend}
                                    disabled={loadingSend}
                                >
                                    {loadingSend ? "NADAWANIE..." : "NADAJ PACZKĘ"}
                                </button>

                                <button
                                    className="primary-btn"
                                    onClick={handleCancel}
                                >
                                    ANULUJ
                                </button>
                            </>
                        ) : (
                            <>
                                <h2>Paczka w skrytce!</h2>
                                <p>Skrytka została poprawnie zamknięta.</p>

                                <button
                                    className="primary-btn"
                                    onClick={handleCloseSuccess}
                                >
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
