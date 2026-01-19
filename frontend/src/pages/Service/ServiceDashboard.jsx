import "./ServiceDashboard.css";
import { useNavigate } from "react-router-dom";
import serviceIcon from "../../assets/service.png";
import diagIcon from "../../assets/diagnostyka.png";

export default function ServiceDashboard() {
    const navigate = useNavigate();

    return (
        <div className="sd-grid">
            <button
                className="sd-tile sd-tile--big"
                type="button"
                onClick={() => navigate("/service/lockers")}
            >
                <div className="sd-title">ZARZĄDZANIE SKRYTKAMI</div>
                <img
                    className="sd-icon"
                    src={serviceIcon}
                    alt="Zarządzaj skrytkami"
                />
            </button>

            <button
                className="sd-tile sd-tile--big"
                type="button"
                onClick={() => navigate("/service/diagnostics")}
            >
                <div className="sd-title">DIAGNOSTYKA URZĄDZENIA</div>
                <img
                    className="sd-icon"
                    src={diagIcon}
                    alt="Diagnostyka urządzenia"
                />
            </button>
        </div>
    );
}
