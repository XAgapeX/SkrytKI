import "./Send.css";
import lockerImg from "/public/lockers/0.png";

export default function Send() {
    return (
        <div className="send-page">
            <div className="send-content">

                {/* LEWA STRONA */}
                <div className="send-left">

                    <input className="field" placeholder="Nadaj nazwę" />
                    <select className="field">
                        <option>Wybierz miasto</option>
                    </select>
                    <input className="field" placeholder="Numer skrytki" />
                    <input className="field" placeholder="Email odbiorcy" />

                    <button className="primary-btn">
                        NADAJ
                    </button>
                </div>

                {/* PRAWA STRONA */}
                <div className="send-right">
                    <img
                        src={lockerImg}
                        alt="Skrytki"
                        className="send-locker-img"
                    />
                </div>

            </div>
        </div>
    );
}
