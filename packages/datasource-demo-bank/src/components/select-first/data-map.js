/* eslint-disable import/no-unresolved -- runs inside the Forest app, which provides these */
/* eslint-env browser */
/**
 * Data map: a workspace Custom component that shows the bank's data model to a demo visitor, by
 * domain: what each table holds, how the tables link, which Smart Actions run on them, and how
 * many rows they have. Everything comes from the agent's API chart `data_map` (data-map.js), read
 * live from the agent's own schema. Click a domain, then a table; its links jump to the linked
 * table, and "Open in Forest" opens its list. Generated as hub/data-map.{hbs,js,css}.
 */
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

const REFRESH_MS = 60 * 1000;
// Forest's grid cell, in px (WORKSPACE_GRID_CELL_WIDTH and _HEIGHT).
const CELL = 20;
const EM_TALL = 52;
const EM_WIDE = 96;
// The domain map's drawing box (an SVG viewBox), and a table's box in it.
const MAP = { width: 1000, height: 250, nodeHeight: 34 };
// A table's box fits its name: about 7.6 drawing units a character at 13, plus margins.
const nodeWidthOf = label => Math.max(100, Math.round(label.length * 7.6 + 26));
const TYPES = {
  String: 'text',
  Number: 'number',
  Boolean: 'yes / no',
  Date: 'date',
  Dateonly: 'date',
  Enum: 'list',
  Uuid: 'id',
  Json: 'data',
  Point: 'place',
};

const number = n => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-GB'));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default class DataMap extends Component {
  @service lianaServerFetch;

  @service router;

  @tracked map = null;

  @tracked failed = false;

  @tracked domainIndex = 0;

  @tracked tableName = null;

  constructor(owner, args) {
    super(owner, args);
    this.timer = window.setInterval(() => this.load(), REFRESH_MS);
    this.load();
  }

  willDestroy(...args) {
    super.willDestroy?.(...args);
    window.clearInterval(this.timer);
  }

  async load() {
    try {
      const response = await this.lianaServerFetch.fetch('/forest/_charts/data_map', {});
      if (!response.ok) throw new Error(`agent answered ${response.status}`);
      this.map = await response.json();
      this.failed = false;
    } catch (error) {
      this.failed = true;
    }
  }

  get stats() {
    const s = this.map?.stats;
    if (!s) return [];

    return [
      [s.domains, 'domains'],
      [s.tables, 'tables'],
      [s.links, 'links between them'],
      [s.actions, 'Smart Actions'],
      [number(s.rows), 'rows, live'],
    ].map(([value, label]) => ({ value, label }));
  }

  get domains() {
    return (this.map?.domains || []).map((d, i) => {
      const actions = d.tables.reduce((n, t) => n + t.actions.length, 0);

      return {
        ...d,
        index: i,
        className: i === this.domainIndex ? 'dm-domain dm-domain--on' : 'dm-domain',
        meta: `${plural(d.tables.filter(t => !t.hidden).length, 'table')}${
          actions ? ` · ⚡ ${actions}` : ''
        }`,
      };
    });
  }

  get domain() {
    return this.domains[this.domainIndex] || null;
  }

  get cards() {
    return (this.domain?.tables || []).map(t => ({
      ...t,
      className: t.hidden ? 'dm-card dm-card--link' : 'dm-card',
      rowsText: `${number(t.rows)} rows`,
      meta: [
        plural(t.fields.length + t.computed.length, 'field'),
        plural(t.belongsTo.length + t.hasMany.length, 'link'),
        t.actions.length ? `⚡ ${plural(t.actions.length, 'action')}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }));
  }

  /** The domain's tables on an ellipse, and a line for each link between two of them. */
  get mapView() {
    const tables = (this.domain?.tables || []).filter(t => !t.hidden);
    const { width, height, nodeHeight } = MAP;
    const n = tables.length;
    // The ellipse leaves room for the widest box.
    const nodeWidth = Math.max(100, ...tables.map(t => nodeWidthOf(t.label)));
    const at = {};
    tables.forEach((t, i) => {
      const angle = n === 1 ? 0 : (2 * Math.PI * i) / n - Math.PI / 2;
      const rx = n === 1 ? 0 : (width - nodeWidth) / 2 - 6;
      const ry = n === 1 ? 0 : (height - nodeHeight) / 2 - 6;
      at[t.name] = { x: width / 2 + rx * Math.cos(angle), y: height / 2 + ry * Math.sin(angle) };
    });
    const seen = new Set();
    const lines = [];

    const draw = (a, b) => {
      const pair = [a, b].sort().join('|');
      if (!at[a] || !at[b] || a === b || seen.has(pair)) return;
      seen.add(pair);
      lines.push({ x1: at[a].x, y1: at[a].y, x2: at[b].x, y2: at[b].y });
    };

    (this.domain?.tables || []).forEach(t => {
      if (at[t.name]) {
        t.belongsTo.forEach(link => draw(t.name, link.table));
      } else {
        // A link table (not drawn) joins the tables it points to: draw a line between them.
        const ends = t.belongsTo.map(link => link.table).filter(name => at[name]);
        ends.forEach((a, i) => ends.slice(i + 1).forEach(b => draw(a, b)));
      }
    });
    const outside = new Set();
    (this.domain?.tables || []).forEach(t =>
      [...t.belongsTo, ...t.hasMany].forEach(link => {
        if (!(this.domain.tables || []).some(x => x.name === link.table)) outside.add(link.table);
      }),
    );

    return {
      viewBox: `0 0 ${width} ${height}`,
      lines,
      nodes: tables.map(t => ({
        name: t.name,
        label: t.label,
        x: at[t.name].x - nodeWidthOf(t.label) / 2,
        y: at[t.name].y - nodeHeight / 2,
        tx: at[t.name].x,
        ty: at[t.name].y + 5,
        width: nodeWidthOf(t.label),
        height: nodeHeight,
        className: t.name === this.tableName ? 'dm-node dm-node--on' : 'dm-node',
      })),
      outside: outside.size,
    };
  }

  get table() {
    const t = (this.domain?.tables || []).find(x => x.name === this.tableName);
    if (!t) return null;
    const link = l => ({ ...l, label: this.labelOf(l.table) });

    return {
      ...t,
      rowsText: number(t.rows),
      fields: t.fields.map(f => ({ ...f, typeText: f.key ? 'key' : TYPES[f.type] || f.type })),
      computed: t.computed.map(f => ({ ...f, typeText: TYPES[f.type] || f.type })),
      belongsTo: t.belongsTo.map(link),
      hasMany: t.hasMany.map(link),
    };
  }

  labelOf(name) {
    const t = (this.map?.domains || []).flatMap(d => d.tables).find(x => x.name === name);

    return t?.label || name;
  }

  @action
  pickDomain(index) {
    this.domainIndex = index;
    this.tableName = null;
  }

  @action
  pickTable(name) {
    const index = (this.map?.domains || []).findIndex(d => d.tables.some(t => t.name === name));
    if (index < 0) return;
    this.domainIndex = index;
    this.tableName = name;
  }

  @action
  closeTable() {
    this.tableName = null;
  }

  /** The table's list in Forest: /<project>/<environment>/<team>/data/<table>/index. */
  @action
  openInForest(name) {
    const [project, environment, team] = window.location.pathname.split('/').filter(Boolean);
    const path = `/${project}/${environment}/${team}/data/${name}/index`;

    try {
      const transition = this.router.transitionTo(path);
      transition?.catch?.(error => {
        if (error?.name !== 'TransitionAborted') window.location.assign(path);
      });
    } catch (error) {
      window.location.assign(path);
    }
  }

  get rootStyle() {
    const box = this.args.component?.displaySettings;
    if (!box?.width || !box?.height) return null;
    const size = Math.min((box.height * CELL) / EM_TALL, (box.width * CELL) / EM_WIDE);

    return htmlSafe(`font-size:${Math.round(Math.max(11, Math.min(26, size)))}px`);
  }
}
