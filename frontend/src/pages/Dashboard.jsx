import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profileApi } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

function isMissingProfile(error) {
  return /not found|não encontrado/i.test(error.message);
}

export default function Dashboard() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    profileApi
      .get(token)
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((err) => {
        if (!active) return;
        if (isMissingProfile(err)) setProfile(null);
        else setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const firstName = profile?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'estudante';

  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Painel</span>
          <h1>Olá, {firstName}!</h1>
          <p>Bem-vindo ao seu espaço de estudos.</p>
        </div>
        <Link className="button button-outline" to="/profile/edit">
          {profile ? 'Editar perfil' : 'Completar perfil'}
        </Link>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {loading ? (
        <div className="state-card">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando seu painel...</p>
        </div>
      ) : !profile ? (
        <div className="state-card">
          <span className="state-icon" aria-hidden="true">📝</span>
          <h2>Seu perfil ainda está vazio</h2>
          <p>Adicione seu nível acadêmico, matérias e interesses para começar.</p>
          <Link className="button button-primary" to="/profile/edit">Completar perfil</Link>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <article className="stat-card">
              <span className="stat-label">Nível acadêmico</span>
              <strong>{profile.academic_level || 'Não informado'}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Matérias</span>
              <strong>{profile.subjects?.length || 0}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Interesses</span>
              <strong>{profile.interests?.length || 0}</strong>
            </article>
          </div>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Resumo do perfil</h2>
                <Link to="/profile" className="text-link">Ver perfil completo</Link>
              </div>
              <p className="panel-text">
                {profile.bio || 'Você ainda não escreveu uma bio. Conte um pouco sobre seus estudos.'}
              </p>
              <dl className="detail-list">
                <div>
                  <dt>Nome</dt>
                  <dd>{profile.name || 'Não informado'}</dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd>{profile.email}</dd>
                </div>
              </dl>
            </section>

            <section className="panel">
              <h2>Próximo passo</h2>
              <p className="panel-text">
                Mantenha suas matérias e interesses atualizados para mostrar o que você
                está estudando no momento.
              </p>
              <div className="panel-actions">
                <Link className="button button-primary" to="/profile/edit">
                  Atualizar informações
                </Link>
                <Link className="button button-outline" to="/students">
                  Encontrar estudantes
                </Link>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
