import "./Pickup.css";
import lockerImg from "/public/lockers/0.png";
export default function Pickup() {
    return (
        <div className="pickup-page">
            <div className="pickup-content">

                {/* LEWA STRONA */}
                <div className="pickup-left">

                    <select className="field">
                        <option>Wybierz miasto</option>
                    </select>

                    <select className="field">
                        <option>Wybierz paczkę</option>
                    </select>

                    <button className="primary-btn">
                        ODBIERZ
                    </button>
                </div>

                {/* PRAWA STRONA – GRAFIKA */}
                <div className="pickup-right">
                    <img
                        src={lockerImg}
                        alt="Skrytki"
                        className="pickup-locker-img"
                    />
                </div>
            </div>
        </div>
    );
}
