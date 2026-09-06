import { Route, Routes, useLocation } from "react-router-dom";
import { BottomNav } from "./components/layout/BottomNav";
import { OfflineBanner } from "./components/layout/OfflineBanner";
import { Home } from "./routes/Home";
import { Search } from "./routes/Search";
import { ToiletDetail } from "./routes/ToiletDetail";
import { EditToilet } from "./routes/EditToilet";
import { AddPhotosOnly } from "./routes/AddPhotosOnly";
import { AddToiletWizard } from "./routes/add/AddToiletWizard";
import { You } from "./routes/You";
import { SaveHandle } from "./routes/SaveHandle";
import { LogIn } from "./routes/LogIn";
import { ResetPassword } from "./routes/ResetPassword";
import { Settings } from "./routes/Settings";
import { AuthCallback } from "./routes/AuthCallback";
import { AdminDashboard } from "./routes/admin/AdminDashboard";
import { Rules } from "./routes/Rules";

const TAB_ROUTES = new Set(["/", "/you"]);

export default function App() {
  const location = useLocation();
  const showNav = TAB_ROUTES.has(location.pathname);

  return (
    <div className="app-shell">
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/t/:id" element={<ToiletDetail />} />
        <Route path="/t/:id/edit" element={<EditToilet />} />
        <Route path="/t/:id/add-photos" element={<AddPhotosOnly />} />
        <Route path="/add" element={<AddToiletWizard />} />
        <Route path="/you" element={<You />} />
        <Route path="/you/save-handle" element={<SaveHandle />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  );
}
