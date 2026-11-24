import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { groupsApi } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

function getInitials(name, email) {
  const source = (name || email || 'SL').trim();
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

export default function GroupDetail() {
  const { groupId } = useParams();
  const { token } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setActionError('');

    Promise.all([groupsApi.get(groupId, token), groupsApi.members(groupId, token)])
      .then(async ([groupData, membersData]) => {
        const requestsData = groupData.is_admin
          ? await groupsApi.requests(groupId, token)
          : [];
        if (active) {
          setGroup(groupData);
          setMembers(membersData);
          setRequests(requestsData);
        }
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
  }, [groupId, token]);

  async function handleJoinOrRequest(action) {
    setBusy(true);
    setNotice('');
    setActionError('');

    try {
      const updated =
        action === 'join'
          ? await groupsApi.join(groupId, token)
          : await groupsApi.request(groupId, token);
      const membersData = await groupsApi.members(groupId, token);

      setGroup(updated);
      setMembers(membersData);
      setNotice(
        action === 'join'
          ? 'Você entrou no grupo com sucesso!'
          : 'Solicitação enviada. Aguarde a aprovação do administrador.',
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDecision(joinRequest, decision) {
    setBusy(true);
    setNotice('');
    setActionError('');

    try {
      const updated =
        decision === 'approve'
          ? await groupsApi.approve(groupId, joinRequest.id, token)
          : await groupsApi.reject(groupId, joinRequest.id, token);
      const [membersData, requestsData] = await Promise.all([
        groupsApi.members(groupId, token),
        groupsApi.requests(groupId, token),
      ]);

      setGroup(updated);
      setMembers(membersData);
      setRequests(requestsData);
      setNotice(
        decision === 'approve'
          ? 'Solicitação aprovada. O estudante agora participa do grupo.'
          : 'Solicitação recusada.',
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const pendingRequests = requests.filter((request) => request.status === 'pending');
  const created = formatDate(group?.created_at);

  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Grupo de estudo</span>
          <h1>{group?.name || 'Grupo de estudo'}</h1>
          <p>Conheça o grupo, seus integrantes e participe das atividades.</p>
        </div>
        <Link className="button button-outline" to="/groups">
          ← Voltar para grupos
        </Link>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {loading ? (
        <div className="state-card">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando grupo...</p>
        </div>
      ) : error ? null : !group ? (
        <div className="state-card">
          <span className="state-icon" aria-hidden="true">🔍</span>
          <h2>Grupo não encontrado</h2>
          <p>Este grupo pode ter sido removido ou o link está incorreto.</p>
          <Link className="button button-primary" to="/groups">Ver grupos</Link>
        </div>
      ) : (
        <div className="profile-layout">
          <section className="panel profile-card">
            <div className="profile-identity">
              <div className="group-avatar" aria-hidden="true">
                {getInitials(group.name)}
              </div>
              <div>
                <h2>{group.name}</h2>
                <p>
                  Criado por {group.creator_name || group.creator_email}
                  {created ? ` em ${created}` : ''}
                </p>
              </div>
            </div>

            <div className="tag-list group-tags">
              <span className="tag">{group.subject}</span>
              <span className="tag tag-accent">
                {group.join_policy === 'approval' ? 'Com aprovação' : 'Entrada livre'}
              </span>
              <span className="tag">
                {members.length} {members.length === 1 ? 'membro' : 'membros'}
              </span>
            </div>

            <div className="profile-section">
              <h3>Sobre o grupo</h3>
              <p className="panel-text">{group.description}</p>
            </div>

            <div className="profile-section">
              <h3>Integrantes</h3>
              <ul className="member-list">
                {members.map((member) => (
                  <li className="member-item" key={member.email}>
                    <span className="member-avatar" aria-hidden="true">
                      {getInitials(member.name, member.email)}
                    </span>
                    <span className="member-identity">
                      <strong>{member.name || 'Estudante sem nome'}</strong>
                      <small>{member.email}</small>
                    </span>
                    {member.role === 'admin' && <span className="tag">Admin</span>}
                    <span className="muted member-date">{formatDate(member.joined_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="panel profile-side">
            <h3>Participação</h3>
            {group.is_member ? (
              <p className="muted">
                Você participa deste grupo
                {group.is_admin ? ' como administrador.' : '.'}
              </p>
            ) : group.has_pending_request ? (
              <>
                <p className="muted">Sua solicitação está aguardando aprovação.</p>
                <span className="status-badge status-badge-pending">
                  Solicitação pendente
                </span>
              </>
            ) : group.join_policy === 'approval' ? (
              <>
                <p className="muted">
                  Este grupo exige aprovação. Envie uma solicitação para participar.
                </p>
                <button
                  type="button"
                  className="button button-primary button-full"
                  disabled={busy}
                  onClick={() => handleJoinOrRequest('request')}
                >
                  {busy ? 'Enviando...' : 'Solicitar participação'}
                </button>
              </>
            ) : (
              <>
                <p className="muted">Este grupo permite entrada direta.</p>
                <button
                  type="button"
                  className="button button-primary button-full"
                  disabled={busy}
                  onClick={() => handleJoinOrRequest('join')}
                >
                  {busy ? 'Entrando...' : 'Entrar no grupo'}
                </button>
              </>
            )}

            {group.is_admin && (
              <div className="requests-section">
                <h3>Solicitações pendentes</h3>
                {pendingRequests.length === 0 ? (
                  <p className="muted">Nenhuma solicitação pendente.</p>
                ) : (
                  <ul className="request-list">
                    {pendingRequests.map((request) => (
                      <li className="request-item" key={request.id}>
                        <strong>{request.name || 'Estudante sem nome'}</strong>
                        <small>
                          {request.email}
                          {formatDate(request.created_at) ? ` · ${formatDate(request.created_at)}` : ''}
                        </small>
                        <div className="request-actions">
                          <button
                            type="button"
                            className="button button-primary button-small"
                            disabled={busy}
                            onClick={() => handleDecision(request, 'approve')}
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            className="button button-outline button-small"
                            disabled={busy}
                            onClick={() => handleDecision(request, 'reject')}
                          >
                            Recusar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
