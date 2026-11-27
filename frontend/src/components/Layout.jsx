import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Layout() {
  const { token, user, logout } = useAuth();
  const displayName = user?.email?.split('@')[0];

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="StudyLink — página inicial">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span>Study<span className="brand-accent">Link</span></span>
          </Link>

          <nav className="main-nav" aria-label="Navegação principal">
            {token ? (
              <>
                <NavLink to="/dashboard">Painel</NavLink>
                <NavLink to="/students">Estudantes</NavLink>
                <NavLink to="/groups">Grupos</NavLink>
                <NavLink to="/profile">Perfil</NavLink>
                <button type="button" className="nav-logout" onClick={logout}>
                  Sair{displayName ? `, ${displayName}` : ''}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/">Início</NavLink>
                <NavLink to="/login">Entrar</NavLink>
                <Link className="button button-small button-primary" to="/register">
                  Criar conta
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span>StudyLink</span>
          <span>Seu espaço para crescer junto.</span>
        </div>
      </footer>
    </div>
  );
}
