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

function GroupCard({ group, busy, onJoin, onRequest }) {
  const created = formatDate(group.created_at);
  const creator = group.creator_name || group.creator_email;
  const requiresApproval = group.join_policy === 'approval';

  return (
    <article className="group-card">
      <div className="group-card-header">
        <div className="group-avatar" aria-hidden="true">
          {getInitials(group.name)}
        </div>

        <div className="group-identity">
          <h2>{group.name}</h2>
          <div className="tag-list">
            <span className="tag">{group.subject}</span>
            <span className="tag tag-accent">
              {requiresApproval ? 'Com aprovação' : 'Entrada livre'}
            </span>
          </div>
        </div>

        {group.is_member && <span className="match-badge">Você participa</span>}
        {!group.is_member && group.has_pending_request && (
          <span className="status-badge status-badge-pending">Solicitação enviada</span>
        )}
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

      <div className="group-card-actions">
        <Link className="button button-outline button-small" to={`/groups/${group.id}`}>
          Ver detalhes
        </Link>
        {!group.is_member && !group.has_pending_request && (
          requiresApproval ? (
            <button
              type="button"
              className="button button-primary button-small"
              disabled={busy}
              onClick={() => onRequest(group)}
            >
              {busy ? 'Enviando...' : 'Solicitar participação'}
            </button>
          ) : (
            <button
              type="button"
              className="button button-primary button-small"
              disabled={busy}
              onClick={() => onJoin(group)}
            >
              {busy ? 'Entrando...' : 'Entrar no grupo'}
            </button>
          )
        )}
      </div>
    </article>
  );
}

export default function Groups() {
  const { token } = useAuth();
  const location = useLocation();
  const [view, setView] = useState('all');
  const [subjectForm, setSubjectForm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyGroupId, setBusyGroupId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setActionError('');

    const request =
      view === 'mine'
        ? groupsApi.mine({ subject: subjectFilter }, token)
        : groupsApi.list({ subject: subjectFilter }, token);

    request
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
  }, [subjectFilter, token, view]);

  function handleSubmit(event) {
    event.preventDefault();
    setSubjectFilter(subjectForm.trim());
  }

  function clearFilter() {
    setSubjectForm('');
    setSubjectFilter('');
  }

  async function handleAction(group, action) {
    setBusyGroupId(group.id);
    setNotice('');
    setActionError('');

    try {
      if (action === 'join') {
        const updated = await groupsApi.join(group.id, token);
        setGroups((current) =>
          current.map((item) => (item.id === group.id ? updated : item)),
        );
        setNotice('Você entrou no grupo com sucesso!');
      } else {
        await groupsApi.request(group.id, token);
        setGroups((current) =>
          current.map((item) =>
            item.id === group.id ? { ...item, has_pending_request: true } : item,
          ),
        );
        setNotice('Solicitação enviada. Aguarde a aprovação do administrador.');
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyGroupId(null);
    }
  }

  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Grupos de estudo</span>
          <h1>{view === 'mine' ? 'Meus grupos' : 'Grupos de estudo'}</h1>
          <p>
            {view === 'mine'
              ? 'Acompanhe os grupos dos quais você participa.'
              : 'Reúna pessoas interessadas em aprender o mesmo conteúdo.'}
          </p>
        </div>
        <Link className="button button-primary" to="/groups/new">
          Criar grupo
        </Link>
      </div>

      <div className="view-switcher" role="tablist" aria-label="Visualização de grupos">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'all'}
          className={`view-tab${view === 'all' ? ' active' : ''}`}
          onClick={() => setView('all')}
        >
          Todos os grupos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'mine'}
          className={`view-tab${view === 'mine' ? ' active' : ''}`}
          onClick={() => setView('mine')}
        >
          Meus grupos
        </button>
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
      {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

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
                ? view === 'mine'
                  ? 'Você ainda não participa de nenhum grupo.'
                  : 'Nenhum grupo encontrado.'
                : view === 'mine'
                  ? `Você participa de ${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}.`
                  : `${groups.length} ${groups.length === 1 ? 'grupo encontrado' : 'grupos encontrados'}`}
            </p>
          </div>

          {groups.length === 0 ? (
            <div className="state-card">
              <span className="state-icon" aria-hidden="true">👥</span>
              <h2>
                {view === 'mine'
                  ? 'Nenhum grupo participado'
                  : subjectFilter
                    ? 'Nenhum grupo encontrado'
                    : 'Nenhum grupo criado ainda'}
              </h2>
              <p>
                {view === 'mine'
                  ? 'Explore os grupos disponíveis e entre em um para começar a estudar junto.'
                  : subjectFilter
                    ? 'Tente buscar por outra matéria ou crie o primeiro grupo sobre esse assunto.'
                    : 'Crie o primeiro grupo de estudo e convide outros estudantes.'}
              </p>
              {view === 'mine' ? (
                <button type="button" className="button button-primary" onClick={() => setView('all')}>
                  Ver grupos disponíveis
                </button>
              ) : subjectFilter ? (
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
                <GroupCard
                  group={group}
                  key={group.id}
                  busy={busyGroupId === group.id}
                  onJoin={(item) => handleAction(item, 'join')}
                  onRequest={(item) => handleAction(item, 'request')}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
