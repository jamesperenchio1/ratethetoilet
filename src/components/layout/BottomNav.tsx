import { NavLink } from "react-router-dom";

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
        <i />
        Nearby
      </NavLink>
      <NavLink to="/saved" className={({ isActive }) => (isActive ? "active" : "")}>
        <i />
        Saved
      </NavLink>
      <NavLink to="/add" className={({ isActive }) => (isActive ? "active" : "")}>
        <i />
        Add
      </NavLink>
      <NavLink to="/you" className={({ isActive }) => (isActive ? "active" : "")}>
        <i />
        You
      </NavLink>
    </nav>
  );
}
