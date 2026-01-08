import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";

import UserDashboard from "./User/UserDashboard";
import AdminDashboard from "./Admin/AdminDashboard";
import CourierDashboard from "./Courier/CourierDashboard";
import ServiceDashboard from "./Service/ServiceDashboard";

export default function PanelRouter() {
    const { user, authLoading } = useContext(AuthContext);

    if (authLoading) return null;
    if (!user) return <Navigate to="/login" />;

    switch (user.role) {
        case "admin":
            return <AdminDashboard />;
        case "courier":
            return <CourierDashboard />;
        case "service":
            return <ServiceDashboard />;
        default:
            return <UserDashboard />;
    }
}
