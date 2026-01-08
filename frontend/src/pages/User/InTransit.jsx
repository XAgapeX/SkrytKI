import "./InTransit.css";

export default function InTransit() {
    return (
        <div className="intransit-page">
            <div className="intransit-content">

                {/* LEWA STRONA – LISTA PACZEK */}
                <div className="intransit-left">
                    <div className="intransit-left-left">
                        <h4 className="package-column-title">
                            Paczki nadane przeze mnie
                        </h4>
                        <button className="package-btn">Nazwa paczki 1</button>
                        <button className="package-btn">Nazwa paczki 2</button>
                        <button className="package-btn">Nazwa paczki 3</button>
                    </div>
                    <div className="intransit-left-right">
                        <h4 className="package-column-title">
                            Paczki odbierane przeze mnie
                        </h4>
                        <button className="package-btn">Nazwa paczki 1</button>
                        <button className="package-btn">Nazwa paczki 2</button>
                        <button className="package-btn">Nazwa paczki 3</button>
                    </div>
                </div>

                {/* PRAWA STRONA – SZCZEGÓŁY */}
                <div className="intransit-right">
                    <h3>Nazwa paczki 1</h3>


                    <p>Paczka w paczkomacie docelowym | data.godzina</p>
                    <p>Paczka znajduje się | lokalizacja</p>
                    <p>W drodze do miejsca docelowego | data.godzina</p>
                    <p>Kiedy została zabrana przez kuriera | data.godzina</p>
                    <p>Kiedy została nadana | data.godzina</p>

                </div>

            </div>
        </div>
    );
}
