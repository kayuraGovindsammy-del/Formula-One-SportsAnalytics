import { NavLink } from "react-router-dom";

function Navbar() {
  return (
    <header>
      <nav>
        <h2>F1 Analytics</h2>

        <ul>
          <li>
            <NavLink to="/">Dashboard</NavLink>
          </li>

          <li>
            <NavLink to="/drivers">Drivers</NavLink>
          </li>

          <li>
            <NavLink to="/races">Races</NavLink>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Navbar;