import type { ValidationError } from './types';

export function buildAgentRepairPrompt(sourceText: string, errors: ValidationError[]): string {
  const errorText = errors
    .map((error) => {
      const location = [
        error.staff ? `${error.staff}` : '',
        error.measure ? `measure ${error.measure}` : '',
        error.voice && error.voice !== 'default' ? `${error.voice}` : '',
        error.line ? `line ${error.line}` : '',
        error.token ? `token "${error.token}"` : ''
      ]
        .filter(Boolean)
        .join(', ');
      const where = location ? ` (${location})` : '';
      return `[${error.code}]${where} ${error.message}\nfix: ${error.fixHint}`;
    })
    .join('\n\n');

  return `The Musicblock music block has validation errors.

Please fix the errors below and return the entire corrected Musicblock music block.
Return only the corrected block.
Do not explain the changes.

errors:

${errorText}

original block:
${sourceText}`;
}
