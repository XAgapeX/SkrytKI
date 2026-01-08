import "./Navbar.css";
import { Link } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../AuthContext";
import logo from "../assets/logo.png";

export default function Navbar() {
    const { user, logout } = useContext(AuthContext);
    const [menuOpen, setMenuOpen] = useState(false);

    function handleLogout() {
        logout();
        setMenuOpen(false);
    }

    return (
        <header className="navbar">
            <div className="navbar-top">
                {/* LOGO */}
                <Link to="/" className="logo" onClick={() => setMenuOpen(false)}>
                    <img src={logo} alt="SkrytKI logo" className="logo-img" />
                    <span className="logo-text">SkrytKI</span>
                </Link>

                {/* DESKTOP MENU */}
                <div className="navbar-desktop">
                    {user ? (
                        <>
                            <Link to="/panel" className="nav-btn">
                                PANEL
                            </Link>
                            <Link to="/login" onClick={handleLogout} className="nav-btn">
                                WYLOGUJ
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link to="/register" className="nav-btn">
                                REJESTRACJA
                            </Link>
                            <Link to="/login" className="nav-btn">
                                ZALOGUJ
                            </Link>
                        </>
                    )}
                </div>

                {/* HAMBURGER */}
                <button
                    className="hamburger"
                    aria-label="Menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen(!menuOpen)}
                >
                    {menuOpen ? "✕" : "☰"}
                </button>
            </div>

            {/* MOBILE MENU */}
            {menuOpen && (
                <div className="navbar-mobile">
                    {user ? (
                        <>
                            <Link
                                to="/panel"
                                className="nav-btn"
                                onClick={() => setMenuOpen(false)}
                            >
                                PANEL
                            </Link>
                            <Link
                                to="/login"
                                onClick={handleLogout}
                                className="nav-btn"
                            >
                                WYLOGUJ
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                to="/register"
                                className="nav-btn"
                                onClick={() => setMenuOpen(false)}
                            >
                                REJESTRACJA
                            </Link>
                            <Link
                                to="/login"
                                className="nav-btn"
                                onClick={() => setMenuOpen(false)}
                            >
                                ZALOGUJ
                            </Link>
                        </>
                    )}
                </div>
            )}
        </header>
    );
}
