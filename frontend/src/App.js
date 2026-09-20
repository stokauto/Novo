import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Listing from "@/pages/Listing";
import VehicleDetail from "@/pages/VehicleDetail";
import DealerList from "@/pages/DealerList";
import DealerProfile from "@/pages/DealerProfile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import DealerPanel from "@/pages/DealerPanel";
import AdminPanel from "@/pages/AdminPanel";
import Repasse from "@/pages/Repasse";
import RepasseDetail from "@/pages/RepasseDetail";
import Services from "@/pages/Services";
import ServiceProfile from "@/pages/ServiceProfile";
import LandingPlans from "@/pages/LandingPlans";
import WhiteLabelSite from "@/pages/WhiteLabelSite";
import WhiteLabelVehicleDetail from "@/pages/WhiteLabelVehicleDetail";
import { isWhiteLabelMode } from "@/lib/whiteLabel";
import RegionalLanding from "@/pages/RegionalLanding";
import ComingSoon from "@/pages/ComingSoon";

const CAMPO_GRANDE_REGION = {
  city: "Campo Grande",
  uf: "MS",
  ufFull: "Mato Grosso do Sul",
  citySlug: "campo-grande-ms",
  h1: "Veículos e Repasses em Campo Grande - MS",
  seoTitle: "StockAuto | Classificados de Veículos e Repasse em Campo Grande - MS",
  seoDesc:
    "Carros, motos, camionetes e caminhões seminovos em Campo Grande/MS. Anúncios verificados de revendedores locais + Hub de Repasse B2B exclusivo. Contato direto via WhatsApp pelo StockAuto.",
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  // White-label mode: when the app is being served from a tenant subdomain
  // (or overridden via ?subdomain=/localStorage in dev), render the store site
  // in complete isolation from the main portal — no shared header/footer/menu.
  const whiteLabel = isWhiteLabelMode();
  if (whiteLabel) {
    return (
      <div className="App">
        <BrowserRouter>
          <AuthProvider>
            <ScrollToTop />
            <Routes>
              {/* Tenant-scoped vehicle detail — mirrors the portal's /veiculo/:slug
                  route so existing links keep working, but renders WITHOUT the
                  main StockAuto chrome. */}
              <Route path="/veiculo/:slug" element={<WhiteLabelVehicleDetail />} />
              <Route path="*" element={<WhiteLabelSite />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            {/* Path-based white-label — rendered WITHOUT the shared Layout
                so the main StockAuto chrome (header, menu, footer) never
                appears on tenant pages. The subdomain is read from the URL
                via useParams and passed to the backend as `?sub=`; no
                localStorage fallback is used on the production domain. */}
            <Route path="/loja/:subdomain" element={<WhiteLabelSite pathMode />} />
            <Route path="/loja/:subdomain/veiculo/:slug" element={<WhiteLabelVehicleDetail pathMode />} />

            {/* All remaining portal routes stay wrapped by the shared Layout. */}
            <Route element={<Layout><Outlet /></Layout>}>
              <Route path="/" element={<Home />} />
              <Route path="/veiculos" element={<Listing />} />
              <Route path="/veiculo/:slug" element={<VehicleDetail />} />
              <Route path="/revendedores" element={<DealerList />} />
              <Route path="/revendedor/:slug" element={<DealerProfile />} />
              <Route path="/servicos" element={<Services />} />
              <Route path="/servicos/:slug" element={<ServiceProfile />} />
              <Route path="/comece-agora" element={<LandingPlans />} />
              <Route path="/planos-agora" element={<Navigate to="/comece-agora" replace />} />
              <Route path="/planos" element={<Navigate to="/cadastro" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Register />} />
              <Route
                path="/painel"
                element={
                  <ProtectedRoute role="dealer">
                    <DealerPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute role="admin">
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/repasse"
                element={
                  <ProtectedRoute roles={["dealer", "admin"]}>
                    <Repasse />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/repasse/:slug"
                element={
                  <ProtectedRoute roles={["dealer", "admin"]}>
                    <RepasseDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seminovos-campo-grande-ms"
                element={<RegionalLanding {...CAMPO_GRANDE_REGION} />}
              />
              <Route path="*" element={<ComingSoon title="Página não encontrada" />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
