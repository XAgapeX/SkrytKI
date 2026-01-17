import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";

import MainLayout from "./components/MainLayout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterSuccess from "./pages/RegisterSuccess";


import DashboardBase from "./components/DashboardBase";
import PanelRouter from "./pages/PanelRouter";
import RedirectRoot from "./components/RedirectRoot";

import Pickup from "./pages/User/Pickup";
import InTransit from "./pages/User/InTransit";
import Send from "./pages/User/Send";
import Profile from "./pages/User/Profile";
import Map from "./pages/User/Map.jsx";
import History from "./pages/User/History.jsx";

import AdminDashboard from "./pages/Admin/AdminDashboard";
import Lockers from "./pages/Admin/ManageLockers";
import Reports from "./pages/Admin/Reports";
import Users from "./pages/Admin/Users";

import CourierDashboard from "./pages/Courier/CourierDashboard";
import CourierOverview from "./pages/Courier/CourierOverview";
import CourierPickup from "./pages/Courier/CourierPickup";
import CourierDelivery from "./pages/Courier/CourierDelivery";


export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>

                    {/* PUBLIC */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/register-success" element={<RegisterSuccess />} />


                    {/* Z NAVBAREM */}
                    <Route element={<MainLayout />}>
                        <Route element={<DashboardBase />}>

                            {/* USER */}
                            <Route path="/panel">
                                <Route index element={<PanelRouter />} />
                                <Route path="pickup" element={<Pickup />} />
                                <Route path="in-transit" element={<InTransit />} />
                                <Route path="send" element={<Send />} />
                                <Route path="profile" element={<Profile />} />
                                <Route path="map" element={<Map />} />
                                <Route path="history" element={<History />} />
                            </Route>

                            {/* ADMIN */}
                            <Route path="/admin">
                                <Route index element={<AdminDashboard />} />
                                <Route path="lockers" element={<Lockers />} />
                                <Route path="reports" element={<Reports />} />
                                <Route path="users" element={<Users />} />
                            </Route>

                            {/* COURIER */}
                            <Route path="/courier">
                                <Route index element={<CourierDashboard />} />
                                <Route path="overview" element={<CourierOverview />} />
                                <Route path="pickup" element={<CourierPickup />} />
                                <Route path="delivery" element={<CourierDelivery />} />
                            </Route>

                        </Route>

                        <Route path="/" element={<RedirectRoot />} />
                        <Route path="*" element={<RedirectRoot />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
