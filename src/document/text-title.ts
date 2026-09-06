import type { TextElement, MonthTextElement } from './types';
export function setManualTextTitle(element: TextElement | MonthTextElement, title: string): void {
  element.content.title = title;
  if (element.type === 'text' && element.semanticRole === 'calendar-month-title') {
    delete element.semanticRole;
    element.manualTitle = true;
  }
}
