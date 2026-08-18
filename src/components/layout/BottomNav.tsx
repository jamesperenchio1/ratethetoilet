import { NavLink } from "react-router-dom";
import { AddIcon, NearbyIcon, YouIcon } from "./NavIcons";

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
        <NearbyIcon />
        Nearby
      </NavLink>
      <NavLink to="/add" className={({ isActive }) => (isActive ? "active" : "")}>
        <AddIcon />
        Add
      </NavLink>
      <NavLink to="/you" className={({ isActive }) => (isActive ? "active" : "")}>
        <YouIcon />
        You
      </NavLink>
    </nav>
  );
}
