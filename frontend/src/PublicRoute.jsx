import { Navigate, Outlet } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./AuthContext";

export default function PublicRoute() {
    const { user, authLoading } = useContext(AuthContext);

    if (authLoading) return null;

    if (user) {
        if (user.role === "admin") return <Navigate to="/admin" replace />;
        if (user.role === "courier") return <Navigate to="/courier" replace />;
        if (user.role === "service") return <Navigate to="/service" replace />;
        return <Navigate to="/panel" replace />;
    }

    return <Outlet />;
}
