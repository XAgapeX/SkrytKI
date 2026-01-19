import { useNavigate } from "react-router-dom";
import "./UserDashboard.css";

import odbieramIcon from "../../assets/odbieram.png";
import wdrodzeIcon from "../../assets/wdrodze.png";
import nadajeIcon from "../../assets/nadaje.png";
import usersIcon from "../../assets/users.png";
import mapsIcon from "../../assets/maps.png";
import historyIcon from "../../assets/history.png";

export default function UserDashboard() {
    const navigate = useNavigate();

    return (
        <div className="ud-grid">
            <button
                className="ud-tile ud-tile--big"
                type="button"
                onClick={() => navigate("/panel/pickup")}
            >
                <div className="ud-title">ODBIERAM</div>
                <img className="ud-icon" src={odbieramIcon} alt="Pickup" />
            </button>

            <button
                className="ud-tile ud-tile--big"
                type="button"
                onClick={() => navigate("/panel/in-transit")}
            >
                <div className="ud-title">W DRODZE</div>
                <img className="ud-icon" src={wdrodzeIcon} alt="In transit" />
            </button>

            <button
                className="ud-tile ud-tile--big"
                type="button"
                onClick={() => navigate("/panel/send")}
            >
                <div className="ud-title">NADAJĘ</div>
                <img className="ud-icon" src={nadajeIcon} alt="Send" />
            </button>

            <button
                className="ud-tile ud-tile--big"
                type="button"
                onClick={() => navigate("/panel/profile")}
            >
                <div className="ud-title">EDYTUJ PROFIL</div>
                <img className="ud-icon" src={usersIcon} alt="User" />
            </button>

            <button
                className="ud-tile ud-tile--big"
                type="button"
                onClick={() => navigate("/panel/map")}
            >
                <div className="ud-title">MAPA SKRYTKOMATÓW</div>
                <img className="ud-icon" src={mapsIcon} alt="Maps" />
            </button>

            <button
                className="ud-tile ud-tile--big"
                type="button"
                onClick={() => navigate("/panel/history")}
            >
                <div className="ud-title">HISTORIA MOICH PACZEK</div>
                <img className="ud-icon" src={historyIcon} alt="USER" />
            </button>
        </div>
    );
}
