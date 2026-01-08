import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

import lockersIcon from "../../assets/odbieram.png";
import reportsIcon from "../../assets/raporty.png";
import usersIcon from "../../assets/users.png";

export default function AdminDashboard() {
    const navigate = useNavigate();

    return (
        <div className="ad-grid">
            <button
                className="ad-tile ad-tile--big"
                type="button"
                onClick={() => navigate("/admin/lockers")}
            >
                <div className="ad-title">ZARZĄDZAJ SKRYTKAMI</div>
                <img className="ad-icon" src={lockersIcon} alt="Zarządzaj skrytkami" />
            </button>

            <button
                className="ad-tile ad-tile--big"
                type="button"
                onClick={() => navigate("/admin/reports")}
            >
                <div className="ad-title">GENERUJ RAPORTY</div>
                <img className="ad-icon" src={reportsIcon} alt="Generuj raporty" />
            </button>

            <button
                className="ad-tile ad-tile--big"
                type="button"
                onClick={() => navigate("/admin/users")}
            >
                <div className="ad-title">ZARZĄDZAJ UŻYTKOWNIKAMI</div>
                <img className="ad-icon" src={usersIcon} alt="Zarządzaj użytkownikami" />
            </button>
        </div>
    );
}
