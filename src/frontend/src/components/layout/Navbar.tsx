import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

function Navbar() {
  const { role, submitterStatus } = useAuth();

  const canSubmit =
    role === "ADMIN" ||
    (role === "SUBMITTER" && submitterStatus === "approved");

  return (
  <header className="site-header">
    <nav className="site-nav">
      <NavLink to="/" className="site-brand">
        <span className="site-brand-mark">F1</span>
        <span>Analytics</span>
      </NavLink>

      <ul className="site-nav-links">
        <li>
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Dashboard
          </NavLink>
        </li>

        <li>
          <NavLink
            to="/drivers"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Drivers
          </NavLink>
        </li>

        <li>
          <NavLink
            to="/races"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Races
          </NavLink>
        </li>

        <li>
          <NavLink
            to="/constructors"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Constructors
          </NavLink>
        </li>

        <li>
          <NavLink
            to="/statistics"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Statistics
          </NavLink>
        </li>

        {canSubmit && (
          <li>
            <NavLink
              to="/submit"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              Submit Data
            </NavLink>
          </li>
        )}

        {role === "ADMIN" && (
          <>
            <li>
              <NavLink
                to="/admin/submitter-requests"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                Requests
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/admin/submissions"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                Reviews
              </NavLink>
            </li>
          </>
        )}
      </ul>

      <NavLink
        to="/account"
        className={({ isActive }) =>
          isActive
            ? "nav-account active"
            : "nav-account"
        }
      >
        Account
      </NavLink>
    </nav>
  </header>
);
}

export default Navbar;