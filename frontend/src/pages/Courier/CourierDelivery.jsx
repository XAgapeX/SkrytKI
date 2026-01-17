import { useEffect, useRef, useState } from "react";
import "./CourierDelivery.css";
import lockerImg from "/lockers/0.png";
import Lottie from "lottie-react";
import emptyBoxAnimation from "../../assets/empty-box.json";

export default function CourierDelivery() {
    const [groups, setGroups] = useState([]);
    const [groupId, setGroupId] = useState("");
    const [message, setMessage] = useState("");
    const [step, setStep] = useState("open"); // open | deliver | done
    const [deliveredCount, setDeliveredCount] = useState(0);
    const [showModal, setShowModal] = useState(false);

    const token = localStorage.getItem("token");
    const lottieRef = useRef(null);

    useEffect(() => {
        fetch("http://localhost:3001/api/lockerGroups", {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.ok) setGroups(data.groups);
            });
    }, [token]);

    const handleOpen = async () => {
        setMessage("");

        const res = await fetch("http://localhost:3001/api/courier/delivery/open", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ groupId: Number(groupId) })
        });

        const data = await res.json();

        if (!res.ok) {
            setMessage(data.error || "Błąd otwierania skrytek");
            return;
        }

        setStep("deliver");
        setShowModal(true);

        // normalna animacja (otwarte pudełko)
        setTimeout(() => {
            if (lottieRef.current) {
                lottieRef.current.setDirection(1);
                lottieRef.current.goToAndPlay(0, true);
            }
        }, 100);
    };

    const handleDeliver = async () => {
        const res = await fetch("http://localhost:3001/api/lockers/deliver", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ toGroupId: Number(groupId) })
        });

        const data = await res.json();

        if (!res.ok) {
            setMessage(data.error || "Błąd dostawy");
            setShowModal(false);
            setStep("open");
            return;
        }

        const count = Number(data.message.match(/\d+/)?.[0] || 0);
        setDeliveredCount(count);
        setStep("done");

        setTimeout(() => {
            if (lottieRef.current) {
                const total = lottieRef.current.getDuration(true);
                lottieRef.current.setDirection(-1);
                lottieRef.current.goToAndPlay(total, true);
            }
        }, 100);
    };

    const close = () => {
        setShowModal(false);
        setDeliveredCount(0);
        setStep("open");
    };

    return (
        <div className="delivery-page">
            <div className="delivery-content">
                <div className="delivery-left">
                    <h2>Dostawa paczek</h2>

                    <select
                        className="delivery-field"
                        value={groupId}
                        onChange={e => setGroupId(e.target.value)}
                    >
                        <option value="">Wybierz paczkomat</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </select>

                    <button
                        className="delivery-btn"
                        onClick={handleOpen}
                        disabled={!groupId}
                    >
                        OTWÓRZ SKRYTKI
                    </button>

                    {message && <div className="delivery-msg">{message}</div>}
                </div>

                <div className="delivery-right">
                    <img src={lockerImg} className="delivery-img" alt="Skrytki" />
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

                        {step === "deliver" && (
                            <>
                                <h2>Włóż paczki do skrytek</h2>
                                <button className="delivery-btn" onClick={handleDeliver}>
                                    PACZKI WŁOŻONE
                                </button>
                            </>
                        )}

                        {step === "done" && (
                            <>
                                <h2>Gotowe</h2>
                                <p>Dostarczono {deliveredCount} paczek</p>
                                <button className="delivery-btn" onClick={close}>
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
