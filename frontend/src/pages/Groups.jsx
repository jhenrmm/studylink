import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SUBJECT_SUGGESTIONS } from '../academicOptions.js';
import { groupsApi } from '../api.js';
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
  if (!value) return null;

  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function GroupCard({ group }) {
  const created = formatDate(group.created_at);
  const creator = group.creator_name || group.creator_email;

  return (
    <article className="group-card">
      <div className="group-card-header">
        <div className="group-avatar" aria-hidden="true">
          {getInitials(group.name)}
        </div>

        <div className="group-identity">
          <h2>{group.name}</h2>
          <span className="tag">{group.subject}</span>
        </div>

        {group.is_admin && <span className="match-badge">Você é admin</span>}
      </div>

      <p className="group-description">{group.description}</p>

      <div className="group-card-footer">
        <span className="muted">
          Criado por {creator}
          {created ? ` em ${created}` : ''}
        </span>
        <span className="group-members">
          {group.member_count} {group.member_count === 1 ? 'membro' : 'membros'}
        </span>
      </div>
    </article>
  );
}

export default function Groups() {
  const { token } = useAuth();
  const location = useLocation();
  const [subjectForm, setSubjectForm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    groupsApi
      .list({ subject: subjectFilter }, token)
      .then((data) => {
        if (active) setGroups(data);
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
  }, [subjectFilter, token]);

  function handleSubmit(event) {
    event.preventDefault();
    setSubjectFilter(subjectForm.trim());
  }

  function clearFilter() {
    setSubjectForm('');
    setSubjectFilter('');
  }

  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Grupos de estudo</span>
          <h1>Grupos de estudo</h1>
          <p>Reúna pessoas interessadas em aprender o mesmo conteúdo.</p>
        </div>
        <Link className="button button-primary" to="/groups/new">
          Criar grupo
        </Link>
      </div>

      {location.state?.created && (
        <div className="alert alert-success" role="status">
          Grupo criado com sucesso! Você é o administrador.
        </div>
      )}

      <form className="panel search-panel" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="group-subject-filter">Matéria ou assunto</label>
          <input
            id="group-subject-filter"
            type="text"
            list="group-subjects"
            maxLength={100}
            placeholder="Ex.: Matemática"
            value={subjectForm}
            onChange={(event) => setSubjectForm(event.target.value)}
          />
          <datalist id="group-subjects">
            {SUBJECT_SUGGESTIONS.map((subject) => <option value={subject} key={subject} />)}
          </datalist>
          <small className="field-hint">Filtre os grupos por matéria ou assunto.</small>
        </div>

        <div className="search-actions">
          <button type="button" className="button button-outline" onClick={clearFilter}>
            Limpar filtro
          </button>
          <button type="submit" className="button button-primary">
            Buscar grupos
          </button>
        </div>
      </form>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {loading ? (
        <div className="state-card">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando grupos...</p>
        </div>
      ) : error ? null : (
        <>
          <div className="results-bar">
            <p role="status">
              {groups.length === 0
                ? 'Nenhum grupo encontrado.'
                : `${groups.length} ${groups.length === 1 ? 'grupo encontrado' : 'grupos encontrados'}`}
            </p>
          </div>

          {groups.length === 0 ? (
            <div className="state-card">
              <span className="state-icon" aria-hidden="true">👥</span>
              <h2>
                {subjectFilter ? 'Nenhum grupo encontrado' : 'Nenhum grupo criado ainda'}
              </h2>
              <p>
                {subjectFilter
                  ? 'Tente buscar por outra matéria ou crie o primeiro grupo sobre esse assunto.'
                  : 'Crie o primeiro grupo de estudo e convide outros estudantes.'}
              </p>
              {subjectFilter ? (
                <button type="button" className="button button-outline" onClick={clearFilter}>
                  Limpar filtro
                </button>
              ) : (
                <Link className="button button-primary" to="/groups/new">Criar grupo</Link>
              )}
            </div>
          ) : (
            <div className="groups-grid">
              {groups.map((group) => (
                <GroupCard group={group} key={group.id} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
