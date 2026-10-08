import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth/useAuth";

import Dashboard from "./pages/Dashboard/Dashboard";
import Drivers from "./pages/Drivers/Drivers";
import DriverDetails from "./pages/DriverDetails/DriverDetails";
import Races from "./pages/Races/Races";
import RaceDetails from "./pages/RaceDetails/RaceDetails";

import Login from "./pages/Auth/Login";
import Account from "./pages/Auth/Account";

import SubmitterRequests from "./pages/Admin/SubmitterRequests";
import SubmissionReview from "./pages/Admin/SubmissionReview";

import SubmitData from "./pages/Submit/SubmitData";
import MySubmissions from "./pages/Submit/MySubmissions";

import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import SubmitterRoute from "./auth/SubmitterRoute";

import Layout from "./components/layout/Layout";
import ChatWidget from "./components/chat/ChatWidget";
import Constructors from "./pages/Constructors/Constructors";
import Statistics from "./pages/Statistics/Statistics";

function App() {
  const { user } = useAuth();

  return (
    <>
    <Routes>
      {/* PUBLIC */}
      <Route
        path="/login"
        element={user ? (
      <Navigate to="/" replace />
    ) : (
      <Login />
    )
    }
      />

      {/* DASHBOARD */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* DRIVERS */}
      <Route
        path="/drivers"
        element={
          <ProtectedRoute>
            <Layout>
              <Drivers />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* DRIVER DETAILS */}
      <Route
        path="/drivers/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <DriverDetails />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* RACES */}
      <Route
        path="/races"
        element={
          <ProtectedRoute>
            <Layout>
              <Races />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* RACE DETAILS */}
      <Route
        path="/races/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <RaceDetails />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* ACCOUNT */}
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <Layout>
              <Account />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* ADMIN - SUBMITTER REQUESTS */}
      <Route
        path="/admin/submitter-requests"
        element={
          <AdminRoute>
            <Layout>
              <SubmitterRequests />
            </Layout>
          </AdminRoute>
        }
      />

      {/* ADMIN - SUBMISSION REVIEW */}
      <Route
        path="/admin/submissions"
        element={
          <AdminRoute>
            <Layout>
              <SubmissionReview />
            </Layout>
          </AdminRoute>
        }
      />

      <Route
        path="/my-submissions"
        element={
          <ProtectedRoute>
            <Layout><MySubmissions /></Layout>
          </ProtectedRoute>
        }
      />

      {/* APPROVED SUBMITTER */}
      <Route
        path="/submit"
        element={
          <SubmitterRoute>
            <Layout>
              <SubmitData />
            </Layout>
          </SubmitterRoute>
        }
      />
      
      <Route
  path="/constructors"
  element={
    <ProtectedRoute>
      <Layout>
        <Constructors />
      </Layout>
    </ProtectedRoute>
  }
/>

<Route
  path="/statistics"
  element={
    <ProtectedRoute>
      <Layout>
        <Statistics />
      </Layout>
    </ProtectedRoute>
  }
/>
      

    </Routes>

    {/* Outside the routes so it never remounts: the conversation survives
        navigation, and it shows on every page, including /login. */}
    <ChatWidget />
    </>
  );
}

export default App;