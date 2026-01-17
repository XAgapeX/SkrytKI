import { useEffect, useRef, useState } from "react";
import "./CourierPickup.css";
import lockerImg from "/lockers/0.png";
import Lottie from "lottie-react";
import emptyBoxAnimation from "../../assets/empty-box.json";

export default function CourierPickup() {
    const [groups, setGroups] = useState([]);
    const [groupId, setGroupId] = useState("");
    const [message, setMessage] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState("open"); // open | pickup | done
    const [pickupCount, setPickupCount] = useState(0);

    const token = localStorage.getItem("token");

    const lottieRef = useRef(null);

    // ---------- LOAD GROUPS ----------
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

    // ---------- STEP 1: OPEN LOCKERS ----------
    const handleOpen = async () => {
        if (!groupId || !token) return;
        setMessage("");

        const res = await fetch("http://localhost:3001/api/courier/open", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ groupId: Number(groupId) }),
        });

        const data = await res.json();

        if (!res.ok) {
            setMessage(data.error || "Brak paczek do odebrania");
            return;
        }

        setShowModal(true);
        setStep("pickup");

        // start normalnej animacji
        setTimeout(() => {
            if (lottieRef.current) {
                lottieRef.current.setDirection(1);
                lottieRef.current.goToAndPlay(0, true);
            }
        }, 100);
    };

    // ---------- STEP 2: PACKAGES TAKEN ----------
    const handlePickup = async () => {
        if (!token) return;

        const res = await fetch("http://localhost:3001/api/lockers/pickup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ groupId: Number(groupId) }),
        });

        const data = await res.json();

        if (!res.ok) {
            setMessage(data.error || "Błąd przy odbiorze paczek");
            setShowModal(false);
            setStep("open");
            return;
        }

        const count = Number(data.message.match(/\d+/)?.[0] || 0);
        setPickupCount(count);
        setStep("done");

        // odwrócona animacja (zamykanie pudełka)
        setTimeout(() => {
            if (lottieRef.current) {
                const total = lottieRef.current.getDuration(true);
                lottieRef.current.setDirection(-1);
                lottieRef.current.goToAndPlay(total, true);
            }
        }, 100);
    };

    // ---------- CLOSE ----------
    const handleClose = () => {
        setShowModal(false);
        setPickupCount(0);
        setStep("open");
        setGroupId("");
        setMessage("");
    };

    return (
        <div className="pickup-page">
            <div className="pickup-content">
                <div className="pickup-left">
                    <h2>Odbiór paczek</h2>

                    <select
                        className="pickup-field"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                    >
                        <option value="">Wybierz paczkomat</option>
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </select>

                    <button
                        className="pickup-btn"
                        onClick={handleOpen}
                        disabled={!groupId}
                    >
                        OTWÓRZ SKRYTKI
                    </button>

                    {message && <div className="pickup-msg">{message}</div>}
                </div>

                <div className="pickup-right">
                    <img src={lockerImg} className="pickup-img" alt="Skrytki" />
                </div>
            </div>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal">

                        <div className="modal-lottie">
                            <Lottie
                                lottieRef={lottieRef}
                                animationData={emptyBoxAnimation}
                                autoplay={false}
                                loop
                            />
                        </div>

                        {step === "pickup" && (
                            <>
                                <h2>Skrytki otwarte</h2>
                                <p>Wyjmij paczki i kliknij poniżej</p>
                                <button className="pickup-btn" onClick={handlePickup}>
                                    PACZKI WYCIĄGNIĘTE
                                </button>
                            </>
                        )}

                        {step === "done" && (
                            <>
                                <h2>Gotowe</h2>
                                <p>Odebrano {pickupCount} paczek</p>

                                <button className="pickup-btn" onClick={handleClose}>
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
