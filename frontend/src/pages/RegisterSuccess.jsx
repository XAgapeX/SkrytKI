import { useNavigate } from "react-router-dom";
import "./RegisterSuccess.css";

export default function RegisterSuccess() {
    const navigate = useNavigate();

    return (
        <div className="success-page">
            <div className="success-card">
                <h1>Konto zostało stworzone!</h1>
                <p>
                    Możesz się teraz zalogować i korzystać ze skrytek - SkrytKI.
                </p>

                <button className="primary-btn" onClick={() => navigate("/login")}>
                    Przejdź do logowania
                </button>
            </div>
        </div>
    );
}
