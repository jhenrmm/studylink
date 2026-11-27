import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { studentsApi } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

function getInitials(name) {
  const source = (name || 'SL').trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function StudentProfile() {
  const { studentId } = useParams();
  const { token } = useAuth();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    studentsApi
      .get(studentId, token)
      .then((data) => {
        if (active) setStudent(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [studentId, token]);

  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Perfil do estudante</span>
          <h1>{student?.name || 'Estudante'}</h1>
          <p>Conheça as matérias e os interesses acadêmicos deste estudante.</p>
        </div>
        <Link className="button button-outline" to="/students">
          ← Voltar para estudantes
        </Link>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {loading ? (
        <div className="state-card">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando perfil...</p>
        </div>
      ) : error ? null : !student ? (
        <div className="state-card">
          <span className="state-icon" aria-hidden="true">🔍</span>
          <h2>Estudante não encontrado</h2>
          <p>Este perfil pode ter sido removido ou o link está incorreto.</p>
          <Link className="button button-primary" to="/students">Ver estudantes</Link>
        </div>
      ) : (
        <div className="profile-layout">
          <section className="panel profile-card">
            <div className="profile-identity">
              <div className="profile-avatar" aria-hidden="true">
                {getInitials(student.name)}
              </div>
              <div>
                <h2>{student.name || 'Estudante sem nome'}</h2>
              </div>
            </div>

            {student.academic_level && (
              <span className="level-badge">{student.academic_level}</span>
            )}

            <div className="profile-section">
              <h3>Sobre</h3>
              <p className="panel-text">
                {student.bio || 'Este estudante ainda não escreveu uma bio.'}
              </p>
            </div>

            <div className="profile-section">
              <h3>Matérias</h3>
              {student.subjects?.length ? (
                <div className="tag-list">
                  {student.subjects.map((subject) => (
                    <span className="tag" key={subject}>{subject}</span>
                  ))}
                </div>
              ) : (
                <p className="muted">Nenhuma matéria informada.</p>
              )}
            </div>

            <div className="profile-section">
              <h3>Interesses</h3>
              {student.interests?.length ? (
                <div className="tag-list">
                  {student.interests.map((interest) => (
                    <span className="tag tag-accent" key={interest}>{interest}</span>
                  ))}
                </div>
              ) : (
                <p className="muted">Nenhum interesse informado.</p>
              )}
            </div>
          </section>

          <aside className="panel profile-side">
            <h3>Detalhes</h3>
            {student.updated_at && (
              <div className="side-stat">
                <span>Última atualização</span>
                <strong>{formatDate(student.updated_at)}</strong>
              </div>
            )}
            <Link className="button button-outline button-full" to="/students">
              Ver outros estudantes
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
