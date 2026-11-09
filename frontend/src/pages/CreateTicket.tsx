/**
 * Screen 1 — Create Ticket (PRD FR-03, §8 AI suggestion with human override)
 */
import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client';
import { getAiSuggestion } from '../api/aiService';
import type { Priority, Suggestion, Ticket } from '../api/types';
import { ErrorNotice, Field, Notice, Panel } from '../components/ui';
import { PRIORITY_HINT, PRIORITY_LABEL, ROUTE_LABEL } from '../lib/format';
import { useAsync } from '../lib/useAsync';

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

export function CreateTicket() {
  const { data: categories, error: categoriesError } = useAsync(() => api.categories(), []);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [urgency, setUrgency] = useState<Priority | ''>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Ticket | null>(null);

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestError, setSuggestError] = useState<unknown>(null);
  const [suggesting, setSuggesting] = useState(false);

  const askSuggestion = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      setSuggestion(await getAiSuggestion({ subject, description, urgency: urgency || undefined }));
    } catch (err) {
      setSuggestion(null);
      setSuggestError(err);
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    setCategoryId(suggestion.category_id);
    setUrgency(suggestion.priority);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    try {
      const ticket = await api.createTicket({
        subject,
        description,
        category_id: Number(categoryId),
        urgency: urgency as Priority,
      });
      setCreated(ticket);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setSubject('');
    setDescription('');
    setCategoryId('');
    setUrgency('');
    setSuggestion(null);
  };

  if (created) {
    return (
      <div className="page">
        <div className="page__head">
          <h1>Ticket submitted</h1>
          <p>Keep this ticket number to follow up or to refer to it when contacting the Helpdesk team.</p>
        </div>
        <Panel>
          <p className="muted">Ticket number</p>
          <p className="ticket-number">{created.ticket_number}</p>
          <p className="mt-2">{created.title}</p>
          <p className="muted small mt-2">You can edit the subject and description until the Helpdesk team starts work on it.</p>
          <div className="form-actions mt-5">
            <a className="btn" href={`#/my/${created.id}`}>View ticket status</a>
            <button className="btn btn--secondary" onClick={reset}>Report another issue</button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <h1>Report an issue</h1>
        <p>Describe the problem clearly. The Helpdesk team will review it and post updates on this ticket.</p>
      </div>

      <div className="layout-aside">
        <Panel title="Problem details">
          <form className="form" onSubmit={submit} noValidate>
            <Field id="subject" label="Subject" required hint="What happened and where, e.g. Air conditioner in room B-204 not cooling" error={fieldErrors.subject}>
              <input
                id="subject"
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={150}
                aria-invalid={!!fieldErrors.subject}
                aria-describedby="subject-hint"
                required
              />
            </Field>

            <Field id="description" label="Description" required hint="When it started, what you have tried, and how it affects your study or work" error={fieldErrors.description}>
              <textarea
                id="description"
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                aria-invalid={!!fieldErrors.description}
                aria-describedby="description-hint"
                required
              />
            </Field>

            <Field id="category" label="Category" required error={fieldErrors.category_id}>
              {categoriesError ? <ErrorNotice error={categoriesError} /> : null}
              <select
                id="category"
                className="select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                aria-invalid={!!fieldErrors.category_id}
                required
              >
                <option value="">Select a category</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.description ? ` — ${c.description}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset className="field" aria-invalid={!!fieldErrors.urgency}>
              <legend>
                Urgency<span className="req" aria-hidden="true">*</span>
              </legend>
              <div className="choice-row">
                {PRIORITIES.map((p) => (
                  <label key={p} className="choice" title={PRIORITY_HINT[p]}>
                    <input type="radio" name="urgency" value={p} checked={urgency === p} onChange={() => setUrgency(p)} />
                    {PRIORITY_LABEL[p]}
                  </label>
                ))}
              </div>
              <span className="hint">{urgency ? PRIORITY_HINT[urgency] : 'Choose based on the actual impact'}</span>
              {fieldErrors.urgency && <span className="error">{fieldErrors.urgency}</span>}
            </fieldset>

            {submitError && !Object.keys(fieldErrors).length ? <ErrorNotice error={submitError} /> : null}
            {Object.keys(fieldErrors).length > 0 && (
              <Notice tone="error" title="Please correct the highlighted fields" />
            )}

            <div className="form-actions">
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit ticket'}
              </button>
            </div>
          </form>
        </Panel>

        <div>
          <Panel title="Suggest a category" quiet>
            <p className="small">
              The system reads the subject and description and suggests a category and urgency. You can change every field before submitting.
            </p>
            <div className="mt-3">
              <button
                className="btn btn--secondary"
                type="button"
                onClick={askSuggestion}
                disabled={suggesting || subject.trim().length < 5 || description.trim().length < 10}
              >
                {suggesting ? 'Analysing…' : 'Get a suggestion'}
              </button>
            </div>
            {suggestError ? <div className="mt-3"><ErrorNotice error={suggestError} /></div> : null}
            {suggestion && (
              <div className="suggestion" aria-live="polite">
                <dl className="meta">
                  <dt>Category</dt>
                  <dd>{suggestion.category_name}</dd>
                  <dt>Urgency</dt>
                  <dd>{PRIORITY_LABEL[suggestion.priority]}</dd>
                  <dt>Route to</dt>
                  <dd>{ROUTE_LABEL[suggestion.route] ?? suggestion.route}</dd>
                </dl>
                <p className="muted small mt-2">
                  {suggestion.source === 'ai' ? 'Suggested by AI' : 'Suggested by system rules (AI unavailable)'}
                  {suggestion.reason ? `: ${suggestion.reason}` : ''}
                </p>
                <button className="btn btn--plain mt-2" type="button" onClick={applySuggestion}>
                  Apply suggestion
                </button>
              </div>
            )}
          </Panel>

          <Panel title="What happens next" quiet>
            <ol className="steps small">
              <li>You get a ticket number straight away.</li>
              <li>The Helpdesk team reviews it and starts work. Until then you can still edit your ticket.</li>
              <li>Repairs are sent to Maintenance, and the repair status appears on this ticket automatically.</li>
              <li>When it is resolved, you will see a summary in "My tickets".</li>
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
