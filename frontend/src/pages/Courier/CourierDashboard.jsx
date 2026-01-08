import "./CourierDashboard.css";

import serviceIcon from "../../assets/service.png";
import placeIcon from "../../assets/umiescpaczke.png";
import checkIcon from "../../assets/check.png";

export default function CourierDashboard() {
    return (
        <div className="cd-grid">
            <button className="cd-tile cd-tile--big" type="button">
                <div className="cd-title">SKRYTKA</div>
                <img className="cd-icon" src={serviceIcon} alt="Skrytka" />
            </button>

            <button className="cd-tile cd-tile--big" type="button">
                <div className="cd-title">UMIEŚĆ PACZKĘ</div>
                <img className="cd-icon" src={placeIcon} alt="Umieść paczkę" />
            </button>

            <button className="cd-tile cd-tile--big" type="button">
                <div className="cd-title">POTWIERDŹ DOSTAWĘ</div>
                <img className="cd-icon" src={checkIcon} alt="Potwierdź dostawę" />
            </button>
        </div>
    );
}
