import "./ServiceDashboard.css";

import serviceIcon from "../../assets/service.png";
import lockersIcon from "../../assets/odbieram.png";
import diagIcon from "../../assets/diagnostyka.png";

export default function ServiceDashboard() {
    return (
        <div className="sd-grid">
            <button className="sd-tile sd-tile--big" type="button">
                <div className="sd-title">ZARZĄDZAJ SKRYTKAMI</div>
                <img className="sd-icon" src={serviceIcon} alt="Zarządzaj skrytkami" />
            </button>

            <button className="sd-tile sd-tile--big" type="button">
                <div className="sd-title">OTWÓRZ WSZYSTKIE SKRYTKI</div>
                <img className="sd-icon" src={lockersIcon} alt="Otwórz wszystkie skrytki" />
            </button>

            <button className="sd-tile sd-tile--big" type="button">
                <div className="sd-title">DIAGNOSTYKA URZĄDZENIA</div>
                <img className="sd-icon" src={diagIcon} alt="Diagnostyka urządzenia" />
            </button>
        </div>
    );
}
