/** Store an advisory triage suggestion after ticket creation without changing the ticket itself. */
import type { Bindings } from '../core/env';
import type { Ticket } from '../modules/tickets/rules';
import { askAi } from './ai';
import { pickSuggestion } from './pickSuggestion';

export { pickSuggestion } from './pickSuggestion';

export async function recordSuggestion(env: Bindings, ticket: Ticket): Promise<void> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name FROM ticket_categories WHERE is_active = 1 ORDER BY id',
    ).all<{ id: number; name: string }>();
    const input = {
      subject: ticket.title,
      description: ticket.description,
      urgency: ticket.priority,
      categories: results ?? [],
    };
    const suggestion = pickSuggestion(await askAi(env, input), input);
    await env.DB.prepare(
      'UPDATE tickets SET ai_category_id = ?, ai_priority = ?, ai_route = ?, ai_source = ? WHERE id = ?',
    ).bind(suggestion.category_id, suggestion.priority, suggestion.route, suggestion.source, ticket.id).run();
  } catch (error) {
    console.log(JSON.stringify({ msg: 'ai suggestion failed', ticket: ticket.id, error: String(error) }));
  }
}
