import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelRef, PiModel } from '@/api/types';
import { sameModel } from '@/api/types';

interface ModelPickerProps {
  models: PiModel[];
  value: ModelRef | null;
  onChange: (model: ModelRef | null) => void;
  allowFollowDefault?: boolean;
  disabled?: boolean;
  testId?: string;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  models,
  value,
  onChange,
  allowFollowDefault = true,
  disabled,
  testId = 'model-picker',
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = models.filter((m) =>
      !q || `${m.provider} ${m.id} ${m.name}`.toLowerCase().includes(q)
    );
    const map = new Map<string, PiModel[]>();
    for (const model of filtered) {
      const list = map.get(model.provider) ?? [];
      list.push(model);
      map.set(model.provider, list);
    }
    return Array.from(map.entries());
  }, [models, query]);

  const selected = value
    ? models.find((m) => sameModel({ provider: m.provider, id: m.id }, value))
    : null;

  return (
    <div className="space-y-2" data-testid={testId}>
      {models.length > 6 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('model.filter')}
          className="w-full px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-900"
        />
      )}
      <select
        disabled={disabled}
        data-testid={`${testId}-select`}
        value={value ? `${value.provider}/${value.id}` : ''}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) {
            onChange(null);
            return;
          }
          const [provider, ...rest] = next.split('/');
          onChange({ provider, id: rest.join('/') });
        }}
        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-sm"
      >
        {allowFollowDefault && (
          <option value="">{t('model.followDefault')}</option>
        )}
        {groups.map(([provider, items]) => (
          <optgroup key={provider} label={provider}>
            {items.map((model) => (
              <option
                key={`${model.provider}/${model.id}`}
                value={`${model.provider}/${model.id}`}
                disabled={!model.hasAuth}
              >
                {model.name}
                {!model.hasAuth ? ` — ${t('model.noAuth')}` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {selected && !selected.hasAuth && (
        <p className="text-xs text-amber-600" data-testid="model-no-auth-hint">
          {t('model.noAuthHint', { provider: selected.provider })}
        </p>
      )}
    </div>
  );
};
