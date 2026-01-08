import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";

export default function RedirectRoot() {
    const { user, authLoading } = useContext(AuthContext);

    if (authLoading) return null;

    return user
        ? <Navigate to="/panel" replace />
        : <Navigate to="/login" replace />;
}
