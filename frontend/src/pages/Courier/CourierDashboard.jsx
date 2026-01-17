import "./CourierDashboard.css";
import { useNavigate } from "react-router-dom";

import serviceIcon from "../../assets/service.png";
import placeIcon from "../../assets/umiescpaczke.png";
import checkIcon from "../../assets/check.png";

export default function CourierDashboard() {
    const navigate = useNavigate();

    return (
        <div className="cd-grid">

            <button
                className="cd-tile cd-tile--big"
                type="button"
                onClick={() => navigate("/courier/overview")}
            >
                <div className="cd-title">SKRYTKA</div>
                <img className="cd-icon" src={serviceIcon} alt="Skrytka" />
            </button>

            <button
                className="cd-tile cd-tile--big"
                type="button"
                onClick={() => navigate("/courier/pickup")}
            >
                <div className="cd-title">ODBIERZ PACZKI</div>
                <img className="cd-icon" src={placeIcon} alt="Odbierz paczki" />
            </button>

            <button
                className="cd-tile cd-tile--big"
                type="button"
                onClick={() => navigate("/courier/delivery")}
            >
                <div className="cd-title">DOSTARCZ PACZKI</div>
                <img className="cd-icon" src={checkIcon} alt="Dostarcz paczki" />
            </button>

        </div>
    );
}
