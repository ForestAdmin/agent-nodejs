/* eslint-disable no-bitwise -- integer maths of the layout */
/**
 * Where to draw each node of a record network (network.ts), computed on the agent so the Smart
 * Chart (network-chart/) only draws an SVG and never measures anything in Forest's page.
 *
 * Coordinates are in a fixed WIDTH x HEIGHT space (the SVG's viewBox). The record's center node
 * sits in the middle, the others start on rings by hop (graph distance from the center), then a
 * small force-directed pass (a fixed number of iterations, seeded with the center's id) untangles
 * them: the same record always gets the same picture. The drawing is turned so its long side is
 * horizontal, stretched to fill the box, then nodes are pushed apart until none overlap, and each
 * label goes below, above, right or left of its node, where it covers the least.
 *
 * Adds to each node: x, y (its middle), lx, ly (the label's anchor: the point of the label box
 * nearest the node) and la ('below', 'above', 'right', 'left'); to each money edge `t`, where its
 * amount sits along it (0 at `from`, 1 at `to`), away from labels. Adds `layout: { width, height }`.
 */
const WIDTH = 1600;
const HEIGHT = 600;
const PAD_X = 110;
const PAD_Y = 50;
const ITERATIONS = 420;
const RING = 1.25;
// The force pass: repulsion between every pair, springs on edges (pull grows as distance^1.5),
// a pull back to the node's ring, and a low heat so the rings by hop stay readable.
const REPULSION = 6;
const RADIAL = 2;
// The most a unit of the force layout (an ideal edge) may stretch to, in px: small networks stay
// compact instead of spreading across the whole box.
const MAX_UNIT_X = 230;
const MAX_UNIT_Y = 150;
const MAX_STRETCH = 2.6;
// Each side of the center stretches on its own (the picture fills the box with the center in the
// middle), up to this ratio between opposite sides.
const MAX_SIDES = 2.5;
// Node radii and label fonts, the same as the component's (network-chart/component.js).
const RADIUS = { customer: 18, account: 13, device: 16, phone: 14, postal: 14, iban: 16 };
const CENTER_RADIUS = 26;
const FONT = 13;
const CENTER_FONT = 15;
const FLAG_FONT = 11;
const LINE = 1.25;
const GLYPH = 0.56;
const LABEL_GAP = 5;
const AMOUNT_FONT = 11;
const MONEY = new Set(['paid', 'received']);
// Where an amount can sit along its edge (0 = the payer, 1 = the payee), best first.
const AMOUNT_SPOTS = [0.5, 0.38, 0.62, 0.28, 0.72];

const radiusOf = (node, center) =>
  node.id === center ? CENTER_RADIUS : RADIUS[node.kind] || RADIUS.customer;

/** The label's lines: the name, then its flags. */
const labelLines = node => {
  const flags = (node.flags || []).map(f => f.label).join(' · ');

  return flags ? [node.label || '', flags] : [node.label || ''];
};

function labelSize(node, center) {
  const [name, flags] = labelLines(node);
  const font = node.id === center ? CENTER_FONT : FONT;
  const width = Math.max(
    name.length * GLYPH * font * (node.id === center ? 1.08 : 1),
    flags ? flags.length * GLYPH * FLAG_FONT : 0,
  );

  return { w: width + 8, h: font * LINE + (flags ? FLAG_FONT * LINE : 0) + 2 };
}

/** A 32-bit seed from a string (FNV-1a), then a small seeded generator (mulberry32). */
function seeded(text) {
  let h = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  let a = h >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = 2 * Math.PI;

const circularMean = angles => {
  const s = angles.reduce((acc, a) => acc + Math.sin(a), 0);
  const c = angles.reduce((acc, a) => acc + Math.cos(a), 0);

  return Math.atan2(s, c);
};

/** Graph distance from the center for every node; unreachable ones go one ring further out. */
function hopsFrom(start, adjacency) {
  const hop = adjacency.map(() => -1);
  hop[start] = 0;
  const queue = [start];

  while (queue.length) {
    const i = queue.shift();
    adjacency[i].forEach(j => {
      if (hop[j] < 0) {
        hop[j] = hop[i] + 1;
        queue.push(j);
      }
    });
  }

  const far = Math.max(0, ...hop) + 1;

  return hop.map(h => (h < 0 ? far : h));
}

/** Rings by hop: a ring's nodes keep their parents' order and are spread evenly around it. */
function ringStart(hop, adjacency, rand) {
  const n = hop.length;
  const angle = new Array(n).fill(0);
  const x = new Array(n).fill(0);
  const y = new Array(n).fill(0);
  const maxHop = Math.max(...hop);

  for (let h = 1; h <= maxHop; h += 1) {
    const ring = hop.map((v, i) => (v === h ? i : -1)).filter(i => i >= 0);

    if (ring.length) {
      const wanted = ring.map(i => {
        const parents = adjacency[i].filter(j => hop[j] < h);

        return parents.length ? circularMean(parents.map(j => angle[j])) : rand() * TAU;
      });
      const order = ring
        .map((i, k) => ({ i, a: wanted[k] }))
        .sort((p, q) => p.a - q.a || p.i - q.i);
      const step = TAU / order.length;
      const offset = circularMean(order.map((o, k) => o.a - k * step));
      order.forEach((o, k) => {
        angle[o.i] = offset + k * step + (rand() - 0.5) * 0.08;
        x[o.i] = Math.cos(angle[o.i]) * h * RING;
        y[o.i] = Math.sin(angle[o.i]) * h * RING;
      });
    }
  }

  return { x, y };
}

/** One step's pushes and pulls on every node: dx, dy (see relax). */
function forces(x, y, hop, pairs) {
  const n = x.length;
  const dx = new Array(n).fill(0);
  const dy = new Array(n).fill(0);

  const add = (i, j, fx, fy) => {
    dx[i] += fx;
    dy[i] += fy;
    dx[j] -= fx;
    dy[j] -= fy;
  };

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const ex = x[i] - x[j];
      const ey = y[i] - y[j];
      const f = REPULSION / Math.max(ex * ex + ey * ey, 1e-4);
      add(i, j, ex * f, ey * f);
    }
  }

  pairs.forEach(([i, j]) => {
    const ex = x[i] - x[j];
    const ey = y[i] - y[j];
    const d = Math.sqrt(Math.sqrt(ex * ex + ey * ey)) || 1e-3;
    add(i, j, -ex * d, -ey * d);
  });

  for (let i = 0; i < n; i += 1) {
    const r = Math.sqrt(x[i] * x[i] + y[i] * y[i]) || 1e-3;
    const pull = (hop[i] * RING - r) * RADIAL;
    dx[i] += (x[i] / r) * pull - x[i] * 0.02;
    dy[i] += (y[i] / r) * pull - y[i] * 0.02;
  }

  return { dx, dy };
}

/**
 * A force pass (Fruchterman-Reingold-like): every pair repels, edges pull, each node is pulled
 * back to its ring; moves shrink as the pass cools. The center stays.
 */
function relax(x, y, hop, pairs, centerIndex) {
  for (let it = 0; it < ITERATIONS; it += 1) {
    const heat = 0.1 * (1 - it / ITERATIONS) + 0.004;
    const { dx, dy } = forces(x, y, hop, pairs);
    x.forEach((_, i) => {
      if (i === centerIndex) return;
      const len = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
      const move = Math.min(len, heat);
      x[i] += (dx[i] / len) * move;
      y[i] += (dy[i] / len) * move;
    });
  }
}

/** Turns the drawing around the center so its long side is horizontal (the box is wide). */
function turnFlat(x, y) {
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  x.forEach((v, i) => {
    sxx += v * v;
    syy += y[i] * y[i];
    sxy += v * y[i];
  });
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const cos = Math.cos(-theta);
  const sin = Math.sin(-theta);
  x.forEach((v, i) => {
    const w = y[i];
    x[i] = v * cos - w * sin;
    y[i] = v * sin + w * cos;
  });
}

/**
 * Stretches the drawing to the box, the center in the middle: left, right, top and bottom of the
 * center each get their own scale, so a lopsided drawing still fills both halves.
 */
function stretch(x, y) {
  const side = (values, room, cap) => Math.min(room / Math.max(0.5, ...values), cap);
  let left = side(
    x.map(v => -v),
    WIDTH / 2 - PAD_X,
    MAX_UNIT_X,
  );
  let right = side(x, WIDTH / 2 - PAD_X, MAX_UNIT_X);
  let top = side(
    y.map(v => -v),
    HEIGHT / 2 - PAD_Y,
    MAX_UNIT_Y,
  );
  let bottom = side(y, HEIGHT / 2 - PAD_Y, MAX_UNIT_Y);
  [left, right] = [Math.min(left, right * MAX_SIDES), Math.min(right, left * MAX_SIDES)];
  [top, bottom] = [Math.min(top, bottom * MAX_SIDES), Math.min(bottom, top * MAX_SIDES)];
  const sx = Math.min(left, right);
  const sy = Math.min(top, bottom);
  const wide = Math.min(1, (sy * MAX_STRETCH) / sx);
  const tall = Math.min(1, (sx * MAX_STRETCH) / sy);

  return {
    px: x.map(v => WIDTH / 2 + v * (v < 0 ? left : right) * wide),
    py: y.map(v => HEIGHT / 2 + v * (v < 0 ? top : bottom) * tall),
  };
}

/**
 * Pushes two nodes apart when they overlap (an ellipse around each: labels are wide); the
 * center does not move. Says whether they did.
 */
function pushPair(px, py, radius, i, j, centerIndex) {
  const ex = px[j] - px[i];
  const ey = py[j] - py[i];
  const q = Math.sqrt(
    (ex / (radius[i] + radius[j] + 52)) ** 2 + (ey / (radius[i] + radius[j] + 26)) ** 2,
  );
  if (q >= 1) return false;
  // Two nodes on the same spot: a fixed direction, so the result stays the same every time.
  const [ux, uy] = q > 1e-6 ? [ex / q, ey / q] : [(i + j) % 2 ? 0.7 : -0.7, 0.7];
  const wi = i === centerIndex ? 0 : 1;
  const wj = j === centerIndex ? 0 : 1;
  const push = ((1 - q) / 2 + 0.01) * (2 / (wi + wj || 1));
  px[i] -= ux * push * wi;
  py[i] -= uy * push * wi;
  px[j] += ux * push * wj;
  py[j] += uy * push * wj;

  return true;
}

/** Pushes overlapping nodes apart until none overlap (or 80 passes), keeping them in the box. */
function separate(px, py, radius, centerIndex) {
  const n = px.length;

  for (let pass = 0; pass < 80; pass += 1) {
    let moved = false;

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        moved = pushPair(px, py, radius, i, j, centerIndex) || moved;
      }
    }

    px.forEach((_, i) => {
      if (i === centerIndex) return;
      px[i] = Math.max(radius[i] + 12, Math.min(WIDTH - radius[i] - 12, px[i]));
      py[i] = Math.max(radius[i] + 12, Math.min(HEIGHT - radius[i] - 12, py[i]));
    });
    if (!moved) return;
  }
}

const overlap = (a, b) =>
  Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) *
  Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));

const outside = box =>
  (Math.max(0, -box.x1) + Math.max(0, box.x2 - WIDTH)) * (box.y2 - box.y1) +
  (Math.max(0, -box.y1) + Math.max(0, box.y2 - HEIGHT)) * (box.x2 - box.x1);

/** The four places a label can go, best first when nothing is in the way. */
function labelSpots(cx, cy, r, size) {
  const { w, h } = size;
  const g = LABEL_GAP;

  return [
    {
      la: 'below',
      lx: cx,
      ly: cy + r + g,
      box: { x1: cx - w / 2, x2: cx + w / 2, y1: cy + r + g, y2: cy + r + g + h },
    },
    {
      la: 'above',
      lx: cx,
      ly: cy - r - g,
      box: { x1: cx - w / 2, x2: cx + w / 2, y1: cy - r - g - h, y2: cy - r - g },
    },
    {
      la: 'right',
      lx: cx + r + g,
      ly: cy,
      box: { x1: cx + r + g, x2: cx + r + g + w, y1: cy - h / 2, y2: cy + h / 2 },
    },
    {
      la: 'left',
      lx: cx - r - g,
      ly: cy,
      box: { x1: cx - r - g - w, x2: cx - r - g, y1: cy - h / 2, y2: cy + h / 2 },
    },
  ];
}

/** Each label where it covers the least of the labels already placed and of the nodes. */
function placeLabels(nodes, px, py, radius, degree, center) {
  const nodeBoxes = nodes.map((_, i) => ({
    x1: px[i] - radius[i] - 3,
    x2: px[i] + radius[i] + 3,
    y1: py[i] - radius[i] - 3,
    y2: py[i] + radius[i] + 3,
  }));
  const placed = [];
  const spots = new Array(nodes.length);
  const order = nodes
    .map((n, i) => i)
    .sort(
      (a, b) =>
        Number(nodes[b].id === center) - Number(nodes[a].id === center) ||
        degree[b] - degree[a] ||
        a - b,
    );
  order.forEach(i => {
    const size = labelSize(nodes[i], center);
    let best = null;
    labelSpots(px[i], py[i], radius[i], size).forEach((spot, rank) => {
      const cost =
        3 * placed.reduce((s, b) => s + overlap(spot.box, b), 0) +
        2 * nodeBoxes.reduce((s, b, j) => s + (j === i ? 0 : overlap(spot.box, b)), 0) +
        4 * outside(spot.box) +
        rank * 30;
      if (!best || cost < best.cost) best = { ...spot, cost };
    });
    placed.push(best.box);
    spots[i] = best;
  });

  return spots;
}

/** Each money edge's amount where it covers the least of the labels, nodes and other amounts. */
function placeAmounts(edges, index, px, py, radius, spots) {
  const taken = spots.map(s => s.box);
  const nodeBoxes = px.map((x, i) => ({
    x1: x - radius[i],
    x2: x + radius[i],
    y1: py[i] - radius[i],
    y2: py[i] + radius[i],
  }));

  return edges.map(e => {
    const i = index.get(e.from);
    const j = index.get(e.to);
    if (!MONEY.has(e.kind) || i === undefined || j === undefined) return e;
    const text = String(e.label || '').split(' · ')[0];
    const w = text.length * GLYPH * AMOUNT_FONT + 6;
    const h = AMOUNT_FONT * LINE;
    let best = null;
    AMOUNT_SPOTS.forEach((t, rank) => {
      const x = px[i] + (px[j] - px[i]) * t;
      const y = py[i] + (py[j] - py[i]) * t;
      const box = { x1: x - w / 2, x2: x + w / 2, y1: y - h / 2, y2: y + h / 2 };
      const cost =
        3 * taken.reduce((sum, b) => sum + overlap(box, b), 0) +
        2 * nodeBoxes.reduce((sum, b) => sum + overlap(box, b), 0) +
        rank * 20;
      if (!best || cost < best.cost) best = { t, box, cost };
    });
    taken.push(best.box);

    return { ...e, t: best.t };
  });
}

/** The graph with coordinates on each node (see the header). */
function layoutNetwork(graph) {
  const { nodes, edges, center } = graph;
  const layout = { width: WIDTH, height: HEIGHT };
  if (!nodes.length) return { ...graph, layout };
  const index = new Map<any, number>(nodes.map((n, i) => [n.id, i]));
  const adjacency = nodes.map(() => []);
  const seen = new Set();
  const pairs = [];
  edges.forEach(e => {
    const i = index.get(e.from);
    const j = index.get(e.to);
    const key = i < j ? `${i}|${j}` : `${j}|${i}`;
    if (i === undefined || j === undefined || i === j || seen.has(key)) return;
    seen.add(key);
    pairs.push([i, j]);
    adjacency[i].push(j);
    adjacency[j].push(i);
  });
  const centerIndex = index.has(center) ? index.get(center) : 0;
  const rand = seeded(String(center || nodes[0].id));
  const hop = hopsFrom(centerIndex, adjacency);
  const { x, y } = ringStart(hop, adjacency, rand);
  relax(x, y, hop, pairs, centerIndex);
  turnFlat(x, y);
  const { px, py } = stretch(x, y);
  const radius = nodes.map(n => radiusOf(n, center));
  separate(px, py, radius, centerIndex);
  const spots = placeLabels(
    nodes,
    px,
    py,
    radius,
    adjacency.map(a => a.length),
    center,
  );
  const round = v => Math.round(v);

  return {
    ...graph,
    layout,
    edges: placeAmounts(edges, index, px, py, radius, spots),
    nodes: nodes.map((n, i) => ({
      ...n,
      x: round(px[i]),
      y: round(py[i]),
      lx: round(spots[i].lx),
      ly: round(spots[i].ly),
      la: spots[i].la,
    })),
  };
}

export { HEIGHT, WIDTH, labelLines, labelSize, layoutNetwork, radiusOf };
