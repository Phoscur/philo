import { injectable, token } from '@joist/di';
import { I18n, useTranslations } from '../i18n.js';

export const InjectableI18n = token<I18n>('I18n', () => useTranslations());

@injectable
export class I18nService {
  useTranslations = useTranslations;
  t = useTranslations();
}
