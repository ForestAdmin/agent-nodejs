![](../../assets/smart-chart-bar.png)

This second example shows how you can achieve any format of charts, as you can benefit from external libraries like D3js.

{% tabs %} {% tab title="Agent" %}

```javascript
agent.addChart('alphabetFrequency', async (context, resultBuilder) => {
  // You may want to load that data dynamically
  // [...]

  return resultBuilder.smart([
    { name: 'E', value: 0.12702 },
    { name: 'T', value: 0.09056 },
    { name: 'A', value: 0.08167 },
    { name: 'O', value: 0.07507 },
    { name: 'I', value: 0.06966 },
    { name: 'N', value: 0.06749 },
    { name: 'S', value: 0.06327 },
    { name: 'H', value: 0.06094 },
    { name: 'R', value: 0.05987 },
    { name: 'D', value: 0.04253 },
    { name: 'L', value: 0.04025 },
    { name: 'C', value: 0.02782 },
    { name: 'U', value: 0.02758 },
    { name: 'M', value: 0.02406 },
    { name: 'W', value: 0.0236 },
    { name: 'F', value: 0.02288 },
    { name: 'G', value: 0.02015 },
    { name: 'Y', value: 0.01974 },
    { name: 'P', value: 0.01929 },
    { name: 'B', value: 0.01492 },
    // [...]
  ]);
);
```

{% endtab %} {% tab title="Component" %}

```javascript
import Component from '@glimmer/component';
import { loadExternalJavascript } from 'client/utils/smart-view-utils';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

// Settings
const color = 'steelblue';
const height = 500;
const width = 800;
const margin = { top: 30, right: 0, bottom: 30, left: 40 };

// Component
export default class extends Component {
  @service lianaServerFetch;
  @tracked chart;

  constructor(...args) {
    super(...args);
    this.load();
  }

  async load() {
    // Load charting library
    await loadExternalJavascript('https://d3js.org/d3.v6.min.js');

    // Load data from agent
    const response = await this.lianaServerFetch.fetch('/forest/_charts/alphabetFrequency', {});
    const alphabet = await response.json();

    // Render chart
    this.renderChart(alphabet);
  }

  @action
  async renderChart(alphabet) {
    const data = Object.assign(
      alphabet.sort((a, b) => d3.descending(a.value, b.value)),
      { format: '%', y: '↑ Frequency' },
    );

    const x = d3
      .scaleBand()
      .domain(d3.range(data.length))
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.value)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const xAxis = g =>
      g.attr('transform', `translate(0,${height - margin.bottom})`).call(
        d3
          .axisBottom(x)
          .tickFormat(i => data[i].username)
          .tickSizeOuter(0),
      );

    const yAxis = g =>
      g
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(null, data.format))
        .call(g => g.select('.domain').remove())
        .call(g =>
          g
            .append('text')
            .attr('x', -margin.left)
            .attr('y', 10)
            .attr('fill', 'currentColor')
            .attr('text-anchor', 'start')
            .text(data.y),
        );

    const svg = d3.create('svg').attr('viewBox', [0, 0, width, height]);

    svg
      .append('g')
      .attr('fill', color)
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d, i) => x(i))
      .attr('y', d => y(d.value))
      .attr('height', d => y(0) - y(d.value))
      .attr('width', x.bandwidth());

    svg.append('g').call(xAxis);
    svg.append('g').call(yAxis);

    this.chart = svg.node();
  }
}
```

{% endtab %} {% tab title="Template" %}

```handlebars
<div class='c-smart-view'>{{this.chart}}</div>
```

{% endtab %} {% endtabs %}

In the above snippet, notice how we import the **D3js** library. Of course, you can choose to use any other library of your choice.

{% hint style="info" %}
This bar chart is inspired by [this one](https://observablehq.com/@d3/bar-chart).
{% endhint %}

The resulting chart can be resized to fit your use.
