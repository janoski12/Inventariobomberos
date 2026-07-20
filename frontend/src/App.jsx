import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DialogProvider } from './context/DialogContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import NavBar from './components/NavBar';
import CambiarPassword from './components/CambiarPassword';
import BusquedaItems from './pages/BusquedaItems';
import FichaItem from './pages/FichaItem';
import NuevoItem from "./pages/NuevoItem";
import Bomberos from "./pages/Bomberos";
import FichaBombero from "./pages/FichaBombero";
import Ubicaciones from "./pages/Ubicaciones";
import FichaUbicacion from "./pages/FichaUbicacion";
import Carros from "./pages/Carros";
import FichaCarro from "./pages/FichaCarro";
import RevisionCarroPublica from "./pages/RevisionCarroPublica";
import Reportes from "./pages/Reportes";
import Importar from "./pages/Importar";
import Trauma from "./pages/Trauma";
import Login from "./pages/Login";
import Usuarios from "./pages/Usuarios";

// Ficha autenticada de la app: requiere sesion. Se separa de AppContent para
// que la ruta publica de revision de carros (sin login) pueda vivir al lado,
// sin quedar bloqueada por el gate de autenticacion.
function AppAutenticada() {
  const { usuario, cargando, logout, esAdmin } = useAuth();
  const [openPassword, setOpenPassword] = useState(false);

  if (cargando) {
    return <div className="login-screen"><p className="muted">Cargando...</p></div>;
  }

  if (!usuario) {
    return <Login />;
  }

  return (
    <>
      <header className="app-header">
        <span className="app-header-badge">CBT10</span>
        <span className="app-header-title">Inventario Bomberos</span>
        <div className="app-header-user">
          <span className="app-header-rol">{usuario.rol}</span>
          <button
            className="app-header-nombre app-header-nombre--btn"
            title="Cambiar mi contraseña"
            onClick={() => setOpenPassword(true)}
          >
            {usuario.nombre ?? usuario.username}
          </button>
          <button className="btn-logout" onClick={logout}>Salir</button>
        </div>
      </header>
      <CambiarPassword open={openPassword} onClose={() => setOpenPassword(false)} />
      <NavBar esAdmin={esAdmin} />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<BusquedaItems />} />
          <Route path="/items/nuevo" element={<NuevoItem />} />
          <Route path="/items/:id" element={<FichaItem />} />
          <Route path="/bomberos" element={<Bomberos />} />
          <Route path="/bomberos/:id" element={<FichaBombero />} />
          <Route path="/ubicaciones" element={<Ubicaciones />} />
          <Route path="/ubicaciones/:id" element={<FichaUbicacion />} />
          <Route path="/carros" element={<Carros />} />
          <Route path="/carros/:id" element={<FichaCarro />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/trauma" element={<Trauma />} />
          {esAdmin && <Route path="/usuarios" element={<Usuarios />} />}
        </Routes>
      </main>
    </>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Publica: cualquier bombero, sin login, escaneando el QR de revision del carro */}
        <Route path="/revision-carro/:id" element={<RevisionCarroPublica />} />
        <Route path="/*" element={<AppAutenticada />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <DialogProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </DialogProvider>
  );
}

export default App;
