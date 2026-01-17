import { useEffect, useRef, useState } from "react";
import "./Pickup.css";
import lockerImg from "/lockers/0.png";
import Lottie from "lottie-react";
import emptyBoxAnimation from "../../assets/empty-box.json";

export default function Pickup() {
    const [pending, setPending] = useState(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState("open"); // open | pickup | done

    const token = localStorage.getItem("token");
    const lottieRef = useRef(null);

    // ---------- LOAD USER PENDING PACKAGE ----------
    const loadPending = async () => {
        if (!token) {
            setMessage("Brak autoryzacji");
            return;
        }

        try {
            const res = await fetch("http://localhost:3001/api/user/pending", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();

            if (data.ok && data.pending) {
                setPending(data.locker);
            } else {
                setPending(null);
            }
        } catch {
            setMessage("Błąd połączenia z serwerem");
        }
    };

    useEffect(() => {
        loadPending();
    }, []);

    // ---------- OPEN ----------
    const handleOpen = () => {
        if (!pending) return;
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

    // ---------- RECEIVE ----------
    const handleReceive = async () => {
        if (!token) return;

        setLoading(true);
        setMessage("");

        try {
            const res = await fetch("http://localhost:3001/api/lockers/receive", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await res.json();

            if (!res.ok) {
                setMessage(data.error || "Błąd odbioru");
                setLoading(false);
                return;
            }

            setStep("done");
            setPending(null);

            // reverse animacji (zamykanie)
            setTimeout(() => {
                if (lottieRef.current) {
                    const total = lottieRef.current.getDuration(true);
                    lottieRef.current.setDirection(-1);
                    lottieRef.current.goToAndPlay(total, true);
                }
            }, 100);

            await loadPending();
        } catch {
            setMessage("Błąd połączenia z serwerem");
        }

        setLoading(false);
    };

    // ---------- CLOSE ----------
    const close = () => {
        setShowModal(false);
        setStep("open");
        setMessage("");
    };

    return (
        <div className="pickup-page">
            <div className="pickup-content">
                <div className="pickup-left">

                    {!pending && <p>Nie masz paczek do odbioru</p>}

                    {pending && (
                        <>
                            <input
                                className="field"
                                disabled
                                value={`Lokalizacja: ${pending.location}`}
                            />

                            <input
                                className="field"
                                disabled
                                value={`Skrytka nr ${pending.id}`}
                            />

                            <input
                                className="field"
                                disabled
                                value={`ID paczki: ${pending.packageId}`}
                            />

                            <button className="primary-btn" onClick={handleOpen}>
                                ODBIERZ
                            </button>
                        </>
                    )}

                    {message && <p className="pickup-msg">{message}</p>}
                </div>

                <div className="pickup-right">
                    <img src={lockerImg} alt="Skrytki" className="pickup-locker-img" />
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
                                <h2>Skrytka otwarta</h2>
                                <p>Wyjmij paczkę i kliknij poniżej</p>

                                <button
                                    className="primary-btn"
                                    onClick={handleReceive}
                                    disabled={loading}
                                >
                                    {loading ? "OTWIERANIE..." : "PACZKA WYJĘTA"}
                                </button>
                            </>
                        )}

                        {step === "done" && (
                            <>
                                <h2>Paczka odebrana</h2>
                                <button className="primary-btn" onClick={close}>
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
