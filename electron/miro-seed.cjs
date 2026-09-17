// One-time import of Egor's active (white) Miro backlog captured on 2026-09-17.
// One bullet/line = one task. Yellow/red/blue-only lines are intentionally excluded.

function task(id, title, chapter, area, feature, taskType) {
  return {
    id: `miro-${id}`,
    title,
    chapter: chapter || null,
    area: area || null,
    feature: feature || null,
    taskType: taskType || null,
  };
}

const MIRO_TASKS = [
  // Tutorial / initial cutscene
  task('tutorial-001', 'начальные титры на экране', 'Chapter 1', 'Tutorial', 'Initial Cutscene'),

  // Bugs
  task('bugs-001', 'Rey not running in end of tutorial', 'Global', 'Bugs', null, 'bug'),
  task('bugs-002', 'Disable disk after take event on reload ACTs', 'Global', 'Bugs', null, 'bug'),
  task('bugs-003', 'Не убирается эффект перегруза (мб изза вольта) после воды', 'Global', 'Bugs', null, 'bug'),
  task('bugs-004', 'Сделать скип диалога еще и на кнопку взаимодействия', 'Global', 'Bugs', null, 'bug'),
  task('bugs-005', 'Скипаемые полностью катсцены', 'Global', 'Bugs', null, 'bug'),
  task('bugs-006', 'Оповещение что после взятия диска от Молли что можно вернуться в хаб когда захочешь', 'Global', 'Bugs', null, 'bug'),

  // Level Selector
  task('level-selector-001', 'Spawn new Acts', 'Global', 'Level Selector', 'Visual'),
  task('level-selector-002', 'Anounce about new Levels', 'Global', 'Level Selector', 'Visual'),
  task('level-selector-003', 'Hub Change with new acts', 'Global', 'Level Selector', 'Visual'),

  // Main Menu
  task('main-menu-001', 'Randomize Rey Location and animation', 'Global', 'Main Menu'),
  task('main-menu-002', 'Buttons and Logo', 'Global', 'Main Menu'),
  task('main-menu-003', 'Interactable Clicks for Rey and Environment.', 'Global', 'Main Menu'),
  task('main-menu-004', 'Permanent borderless start to game from Menu', 'Global', 'Main Menu'),
  task('main-menu-005', 'Another Menu for New game', 'Global', 'Main Menu'),

  // Gameplay notes / assorted
  task('gameplay-001', 'Component interaction widget', 'Global', 'Gameplay notes'),
  task('gameplay-002', 'Player Shader Optimization from Texture Object.', 'Global', 'Gameplay notes'),
  task('gameplay-003', 'Slopes are busting our speed (Home Paige)', 'Global', 'Gameplay notes'),
  task('gameplay-004', 'Remove Widgets from Game state Enum', 'Global', 'Gameplay notes'),
  task('gameplay-005', 'make Animation for Good Timing Jump on Water', 'Global', 'Gameplay notes'),
  task('gameplay-006', 'Pixel Ability to wallrun on billboards and smth.', 'Global', 'Gameplay notes'),
  task('gameplay-007', 'Gravi Reload stations', 'Global', 'Gameplay notes'),
  task('gameplay-008', 'Gravi Zones with fly.', 'Global', 'Gameplay notes'),
  task('gameplay-009', 'Fast Take Collectables (Animation and fast skip event)', 'Global', 'Gameplay notes'),
  task('gameplay-010', 'Emotions wheel', 'Global', 'Gameplay notes'),
  task('gameplay-011', 'Checkpoint icon animation', 'Global', 'Gameplay notes'),
  task('gameplay-012', 'Interactable to hit and byby hit items', 'Global', 'Gameplay notes'),
  task('gameplay-013', 'Не выкидывать игрока с уровня после взятия диска (только в некоторых актах отправлять дальше)', 'Global', 'Gameplay notes'),

  // Chapter 1 / Act 2
  task('c1a2-001', 'Фразы капитана во время босс файта (звуки и мб виджет)', 'Chapter 1', 'Act 2'),
  task('c1a2-002', 'Звуки', 'Chapter 1', 'Act 2'),
  task('c1a2-003', 'Починить скорость босса', 'Chapter 1', 'Act 2'),
  task('c1a2-004', 'Эффект победы над боссом', 'Chapter 1', 'Act 2'),
  task('c1a2-005', 'Катсцены', 'Chapter 1', 'Act 2'),

  // Chapter 1 / Act 4 / Bag Shop
  task('c1a4-001', 'Голос механической собаки', 'Chapter 1', 'Act 4', 'Магазин сумок'),
  task('c1a4-002', 'Фразы для каждой комнаты и сопроводительные', 'Chapter 1', 'Act 4', 'Магазин сумок'),

  // Chapter 1 / Act 5
  task('c1a5-001', 'Модели закулисья (Светильники, зеркала, столики, шторы, и тд вент шахты)', 'Chapter 1', 'Act 5'),
  task('c1a5-002', 'Платья и разная логика для каждого', 'Chapter 1', 'Act 5'),
  task('c1a5-003', 'Механика скинов', 'Chapter 1', 'Act 5'),
  task('c1a5-004', 'Система очков', 'Chapter 1', 'Act 5'),
  task('c1a5-005', 'Катсцены', 'Chapter 1', 'Act 5'),
  task('c1a5-006', 'Плакаты в гримерку', 'Chapter 1', 'Act 5'),
  task('c1a5-007', 'При позировании смотреть в камеру', 'Chapter 1', 'Act 5'),
  task('c1a5-008', 'Презентация очков и Рей в конце путей', 'Chapter 1', 'Act 5'),
  task('c1a5-009', 'Позирование', 'Chapter 1', 'Act 5'),
  task('c1a5-010', 'Экрану дать обрамление из фотографирующих пугов и толпы', 'Chapter 1', 'Act 5'),
  task('c1a5-011', 'Сохранения', 'Chapter 1', 'Act 5'),
  task('c1a5-012', 'Трейлы и ленточки у конфетти', 'Chapter 1', 'Act 5'),
  task('c1a5-013', 'Мопс жарит шашлык на огнемете', 'Chapter 1', 'Act 5'),
  task('c1a5-014', 'Вход в закулисье', 'Chapter 1', 'Act 5'),
  task('c1a5-015', 'Переход в следующий акт', 'Chapter 1', 'Act 5'),
  task('c1a5-016', 'Подушка приземления в 3 забеге', 'Chapter 1', 'Act 5'),
  task('c1a5-017', 'Постеры на стенах гримерки', 'Chapter 1', 'Act 5'),
  task('c1a5-018', 'Большая вывеска при входе и выходе', 'Chapter 1', 'Act 5'),
  task('c1a5-019', 'Эффект фотоаппаратов', 'Chapter 1', 'Act 5'),
  task('c1a5-020', 'Феерверки', 'Chapter 1', 'Act 5'),
  task('c1a5-021', 'Катсцена на первом пути куда идти', 'Chapter 1', 'Act 5'),
  task('c1a5-022', 'На подобии ахита "плитки" которые надо активировать чтобы проложить путь дальше', 'Chapter 1', 'Act 5'),
  task('c1a5-023', 'Рандомить слова в виджете скора', 'Chapter 1', 'Act 5'),

  // Chapter 1 / Act 6
  task('c1a6-001', 'Катсцена в начале и конце', 'Chapter 1', 'Act 6'),
  task('c1a6-002', 'Переход в 3 фазу', 'Chapter 1', 'Act 6'),
  task('c1a6-003', 'Анимации позирования Рей', 'Chapter 1', 'Act 6'),
  task('c1a6-004', 'Виджет визуал', 'Chapter 1', 'Act 6'),
  task('c1a6-005', 'Эффекты блеска для Принца', 'Chapter 1', 'Act 6'),
  task('c1a6-006', 'Летающие мопсы в 3 фазе', 'Chapter 1', 'Act 6'),
  task('c1a6-007', 'Эффекты при получении поинтов в виджете (Звездочки и тд)', 'Chapter 1', 'Act 6'),
  task('c1a6-008', 'Барьер реагирует на босс файт', 'Chapter 1', 'Act 6'),
  task('c1a6-009', 'Эффект победы над боссом', 'Chapter 1', 'Act 6'),
  task('c1a6-010', 'Переход во 2 фазу переделать камеру', 'Chapter 1', 'Act 6'),
  task('c1a6-011', 'Баг со сменой локации в последний момент в 3 фазе', 'Chapter 1', 'Act 6', null, 'bug'),

  // Chapter 2 / Act 1
  task('c2a1-001', 'Все машины и их анимации', 'Chapter 2', 'Act 1'),
  task('c2a1-002', 'Люди и их анимации', 'Chapter 2', 'Act 1'),
  task('c2a1-003', 'Виджет Most wanted, звезд розыска для каждой зоны, обозначение зон при заходе (как в метро ахит)', 'Chapter 2', 'Act 1'),
  task('c2a1-004', 'Ассеты для погони (стоки, гидрояма, подземка, стройка)', 'Chapter 2', 'Act 1'),
  task('c2a1-005', 'Катсцены', 'Chapter 2', 'Act 1'),
  task('c2a1-006', 'Место разрушения', 'Chapter 2', 'Act 1'),

  // Chapter 2 / Karo City
  task('karo-001', 'Сделать скрины более красивыми', 'Chapter 2', 'Karo City', 'Доставка грузов'),
  task('karo-002', 'Обозначение задачи что нужно сделать и что есть таймер', 'Chapter 2', 'Karo City', 'Доставка грузов'),
  task('karo-003', 'Светофоры', 'Chapter 2', 'Karo City', 'Assets'),
  task('karo-004', 'Машины', 'Chapter 2', 'Karo City', 'Assets'),
  task('karo-005', 'Люди', 'Chapter 2', 'Karo City', 'Assets'),

  // Chapter 2 / Besto Place
  task('besto-001', 'Уровень города', 'Chapter 2', 'Besto Place', 'Assets'),
  task('besto-002', 'Ресторан и реквизит для катсцены', 'Chapter 2', 'Besto Place', 'Assets'),
  task('besto-003', 'Дизайн для вокалоида', 'Chapter 2', 'Besto Place', 'Assets'),
  task('besto-004', 'Микрофон', 'Chapter 2', 'Besto Place', 'Assets'),
  task('besto-005', 'катсцены', 'Chapter 2', 'Besto Place'),
  task('besto-006', 'Якудза и подручные + анимации', 'Chapter 2', 'Besto Place', 'Assets'),
  task('besto-007', 'Echo сегменты', 'Chapter 2', 'Besto Place', 'Assets'),
  task('besto-008', 'Скин Вокалоида', 'Chapter 2', 'Besto Place', 'Assets'),

  // Chapter 1 / Seawing Island
  task('seawing-001', "NPS's dialogues, animations and logic.", 'Chapter 1', 'Seawing Island'),
  task('seawing-002', 'Добавить для чипов мувмент сегменты', 'Chapter 1', 'Seawing Island'),
  task('seawing-003', 'Carpets, food', 'Chapter 1', 'Seawing Island'),
  task('seawing-004', 'Planer Painting Area', 'Chapter 1', 'Seawing Island', 'Level Design touch'),

  // HUB
  task('hub-001', 'Molly Animations', 'Global', 'HUB'),
  task('hub-002', 'Folder Phone Molly', 'Global', 'HUB'),
  task('hub-003', 'Настенные рисунки/плакаты – от Молли', 'Global', 'HUB'),
  task('hub-004', 'Сыпающийся песок с крыши', 'Global', 'HUB'),
  task('hub-005', 'провода от диск драйва до антенны и селектора', 'Global', 'HUB'),
  task('hub-006', 'Бочка WD-40', 'Global', 'HUB'),

  // HUB items (white rows only)
  task('hub-items-001', 'Холодильник', 'Global', 'HUB', 'Items'),
  task('hub-items-002', 'Вентилятор', 'Global', 'HUB', 'Items'),
  task('hub-items-003', 'Креслокачалка', 'Global', 'HUB', 'Items'),
  task('hub-items-004', 'Доска с записями и стикерами', 'Global', 'HUB', 'Items'),
  task('hub-items-005', 'Касеты', 'Global', 'HUB', 'Items'),
  task('hub-items-006', 'Флюгер', 'Global', 'HUB', 'Items'),
  task('hub-items-007', 'Дата ассеты на действия Молли для рандома', 'Global', 'HUB', 'Items'),
];

function seedMiroTasks(db) {
  // Current user's existing DB already contains state. On a brand-new empty DB we let
  // the renderer create its normal routines/chat first; the Miro import is for the upgrade path.
  const counts = db.prepare(`SELECT
    (SELECT COUNT(*) FROM tasks) +
    (SELECT COUNT(*) FROM routines) +
    (SELECT COUNT(*) FROM chat_messages) +
    (SELECT COUNT(*) FROM calendar_blocks) AS count`).get();
  if (Number(counts?.count || 0) <= 0) return { imported: 0, skipped: MIRO_TASKS.length };

  // Remove the two old demo tasks only; never touch user-created tasks.
  db.prepare("DELETE FROM tasks WHERE id IN ('seed-pixel','seed-karaoke') AND source = 'seed'").run();

  const insert = db.prepare(`INSERT OR IGNORE INTO tasks (
    id,title,notes,checklist_json,status,kind,task_type,project,area,chapter,feature,tags_json,estimate_minutes,
    stream_friendly,visual,deep_work,blocking,created_at,completed_at,archived_at,deferred_until,defer_reason,
    ai_reason,classification_reason,classification_confidence,source
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const now = new Date().toISOString();
  let imported = 0;
  for (const t of MIRO_TASKS) {
    const result = insert.run(
      t.id, t.title, null, null, 'todo', 'dev', t.taskType, 'Reytrieve Odyssey', t.area, t.chapter, t.feature,
      JSON.stringify(['miro']), null, null, null, null, null, now,
      null, null, null, null, null, 'Imported from white Miro backlog line', 1, 'miro'
    );
    if (Number(result.changes || 0) > 0) imported += 1;
  }
  return { imported, skipped: MIRO_TASKS.length - imported };
}

module.exports = { MIRO_TASKS, seedMiroTasks };
