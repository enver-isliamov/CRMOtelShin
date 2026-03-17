# План реализации двусторонней синхронизации (Vercel Postgres <-> Google Sheets)

## [x] Этап 1: Обновление Google Apps Script (`data/gas-scripts.ts`)
- Добавление обработки новых `action` в `Code.gs`: `sync_client`, `sync_delete_client`, `sync_master`, `sync_template`.
- Обеспечение стабильности `id` (если `id` нет, он должен генерироваться и сохраняться в `metadata`).
- Оптимизация поиска строк по `id` для быстрого обновления.

## [x] Этап 2: Обновление Vercel API (`api/crm.ts`)
- Изменение логики `import`: использование строгого `UPSERT` (ON CONFLICT (id) DO UPDATE) без генерации новых случайных ID для существующих записей.
- Добавление фоновой отправки данных в Google Sheets при локальных изменениях (`add`, `update`, `delete`, `reorder`, `addmaster`, `addtemplate` и т.д.).
- Получение `googleSheetId` (URL скрипта) из запроса для отправки вебхуков в GAS.

## [x] Этап 3: Обновление Frontend сервисов (`services/api.ts`)
- Передача `googleSheetId` (URL скрипта) во все запросы мутаций (`addClient`, `updateClient`, `deleteClient` и т.д.), чтобы бэкенд знал, куда слать синхронизацию.

## [x] Этап 4: Обновление UI (`components/Settings.tsx`)
- Переименование вкладки "Миграция" в "Синхронизация".
- Удаление опасной кнопки "Очистить базу данных".
- Обновление текстов и логики кнопок для отражения процесса двусторонней синхронизации.
