import { useState } from "react";
import "./Map.css";

const maps = {
    warszawa:
        "https://www.google.com/maps?q=52.231610624876026,21.03468982125436&z=14&output=embed",
    krakow:
        "https://www.google.com/maps?q=50.05831081733932,19.99935917523723&z=14&output=embed",
    tarnow:
        "https://www.google.com/maps?q=50.012218531600666,20.986982194583156&z=14&output=embed",
};

export default function Map() {
    const [city, setCity] = useState("");

    return (
        <div className="map-page">
            <div className="map-layout">
                {/* LEWA KOLUMNA */}
                <div className="map-controls">
                    <select
                        className="map-select"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                    >
                        <option value="">Wybierz miasto</option>
                        <option value="warszawa">Warszawa</option>
                        <option value="krakow">Kraków</option>
                        <option value="tarnow">Tarnów</option>
                    </select>
                </div>

                {/* PRAWA KOLUMNA – MAPA */}
                <div className="map-container">
                    {city ? (
                        <iframe
                            src={maps[city]}
                            width="100%"
                            height="100%"
                            style={{
                                border: 0,
                                borderRadius: "24px",
                            }}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Mapa Google"
                        />
                    ) : (
                        <div className="map-placeholder map-placeholder--empty">
                            Wybierz miasto
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
