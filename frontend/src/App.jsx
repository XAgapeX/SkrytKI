import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, AuthContext } from "./AuthContext";
import { useContext } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Lockers from "./pages/Lockers";

function NavBar() {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        marginBottom: "20px",
      }}
    >
      <Link to="/">Login</Link>
      <Link to="/register">Register</Link>
      <Link to="/lockers">Lockers</Link>

      {user && (
        <button
          onClick={logout}
          style={{
            marginLeft: "auto",
            background: "#222",
            color: "#fff",
            border: "1px solid #555",
            padding: "4px 10px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/lockers" element={<Lockers />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}