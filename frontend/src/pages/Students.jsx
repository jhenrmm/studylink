import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  INTEREST_SUGGESTIONS,
  LEVELS,
  SUBJECT_SUGGESTIONS,
} from '../academicOptions.js';
import { studentsApi } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import TagInput from '../components/TagInput.jsx';

function emptyFilters() {
  return { subjects: [], interests: [], academic_level: '' };
}

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

function TagList({ items, common = [], accent = false }) {
  if (!items?.length) {
    return <p className="muted">Não informado.</p>;
  }

  const commonKeys = new Set(common.map((item) => item.toLocaleLowerCase('pt-BR')));

  return (
    <div className="tag-list">
      {items.map((item) => {
        const isCommon = commonKeys.has(item.toLocaleLowerCase('pt-BR'));
        const classes = ['tag'];

        if (accent) classes.push('tag-accent');
        if (isCommon) classes.push('tag-match');

        return (
          <span className={classes.join(' ')} key={item}>
            {isCommon && <span aria-hidden="true">✓</span>}
            {item}
          </span>
        );
      })}
    </div>
  );
}

function StudentCard({ student }) {
  const updated = formatDate(student.updated_at);

  return (
    <article className="student-card">
      <div className="student-card-header">
        <div className="student-avatar" aria-hidden="true">
          {getInitials(student.name)}
        </div>

        <div className="student-identity">
          <h2>{student.name || 'Estudante sem nome'}</h2>
          {student.academic_level && (
            <span className="level-badge level-badge-sm">{student.academic_level}</span>
          )}
        </div>

        {student.match_count > 0 && (
          <span className="match-badge">
            {student.match_count} em comum
          </span>
        )}
      </div>

      <p className="student-bio">
        {student.bio || 'Este estudante ainda não escreveu uma bio.'}
      </p>

      <div className="student-section">
        <h3>Matérias</h3>
        <TagList items={student.subjects} common={student.common_subjects} />
      </div>

      <div className="student-section">
        <h3>Interesses</h3>
        <TagList items={student.interests} common={student.common_interests} accent />
      </div>

      <div className="student-card-footer">
        <span className="muted">
          {updated ? `Atualizado em ${updated}` : 'Perfil não preenchido'}
        </span>
        <Link className="text-link" to={`/students/${student.id}`}>
          Ver perfil →
        </Link>
      </div>
    </article>
  );
}

export default function Students() {
  const { token } = useAuth();
  const [form, setForm] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const hasFilters = Boolean(
    filters.subjects.length || filters.interests.length || filters.academic_level,
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const nextFilters = {
      subjects: [...form.subjects],
      interests: [...form.interests],
      academic_level: form.academic_level,
    };
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    setFilters(nextFilters);
    setStudents([]);
    setLoading(true);
    setError('');
    setHasSearched(true);

    studentsApi
      .list(nextFilters, token)
      .then((data) => {
        if (requestId === requestRef.current) setStudents(data);
      })
      .catch((err) => {
        if (requestId === requestRef.current) setError(err.message);
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }

  function clearFilters() {
    requestRef.current += 1;
    setForm(emptyFilters());
    setFilters(emptyFilters());
    setStudents([]);
    setLoading(false);
    setError('');
    setHasSearched(false);
  }

  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Conexões de estudo</span>
          <h1>Encontrar estudantes</h1>
          <p>Descubra colegas com matérias e interesses acadêmicos em comum.</p>
        </div>
      </div>

      <form className="panel search-panel" onSubmit={handleSubmit}>
        <div className="search-grid">
          <TagInput
            id="search-subjects"
            label="Matérias"
            value={form.subjects}
            onChange={(value) => updateForm('subjects', value)}
            placeholder="Ex.: Matemática"
            suggestions={SUBJECT_SUGGESTIONS}
            hint="Adicione uma ou mais matérias para filtrar."
          />

          <TagInput
            id="search-interests"
            label="Interesses acadêmicos"
            value={form.interests}
            onChange={(value) => updateForm('interests', value)}
            placeholder="Ex.: Pesquisa"
            suggestions={INTEREST_SUGGESTIONS}
            hint="Adicione interesses para encontrar pessoas afins."
          />

          <div className="field">
            <label htmlFor="search-level">Nível acadêmico</label>
            <select
              id="search-level"
              value={form.academic_level}
              onChange={(event) => updateForm('academic_level', event.target.value)}
            >
              <option value="">Todos os níveis</option>
              {LEVELS.map((level) => (
                <option value={level} key={level}>{level}</option>
              ))}
            </select>
            <small className="field-hint">Refine a busca por etapa de ensino.</small>
          </div>
        </div>

        <div className="search-actions">
          <button type="button" className="button button-outline" onClick={clearFilters}>
            Limpar filtros
          </button>
          <button type="submit" className="button button-primary">
            Buscar estudantes
          </button>
        </div>
      </form>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {!hasSearched ? (
        <div className="state-card">
          <span className="state-icon" aria-hidden="true">🔍</span>
          <h2>Busque estudantes</h2>
          <p>Escolha matérias, interesses ou nível acadêmico e clique em Buscar estudantes.</p>
        </div>
      ) : loading ? (
        <div className="state-card">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando estudantes...</p>
        </div>
      ) : error ? null : (
        <>
          <div className="results-bar">
            <p role="status">
              {students.length === 0
                ? 'Nenhum estudante encontrado.'
                : `${students.length} ${students.length === 1 ? 'estudante encontrado' : 'estudantes encontrados'}`}
            </p>
            {hasFilters && students.length > 0 && (
              <span className="match-legend">Itens com ✓ correspondem à sua busca.</span>
            )}
          </div>

          {students.length === 0 ? (
            <div className="state-card">
              <span className="state-icon" aria-hidden="true">🔍</span>
              <h2>
                {hasFilters ? 'Nenhum estudante encontrado' : 'Nenhum estudante cadastrado'}
              </h2>
              <p>
                {hasFilters
                  ? 'Tente buscar por outras matérias, interesses ou níveis acadêmicos.'
                  : 'Assim que novos estudantes se cadastrarem, eles aparecerão aqui.'}
              </p>
              {hasFilters && (
                <button type="button" className="button button-primary" onClick={clearFilters}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="students-grid">
              {students.map((student) => (
                <StudentCard student={student} key={student.id} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
