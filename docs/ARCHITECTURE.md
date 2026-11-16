# Архитектура ФЕРМА·CAD

SPA без сборки: `index.html` подключает 32 классических `<script>`‑модуля
(порядок = зависимости, общие глобальные переменные). three.js r128 с CDN.
Версия сборки — число в `?v=NN` у каждого скрипта + чип версии в UI.

## Карта модулей (js/)

| Модуль | Назначение |
|---|---|
| 00-util | мелкие утилиты (clamp, esc, fmt) |
| 01-icons | SVG‑иконки инструментов |
| 02-types | TYPES: типы стержней (цвет, префикс имени, material), TOOL_DEFS |
| 03-state | глобальное состояние: renderer, scene, camP/camO/planCam, M (модель), params, sel |
| 04-scene3d | инициализация сцены, свет, ground, cube вида |
| 05-model | модель: nodes/rods/planes, rodLen, addRod, shared hosts (n.host/n.hosts) |
| 06-history | serialize/deserialize, pushUndo/undo/redo (JSON‑снимки) |
| 07-scenebuild | построение объектов сцены по модели (stержни-линии, узлы, размеры) |
| 08-grid | сетка, подписи координат |
| 09-camera | орбита/пан/зум, плавный applyCams, fitAll/fitBox, план‑камера |
| 10-picking | лучевое выделение, привязки (узлы, стержни, сетка) |
| 11-ghost | призраки инструментов (линии/дуги превью) |
| 12-tools | клики инструментов: стержни (цепочка), узел, опора, ряд опор, attachNodesOnRod |
| 13-pointer | обработка мыши: drag, marquee, колесо, dblclick |
| 14-plan | режим плана XY: enterPlanXY/exitPlan, чертёж, размеры в плане |
| 15-ctxmenu | контекстное меню |
| 16-modals | модалки (сохранения, справка helpModal, группировка); #modalWrap/#modalCard(.wide) |
| 17-storage | localStorage: fc.auto автосейв, список сохранений, импорт/экспорт JSON |
| 18-demo | buildDemo/loadDemo (демо-каркас SEC_DEFAULTS), справочные данные |
| 19-tree | дерево проекта (дерево стержней/узлов, скрытие eye) |
| 20-props | панель свойств выбранного |
| 21-coach | обучающие подсказки |
| 22-params | панель параметров (сечение, материал, шаг сети, клонирование) |
| 23-toolbar | тулбар: инструменты (t.act), режимы вкладок, кнопки раскроя/отчёта |
| 24-cube | куб ориентации видов |
| 25-keys | хоткеи: handleEscape, MOD_ACTIONS, TOOL_KEYS, F1–F5 |
| 26-app | главный цикл rAF, режимные переключатели, инициализация |
| 27-data | каталог NR_SECTIONS (ГОСТ‑трубы: масса, Ix/Iy/Wx/Wy, sell_len_m, цена), материалы |
| 28-calc | ядро: solveFrame (FEM 12DOF), нагрузки СП 20, UR СП 16, прогибы, тепловые карты, defl‑UI, раскрой, autoSections, панель расчёта |
| 29-fullmodel | полная модель из профилей: secContours, endInfo (классификация стыков + вложение), призмы, сварные контуры |
| 30-xnodes | инструмент «узлы на пересечениях стержней» (segClosest, shared hosts) |
| 31-report | HTML‑отчёт: снимки видов, SVG‑схемы, реакции, раскрой, смета; deflBodies (изогнутые тела) |

## Потоки данных

```
M (модель: nodes/rods/planes)  ->  rebuildScene (07)  ->  сцена three.js
        |                                   ^
  pushUndo/deserialize (06)                 |
        |                                   |
  runCalc/solveFrame (28) -> calc.res -> drawCalc (тепло/тела/план-эпюра)
        |                                   |
  autoSections (28) меняет r.sec ----------+
        |
  cut-таб (28) rodCutLen/cutInfo ; 31-report: HTML
```

Ключевые соглашения:

- Единицы: мм, кН, MPa; N в строках расчёта кН, M кН·м (`/1e6` из N·mm).
- Канон координат X/Y/Z; опоры `type:'support'` = заделка 6 DOF.
- `calc.byId` ключи — **String(id)**; id стержней/узлов числовые (см. patch String).
- Расчётная модель не меняет основную: `solveFrame` делит стержни по host‑узлам
  на лету (имена частей `r.id+'#'`), строки агрегируются (max M/UR/defl, ΣL).
- Стержень наследует сечение по типу из `SEC_DEFAULTS`, если `r.sec` не задан.

## Версионирование и релиз

- Каждая фича: правка js → `node --check` (файлы ESM‑совместимы, check чистых classic)
  → `sed -i 's/?v=N/?v=N+1/g; s/>vN</>vN+1</; s/Версия сборки vN/.../' index.html`.
- Слово пользователя «хорошо» = `git add -A; git commit; git tag vNN-baseline; bump +0.1; push`.
- Пуш в `origin main` (github.com/Denstis/FermaCad) — регулярно, после каждой завершённой работы.

## QA (headless Chromium + CDP)

См. docs/AGENTS.md — пул граблей: вкладки, таймауты js(), rAF, план/3D, vision-кропы.
