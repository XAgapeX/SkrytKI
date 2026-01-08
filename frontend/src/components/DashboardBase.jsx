import { Outlet } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import "./DashboardBase.css";

export default function DashboardBase() {
    const { user } = useContext(AuthContext);

    const sectionTitleByRole = {
        user: "Twoje paczki",
        admin: "Administrator",
        courier: "Kurier",
        service: "Serwisant",
    };

    return (
        <div className="dashboard">

            {/* CONTENT */}
            <main className="dashboard-content">
                <div className="dashboard-inner">
                    <div className="dashboard-user">
                        Witaj!: <strong>{user?.email}</strong>
                    </div>

                    <div className="dashboard-section">
                        <span>{sectionTitleByRole[user?.role] || "Panel"}</span>
                    </div>

                    <Outlet />
                </div>
            </main>
        </div>
    );
}
