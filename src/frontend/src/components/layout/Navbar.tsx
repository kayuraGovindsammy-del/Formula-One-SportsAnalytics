import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

function Navbar() {
  const { role, submitterStatus } = useAuth();

  const canSubmit =
    role === "ADMIN" ||
    (role === "SUBMITTER" && submitterStatus === "approved");

  return (
    <header>
      <nav>
        <h2>F1 Analytics</h2>

        <ul>
          <li>
            <NavLink to="/">
              Dashboard
            </NavLink>
          </li>

          <li>
            <NavLink to="/drivers">
              Drivers
            </NavLink>
          </li>

          <li>
            <NavLink to="/races">
              Races
            </NavLink>
          </li>

          <li>
            <NavLink to="/constructors">
              Constructors
            </NavLink>
          
          </li>

          <li>
             <NavLink to="/statistics">Statistics</NavLink>
          </li>

          {canSubmit && (
            <li>
              <NavLink to="/submit">
                Submit Data
              </NavLink>
            </li>
          )}

          {role === "ADMIN" && (
            <>
              <li>
                <NavLink to="/admin/submitter-requests">
                  Submitter Requests
                </NavLink>
              </li>

              <li>
                <NavLink to="/admin/submissions">
                  Review Submissions
                </NavLink>
              </li>
            </>
          )}

          <li>
            <NavLink to="/account">
              Account
            </NavLink>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Navbar;